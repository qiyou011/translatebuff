export function findUpstreamDomainHits(bundleText: string, forbidden: string[]): string[]
export function findMissingForkDomains(bundleText: string, required: string[]): string[]
export function readForkDomainsFromEnv(envText: string): string[]
export function readTestDomainsFromEnv(envText: string): string[]

export function checkEditionDomains(
  bundleText: string,
  ownEnvText: string,
  otherEnvText: string,
  localeText?: string,
): { missing: string[]; leaked: string[]; copyLeaked: string[] }

export function findPartnerSiteHits(manifest: {
  host_permissions?: string[]
  content_scripts?: { matches?: string[] }[]
}): string[]
