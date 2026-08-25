import { browser } from "#imports"
import { FORK_BRANDING } from "@/fork/branding"

// fork 品牌名：上游本次改成从 @read-frog/definitions 转出 APP_NAME，
// 那是上游自己的品牌常量；fork 必须继续指向 FORK_BRANDING，否则扩展名会变回上游。
export const APP_NAME = FORK_BRANDING.name
const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
