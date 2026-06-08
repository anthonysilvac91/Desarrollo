export const AUTO_REFETCH_INTERVALS = {
  fast: 30000,
  detail: 60000,
  dashboard: 60000,
} as const;

export const AUTO_REFETCH_OPTIONS = {
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
} as const;
