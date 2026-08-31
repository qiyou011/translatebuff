import { afterEach, describe, expect, it } from "vitest"
import {
  clearLastReportedDate,
  readLastReportedDate,
  shouldReportOn,
  toUtcDateKey,
  writeLastReportedDate,
} from "../active-dedup"

// 固定 UTC 时间戳：本地时区无关，换台机器跑结论一致。
const UTC_MORNING = Date.UTC(2026, 7, 31, 0, 30)
const UTC_NIGHT = Date.UTC(2026, 7, 31, 23, 59, 59)
const UTC_NEXT_DAY = Date.UTC(2026, 8, 1, 0, 0, 1)

afterEach(async () => {
  await clearLastReportedDate()
})

// 去重口径必须与中台看板的分桶时区一致。用「用户本地时区」的话，每个用户的一天边界都不同，
// 任何固定时区的看板都对不齐；海外用户尤其明显。故统一取 UTC 自然日。
describe("UTC 自然日键", () => {
  it("同一 UTC 日内不同时刻取到同一个键", () => {
    expect(toUtcDateKey(UTC_MORNING)).toBe(toUtcDateKey(UTC_NIGHT))
  })

  it("跨 UTC 零点取到不同的键", () => {
    expect(toUtcDateKey(UTC_NIGHT)).not.toBe(toUtcDateKey(UTC_NEXT_DAY))
  })

  it("键是零填充的 YYYY-MM-DD，且按 UTC 而非本地时区计算", () => {
    expect(toUtcDateKey(Date.UTC(2026, 0, 5, 12))).toBe("2026-01-05")
    // UTC+8 的机器上这一刻本地已是 2026-09-01，取本地时区就会算错。
    expect(toUtcDateKey(Date.UTC(2026, 7, 31, 23, 59))).toBe("2026-08-31")
    // UTC-5 的机器上这一刻本地还是 2026-08-31，同理。
    expect(toUtcDateKey(Date.UTC(2026, 8, 1, 0, 1))).toBe("2026-09-01")
  })
})

describe("是否该上报", () => {
  it("从未上报过 → 该报", () => {
    expect(shouldReportOn("2026-08-31", null)).toBe(true)
  })

  it("上次上报早于今日 → 该报", () => {
    expect(shouldReportOn("2026-08-31", "2026-08-30")).toBe(true)
  })

  it("今日已上报 → 不该报", () => {
    expect(shouldReportOn("2026-08-31", "2026-08-31")).toBe(false)
  })
})

describe("上报日期存取", () => {
  it("未写入时读到 null", async () => {
    expect(await readLastReportedDate()).toBeNull()
  })

  it("写入后读回同值", async () => {
    await writeLastReportedDate("2026-08-31")
    expect(await readLastReportedDate()).toBe("2026-08-31")
  })
})
