// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { createFeatureConfigStore } from "@/fork/background/initialize-feature-config"
import { FeatureSettings } from "@/fork/ui/feature-settings"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

let service: ReturnType<typeof createFeatureConfigStore>
vi.mock("@/fork/message", () => ({
  sendForkMessage: (name: string, data: never) => {
    if (name === "forkReadFeatureConfig") return service.read()
    if (name === "forkPatchFeatureConfig") return service.patch(data)
    throw new Error(name)
  },
}))
vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))
vi.mock("@/fork/ui/providers/use-renyimiao-gating", () => ({
  useRenyimiaoGatedProviders: () => ({ providers: [], showFallback: false }),
  RenyimiaoGatedFallback: () => null,
}))
vi.mock("@/fork/components/provider-selector", () => ({ default: () => null }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("quick settings and full settings synchronization", () => {
  it("replaces the error with the saved settings when the background recovers", async () => {
    await storage.clear("local")
    service = createFeatureConfigStore(async () => {
      const config = structuredClone(DEFAULT_CONFIG)
      config.inputTranslation.toLang = "jpn"
      await storage.setItem("local:config", config)
    })
    vi.spyOn(service, "read").mockRejectedValueOnce(new Error("Receiving end does not exist"))
    render(
      <Provider store={createStore()}>
        <FeatureSettings feature="input" />
      </Provider>,
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("quickTranslation.loadFailed")
    await screen.findByLabelText("quickTranslation.triggerCount")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect((await service.read()).mainConfig.inputTranslation.toLang).toBe("jpn")
  })

  it("reports a failed settings read instead of leaving a loading indicator", async () => {
    service = createFeatureConfigStore(async () => {})
    vi.spyOn(service, "read").mockRejectedValue(new Error("Receiving end does not exist"))
    render(
      <Provider store={createStore()}>
        <FeatureSettings feature="page" />
      </Provider>,
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("quickTranslation.loadFailed")
    expect(screen.queryByText("quickTranslation.loading")).not.toBeInTheDocument()
  })

  it("persists trigger edits across two mounted stores and reopening, without changing other features", async () => {
    await storage.clear("local")
    service = createFeatureConfigStore(async () => {
      await storage.setItem("local:config", structuredClone(DEFAULT_CONFIG))
    })
    const before = await service.read()
    const one = render(
      <Provider store={createStore()}>
        <FeatureSettings feature="input" />
      </Provider>,
    )
    render(
      <Provider store={createStore()}>
        <FeatureSettings feature="input" />
      </Provider>,
    )
    const counts = await screen.findAllByLabelText("quickTranslation.triggerCount")
    await waitFor(() =>
      expect(screen.getAllByLabelText("quickTranslation.triggerCount")).toHaveLength(2),
    )
    fireEvent.change(counts[0]!, { target: { value: "5" } })
    await waitFor(() =>
      expect(
        screen
          .getAllByLabelText<HTMLSelectElement>("quickTranslation.triggerCount")
          .map((select) => select.value),
      ).toEqual(["5", "5"]),
    )
    expect(screen.getAllByText("inputTranslationBar.triggerHintCount")).toHaveLength(2)
    one.unmount()
    render(
      <Provider store={createStore()}>
        <FeatureSettings feature="input" />
      </Provider>,
    )
    await waitFor(() =>
      expect(
        screen
          .getAllByLabelText<HTMLSelectElement>("quickTranslation.triggerCount")
          .map((select) => select.value),
      ).toEqual(["5", "5"]),
    )
    const after = await service.read()
    expect(after.mainConfig.language).toEqual(before.mainConfig.language)
    expect(after.forkConfig.featureLanguages).toEqual(before.forkConfig.featureLanguages)
    expect(
      screen.getAllByRole("switch", { name: "quickTranslation.smartContext" })[0],
    ).toHaveAttribute("aria-disabled", "true")
  })
})
