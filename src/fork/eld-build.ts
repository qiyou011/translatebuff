import type { Plugin } from "vite"
import { Buffer } from "node:buffer"

/** Static data chunk: preserves the full model and works in MV3 service workers. */
export function eldLanguageDataChunk(id: string): string | undefined {
  return id.replace(/\\/g, "/").endsWith("/eld/src/ngrams/large.js")
    ? "eld-language-data"
    : undefined
}

export function firefoxScriptSizePlugin() {
  return {
    name: "check-firefox-script-size",
    generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      // Mozilla's parser checks uncompressed bytes, including at the boundary.
      for (const [file, item] of Object.entries(bundle)) {
        if (item.type !== "chunk" || typeof item.code !== "string") continue
        const bytes = Buffer.byteLength(item.code, "utf8")
        if (bytes >= 5 * 1024 * 1024) {
          throw new Error(`Firefox script ${file} is ${bytes} bytes; keep each script below 5 MiB`)
        }
      }
    },
  } satisfies Plugin
}
