import { SlackClient } from "./slack-client.js";
import { EventDispatcher } from "./dispatcher.js";
import {
  saveState as writeStateFile,
  clearState as clearStateFile,
  DEFAULT_STATE_FILE,
} from "./daemon-state.js";

const PING_INTERVAL_MS = 20000;
const IDLE_TIMEOUT_MS = 60000;
const CHANNELS_CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_PAGE_SIZE = 100;
const HEALTH_CHECK_INTERVAL_MS = 30 * 1000;
const WS_DOWN_ALERT_THRESHOLD_MS = 2 * 60 * 1000;
const API_FAILURE_ALERT_THRESHOLD_MS = 2 * 60 * 1000;

const AUTH_REJECTED_RECONNECT_MS = 5 * 60 * 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const AUTH_REJECTED_ERRORS = [
  "invalid_auth",
  "token_revoked",
  "token_expired",
  "account_inactive",
  "not_authed",
];

function isAuthRejected(message) {
  return AUTH_REJECTED_ERRORS.some((code) => String(message).includes(code));
}

const MODE = { CONNECTING: "connecting", SOCKET: "socket" };

export class SocketListener {
  constructor({
    client = new SlackClient(),
    dispatcher = new EventDispatcher(),
    idleTimeoutMs = IDLE_TIMEOUT_MS,
    pingIntervalMs = PING_INTERVAL_MS,
    stateFile = DEFAULT_STATE_FILE,
  } = {}) {
    this.client = client;
    this.dispatcher = dispatcher;
    this.idleTimeoutMs = idleTimeoutMs;
    this.pingIntervalMs = pingIntervalMs;
    this.stateFile = stateFile;

    this.running = false;
    this.mode = MODE.CONNECTING;
    this.ws = null;
    this.connecting = false;
    this.wsAttempts = 0;
    this.wsReconnectDelay = 1000;
    this.wsReconnectTimer = null;

    this.pingTimer = null;
    this.watchdogTimer = null;

    this.lastCheckedTs = (Date.now() / 1000).toFixed(6);
    this.hadSocketBefore = false;
    this.channelsCache = null;
    this.channelsCacheAt = 0;

    this.startedAt = null;
    this.lastEventAt = null;
    this.eventsDispatched = 0;

    this.wsDownSince = null;
    this.apiFailureStreakSince = null;
    this.alertActive = false;
    this.alertInFlight = false;
    this.authRejected = false;
    this.healthCheckTimer = null;
  }

  log(msg) {
    console.log(`[${new Date().toISOString()}] [slack-router] ${msg}`);
  }

  warn(msg) {
    console.warn(`[${new Date().toISOString()}] [slack-router] ${msg}`);
  }

  error(msg) {
    console.error(`[${new Date().toISOString()}] [slack-router] ${msg}`);
  }

  saveState() {
    writeStateFile(
      {
        pid: process.pid,
        running: this.running,
        startedAt: this.startedAt,
        mode: this.mode,
        lastEventAt: this.lastEventAt,
        eventsDispatched: this.eventsDispatched,
        updatedAt: new Date().toISOString(),
      },
      this.stateFile,
    );
  }

  recordDispatchedEvent() {
    this.eventsDispatched += 1;
    this.lastEventAt = new Date().toISOString();
    this.saveState();
  }

  async start() {
    this.running = true;
    this.startedAt = new Date().toISOString();

    if (!this.client.config.appToken && !this.client.config.xoxcToken && !this.client.config.xoxpToken) {
      throw new Error(
        "No Slack token configured: set appToken, xoxcToken + cookieD, or xoxpToken with `slack config`.",
      );
    }

    const auth = await this.client.authTest();
    this.dispatcher.setMyUserId(auth.user_id);
    this.dispatcher.setTeamId(auth.team_id);
    this.log(`Authenticated as ${auth.user} (${auth.user_id}) on team ${auth.team}`);

    this.healthCheckTimer = setInterval(() => this.evaluateHealth(), HEALTH_CHECK_INTERVAL_MS);

    if (this.client.config.appToken) {
      this.log("Starting in Socket Mode (WebSocket)...");
      this.saveState();
      await this.startSocketMode();
    } else {
      this.log("No SLACK_APP_TOKEN found. Starting in User-Session WebSocket mode (rtm.connect)...");
      this.saveState();
      await this.connectUserSessionSocket();
    }
  }

  async startSocketMode() {
    let reconnectDelay = 1000;

    const connect = async () => {
      if (!this.running) return;

      try {
        const wssUrl = await this.client.openSocketConnection();
        this.ws = new WebSocket(wssUrl);

        this.ws.onopen = () => {
          this.log("WebSocket connection established.");
          reconnectDelay = 1000;
        };

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.envelope_id) {
              this.ws.send(JSON.stringify({ envelope_id: data.envelope_id }));
            }

            if (data.type === "events_api" && data.payload && data.payload.event) {
              const res = await this.dispatcher.dispatch(data.payload.event);
              if (res.routed) {
                this.log(`Event routed to ${res.targetAgent} (${res.type})`);
              }
            }
          } catch (err) {
            this.error(`Error processing WebSocket message: ${err.message}`);
          }
        };

        this.ws.onclose = () => {
          if (!this.running) return;
          this.warn(`WebSocket closed. Reconnecting in ${reconnectDelay}ms...`);
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        };

        this.ws.onerror = (err) => {
          this.error(`WebSocket error: ${err.message || err}`);
        };
      } catch (err) {
        this.error(`Failed to open WebSocket: ${err.message}. Retrying...`);
        if (this.running) {
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        }
      }
    };

    await connect();
  }

  advanceLastCheckedTs(ts) {
    if (ts && parseFloat(ts) > parseFloat(this.lastCheckedTs)) {
      this.lastCheckedTs = ts;
    }
  }

  clearWsTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  detachSocket(ws) {
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    try {
      ws.close();
    } catch {}
  }

  scheduleReconnect(delayMs) {
    if (this.wsReconnectTimer) return;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectUserSessionSocket();
    }, delayMs);
  }

  enterSocketMode() {
    this.wsAttempts = 0;
    this.wsReconnectDelay = 1000;
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    this.wsDownSince = null;
    this.apiFailureStreakSince = null;
    this.authRejected = false;
    this.mode = MODE.SOCKET;
    this.log("WebSocket confirmed (hello).");

    this.saveState();
    this.evaluateHealth();
  }

  evaluateHealth() {
    if (!this.running) return;

    const now = Date.now();
    const wsDownMs = this.wsDownSince ? now - this.wsDownSince : 0;
    const apiFailingMs = this.apiFailureStreakSince ? now - this.apiFailureStreakSince : 0;
    const wsDownTooLong = wsDownMs > WS_DOWN_ALERT_THRESHOLD_MS;
    const apiFailingTooLong = apiFailingMs > API_FAILURE_ALERT_THRESHOLD_MS;
    const unhealthy = wsDownTooLong || apiFailingTooLong;

    if (this.alertInFlight) return;
    if (unhealthy && !this.alertActive) {
      const reasons = [];
      if (this.authRejected)
        reasons.push(
          'Slack rejected the session token (invalid_auth) - refresh it with `slack config xoxcToken="xoxc-..." cookieD="xoxd-..."`',
        );
      if (wsDownTooLong) reasons.push(`WebSocket has been down for ${Math.round(wsDownMs / 1000)}s`);
      if (apiFailingTooLong)
        reasons.push(`Slack API calls have been failing for ${Math.round(apiFailingMs / 1000)}s`);
      this.sendHealthAlert(`Slack daemon is unhealthy: ${reasons.join("; ")}.`, true);
    } else if (!unhealthy && this.alertActive) {
      this.sendHealthAlert("Slack daemon has recovered and is healthy again.", false);
    }
  }

  async sendHealthAlert(message, nextActiveState) {
    this.alertInFlight = true;
    try {
      const res = await this.dispatcher.notifyCoordinator(this.dispatcher.renderHealthAlert(message));
      if (res.routed) {
        this.alertActive = nextActiveState;
        this.warn(`Health alert sent to ${res.targetAgent}: ${message}`);
      } else {
        this.warn(`Health alert not delivered (${res.reason || "send failed"}), will retry: ${message}`);
      }
    } catch (err) {
      this.error(`Failed to send health alert, will retry: ${err.message}`);
    } finally {
      this.alertInFlight = false;
    }
  }

  registerWsFailureBeforeHello(reason, retryAfter) {
    this.wsAttempts += 1;
    if (isAuthRejected(reason)) this.authRejected = true;
    let backoffMs = retryAfter ? Math.max(this.wsReconnectDelay, retryAfter * 1000) : this.wsReconnectDelay;
    if (this.authRejected) backoffMs = AUTH_REJECTED_RECONNECT_MS;
    this.error(
      `Failed to establish user-session WebSocket (attempt ${this.wsAttempts}), retrying in ${backoffMs}ms: ${reason}`,
    );

    if (this.running) {
      this.scheduleReconnect(backoffMs);
      this.wsReconnectDelay = Math.min(this.wsReconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    }
  }

  async connectUserSessionSocket() {
    if (!this.running || this.connecting || this.ws || this.wsReconnectTimer) return;
    this.connecting = true;

    let ws;
    let helloReceived = false;
    let lastMessageAt = Date.now();

    const onSocketGone = (reason) => {
      if (this.ws === ws) this.ws = null;
      if (!this.wsDownSince) this.wsDownSince = Date.now();
      this.clearWsTimers();
      this.connecting = false;
      if (!this.running) return;

      if (!helloReceived) {
        this.registerWsFailureBeforeHello(reason);
        return;
      }

      this.warn(`User-session WebSocket closed. Reconnecting in ${this.wsReconnectDelay}ms...`);
      this.scheduleReconnect(this.wsReconnectDelay);
      this.wsReconnectDelay = Math.min(this.wsReconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
    };

    try {
      const { url, headers, selfId } = await this.client.openUserSessionSocket();
      this.apiFailureStreakSince = null;
      if (!this.running) {
        this.connecting = false;
        return;
      }

      ws = new WebSocket(url, { headers });
      this.ws = ws;

      this.watchdogTimer = setInterval(() => {
        if (this.ws === ws && Date.now() - lastMessageAt > this.idleTimeoutMs) {
          this.warn(
            `No message/handshake from Slack in ${this.idleTimeoutMs / 1000}s. Treating connection as dead.`,
          );
          this.detachSocket(ws);
          onSocketGone("watchdog timeout");
        }
      }, 10000);

      ws.onopen = () => {
        if (this.ws !== ws) return;
        lastMessageAt = Date.now();
        let pingId = 0;
        this.pingTimer = setInterval(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", id: ++pingId }));
          }
        }, this.pingIntervalMs);
      };

      ws.onmessage = async (event) => {
        if (this.ws !== ws) return;
        lastMessageAt = Date.now();
        try {
          const data = JSON.parse(event.data);

          if (data.type === "hello") {
            helloReceived = true;
            this.connecting = false;
            this.log("Received hello from Slack RTM gateway.");
            if (selfId) {
              this.dispatcher.setMyUserId(selfId);
            }
            const missedSince = this.hadSocketBefore ? this.lastCheckedTs : null;
            const helloTs = (Date.now() / 1000).toFixed(6);
            this.hadSocketBefore = true;
            this.enterSocketMode();
            if (missedSince) {
              await this.catchUpDirectMessages(missedSince, helloTs);
            }
            return;
          }

          if (data.type === "pong") {
            return;
          }

          if (data.type === "error") {
            this.error(`RTM error: ${JSON.stringify(data.error)}`);
            return;
          }

          if (data.type === "goodbye") {
            this.warn("Received goodbye from Slack RTM gateway. Reconnecting.");
            ws.close();
            return;
          }

          if (data.type === "message") {
            if (selfId && data.user === selfId) {
              return;
            }

            this.advanceLastCheckedTs(data.ts);
            this.recordDispatchedEvent();

            if (!data.channel_type && data.channel?.startsWith("G")) {
              data.channel_type = await this.channelTypeOf(data.channel);
            }
            const res = await this.dispatcher.dispatch(data);
            if (res.routed) {
              this.log(`Event routed to ${res.targetAgent} (${res.type})`);
            }
          }
        } catch (err) {
          this.error(`Error processing WebSocket message: ${err.message}`);
        }
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        onSocketGone("WebSocket closed before hello");
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return;
        this.error(`User-session WebSocket error: ${err.message || err}`);
      };
    } catch (err) {
      this.connecting = false;
      if (!this.wsDownSince) this.wsDownSince = Date.now();
      if (!this.apiFailureStreakSince) this.apiFailureStreakSince = Date.now();
      this.registerWsFailureBeforeHello(err.message, err.retryAfter);
    }
  }

  async channelTypeOf(channel) {
    if (!channel || !channel.startsWith("G")) return undefined;
    this.channelTypes = this.channelTypes || new Map();
    if (!this.channelTypes.has(channel)) {
      try {
        const { channel: info } = await this.client.call("conversations.info", { channel });
        this.channelTypes.set(channel, info.is_mpim ? "mpim" : info.is_im ? "im" : "group");
      } catch (err) {
        this.warn(`Could not tell what kind of conversation ${channel} is: ${err.message}`);
        return undefined;
      }
    }
    return this.channelTypes.get(channel);
  }

  async getCachedImChannels() {
    const isStale = !this.channelsCache || Date.now() - this.channelsCacheAt > CHANNELS_CACHE_TTL_MS;

    if (isStale) {
      const imList = await this.client.listChannels({ types: "im,mpim", limit: 20 });
      this.channelsCache = imList.channels || [];
      this.channelsCacheAt = Date.now();
    }

    return this.channelsCache;
  }

  async fetchMissedDirectMessages(oldest, label, latest = undefined) {
    const channels = await this.getCachedImChannels();
    let newestTs = oldest;

    for (const ch of channels) {
      try {
        const hist = await this.client.getHistory({
          channel: ch.id,
          oldest,
          latest,
          limit: HISTORY_PAGE_SIZE,
        });

        const messages = (hist.messages || []).reverse();
        for (const msg of messages) {
          if (parseFloat(msg.ts) > parseFloat(newestTs)) newestTs = msg.ts;
          this.recordDispatchedEvent();

          msg.channel = ch.id;
          msg.channel_type = ch.is_mpim ? "mpim" : "im";
          const res = await this.dispatcher.dispatch(msg);
          if (res.routed) {
            this.log(`${label} routed to ${res.targetAgent} (${res.type})`);
          }
        }
      } catch (err) {
        throw new Error(`Reading DM history of ${ch.id} failed: ${err.message}`, { cause: err });
      }
    }

    this.advanceLastCheckedTs(newestTs);
    return channels.length;
  }

  async catchUpDirectMessages(oldest, latest) {
    try {
      await this.fetchMissedDirectMessages(oldest, "Missed DM", latest);
    } catch (err) {
      if (!this.apiFailureStreakSince) this.apiFailureStreakSince = Date.now();
      this.error(`Catch-up of DMs missed while the socket was down failed: ${err.message}`);
    }
  }

  stop() {
    this.running = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.clearWsTimers();
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    clearStateFile(this.stateFile);
    this.log("Listener stopped.");
  }
}
