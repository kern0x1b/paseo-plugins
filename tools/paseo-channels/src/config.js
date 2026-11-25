import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FLEET_DIR = path.join(os.homedir(), '.config', 'paseo', 'fleet');
const CONFIG_FILE = path.join(FLEET_DIR, 'config.json');

export function getFleetDir() {
  return FLEET_DIR;
}

export function getConfigPath() {
  return CONFIG_FILE;
}

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`${filePath} is not valid JSON: ${err.message}`);
  }
}

export function ensureFleetDir() {
  if (!fs.existsSync(FLEET_DIR)) {
    fs.mkdirSync(FLEET_DIR, { recursive: true });
  }
}

export function loadConfig() {
  ensureFleetDir();
  if (fs.existsSync(CONFIG_FILE)) return readJson(CONFIG_FILE);
  return {};
}

export function saveConfig(updates) {
  ensureFleetDir();
  const current = loadConfig();
  const merged = { ...current, ...updates };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
