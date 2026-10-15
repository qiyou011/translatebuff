import { SEARCH_ITEMS as upstreamItems } from "@/entrypoints/options/command-palette/search-items"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"

export type { SearchItem } from "@/entrypoints/options/command-palette/search-items"

const closedSections = new Set([
  "google-drive-sync",
  CUSTOM_ACTION_NOTEBASE_SECTION_ID,
  "selection-toolbar-note-suggestion",
  "subtitles-ai-quota",
])

export const SEARCH_ITEMS = upstreamItems.filter(({ sectionId }) => !closedSections.has(sectionId))
