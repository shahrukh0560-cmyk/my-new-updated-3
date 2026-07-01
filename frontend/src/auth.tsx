import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, syncAll } from "./api";

type User = { id: string; email: string; name: string; role: string; owner_id?: string; branch_id?: string | null; google_review_url?: string; business_name?: string; business_address?: string; business_logo_url?: string; currency_symbol?: string };
type AuthCtx = {
  user: User | null;
  loading: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, country?: string) => Promise<void>;
  logout: () => Promise<void>;
  resync: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await syncAll();
      if (r.ok && r.synced_at) setLastSyncedAt(r.synced_at);
    } finally {
      setSyncing(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const token = await tokenStore.get();
      if (!token) { setLoading(false); return; }
      const me = await api("/auth/me");
      setUser(me);
      runSync(); // fire-and-forget warm cache
    } catch {
      await tokenStore.clear();
    } finally {
      setLoading(false);
    }
  }, [runSync]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const res = await api("/auth/login", { method: "POST", body: { email, password }, auth: false });
    await tokenStore.set(res.access_token);
    setUser(res.user);
    runSync();
  };

  const register = async (name: string, email: string, password: string, country?: string) => {
    const res = await api("/auth/register", { method: "POST", body: { name, email, password, country: country || "IN" }, auth: false });
    await tokenStore.set(res.access_token);
    setUser(res.user);
    runSync();
  };

  const logout = async () => {
    await tokenStore.clear();
    setUser(null);
    setLastSyncedAt(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const me = await api("/auth/me");
      setUser(me);
    } catch {}
  }, []);

  return <Ctx.Provider value={{ user, loading, syncing, lastSyncedAt, login, register, logout, resync: runSync, refreshUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
