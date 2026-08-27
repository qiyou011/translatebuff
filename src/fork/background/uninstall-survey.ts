import { browser } from "#imports"
import { appendChannelId } from "@/fork/identity/channel"
import { websiteRouteBasePath } from "@/fork/website-routes"
import { getWebsiteUrl } from "@/fork/website-url"

/**
 * fork 卸载问卷：把卸载 URL 指向 fork 官网 /uninstall-survey（替代上游 read-frog 问卷）。
 * URL 随 fork 官网域（WXT_WEBSITE_URL）分环境（dev → 测试域，prod → 生产域），路径随 edition
 * （国内 /uninstall-survey，海外 /extension/uninstall-survey）。官网页后补即生效。
 *
 * 承载方式对齐 popup / selection.content：上游 `background/uninstall-survey.ts` 缩成 re-export shim，
 * 真逻辑净新增在本文件（C 类，零 allowlist）。上游 background/index.ts 的 import 契约不变。
 */
export async function setupUninstallSurvey() {
  // 追加 ?cid=<渠道号> 供官网按渠道归因（与 UA 段4 / 登录跳转同源）。
  await browser.runtime.setUninstallURL(
    appendChannelId(getWebsiteUrl(websiteRouteBasePath("uninstallSurvey"))),
  )
}
