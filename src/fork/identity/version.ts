import forkBuild from "./fork-build.json"

// 预发布阶段（正式版发布前）：manifest version 用 fork 自主的 0.0.<forkBuild> 三段版本，
// 不继承上游 package.json 版本号。forkBuild 从 1 起单调递增。
export function computeForkVersion(forkBuildNumber: number): string {
  return `0.0.${forkBuildNumber}`
}

// version_name：中文品牌 + 预发布版本 + 上游基线溯源，如「任译喵 0.0.1（rf 1.40.2）」。
// 保留对上游版本号的 3 段合法性校验，供溯源展示。
export function computeForkVersionName(
  pkgVersion: string,
  forkBuildNumber: number,
  brandName: string,
): string {
  const parts = pkgVersion.split(".")
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`意外的上游版本号: ${pkgVersion}`)
  }
  return `${brandName} ${computeForkVersion(forkBuildNumber)}（rf ${pkgVersion}）`
}

export function readForkBuildNumber(): number {
  return forkBuild.forkBuildNumber
}
