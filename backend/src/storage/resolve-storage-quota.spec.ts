import { resolveStorageQuotaBytes, StorageQuotaInput } from './resolve-storage-quota';

describe('resolveStorageQuotaBytes', () => {
  const GB = 1024n * 1024n * 1024n;
  const fallback = 100n * 1024n * 1024n; // 100 MB

  it('returns org override when present', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: 500n * GB,
      subscriptionMaxStorageGb: 200,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(500n * GB);
  });

  it('returns subscription quota when org override is null', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: null,
      subscriptionMaxStorageGb: 200,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(200n * GB);
  });

  it('returns env fallback when both are null', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: null,
      subscriptionMaxStorageGb: null,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(fallback);
  });

  it('skips org override of 0', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: 0n,
      subscriptionMaxStorageGb: 50,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(50n * GB);
  });

  it('skips subscription of 0', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: null,
      subscriptionMaxStorageGb: 0,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(fallback);
  });

  it('floors fractional GB from subscription', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: null,
      subscriptionMaxStorageGb: 1.5,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(1n * GB);
  });

  it('converts 200 GB correctly', () => {
    const result = resolveStorageQuotaBytes({
      orgStorageQuotaBytes: null,
      subscriptionMaxStorageGb: 200,
      envFallbackBytes: fallback,
    });
    expect(result).toBe(214748364800n);
  });
});
