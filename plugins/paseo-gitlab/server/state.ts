import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function stateDir(): string {
  const base = process.env.XDG_STATE_HOME?.trim() || join(homedir(), ".local", "state");
  return join(base, "paseo-gitlab");
}

function configFile(): string {
  return join(stateDir(), "config.json");
}

interface Accounts {
  hosts: string[];
  active: string | null;
}

function readStateJson(path: string): unknown {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${(err as Error).message}`);
  }
}

export function readAccounts(): Accounts {
  const content = readStateJson(configFile());
  if (content === undefined) {
    return { hosts: [], active: null };
  }
  const parsed = content as {
    host?: unknown;
    hosts?: unknown;
    active?: unknown;
  };
  const hosts = Array.isArray(parsed.hosts)
    ? parsed.hosts.filter((host): host is string => typeof host === "string")
    : typeof parsed.host === "string"
      ? [parsed.host]
      : [];
  const active =
    typeof parsed.active === "string" && hosts.includes(parsed.active) ? parsed.active : (hosts[0] ?? null);
  return { hosts, active };
}

function writeAccounts(accounts: Accounts): void {
  mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  const path = configFile();
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(accounts), { mode: 0o600 });
  renameSync(temporary, path);
}

const requestAccount = new AsyncLocalStorage<string>();

export function withAccount<T>(host: string | undefined, work: () => T): T {
  return host ? requestAccount.run(host, work) : work();
}

export function readHost(): string | null {
  return requestAccount.getStore() ?? readAccounts().active;
}

export function writeHost(host: string): void {
  const { hosts } = readAccounts();
  writeAccounts({ hosts: hosts.includes(host) ? hosts : [...hosts, host], active: host });
}

export function clearHost(): void {
  const current = readHost();
  const { hosts, active } = readAccounts();
  const rest = hosts.filter((host) => host !== current);
  if (rest.length === 0) {
    rmSync(configFile(), { force: true });
    return;
  }
  writeAccounts({ hosts: rest, active: active && rest.includes(active) ? active : rest[0]! });
}

function queriesFile(): string {
  return join(stateDir(), "queries.json");
}

export function readSavedQueries<T>(): T[] {
  const content = readStateJson(queriesFile());
  if (content === undefined) {
    return [];
  }
  const parsed = content as { queries?: unknown };
  if (!Array.isArray(parsed.queries)) {
    throw new Error(`${queriesFile()} has no queries list.`);
  }
  return parsed.queries as T[];
}

export function writeSavedQueries<T>(queries: T[]): void {
  mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  const path = queriesFile();
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ queries }), { mode: 0o600 });
  renameSync(temporary, path);
}
