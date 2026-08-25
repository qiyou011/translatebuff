export function classifyChangedFiles(
  changed: string[],
  allowlist: string[],
): { violations: string[] }

export function resolveSyncBase(
  git: (args: string[]) => string,
  baseRef: string,
  explicitBase?: string,
): string
