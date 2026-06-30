import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { isOnline, readCache, writeCache, queueMutation, getQueue, clearQueueItem } from "./offline";

const KEY = "opticrm_token";

export const tokenStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") {
      try { return globalThis.localStorage?.getItem(KEY) ?? null; } catch { return null; }
    }
    return await SecureStore.getItemAsync(KEY);
  },
  async set(token: string) {
    if (Platform.OS === "web") {
      try { globalThis.localStorage?.setItem(KEY, token); } catch {}
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear() {
    if (Platform.OS === "web") {
      try { globalThis.localStorage?.removeItem(KEY); } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function rawFetch(path: string, method: string, body?: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export async function api(
  path: string,
  options: { method?: string; body?: any; auth?: boolean; cache?: boolean } = {}
) {
  const { method = "GET", body, cache = true } = options;
  // GET: try network, fall back to cache when offline
  if (method === "GET") {
    const online = await isOnline();
    if (!online) {
      const cached = await readCache(path);
      if (cached) return cached;
      throw new Error("Offline and no cached data");
    }
    try {
      const data = await rawFetch(path, method);
      if (cache) await writeCache(path, data);
      return data;
    } catch (e) {
      const cached = await readCache(path);
      if (cached) return cached;
      throw e;
    }
  }
  // Mutations
  const online = await isOnline();
  if (!online) {
    await queueMutation({ path, method, body });
    return { queued: true };
  }
  return await rawFetch(path, method, body);
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = await getQueue();
  let flushed = 0, failed = 0;
  for (const q of queue) {
    try {
      await rawFetch(q.path, q.method, q.body);
      await clearQueueItem(q.id);
      flushed++;
    } catch {
      failed++;
    }
  }
  return { flushed, failed };
}

// Prefetch all core data into the offline cache. Called after login and on app resume.
export async function syncAll(): Promise<{ ok: boolean; synced_at?: string; error?: string }> {
  try {
    const online = await isOnline();
    if (!online) return { ok: false, error: "offline" };
    const all = await rawFetch("/sync", "GET");
    // Warm individual GET caches so screens render instantly even when offline.
    await Promise.all([
      writeCache("/dashboard", all.dashboard),
      writeCache("/customers", all.customers),
      writeCache("/inventory", all.inventory),
      writeCache("/orders", all.orders),
      writeCache("/branches", all.branches),
      writeCache("/reminders", all.reminders),
      writeCache("/staff", all.staff || []),
      writeCache("/broadcasts/latest", all.broadcast),
    ]);
    return { ok: true, synced_at: all.synced_at };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sync failed" };
  }
}
