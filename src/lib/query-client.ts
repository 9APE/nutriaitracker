/**
 * Single QueryClient with localStorage persistence.
 *
 * React Query is the source of truth for all server data (meals, goals,
 * profile). The cache is mirrored to localStorage purely as a *cold-start
 * accelerator*  it's revalidated against Supabase on mount, never trusted
 * as authoritative. This replaces the old hand-rolled `cloud-state-sync`.
 */
import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24, // keep cached data 24h for offline cold starts
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: { retry: 0 },
  },
});

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "nouri:rq-cache",
  throttleTime: 1000,
});

if (typeof window !== "undefined") {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // discard cache older than 24h
    // Bust persisted cache when app version changes
    buster: "v1",
  });
}

/** Query key namespaces  keep stable so invalidation works app-wide. */
export const qk = {
  meals: (userId: string | null | undefined) => ["meals", userId] as const,
  goals: (userId: string | null | undefined) => ["goals", userId] as const,
  profile: (userId: string | null | undefined) => ["profile", userId] as const,
};
