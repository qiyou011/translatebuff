import { SAAS_PRODUCT_LINE } from "@/fork/membership/api"

// 中台活跃事件「translate_active」的报文组装。字段与《事件埋点标准文档 v2.0》逐项对应，
// 参照官网 src/lib/api/report.ts 的既有实现——中台按字段名入表，写错不报错、只是数据进不了表。
//
// client_type：标准枚举 10 PC / 20 APP / 30 LJB / 40 官网 / 50 TV / 60 MAC 里没有「浏览器插件」，
// 沿用官网线 2026-07-29 的产品决定取 10。改动需先与数据团队确认看板口径。

/** 活跃信号的事件名，已登记进需求仓埋点台账。 */
export const TRANSLATE_ACTIVE_CLICK_NAME = "translate_active"

export interface TranslateActiveEvent {
  trace_id: string
  click_time: number
  click_name: typeof TRANSLATE_ACTIVE_CLICK_NAME
  client_type: number
  product_line: string
  event_type: "custom"
  /** Web 端设备属性的标准形态就是空对象：浏览器没有设备序列号，也不伪造占位值。 */
  device_info: object
  action_extra_info: { is_active: true }
}

/** 事件唯一 id。http 的测试环境没有 crypto.randomUUID，降级后仍要发得出事件而不是整条丢弃。 */
function newTraceId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
  }
}

export function buildTranslateActiveEvent(now: number): TranslateActiveEvent {
  return {
    trace_id: newTraceId(),
    click_time: now,
    click_name: TRANSLATE_ACTIVE_CLICK_NAME,
    client_type: 10,
    product_line: SAAS_PRODUCT_LINE,
    event_type: "custom",
    device_info: {},
    action_extra_info: { is_active: true },
  }
}
