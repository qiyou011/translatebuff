import type { Resource } from "i18next"
import { FORK_BRANDING, getForkDisplayName } from "@/fork/branding"
import { resources as upstreamResources } from "@/utils/i18n/resources"

export * from "@/utils/i18n/resources"

// 仅转换打包语言资源中的产品显示名。不改语言引擎、用户输入、配置或占位符。
// 所有语种沿用原有文案；海外中文界面也须保留 TranslateBuff 品牌。
function withEditionBrand(node: unknown): unknown {
  if (typeof node === "string") {
    if (/^https?:\/\//.test(node)) return node
    return node
      .replaceAll(FORK_BRANDING.displayName, getForkDisplayName())
      .replaceAll(FORK_BRANDING.name, getForkDisplayName())
  }
  if (Array.isArray(node)) return node.map(withEditionBrand)
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, withEditionBrand(value)]),
    )
  }
  return node
}

export const resources = withEditionBrand(upstreamResources) as Resource
