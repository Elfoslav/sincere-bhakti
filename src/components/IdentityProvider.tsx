"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { AuthorableIdentity, InitialIdentityState } from "@/types/identity";

interface IdentityContextValue {
  identities: AuthorableIdentity[];
  activeIdentity: AuthorableIdentity | null;
  activeChannelId: string | null;
  loading: boolean;
  switchIdentity: (channelId: string) => Promise<void>;
  refreshIdentities: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

interface IdentityResponse {
  activeChannelId: string | null;
  identities: AuthorableIdentity[];
}

export function IdentityProvider({
  children,
  initialState = null,
}: {
  children: React.ReactNode;
  initialState?: InitialIdentityState | null;
}) {
  const { data: session, status } = useSession();
  const [identities, setIdentities] = useState<AuthorableIdentity[]>(initialState?.identities ?? []);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialState?.activeChannelId ?? null);
  const [fetchedUserId, setFetchedUserId] = useState<string | null>(initialState?.userId ?? null);
  const [switching, setSwitching] = useState(false);

  const applyResponse = useCallback((data: IdentityResponse, userId: string) => {
    setIdentities(data.identities);
    setActiveChannelId(data.activeChannelId);
    setFetchedUserId(userId);
  }, []);

  const refreshIdentities = useCallback(async () => {
    const userId = session?.user?.id;
    if (status !== "authenticated" || !userId) return;

    const res = await fetch("/api/identity");
    if (res.ok) applyResponse(await res.json(), userId);
  }, [applyResponse, session?.user?.id, status]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (status !== "authenticated" || !userId) return;

    let cancelled = false;
    fetch("/api/identity")
      .then((res) => res.ok ? res.json() as Promise<IdentityResponse> : null)
      .then((data) => {
        if (data && !cancelled) applyResponse(data, userId);
      })
      .catch(() => {
        // Keep the current identity state if refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [applyResponse, session?.user?.id, status]);

  const switchIdentity = useCallback(async (channelId: string) => {
    const previous = activeChannelId;
    const userId = session?.user?.id;
    if (!userId) throw new Error("identity_switch_failed");
    setActiveChannelId(channelId);
    setSwitching(true);
    try {
      const res = await fetch("/api/identity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        setActiveChannelId(previous);
        throw new Error("identity_switch_failed");
      }
      applyResponse(await res.json(), userId);
    } catch (error) {
      setActiveChannelId(previous);
      throw error;
    } finally {
      setSwitching(false);
    }
  }, [activeChannelId, applyResponse, session?.user?.id]);

  const visibleIdentities = useMemo(
    () => fetchedUserId === session?.user?.id ? identities : [],
    [fetchedUserId, identities, session?.user?.id],
  );
  const visibleActiveChannelId = fetchedUserId === session?.user?.id ? activeChannelId : null;

  const activeIdentity = useMemo(
    () => visibleIdentities.find((identity) => identity.id === visibleActiveChannelId) ?? null,
    [visibleActiveChannelId, visibleIdentities],
  );

  const value = useMemo(() => ({
    identities: visibleIdentities,
    activeIdentity,
    activeChannelId: visibleActiveChannelId,
    loading: switching,
    switchIdentity,
    refreshIdentities,
  }), [activeIdentity, refreshIdentities, switchIdentity, switching, visibleActiveChannelId, visibleIdentities]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error("useIdentity must be used within IdentityProvider");
  }
  return context;
}
