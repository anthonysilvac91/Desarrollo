export const AUTO_REFETCH_INTERVALS = {
  fast: 5000,
  detail: 10000,
  dashboard: 15000,
} as const;

export const AUTO_REFETCH_OPTIONS = {
  refetchOnWindowFocus: true,
  refetchIntervalInBackground: false,
} as const;
