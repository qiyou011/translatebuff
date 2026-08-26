export function classifyChangedFiles(
  changed: string[],
  allowlist: string[],
  divergesFromUpstream?: (file: string) => boolean,
): { violations: string[] }

export function resolveSyncBase(
  git: (args: string[]) => string,
  baseRef: string,
  explicitBase?: string,
): string

export function resolveUpstreamRef(
  mode: "sync" | "audit" | "incremental",
  base: string,
  baseline: { forkPointSha: string; lastSyncedSha: string },
): string
