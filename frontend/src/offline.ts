// Offline-first network helpers
// - Caches GET responses in AsyncStorage
// - Queues mutations (POST/PUT/DELETE) when offline; replays on reconnect

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

const QUEUE_KEY = "opticrm_offline_queue";
const CACHE_PREFIX = "opticrm_cache:";

export type QueuedRequest = {
  id: string;
  path: string;
  method: string;
  body?: any;
  ts: number;
};

export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return !!(s.isConnected && s.isInternetReachable !== false);
  } catch {
    return true; // optimistic
  }
}

export async function readCache<T = any>(path: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(CACHE_PREFIX + path);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function writeCache(path: string, data: any) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
  } catch {}
}

export async function queueMutation(req: Omit<QueuedRequest, "id" | "ts">) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const list: QueuedRequest[] = raw ? JSON.parse(raw) : [];
    list.push({ ...req, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ts: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {}
}

export async function getQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearQueueItem(id: string) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const list: QueuedRequest[] = JSON.parse(raw);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list.filter((x) => x.id !== id)));
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
