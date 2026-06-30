import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { storage } from "./utils/storage";

type Branch = { id: string; name: string; code?: string };

type BranchCtx = {
  branches: Branch[];
  activeBranchId: string | null;
  activeBranch: Branch | null;
  setActiveBranchId: (id: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<BranchCtx>({} as any);
const STORAGE_KEY = "opticrm_active_branch";

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, _setActiveBranchId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setBranches([]); return; }
    try {
      const list = await api("/branches");
      setBranches(list || []);
    } catch { /* offline-ok */ }
  }, [user]);

  // Load persisted branch + branches on auth change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        _setActiveBranchId(null);
        setBranches([]);
        return;
      }
      const saved = await storage.getItem(STORAGE_KEY + ":" + user.id, "" as string);
      if (!cancelled) _setActiveBranchId(saved || null);
      await refresh();
    })();
    return () => { cancelled = true; };
  }, [user, refresh]);

  const setActiveBranchId = useCallback(async (id: string | null) => {
    _setActiveBranchId(id);
    if (user) {
      if (id) await storage.setItem(STORAGE_KEY + ":" + user.id, id);
      else await storage.removeItem(STORAGE_KEY + ":" + user.id);
    }
  }, [user]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) || null,
    [branches, activeBranchId]
  );

  return (
    <Ctx.Provider value={{ branches, activeBranchId, activeBranch, setActiveBranchId, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBranch = () => useContext(Ctx);
