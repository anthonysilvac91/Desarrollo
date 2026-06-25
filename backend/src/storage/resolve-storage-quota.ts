export interface StorageQuotaInput {
  orgStorageQuotaBytes: bigint | null;
  subscriptionMaxStorageGb: number | null;
  envFallbackBytes: bigint;
}

export function resolveStorageQuotaBytes(input: StorageQuotaInput): bigint {
  if (input.orgStorageQuotaBytes != null && input.orgStorageQuotaBytes > 0n) {
    return input.orgStorageQuotaBytes;
  }
  if (input.subscriptionMaxStorageGb != null && input.subscriptionMaxStorageGb > 0) {
    return BigInt(Math.floor(input.subscriptionMaxStorageGb)) * 1024n * 1024n * 1024n;
  }
  return input.envFallbackBytes;
}
