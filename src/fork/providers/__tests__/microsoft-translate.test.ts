import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getRequestErrorMeta } from "@/utils/request/retry-policy"
import { microsoftTranslate } from "../microsoft-translate"

const fetchMock = vi.fn<(...args: any[]) => any>()
let translatedText = "你好"

// fork 接管的微软适配器：走免鉴权 translatetext 端点。上游原版（api/microsoft.ts）保持
// 休眠且仍测旧的 auth 端点，故此处不复用它的用例，直接针对 fork 副本断言。
describe("fork microsoft translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    translatedText = "你好"
    // 真实端点按入参逐条回结果，mock 必须同形，否则长度校验会误判
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string) as string[]
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        json: vi
          .fn<(...args: any[]) => any>()
          .mockImplementation(async () =>
            sent.map(() => ({ translations: [{ text: translatedText }] })),
          ),
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
      })
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function lastCall(): [string, RequestInit] {
    const call = fetchMock.mock.calls.at(-1)
    if (!call) throw new Error("fetch was not called")
    return [String(call[0]), call[1] as RequestInit]
  }

  it("请求免鉴权 translatetext 端点，不再打已下线的 auth 端点", async () => {
    await microsoftTranslate("Library", "en", "zh")

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain("https://edge.microsoft.com/translate/translatetext")
    expect(urls.some((url) => url.includes("/translate/auth"))).toBe(false)
    expect(urls.some((url) => url.includes("cognitive.microsofttranslator.com"))).toBe(false)
  })

  it("不携带鉴权头", async () => {
    await microsoftTranslate("Library", "en", "zh")

    const [, init] = lastCall()
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers).not.toHaveProperty("Authorization")
    expect(headers).not.toHaveProperty("Ocp-Apim-Subscription-Key")
  })

  it("请求体为裸字符串数组，而非旧的 [{ Text }] 形状", async () => {
    await microsoftTranslate(["Library", "Book"], "en", "zh")

    const [, init] = lastCall()
    expect(JSON.parse(init.body as string)).toEqual(["Library", "Book"])
  })

  it("送出前转义裸尖括号，避免被标签对齐器融合成伪标签", async () => {
    await microsoftTranslate("a < b and c > d", "en", "zh")

    const [, init] = lastCall()
    const [sent] = JSON.parse(init.body as string) as string[]
    expect(sent).not.toContain("<")
    expect(sent).toContain("&lt;")
  })

  it("from/to 经 encodeURIComponent 编码", async () => {
    await microsoftTranslate("Library", "zh-Hans", "zh-TW")

    const [url] = lastCall()
    expect(url).toContain(`from=${encodeURIComponent("zh-Hans")}`)
    expect(url).toContain(`to=${encodeURIComponent("zh-TW")}`)
  })

  it("fromLang 为 auto 时 from 传空串", async () => {
    await microsoftTranslate("Library", "auto", "zh")

    const [url] = lastCall()
    expect(url).toContain("from=&")
  })

  it("单串入参返回单串，数组入参返回数组", async () => {
    await expect(microsoftTranslate("Library", "en", "zh")).resolves.toBe("你好")
    await expect(microsoftTranslate(["Library"], "en", "zh")).resolves.toEqual(["你好"])
  })

  it("空数组直接返回，不发请求", async () => {
    await expect(microsoftTranslate([], "en", "zh")).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // 新端点没有保留标记的模式，会以目标语相关的方式破坏带属性的 HTML，无法后处理还原。
  // 配置门禁负责让「微软 × 仅译文」形不成，这里硬失败是兜底。
  it("textFormat 为 html 时抛错且不发起请求", async () => {
    await expect(
      microsoftTranslate("<b>Library</b>", "en", "zh", { textFormat: "html" }),
    ).rejects.toThrow(/does not support HTML/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("textFormat 为 plain 时正常翻译", async () => {
    await expect(microsoftTranslate("Library", "en", "zh", { textFormat: "plain" })).resolves.toBe(
      "你好",
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // 断言 isRetryable / statusCode / responseHeaders——它们只从附加的元数据读取，
  // 不像 kind 那样会被 getRequestErrorMeta 从错误消息文本反推，故不会假绿。
  it("网络异常标注为可重试", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("socket hang up")))

    const error = await microsoftTranslate("Library", "en", "zh").catch((e) => e)
    expect(getRequestErrorMeta(error).isRetryable).toBe(true)
  })

  it("非 2xx 响应携带状态码与响应头", async () => {
    const headers = new Headers({ "retry-after": "30" })
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers,
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue("upstream down"),
      }),
    )

    const error = await microsoftTranslate("Library", "en", "zh").catch((e) => e)
    const meta = getRequestErrorMeta(error)
    expect(meta.statusCode).toBe(503)
    expect(meta.responseHeaders).toBe(headers)
  })

  // 上游把「microsoft 输出要解一次 HTML 实体」写在共享的 translation-output-normalization.ts
  // 里（与 google 并列）。fork 不改那个共享文件（它被 execute-translate 用于所有 provider），
  // 改为在本适配器内自解一次。两条调用路径（execute-translate / microsoftBatchTranslate）
  // 因此都恰好解一次。
  describe("输出实体解码恰好一次", () => {
    beforeEach(() => {
      // 转义后的实体在真实端点原样往返，mock 照此回显送出的文本
      fetchMock.mockImplementation((_url: string, init: RequestInit) => {
        const sent = JSON.parse(init.body as string) as string[]
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          json: vi
            .fn<(...args: any[]) => any>()
            .mockImplementation(async () => sent.map((text) => ({ translations: [{ text }] }))),
          text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
        })
      })
    })

    it("普通文本的尖括号与和号原样还原", async () => {
      await expect(microsoftTranslate("a < b & c", "en", "zh")).resolves.toBe("a < b & c")
    })

    it("原文里的字面量实体往返后不塌陷", async () => {
      // 漏解会残留 &amp;amp;，双解会塌成 &
      await expect(microsoftTranslate("Tom &amp; Jerry", "en", "zh")).resolves.toBe(
        "Tom &amp; Jerry",
      )
    })
  })
})
