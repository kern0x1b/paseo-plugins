import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const CONFIG_DIR = path.join(os.homedir(), ".config", "gitlab-router");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getConfigPath() {
  return CONFIG_FILE;
}

export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function getTokenFromKeychain(host) {
  if (process.platform !== "darwin") return null;
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  try {
    const token = execFileSync(
      "security",
      ["find-generic-password", "-a", cleanHost, "-s", "paseo-gitlab", "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
    ).trim();
    return token || null;
  } catch (err) {
    // security exits with 44 when the Keychain holds no such item.
    if (err.status === 44) return null;
    throw new Error(`Could not read the GitLab token from the Keychain: ${err.message}`);
  }
}

export function loadConfig() {
  ensureConfigDir();
  let fileConfig = {};

  if (fs.existsSync(CONFIG_FILE)) {
    const content = fs.readFileSync(CONFIG_FILE, "utf8");
    try {
      fileConfig = JSON.parse(content);
    } catch (err) {
      throw new Error(`${CONFIG_FILE} is not valid JSON: ${err.message}`);
    }
  }

  const host = process.env.GITLAB_HOST || fileConfig.host || "https://gitlab.com";

  const normalizedHost = host.startsWith("http") ? host : `https://${host}`;

  const token = process.env.GITLAB_TOKEN || fileConfig.token || getTokenFromKeychain(normalizedHost) || null;

  return {
    host: normalizedHost,
    token,
    defaultProjectId: process.env.GITLAB_PROJECT_ID
      ? Number(process.env.GITLAB_PROJECT_ID)
      : fileConfig.defaultProjectId || null,
    coordinatorAgentId: fileConfig.coordinatorAgentId || null,
    paseoBin: process.env.PASEO_BIN || fileConfig.paseoBin || "paseo",
    pollIntervalSeconds: fileConfig.pollIntervalSeconds || 120,
    ...fileConfig,
  };
}

export function saveConfig(updates) {
  ensureConfigDir();
  const current = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) : {};
  const merged = { ...current, ...updates };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
