import type { Config } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

export const SMOKE_GLOSSARY_ID = "route-smoke-glossary"
export const SMOKE_GLOSSARY_NAME = "Route smoke local glossary"

// The route assertions deliberately name a page-owned control/section as well
// as its heading: a sidebar or the Suspense fallback cannot satisfy them.
export const ROUTE_EXPECTATIONS = [
  ["/", "options.apiProviders.title", "#provider-config"],
  ["/preference", "options.preference.title", "#translation-source-language"],
  ["/shortcuts", "options.shortcuts.title", "#page-translation-shortcut"],
  ["/api-providers", "options.apiProviders.title", "#provider-config"],
  ["/custom-actions", "options.selectionToolbar.customActions.title", "input"],
  ["/page-translation", "options.translation.title", "#hover-translation"],
  ["/video-subtitles", "options.videoSubtitles.title", "[role=switch]"],
  ["/floating-button", "options.floatingButton.title", "#floating-button-display"],
  ["/selection-toolbar", "options.selectionToolbar.title", "#selection-toolbar-translate"],
  ["/context-menu", "options.contextMenu.title", "[role=switch]"],
  ["/input-translation", "options.inputTranslation.title", "#input-translation-languages"],
  ["/tts", "options.tts.title", "#tts-voice"],
  ["/advanced", "options.advanced.glossary.title", "#glossary-library"],
  ["/help-and-community", "options.helpAndCommunity.title", "a[href]"],
  ["/advanced/glossary", "options.advanced.glossary.title", "#glossary-library"],
  ["/advanced/glossary/:glossaryId", "options.advanced.glossary.title", "#glossary-terms"],
  ["/preference/config-backup", "options.preference.title", "#config-backup"],
  ["/preference/extension-activation", "options.preference.title", "#site-control-mode"],
  ["/page-translation/custom-css", "options.translation.title", ".cm-editor .cm-content"],
  ["/page-translation/prompts", "options.translation.title", "#personalized-prompts"],
  ["/page-translation/translation-control", "options.translation.title", "#translation-control"],
  [
    "/page-translation/translation-control/auto-translate-websites",
    "options.translation.title",
    "#auto-translate-website",
  ],
  [
    "/page-translation/translation-control/never-auto-translate-websites",
    "options.translation.title",
    "#never-auto-translate-website",
  ],
  [
    "/page-translation/translation-control/site-rules",
    "options.translation.title",
    "#site-rules-user-rules",
  ],
  ["/page-translation/translation-queue", "options.translation.title", "#request-rate"],
  ["/video-subtitles/style", "options.videoSubtitles.title", "#subtitles-style"],
  ["/video-subtitles/style/custom-css", "options.videoSubtitles.title", ".cm-editor .cm-content"],
  ["/video-subtitles/prompts", "options.videoSubtitles.title", "#subtitles-custom-prompts"],
  ["/video-subtitles/subtitles-queue", "options.videoSubtitles.title", "#subtitles-queue"],
] as const

export function makeRouteSmokeConfig(legacyCloudEnabled: boolean): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  if (legacyCloudEnabled) {
    config.selectionToolbar.noteSuggestion.enabled = true
    config.selectionToolbar.builtInActions.sentenceAnalysis.enabled = true
    config.selectionToolbar.builtInActions.improveWriting.enabled = true
    config.betaExperience.enabled = true
    config.pageTranslation.enableAIContentAware = true
    config.videoSubtitles.aiSegmentation = true
  }
  return config
}

// jsdom has no IndexedDB. Keep the real glossary repository/query hooks and
// replace only its Dexie storage transport. Unsupported operations throw rather
// than silently returning a fake successful product result.
export function makeGlossaryStorageBoundary() {
  const createdAt = new Date("2026-10-15T00:00:00Z")
  const glossary = {
    id: SMOKE_GLOSSARY_ID,
    name: SMOKE_GLOSSARY_NAME,
    description: "Synthetic route smoke data; no user data.",
    enabled: true,
    matchPatterns: [],
    createdAt,
    updatedAt: createdAt,
  }
  return {
    batchRequestRecord: {
      where: (index: string) => {
        if (index !== "createdAt") throw new Error(`Unsupported batch record index: ${index}`)
        return { between: () => ({ toArray: async () => [] }) }
      },
    },
    glossary: {
      get: async (id: string) => (id === glossary.id ? structuredClone(glossary) : undefined),
      orderBy: (index: string) => {
        if (index !== "createdAt") throw new Error(`Unsupported glossary index: ${index}`)
        return { toArray: async () => [structuredClone(glossary)] }
      },
    },
    glossaryTerm: {
      count: async () => 0,
      each: async () => {},
      where: (index: string) => {
        if (index !== "glossaryId") throw new Error(`Unsupported term index: ${index}`)
        return {
          equals: () => ({
            count: async () => 0,
            reverse: () => ({ sortBy: async () => [] }),
          }),
        }
      },
    },
  }
}
