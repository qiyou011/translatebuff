import { expect, it } from "vitest"
import { eldLanguageDataChunk, firefoxScriptSizePlugin } from "../eld-build"

it("isolates the complete ELD large database on Windows and POSIX installations", () => {
  expect(
    eldLanguageDataChunk(
      "D:\\project\\node_modules\\.pnpm\\eld@2.1.1\\node_modules\\eld\\src\\ngrams\\large.js",
    ),
  ).toBe("eld-language-data")
  expect(eldLanguageDataChunk("/project/node_modules/eld/src/ngrams/large.js")).toBe(
    "eld-language-data",
  )
  expect(eldLanguageDataChunk("/project/node_modules/eld/src/languageDetector.js")).toBeUndefined()
  expect(eldLanguageDataChunk("/project/src/large.js")).toBeUndefined()
})

it("fails Firefox builds at the uncompressed script limit, counting UTF-8 bytes", () => {
  const plugin = firefoxScriptSizePlugin()
  expect(() =>
    plugin.generateBundle(undefined, { "large.js": { type: "chunk", code: "中".repeat(1747627) } }),
  ).toThrow("large.js")
  expect(() =>
    plugin.generateBundle(undefined, {
      "limit.js": { type: "chunk", code: "a".repeat(5 * 1024 * 1024) },
    }),
  ).toThrow("5 MiB")
  expect(() =>
    plugin.generateBundle(undefined, {
      "small.js": { type: "chunk", code: "a".repeat(5 * 1024 * 1024 - 1) },
    }),
  ).not.toThrow()
})
