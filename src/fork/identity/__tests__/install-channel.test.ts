import { describe, expect, it } from "vitest"

describe("新装渠道选择", () => {
  const installAt = 1_700_000_000_000

  it("仅采纳早于安装且不足 30 天的认可推广", async () => {
    const { selectInstallChannel } = await import("../install-channel")
    const record = JSON.stringify({ cid: "7154", recordedAt: installAt - 1 })
    expect(selectInstallChannel("7151", record, installAt)).toBe("7154")
    expect(selectInstallChannel("7151", record, installAt - 1)).toBe("7151")
    expect(selectInstallChannel("7151", record, installAt + 30 * 86400_000 - 2)).toBe("7154")
    expect(selectInstallChannel("7151", record, installAt + 30 * 86400_000 - 1)).toBe("7151")
  })

  it("识别官网 js-cookie 实际写出的 URL 编码 JSON", async () => {
    const { selectInstallChannel } = await import("../install-channel")
    const cookie = `{%22cid%22:%227154%22%2C%22recordedAt%22:${installAt - 1}}`
    expect(selectInstallChannel("7151", cookie, installAt)).toBe("7154")
  })

  it("拒绝未来、同刻、无效时间和未认可号码", async () => {
    const { selectInstallChannel } = await import("../install-channel")
    for (const recordedAt of [installAt, installAt + 1, null, "yesterday", Number.NaN]) {
      expect(
        selectInstallChannel("7152", JSON.stringify({ cid: "7154", recordedAt }), installAt),
      ).toBe("7152")
    }
    expect(
      selectInstallChannel(
        "7153",
        JSON.stringify({ cid: "7155", recordedAt: installAt - 1 }),
        installAt,
      ),
    ).toBe("7153")
    expect(selectInstallChannel("7150", null, installAt)).toBe("7150")
  })
})

describe("固定渠道状态", () => {
  it("安装选择后即使保存失败，本进程也保持同一号并补存", async () => {
    const { createInstallChannelDecision } = await import("../install-channel")
    let saves = 0
    const decision = createInstallChannelDecision({
      packageCid: "7151",
      websiteOrigin: "https://www.translatebuff.com",
      readSaved: async () => null,
      writeSaved: async () => {
        if (++saves === 1) throw new Error("storage")
      },
      readCookie: async () => JSON.stringify({ cid: "7154", recordedAt: 100 }),
    })
    expect(await decision.install(101)).toBe("7154")
    expect(await decision.get()).toBe("7154")
    expect(saves).toBeGreaterThanOrEqual(2)
  })

  it("普通冷启动缺记录或读取失败时使用包内号，不读取推广", async () => {
    const { createInstallChannelDecision } = await import("../install-channel")
    let cookieReads = 0
    const decision = createInstallChannelDecision({
      packageCid: "7152",
      websiteOrigin: "https://www.translatebuff.com",
      readSaved: async () => {
        throw new Error("storage")
      },
      writeSaved: async () => {
        throw new Error("must not write")
      },
      readCookie: async () => {
        cookieReads++
        return JSON.stringify({ cid: "7154", recordedAt: 100 })
      },
    })
    expect(await decision.get()).toBe("7152")
    expect(await decision.get()).toBe("7152")
    expect(cookieReads).toBe(0)
  })

  it("重启只读取已固定渠道，官网新推广或过期不重新选择", async () => {
    const { createInstallChannelDecision } = await import("../install-channel")
    const decision = createInstallChannelDecision({
      packageCid: "7151",
      websiteOrigin: "https://www.translatebuff.com",
      readSaved: async () => ({
        version: 1,
        installAt: 101,
        selectedCid: "7154",
        websiteOrigin: "https://www.translatebuff.com",
      }),
      writeSaved: async () => {
        throw new Error("must not write")
      },
      readCookie: async () => {
        throw new Error("must not read")
      },
    })
    expect(await decision.get()).toBe("7154")
    expect(await decision.get()).toBe("7154")
  })

  it("别的官网环境保存的固定结果不能在当前环境使用", async () => {
    const { createInstallChannelDecision } = await import("../install-channel")
    const decision = createInstallChannelDecision({
      packageCid: "7151",
      websiteOrigin: "https://test.translatebuff.com",
      readSaved: async () => ({
        version: 1,
        installAt: 101,
        selectedCid: "7154",
        websiteOrigin: "https://www.translatebuff.com",
      }),
      writeSaved: async () => {
        throw new Error("must not write")
      },
      readCookie: async () => {
        throw new Error("must not read")
      },
    })
    expect(await decision.get()).toBe("7151")
  })
})
