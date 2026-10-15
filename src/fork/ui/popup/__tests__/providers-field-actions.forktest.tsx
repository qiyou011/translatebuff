// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { writeFileSync } from "node:fs"
import process from "node:process"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { configAtom } from "@/utils/atoms/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInAction } from "@/utils/custom-actions"
import ProvidersField from "../providers-field"

// Browser/storage use WxtVitest's in-memory implementations. Keep the real
// schema, action admission, provider resolution, seeding hook and rendered UI.
vi.mock("@/fork/message", () => ({
  sendForkMessage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  onForkMessage: vi.fn<() => void>(),
}))

const DICTIONARY_NAME = "Dictionary-only provider"
const UNAPPROVED_NAME = "Unapproved built-in provider"
const evidence: { test: string | undefined; html: string }[] = []

function buildConfig(): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  const dictionaryProvider = {
    ...buildRenyimiaoProvider("summary-dictionary", "fixture-key"),
    name: DICTIONARY_NAME,
  }
  const unapprovedProvider = {
    ...buildRenyimiaoProvider("summary-unapproved", "fixture-key"),
    name: UNAPPROVED_NAME,
  }
  config.providersConfig.push(dictionaryProvider, unapprovedProvider)
  config.pageTranslation.providerId = "microsoft-translate-default"
  config.videoSubtitles.providerId = "microsoft-translate-default"
  config.selectionToolbar.features.translate.providerId = "microsoft-translate-default"
  config.inputTranslation.providerId = "microsoft-translate-default"
  config.selectionToolbar.noteSuggestion.providerId = dictionaryProvider.id
  config.selectionToolbar.builtInActions.dictionary = {
    ...config.selectionToolbar.builtInActions.dictionary,
    enabled: true,
    providerId: dictionaryProvider.id,
  }
  config.selectionToolbar.builtInActions.sentenceAnalysis.providerId = unapprovedProvider.id
  config.selectionToolbar.builtInActions.improveWriting.providerId = unapprovedProvider.id
  config.selectionToolbar.customActions = []
  return configSchema.parse(config)
}

async function renderSummary(config: Config) {
  const parsed = configSchema.parse(config)
  await storageAdapter.set(CONFIG_STORAGE_KEY, parsed, configSchema)
  const store = createStore()
  store.set(configAtom, parsed)
  render(
    <Provider store={store}>
      <ThemeProvider forcedTheme="light">
        <TooltipProvider>
          <ProvidersField />
        </TooltipProvider>
      </ThemeProvider>
    </Provider>,
  )
  const trigger = screen.getByRole("button", { name: "popup.providers.open" })
  await waitFor(() => expect(within(trigger).getAllByRole("img").length).toBeGreaterThan(0))
  return trigger
}

beforeEach(() => {
  // jsdom does not fetch/decode image resources. Complete browser image loading
  // at that boundary so the actual Base UI AvatarImage can expose its DOM/alt.
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true)
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(32)
})

afterEach(() => {
  const evidencePath = process.env.POPUP_SUMMARY_DOM_EVIDENCE
  if (evidencePath) {
    evidence.push({
      test: expect.getState().currentTestName,
      html: document.querySelector("[data-slot=avatar-group]")?.outerHTML ?? "",
    })
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  cleanup()
  vi.restoreAllMocks()
})

describe("actual fork popup action-provider summary", () => {
  it("includes a provider used only by the enabled built-in dictionary", async () => {
    const summary = await renderSummary(buildConfig())
    expect(within(summary).getByRole("img", { name: DICTIONARY_NAME })).toBeVisible()
    expect(within(summary).getAllByRole("img")).toHaveLength(5)
  })

  it("keeps repeated feature slots while omitting disabled dictionary providers", async () => {
    const config = buildConfig()
    config.selectionToolbar.builtInActions.dictionary.enabled = false
    const summary = await renderSummary(config)
    const microsoftName = config.providersConfig.find(
      (provider) => provider.id === "microsoft-translate-default",
    )!.name
    expect(within(summary).getAllByRole("img", { name: microsoftName })).toHaveLength(4)
    expect(within(summary).queryByRole("img", { name: DICTIONARY_NAME })).toBeNull()
    expect(summary.querySelector("[data-slot=avatar-group-count]")).toBeNull()
  })

  it("does not include non-admitted built-ins even when enabled with a local provider", async () => {
    const config = buildConfig()
    config.selectionToolbar.builtInActions.dictionary.enabled = false
    config.selectionToolbar.builtInActions.sentenceAnalysis.enabled = true
    config.selectionToolbar.builtInActions.improveWriting.enabled = true
    const summary = await renderSummary(config)
    expect(within(summary).queryByRole("img", { name: UNAPPROVED_NAME })).toBeNull()
    expect(within(summary).getAllByRole("img")).toHaveLength(4)
  })

  it("keeps a user action's provider in the summary", async () => {
    const config = buildConfig()
    config.selectionToolbar.customActions = [
      {
        ...getBuiltInAction(config.selectionToolbar, "default-dictionary"),
        id: "summary-user-action",
        name: "User action",
      },
    ]
    config.selectionToolbar.builtInActions.dictionary.enabled = false
    const summary = await renderSummary(config)
    expect(within(summary).getByRole("img", { name: DICTIONARY_NAME })).toBeVisible()
    expect(within(summary).getAllByRole("img")).toHaveLength(5)
  })
})
