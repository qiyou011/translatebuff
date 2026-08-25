import { getWebsiteUrl } from "@/fork/website-url"

// 上游 BlogNotification 用 `${env.WXT_WEBSITE_URL}${url}` 直拼博客地址，
// 本地预览（localhost）时丢掉官网的 hash 路由前缀，联调直接 404。
export function buildBlogUrl(postUrl: string | undefined) {
  return getWebsiteUrl(postUrl ?? "/blog")
}
