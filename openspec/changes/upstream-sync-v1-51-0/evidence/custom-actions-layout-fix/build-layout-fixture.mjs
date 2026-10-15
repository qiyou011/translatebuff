import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

const phase = process.argv[2]
const buildDirectory = process.argv[3]
if (!["before", "after"].includes(phase) || !buildDirectory) {
  throw new Error("Usage: node build-layout-fixture.mjs before|after <build-directory>")
}
const output = resolve(
  "openspec/changes/upstream-sync-v1-51-0/evidence/global-production-followup/2026-10-15-reinstalled/fixtures/layout",
)
await mkdir(output, { recursive: true })
const assets = resolve(buildDirectory, "assets")
const stylesheet = (await readdir(assets)).find((name) => /^options-.*\.css$/.test(name))
if (!stylesheet) throw new Error("Built options stylesheet not found")
const sharedStylesheet = (await readdir(assets)).find((name) => /^theme-.*\.css$/.test(name))
if (!sharedStylesheet) throw new Error("Built shared stylesheet not found")
await writeFile(
  resolve(output, `${phase}.css`),
  `${await readFile(resolve(assets, sharedStylesheet), "utf8")}\n${await readFile(resolve(assets, stylesheet), "utf8")}`,
)

// Render only the two shared layout primitives with disposable text. This is
// an isolated CSS regression fixture, not an extension options-page proxy.
const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: { alias: { "@": resolve("src") } },
  server: { middlewareMode: true },
  appType: "custom",
})
try {
  const { ConfigItem } = await server.ssrLoadModule(
    "/src/entrypoints/options/components/config-item.tsx",
  )
  const { EntityEditorLayout } = await server.ssrLoadModule(
    "/src/entrypoints/options/components/entity-editor-layout.tsx",
  )
  const field = (name, tag, id) =>
    React.createElement(
      "div",
      { "data-slot": "field", style: { display: "flex", flexDirection: "column" } },
      React.createElement("label", { "data-slot": "field-label", htmlFor: id }, name),
      React.createElement(tag, {
        id,
        "data-slot": tag === "input" ? "input" : "textarea",
        defaultValue: "Disposable layout acceptance text",
        style: { boxSizing: "border-box" },
      }),
    )
  const editor = React.createElement(
    "form",
    { "data-fixture": "form", className: "flex flex-col gap-4" },
    field("名称", "input", "fixture-name"),
    field("提供商（需支持结构化输出）", "input", "fixture-provider"),
    field("系统提示词", "textarea", "systemPrompt"),
    field("提示词", "textarea", "prompt"),
  )
  const markup = renderToStaticMarkup(
    React.createElement(
      ConfigItem,
      { id: "custom-actions", orientation: "vertical", title: "指令配置" },
      React.createElement(EntityEditorLayout, {
        list: React.createElement("div", { "data-fixture": "list" }, "词典 / Disposable A"),
        editor,
      }),
    ),
  )
  for (const width of [944, 620]) {
    const html = `<!doctype html><html lang="zh-CN" class="dark" data-translatebuff-options-theme><head><meta charset="utf-8"><title>Isolated editor layout — ${phase} — ${width}</title><link rel="stylesheet" href="${phase}.css"><style>body{margin:24px;font-family:system-ui;background:#111;color:#eee}main{width:${width}px;max-width:100%}header{margin-bottom:24px}input,textarea{border:1px solid #777;padding:8px;border-radius:6px;background:#222;color:#eee}form{width:100%}</style></head><body><header>Isolated layout regression: shared layout primitives + built CSS; no extension settings or account data.</header><main>${markup}</main></body></html>`
    await writeFile(resolve(output, `${phase}-${width}.html`), html)
  }
  console.log(JSON.stringify({ phase, stylesheet, sharedStylesheet, output, widths: [944, 620] }))
} finally {
  await server.close()
}
