import type { Config } from "@/types/config/config"
import { toClientLanguage } from "@/fork/membership/client-language"
import { loadForkSession } from "@/fork/membership/session"
import { configSchema } from "@/types/config/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import {
  readLastReportedDate,
  shouldReportOn,
  toUtcDateKey,
  writeLastReportedDate,
} from "./active-dedup"
import { buildTranslateActiveEvent } from "./active-event"
import { postClickEvent } from "./report-client"

// 活跃事件的编排：去重判定 → 标记 → 组装 → 上报。三条翻译通路都汇到这里，去重只此一处（按 UTC 自然日）。
//
// 先标记、再上报，且上报失败不回滚标记：回滚会让一个断网的用户当天每次翻译都重发一次请求，
// 把「丢一个点」放大成「刷接口」。埋点丢一条可以接受，刷接口不行。

function clientLanguageOf(config: Config): string {
  return toClientLanguage(resolveUiLocale(config.uiLanguage))
}

export async function reportTranslateActive(now: number = Date.now()): Promise<void> {
  // 整个函数体裹在 try 里：三个调用点都是 `void reportTranslateActive()`，一旦 reject 就是
  // 未处理的 rejection。storage 抽风、上报失败——任何一环都不许把异常送出去。
  try {
    const todayKey = toUtcDateKey(now)
    if (!shouldReportOn(todayKey, await readLastReportedDate())) {
      return
    }
    await writeLastReportedDate(todayKey)

    const [session, config] = await Promise.all([
      loadForkSession(),
      storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema),
    ])

    await postClickEvent([buildTranslateActiveEvent(now)], {
      // 未登录也报：活跃口径含未登录用户，服务端按 UA / 设备归因。
      loginCredential: session?.loginCredential ?? null,
      clientLanguage: clientLanguageOf(config),
    })
  } catch {
    // 埋点绝不冒泡业务流。
  }
}
