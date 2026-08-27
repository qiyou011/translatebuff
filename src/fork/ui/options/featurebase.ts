import type { FeaturebasePortalDestination } from "@/utils/featurebase"
import type { SupportedUiLocale } from "@/utils/i18n/resources"
// 换皮：上游 src/utils/featurebase.ts 的 URL 构造器。
// 上游把反馈与路线图都指向自家的 feedback.readfrog.app 门户；任译喵走自己的反馈页 / 帮助页。
// 换皮这一个函数即可同时覆盖两个入口（options 侧边栏、网页悬浮球），
// 比逐个换皮消费它的组件省一份要逐次对账的副本。
import { websiteRouteBasePath } from "@/fork/website-routes"
import { getWebsiteUrl } from "@/fork/website-url"

export * from "@/utils/featurebase"

export function buildFeaturebasePortalUrl({
  metadata,
}: {
  destination: FeaturebasePortalDestination
  locale: SupportedUiLocale
  metadata?: Record<string, string | undefined>
}) {
  // 地址不再硬编码：域跟 WXT_WEBSITE_URL、路径跟 edition（国内 /feedback，海外并入 /help）。
  const url = new URL(getWebsiteUrl(websiteRouteBasePath("feedback")))

  // 元数据（浏览器、扩展版本、页面地址）仍带上：反馈要靠它定位用户环境。
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  }

  return url.toString()
}
