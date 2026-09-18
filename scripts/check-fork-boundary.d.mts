export function classifyChangedFiles(
  changed: string[],
  allowlist: string[],
  divergesFromUpstream?: (file: string) => boolean,
): { violations: string[] }

export function validateSelectivePatches(
  ledger: unknown,
  options: { readFile: (path: string) => string | null; verifySource: (sha: string) => void },
): string[]

export function verifySelectiveSource(
  sha: string,
  git: (args: string[]) => string,
  baselineRefs: string[],
): void

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
