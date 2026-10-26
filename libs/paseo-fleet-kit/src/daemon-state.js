import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readJsonFile, removeFile, writeJsonFile } from "./json-file.js";

export function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getProcessCommand(pid) {
  if (!pid) return null;
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function createDaemonStateStore({ routerName, processMarker }) {
  const defaultStateFile = path.join(os.homedir(), ".config", routerName, "daemon-state.json");

  const readState = (stateFile = defaultStateFile) => readJsonFile(stateFile, null);

  const saveState = (state, stateFile = defaultStateFile) => {
    try {
      writeJsonFile(stateFile, state);
    } catch {}
  };

  const clearState = (stateFile = defaultStateFile) => removeFile(stateFile);

  const isDaemonProcess = (pid) => {
    if (!isPidAlive(pid)) return false;
    const command = getProcessCommand(pid);
    return Boolean(command && command.includes(processMarker) && command.includes("daemon"));
  };

  const isDaemonRunning = (stateFile = defaultStateFile) => {
    const state = readState(stateFile);
    return state && isDaemonProcess(state.pid) ? state : null;
  };

  return { defaultStateFile, readState, saveState, clearState, isDaemonProcess, isDaemonRunning };
}
