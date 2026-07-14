import forkBuild from "./fork-build.json"

// 从上游 3 段版本号派生 fork 的 4 段 manifest 版本，保证独立发版单调递增
export function computeForkVersion(pkgVersion: string, forkBuildNumber: number): string {
  const parts = pkgVersion.split(".")
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`意外的上游版本号: ${pkgVersion}`)
  }
  return `${pkgVersion}.${forkBuildNumber}`
}

export function readForkBuildNumber(): number {
  return forkBuild.forkBuildNumber
}
