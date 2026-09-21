import { browser } from "#imports"
import { appendChannelId } from "@/fork/identity/channel"
import { currentEdition } from "@/fork/identity/edition"
import { websiteRouteBasePath } from "@/fork/website-routes"
import { getWebsiteUrl } from "@/fork/website-url"

/**
 * 国内卸载问卷使用固定钉钉表单；海外继续使用官网 /uninstall-survey。
 * 海外 URL 随 WXT_WEBSITE_URL 分环境，路径从 WEBSITE_ROUTES 取。
 *
 * 承载方式对齐 popup / selection.content：上游 `background/uninstall-survey.ts` 缩成 re-export shim，
 * 真逻辑净新增在本文件（C 类，零 allowlist）。上游 background/index.ts 的 import 契约不变。
 */
export async function setupUninstallSurvey() {
  if (currentEdition() === "cn") {
    await browser.runtime.setUninstallURL(
      "https://alidocs.dingtalk.com/notable/share/form/v01XNkOM5KwJ1zR8OY7_dv19yqvsgs3oebp3pcjys_1qX0QQ0?source=link",
    )
    return
  }
  // 追加 ?cid=<渠道号> 供官网按渠道归因（与 UA 段4 / 登录跳转同源）。
  await browser.runtime.setUninstallURL(
    appendChannelId(getWebsiteUrl(websiteRouteBasePath("uninstallSurvey"))),
  )
}
