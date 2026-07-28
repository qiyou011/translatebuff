import versionConfig from "./fork-version.json"

// 正式发布版本：fork 自主 semver（不继承上游 package.json）。发新版直接改 fork-version.json 的 version。
// manifest version 必须是 3 段数字 semver，非法即抛错，防手滑写坏产物。
export function computeForkVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`意外的 fork 版本号: ${version}`)
  }
  return version
}

// version_name：中文品牌 + 正式版本 + 上游基线溯源，如「任译喵 1.0.0（rf 1.42.2）」。
// 上游 pkgVersion 仅作溯源展示、原样透传、不校验格式——上游若走预发布串（如 1.43.0-beta.1）
// 绝不能拖垮 fork 构建；只有 fork 自己的 version 严格校验（见 computeForkVersion）。
export function computeForkVersionName(
  pkgVersion: string,
  version: string,
  brandName: string,
): string {
  return `${brandName} ${computeForkVersion(version)}（rf ${pkgVersion}）`
}

export function readForkVersion(): string {
  return versionConfig.version
}
