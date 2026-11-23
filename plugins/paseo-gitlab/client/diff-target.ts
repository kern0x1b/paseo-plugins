import { useSyncExternalStore } from "react";
import type { ItemRef } from "../shared/contract";
import { readLocalStore, writeLocalStore } from "./local-store";

const STORAGE_KEY = "paseo-gitlab:diff-targets";

const listeners = new Set<() => void>();
let targets: Record<string, ItemRef> = load();

function load(): Record<string, ItemRef> {
  return readLocalStore<Record<string, ItemRef>>(STORAGE_KEY) ?? {};
}

export function setDiffTarget(workspaceId: string, target: ItemRef): void {
  targets = { ...targets, [workspaceId]: target };
  writeLocalStore(STORAGE_KEY, targets);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDiffTarget(workspaceId: string): ItemRef | null {
  return useSyncExternalStore(
    subscribe,
    () => targets[workspaceId] ?? null,
    () => null,
  );
}
