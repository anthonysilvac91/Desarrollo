// SSE (RealtimeQueryInvalidator) handles real-time invalidation for assets, services and users.
// Polling intervals are a fallback for when the SSE connection is briefly down (reconnects in ~3s).
// Dashboard is now covered by SSE too, so all intervals are set to 5 minutes.
export const AUTO_REFETCH_INTERVALS = {
  fast: 120_000,     // was 30s — SSE handles real-time on list pages
  detail: 300_000,   // was 60s — SSE handles real-time on detail views
  dashboard: 300_000, // was 60s — SSE now invalidates dashboard on asset/service events
} as const;

export const AUTO_REFETCH_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
} as const;
