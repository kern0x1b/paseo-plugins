import { createDaemonStateStore, getProcessCommand, isPidAlive } from 'paseo-fleet-kit';

const store = createDaemonStateStore({ routerName: 'slack-router', processMarker: 'slack' });

export const DEFAULT_STATE_FILE = store.defaultStateFile;
export const { readState, saveState, clearState, isDaemonProcess, isDaemonRunning } = store;
export { getProcessCommand, isPidAlive };
