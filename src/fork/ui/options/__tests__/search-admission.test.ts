import { expect, it } from "vitest"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"
import { SEARCH_ITEMS } from "../search-items"

it("keeps glossary settings discoverable while removing closed cloud search entries", () => {
  const ids = SEARCH_ITEMS.map(({ sectionId }) => sectionId)
  expect(ids).toContain("glossary-enabled")
  expect(ids).toContain("glossary-library")
  for (const closed of [
    "google-drive-sync",
    CUSTOM_ACTION_NOTEBASE_SECTION_ID,
    "selection-toolbar-note-suggestion",
    "subtitles-ai-quota",
  ]) {
    expect(ids.includes(closed)).toBe(false)
  }
})
