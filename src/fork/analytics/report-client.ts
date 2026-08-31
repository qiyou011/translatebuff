import { buildAuthHeaders } from "@/fork/membership/api"

// 中台埋点上报底座。两处与会员请求刻意不同：
// - 独立请求路径：会员接口的 401 语义是「凭据失效 → 端到端清态」，埋点偶发 401 若走同一路径会把用户踢下线。
// - fire-and-forget：网络失败、非 2xx 一律静默丢弃，不重试、不冒泡——翻译绝不能因为一个埋点请求而报错。

/** 海豚线不加密 click_event 接口（表 ClientAppClickInfo）。 */
export const CLICK_EVENT_PATH = "/api/data_report/v1/client/click_event"

export interface ReportAuth {
  /** 无会话时传 null：匿名上报，绝不写空凭据头（空值比不发更容易被后端判成非法）。 */
  loginCredential: string | null
  clientLanguage: string
}

export function buildReportHeaders(
  loginCredential: string | null,
  clientLanguage: string,
): Record<string, string> {
  const headers = buildAuthHeaders(loginCredential ?? "", clientLanguage)
  if (!loginCredential) {
    delete headers["Login-Credential"]
  }
  return headers
}

export async function postClickEvent(events: unknown[], auth: ReportAuth): Promise<void> {
  const base = import.meta.env.WXT_REPORT_API_URL as string | undefined
  if (!base) {
    return
  }
  try {
    await fetch(`${base}${CLICK_EVENT_PATH}`, {
      method: "POST",
      // keepalive：用户点完翻译立刻关标签页时，请求仍要发得出去。
      keepalive: true,
      headers: {
        ...buildReportHeaders(auth.loginCredential, auth.clientLanguage),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(events),
    })
  } catch {
    // 埋点绝不冒泡业务流：网络失败、跨源被拦一律静默丢弃，不重试。
  }
}
