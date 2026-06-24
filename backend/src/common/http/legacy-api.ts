import type { Response } from 'express';

export const LEGACY_SUNSET = 'Fri, 14 Aug 2026 00:00:00 GMT';

export function markLegacyResponse(res: Response) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', LEGACY_SUNSET);
}

export function legacyRouteDescription(officialRoute: string) {
  return `Ruta legacy. La ruta oficial es ${officialRoute}.`;
}
