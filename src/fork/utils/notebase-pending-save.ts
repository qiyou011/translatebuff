import { getWebsiteUrl } from "@/fork/website-url"

// 换皮：上游 src/utils/notebase/pending-save.ts。
// 只覆盖 getNotebaseDetailUrl —— 上游 new URL(path, base) 直拼，在本地预览（localhost）
// 下丢掉官网的 hash 路由前缀，联调 404。其余整体复用上游。
export * from "@/utils/notebase/pending-save"

export function getNotebaseDetailUrl(notebaseId: string) {
  return getWebsiteUrl(`/notebase/${encodeURIComponent(notebaseId)}`)
}
