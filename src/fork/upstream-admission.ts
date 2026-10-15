import { isBuiltInActionId } from "@/utils/constants/custom-action"

// 产品准入不写回用户设置：有效能力是本表与用户原配置、既有服务条件的交集。
export const FORK_UPSTREAM_ADMISSION = Object.freeze({
  localGlossary: true,
  cloudServices: false,
  googleDrive: false,
  aiTranscription: false,
  noteSuggestion: false,
  learningSidebar: false,
  xSubtitles: false,
  netflixSubtitles: false,
})

export const APPROVED_BUILT_IN_ACTION_IDS: readonly string[] = Object.freeze(["default-dictionary"])

export function isApprovedBuiltInAction(id: string): boolean {
  return APPROVED_BUILT_IN_ACTION_IDS.includes(id)
}

export function isApprovedCustomAction(id: string): boolean {
  return !isBuiltInActionId(id) || isApprovedBuiltInAction(id)
}

export function isApprovedSubtitlesUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    )
  } catch {
    return false
  }
}
