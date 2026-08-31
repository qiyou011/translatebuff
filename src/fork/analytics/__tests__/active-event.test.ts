import { describe, expect, it, vi } from "vitest"
import { buildTranslateActiveEvent } from "../active-event"

// uuid v4：8-4-4-4-12，第三段首位恒为 4，第四段首位取 8/9/a/b。
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const NOW = 1_767_225_600_000

// 中台按字段名入表，任何一个字段写错都是「数据进不了表」而非报错，故逐个钉死。
describe("translate_active 事件报文", () => {
  it("字段取值与埋点存档表逐项一致", () => {
    const event = buildTranslateActiveEvent(NOW)

    expect(event.click_name).toBe("translate_active")
    expect(event.client_type).toBe(10)
    expect(event.product_line).toBe("AITRANS")
    expect(event.event_type).toBe("custom")
    expect(event.click_time).toBe(NOW)
    expect(event.device_info).toEqual({})
    expect(event.action_extra_info).toEqual({ is_active: true })
  })

  it("trace_id 是 uuid v4", () => {
    expect(buildTranslateActiveEvent(NOW).trace_id).toMatch(UUID_V4)
  })

  it("两次组装的 trace_id 不同", () => {
    expect(buildTranslateActiveEvent(NOW).trace_id).not.toBe(
      buildTranslateActiveEvent(NOW).trace_id,
    )
  })

  it("crypto.randomUUID 不可用时降级，不抛且仍有非空 trace_id", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("not available over http")
      },
    })
    try {
      const event = buildTranslateActiveEvent(NOW)
      expect(event.trace_id.length).toBeGreaterThan(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
