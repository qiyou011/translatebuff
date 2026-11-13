import type { ReactNode } from "react"
import type { SelectionSession } from "@/entrypoints/selection.content/selection-toolbar/atoms"
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { selectionSessionAtom } from "@/entrypoints/selection.content/selection-toolbar/atoms"
import { featureConfigAtom } from "@/fork/config/atoms"
import { migrateFeatureConfig } from "@/fork/config/migration"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { useSelectionTranslationController } from "../use-selection-translation-controller"

const { translate } = vi.hoisted(() => ({
  translate: vi.fn<(...args: unknown[]) => Promise<string>>(() => Promise.resolve("translated")),
}))
vi.mock("@/utils/host/translate/translate-text", () => ({ translateTextCore: translate }))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: () => Promise.resolve(null),
}))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: () => {},
}))
vi.mock("@/utils/message", () => ({
  onMessage: () => () => {},
  sendMessage: () => Promise.resolve(),
}))
vi.mock("@/fork/config/storage", () => ({ subscribeFeatureConfig: () => () => {} }))
vi.mock("@/entrypoints/selection.content/utils", () => ({
  captureSelectionActionContext: () => null,
}))
afterEach(() => {
  cleanup()
  translate.mockClear()
})

describe("actual selection request language isolation", () => {
  it("sends independent selection languages to the engine and reruns without modifying page language", async () => {
    const store = createStore()
    const pair = migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined)
    pair.mainConfig.language = { ...pair.mainConfig.language, sourceCode: "jpn", targetCode: "eng" }
    pair.forkConfig.featureLanguages.selection = { sourceCode: "fra", targetCode: "deu" }
    store.set(configAtom, pair.mainConfig)
    await storage.setItem("local:config", pair.mainConfig)
    store.set(featureConfigAtom, { ...pair, revision: "one" })
    store.set(selectionSessionAtom, {
      id: 1,
      createdAt: 0,
      selectionSnapshot: { text: "Bonjour tout le monde", ranges: [] },
      contextSnapshot: { text: "Bonjour tout le monde", paragraphs: ["Bonjour tout le monde"] },
    } satisfies SelectionSession)
    const hook = renderHook(() => useSelectionTranslationController(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      ),
    })
    act(() => hook.result.current.handleOpenChange(true))
    await waitFor(() => expect(translate).toHaveBeenCalledOnce())
    expect(translate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        langConfig: expect.objectContaining({ sourceCode: "fra", targetCode: "deu" }),
      }),
    )
    act(() =>
      store.set(featureConfigAtom, {
        ...pair,
        forkConfig: {
          ...pair.forkConfig,
          featureLanguages: {
            ...pair.forkConfig.featureLanguages,
            selection: { sourceCode: "fra", targetCode: "spa" },
          },
        },
        revision: "two",
      }),
    )
    await waitFor(() => expect(translate).toHaveBeenCalledTimes(2))
    expect(translate).toHaveBeenLastCalledWith(
      expect.objectContaining({ langConfig: expect.objectContaining({ targetCode: "spa" }) }),
    )
    expect(store.get(configAtom).language).toEqual(pair.mainConfig.language)
  })
})
