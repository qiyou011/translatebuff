// @vitest-environment jsdom
import type { FeatureConfigPatch, FeatureConfigSnapshot } from "@/fork/config/types"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { featureConfigAtom } from "@/fork/config/atoms"
import { migrateFeatureConfig } from "@/fork/config/migration"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { TranslationColorSetting } from "../translation-color"

vi.mock("@/fork/config/atoms", async () => {
  const { atom } = await import("jotai")
  const state = atom<FeatureConfigSnapshot | null>(null)
  return {
    featureConfigAtom: state,
    writeFeatureConfigAtom: atom(null, (get, set, patch: FeatureConfigPatch) => {
      const pair = structuredClone(get(state)!)
      if (patch.fork?.translationTextColor !== undefined)
        pair.forkConfig.translationTextColor = patch.fork.translationTextColor
      Object.assign(pair.forkConfig.translationPresetColors, patch.fork?.translationPresetColors)
      set(state, pair)
      return Promise.resolve()
    }),
  }
})

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("translation color setting", () => {
  it("saves a selected color, preserves it across presets and leaves it unchanged when closed without editing", () => {
    const store = createStore()
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.mainConfig.pageTranslation.translationNodeStyle = {
      ...pair.mainConfig.pageTranslation.translationNodeStyle,
      isCustom: false,
      preset: "textColor",
    }
    store.set(featureConfigAtom, pair)
    const view = render(
      <Provider store={store}>
        <TranslationColorSetting />
      </Provider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "#DC3545" }))
    expect(store.get(featureConfigAtom)!.forkConfig.translationTextColor).toBe("#dc3545")
    act(() => {
      const next = structuredClone(store.get(featureConfigAtom)!)
      next.mainConfig.pageTranslation.translationNodeStyle.preset = "border"
      store.set(featureConfigAtom, next)
    })
    expect(
      screen.queryByRole("region", {
        name: "options.translation.translationStyle.style.textColor",
      }),
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "#1F8EE6" }))
    expect(store.get(featureConfigAtom)!.forkConfig.translationPresetColors.border).toBe("#1f8ee6")
    act(() => {
      const next = structuredClone(store.get(featureConfigAtom)!)
      next.mainConfig.pageTranslation.translationNodeStyle.preset = "textColor"
      store.set(featureConfigAtom, next)
    })
    expect(screen.getByRole("button", { name: "#DC3545" }).getAttribute("aria-pressed")).toBe(
      "true",
    )
    fireEvent.click(
      screen.getByRole("button", { name: "options.translation.translationStyle.style.textColor" }),
    )
    fireEvent.keyDown(screen.getByLabelText("Hex value"), { key: "Escape" })
    view.unmount()
    render(
      <Provider store={store}>
        <TranslationColorSetting />
      </Provider>,
    )
    expect(store.get(featureConfigAtom)!.forkConfig.translationTextColor).toBe("#dc3545")
  })

  it.each(["weakened", "blockquote", "dashedLine", "border", "background"] as const)(
    "saves an arbitrary custom %s color independently",
    (preset) => {
      const store = createStore()
      const pair = {
        ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
        revision: "test",
      }
      pair.mainConfig.pageTranslation.translationNodeStyle.preset = preset
      pair.forkConfig.translationPresetColors = { border: "#123456" }
      store.set(featureConfigAtom, pair)
      const view = render(
        <Provider store={store}>
          <TranslationColorSetting />
        </Provider>,
      )
      const section = screen.getByRole("region")
      const trigger = section.querySelector<HTMLButtonElement>(".tb-custom-color-trigger")!
      fireEvent.click(trigger)
      fireEvent.focus(screen.getByLabelText("Hex value"))
      fireEvent.change(screen.getByLabelText("Hex value"), { target: { value: "ABCDEF" } })
      fireEvent.keyDown(screen.getByLabelText("Hex value"), { key: "Enter" })
      fireEvent.blur(screen.getByLabelText("Hex value"))
      expect(store.get(featureConfigAtom)!.forkConfig.translationPresetColors[preset]).toBe(
        "#abcdef",
      )
      expect(store.get(featureConfigAtom)!.forkConfig.translationPresetColors.border).toBe(
        preset === "border" ? "#abcdef" : "#123456",
      )
      view.unmount()
      render(
        <Provider store={store}>
          <TranslationColorSetting />
        </Provider>,
      )
      expect(screen.getByText("#ABCDEF")).toBeVisible()
    },
  )

  it.each(["default", "blur"] as const)("hides color controls for %s", (preset) => {
    const store = createStore()
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.mainConfig.pageTranslation.translationNodeStyle.preset = preset
    store.set(featureConfigAtom, pair)
    render(
      <Provider store={store}>
        <TranslationColorSetting />
      </Provider>,
    )
    expect(screen.queryByRole("region")).toBeNull()
  })

  it("uses the Figma pastel palette for backgrounds", () => {
    const store = createStore()
    const pair = {
      ...migrateFeatureConfig(structuredClone(DEFAULT_CONFIG), undefined),
      revision: "test",
    }
    pair.mainConfig.pageTranslation.translationNodeStyle.preset = "background"
    store.set(featureConfigAtom, pair)
    render(
      <Provider store={store}>
        <TranslationColorSetting />
      </Provider>,
    )
    expect(screen.queryByRole("button", { name: "#DC3545" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "#DFEEE4" }))
    expect(store.get(featureConfigAtom)!.forkConfig.translationPresetColors.background).toBe(
      "#dfeee4",
    )
    expect(screen.getByRole("button", { name: "#DFEEE4" })).toHaveAttribute("aria-pressed", "true")
  })
})
