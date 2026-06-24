export function buildOrganizationLogoPath(orgId: string): string {
  return `org/${orgId}/branding/logo`;
}

export function buildUserAvatarPath(orgId: string, userId: string): string {
  return `org/${orgId}/users/${userId}/avatar`;
}

export function buildAssetThumbnailPath(
  orgId: string,
  assetId: string,
): string {
  return `org/${orgId}/assets/${assetId}/thumbnail`;
}

export function buildServiceAttachmentsPath(
  orgId: string,
  serviceId: string,
): string {
  return `org/${orgId}/services/${serviceId}/attachments`;
}

export function buildOwnerLogoPath(orgId: string, ownerId: string): string {
  return `org/${orgId}/owners/${ownerId}/logo`;
}
