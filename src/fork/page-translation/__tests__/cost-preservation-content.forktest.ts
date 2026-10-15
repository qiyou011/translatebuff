// @vitest-environment jsdom
import type { MatchedTerm } from "@/utils/glossary/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolveGlossaryTerms } from "@/utils/glossary/active-matcher"
import { clearInMemoryTranslationCache } from "@/utils/host/translate/in-memory-translation-cache"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import {
  beginPageTranslationSession,
  endPageTranslationSession,
} from "@/utils/host/translate/translation-session"
import { sendMessage } from "@/utils/message"

// Keep the real content hash/prompt/provider preparation and memory cache.
// Only replace the matcher snapshot, message transport, and config storage.
vi.mock("@/utils/message", () => ({ sendMessage: vi.fn<(...args: any[]) => any>() }))
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<() => Promise<typeof DEFAULT_CONFIG>>(async () => DEFAULT_CONFIG),
}))
vi.mock("@/utils/glossary/active-matcher", () => ({
  resolveGlossaryTerms: vi.fn<typeof resolveGlossaryTerms>(),
}))
vi.mock("@/utils/glossary/analytics", () => ({ trackGlossaryUsed: vi.fn<() => void>() }))

const providerConfig: Parameters<typeof translateTextCore>[0]["providerConfig"] = {
  kind: "local",
  id: "cost-content-provider",
  name: "Cost content fixture",
  config: {
    id: "cost-content-provider",
    name: "Cost content fixture",
    enabled: true,
    provider: "openai",
    model: { model: "gpt-4o-mini", isCustomModel: false, customModel: null },
    apiKey: "fixture-key",
  },
}
const sender = vi.mocked(sendMessage<"enqueueTranslateRequest">)
const matcher = vi.mocked(resolveGlossaryTerms)
const terms: MatchedTerm[] = [
  { matchKey: "i:frog", source: "Frog", target: "术语甲", keepOriginal: false },
]
let sessionId: string

beforeEach(() => {
  vi.clearAllMocks()
  endPageTranslationSession()
  clearInMemoryTranslationCache()
  sessionId = beginPageTranslationSession()
  matcher.mockResolvedValue({ terms: [], revision: 0 })
  sender.mockResolvedValue("默认译文")
})
afterEach(() => {
  endPageTranslationSession()
  clearInMemoryTranslationCache()
})

const translate = (glossaryEnabled: boolean) =>
  translateTextCore({
    text: "Frog beside the river",
    langConfig: { sourceCode: "eng", targetCode: "cmn", level: "intermediate" },
    providerConfig,
    hostedFeature: "pageTranslation",
    sessionId,
    glossaryEnabled,
  })

describe("cost preservation for empty effective terminology", () => {
  it("reuses a no-glossary translation after enabling an empty glossary", async () => {
    expect(await translate(false)).toBe("默认译文")
    expect(await translate(true)).toBe("默认译文")
    expect(sender).toHaveBeenCalledTimes(1)
  })

  it("reuses the empty-match cache after an unrelated glossary revision", async () => {
    expect(await translate(true)).toBe("默认译文")
    matcher.mockResolvedValue({ terms: [], revision: 7 })
    expect(await translate(true)).toBe("默认译文")
    expect(sender).toHaveBeenCalledTimes(1)
  })

  it("keeps revision invalidation when effective terminology is nonempty", async () => {
    matcher.mockResolvedValue({ terms, revision: 1 })
    expect(await translate(true)).toBe("默认译文")
    const firstHash = sender.mock.calls[0]![1].hash
    matcher.mockResolvedValue({ terms, revision: 2 })
    expect(await translate(true)).toBe("默认译文")
    expect(sender).toHaveBeenCalledTimes(2)
    expect(sender.mock.calls[1]![1].hash).not.toBe(firstHash)
  })

  it("does not reuse a term-constrained result after deleting the last match", async () => {
    matcher.mockResolvedValue({ terms, revision: 1 })
    sender.mockResolvedValueOnce("术语甲在河边").mockResolvedValue("默认译文")
    expect(await translate(true)).toBe("术语甲在河边")
    const firstHash = sender.mock.calls[0]![1].hash
    matcher.mockResolvedValue({ terms: [], revision: 2 })
    expect(await translate(true)).toBe("默认译文")
    expect(await translate(true)).toBe("默认译文")
    expect(sender).toHaveBeenCalledTimes(2)
    expect(sender.mock.calls[1]![1].hash).not.toBe(firstHash)
  })

  it("restores the equivalent pre-term cache through empty, matched, then deleted snapshots", async () => {
    expect(await translate(true)).toBe("默认译文")
    const emptyHash = sender.mock.calls[0]![1].hash
    matcher.mockResolvedValue({ terms, revision: 1 })
    sender.mockResolvedValue("术语甲在河边")
    expect(await translate(true)).toBe("术语甲在河边")
    matcher.mockResolvedValue({ terms: [], revision: 2 })
    expect(await translate(true)).toBe("默认译文")
    expect(sender).toHaveBeenCalledTimes(2)
    expect(sender.mock.calls[1]![1].hash).not.toBe(emptyHash)
  })
})
