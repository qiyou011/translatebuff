// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Animate = Element["animate"]
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const translateTextForInputMock = vi.fn<(...args: any[]) => any>()
const toastAddMock = vi.fn<(...args: any[]) => any>()
const getLocalConfigMock = vi.fn<(...args: any[]) => any>()
const getDetectedCodeMock = vi.fn<(...args: any[]) => any>()
let execCommandMock: ReturnType<typeof vi.fn<() => boolean>>

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForInput: (...args: any[]) => translateTextForInputMock(...args),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: (...args: any[]) => toastAddMock(...args) },
}))
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: (...args: any[]) => getLocalConfigMock(...args),
}))
vi.mock("@/utils/config/languages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/config/languages")>()),
  getDetectedCodeFromStorage: (...args: any[]) => getDetectedCodeMock(...args),
}))
// 埋点与 provider 解析不是本测试的对象，直通即可。
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureAttempt: (_ctx: unknown, run: () => unknown) => run(),
}))
vi.mock("@/utils/analytics-provider", () => ({ classifyResolvedProvider: () => ({}) }))
vi.mock("@/utils/providers/provider-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/providers/provider-registry")>()),
  resolveProviderRefForCapability: () => ({ kind: "local", config: {} }),
}))

const { useInputTranslation } = await import("../use-input-translation")

const RUSSIAN_CHAT = [
  "Элис, еще раз добрый день! У меня появились срочные обстоятельства.",
  "Поэтому я смогу очень мало времени уделять стримам, к сожалению.",
]

function configWith(language: Partial<Config["language"]>): Config {
  return { ...DEFAULT_CONFIG, language: { ...DEFAULT_CONFIG.language, ...language } }
}

/** 铺一个 Discord 形态的对话，并返回已聚焦的输入框。 */
function setupPage(messages: string[]): HTMLInputElement {
  document.body.innerHTML = `${messages
    .map(
      (text, index) =>
        `<li id="chat-messages-${index}"><div id="message-content-${index}">${text}</div></li>`,
    )
    .join("")}<input id="composer" />`
  const input = document.getElementById("composer") as HTMLInputElement
  input.value = "你好呀，最近怎么样"
  input.focus()
  return input
}

function pressSpaceThrice() {
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
  }
}

function renderWithConfig(config: Config) {
  const store = createStore()
  store.set(configAtom, config)
  return renderHook(() => useInputTranslation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    ),
  })
}

describe("useInputTranslation 的语言解析", () => {
  beforeEach(() => {
    // 以下三个都是 jsdom 的缺口，不补桩会在到达断言前就抛，且异常被 `void handleTranslation()`
    // 吞掉，表现为「什么都没发生」。execCommand 用于替换输入框内容，animate 用于 spinner 转圈。
    execCommandMock = vi.fn<() => boolean>(() => true)
    document.execCommand = execCommandMock
    Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
      cancel: vi.fn<() => void>(),
    })) as unknown as Animate
    window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal("location", new URL("https://discord.com/channels/1/2"))
    translateTextForInputMock.mockReset().mockResolvedValue("Привет")
    toastAddMock.mockReset()
    getDetectedCodeMock.mockReset().mockResolvedValue("deu")
    getLocalConfigMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  it("把解析出的具体语言码交给引擎，而不是 sourceCode 这种选项字面量", async () => {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => {
      expect(translateTextForInputMock).toHaveBeenCalledWith(
        "你好呀，最近怎么样",
        "cmn", // fromLang: targetCode
        "rus", // toLang: sourceCode → 跟随对话
      )
    })
  })

  it("解析后两端语言相同时不调引擎，改为提示", async () => {
    // 对话是俄语，用户的目标语言也设成俄语 → 无事可做。
    const config = configWith({ sourceCode: "auto", targetCode: "rus" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => {
      expect(toastAddMock).toHaveBeenCalled()
    })
    expect(translateTextForInputMock).not.toHaveBeenCalled()
  })

  it("用户钉死源语言时不被对话检测顶掉", async () => {
    const config = configWith({ sourceCode: "eng", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(RUSSIAN_CHAT)
    renderWithConfig(config)

    pressSpaceThrice()

    await waitFor(() => {
      expect(translateTextForInputMock).toHaveBeenCalledWith("你好呀，最近怎么样", "cmn", "eng")
    })
  })
})

describe("useInputTranslation 的内联条", () => {
  beforeEach(() => {
    execCommandMock = vi.fn<() => boolean>(() => true)
    document.execCommand = execCommandMock
    Element.prototype.animate = vi.fn<() => { cancel: () => void }>(() => ({
      cancel: vi.fn<() => void>(),
    })) as unknown as Animate
    window.matchMedia = vi.fn<() => { matches: boolean }>(() => ({
      matches: false,
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal("location", new URL("https://discord.com/channels/1/2"))
    translateTextForInputMock.mockReset().mockResolvedValue("Привет")
    toastAddMock.mockReset()
    getDetectedCodeMock.mockReset().mockResolvedValue("deu")
    getLocalConfigMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.innerHTML = ""
  })

  function renderTranslating() {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    const input = setupPage(RUSSIAN_CHAT)
    const rendered = renderWithConfig(config)
    return { input, rendered }
  }

  it("替换成功后挂出内联条，带上语言与它的来源", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()

    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
    expect(rendered.result.current.bar).toMatchObject({
      element: input,
      originalText: "你好呀，最近怎么样",
      lang: "rus",
      langSource: "chatContext",
    })
  })

  it("回退整页源语言时，来源标成 pageSource 而不是 chatContext", async () => {
    const config = configWith({ sourceCode: "auto", targetCode: "cmn" })
    getLocalConfigMock.mockResolvedValue(config)
    setupPage(["👍", "🎉"]) // 判不出语种 → 回退
    const rendered = renderWithConfig(config)
    pressSpaceThrice()

    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())
    expect(rendered.result.current.bar?.langSource).toBe("pageSource")
  })

  it("翻译期间用户改了输入、系统放弃替换时，不挂内联条", async () => {
    let resolveTranslation: (value: string) => void = () => {}
    translateTextForInputMock.mockImplementation(
      () => new Promise<string>((resolve) => (resolveTranslation = resolve)),
    )
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()

    await waitFor(() => expect(translateTextForInputMock).toHaveBeenCalled())
    input.value = "用户又改了别的"
    await act(async () => {
      resolveTranslation("Привет")
    })

    expect(rendered.result.current.bar).toBeNull()
  })

  it("撤销把原文写回去", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.value = "Привет"
    execCommandMock.mockClear()
    act(() => rendered.result.current.undo())

    expect(execCommandMock).toHaveBeenCalledWith("insertText", false, "你好呀，最近怎么样")
    expect(rendered.result.current.bar).toBeNull()
  })

  it("原输入框已离开文档时，撤销不写入任何东西", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    input.remove()
    execCommandMock.mockClear()
    act(() => rendered.result.current.undo())

    expect(execCommandMock).not.toHaveBeenCalled()
  })

  it("焦点已切到另一个输入框时，撤销只写回原来那个", async () => {
    const { input, rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    const other = document.createElement("input")
    other.value = "别动我"
    document.body.appendChild(other)
    other.focus()

    act(() => rendered.result.current.undo())

    // execCommand 作用于当前焦点元素，所以撤销必须先把焦点抢回原输入框。
    expect(document.activeElement).toBe(input)
    expect(other.value).toBe("别动我")
  })

  it("改语言后用原文重译，而不是拿已翻译的文本再翻一遍", async () => {
    const { rendered } = renderTranslating()
    pressSpaceThrice()
    await waitFor(() => expect(rendered.result.current.bar).not.toBeNull())

    translateTextForInputMock.mockClear().mockResolvedValue("こんにちは")
    await act(async () => {
      await rendered.result.current.retranslate("jpn")
    })

    expect(translateTextForInputMock).toHaveBeenCalledWith("你好呀，最近怎么样", "cmn", "jpn")
    expect(rendered.result.current.bar).toMatchObject({ lang: "jpn", langSource: "explicit" })
  })
})
