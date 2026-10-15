import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { build } from "vite"

const phase = process.argv[2]
if (!["before", "after"].includes(phase)) throw new Error("Expected before or after")
const root = resolve(".wxt/switch-theme-fixture")
await mkdir(root, { recursive: true })
await writeFile(
  resolve(root, "index.html"),
  '<!doctype html><html><head><meta charset="utf-8"><title>Isolated Switch theme regression</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
)
await writeFile(
  resolve(root, "main.tsx"),
  `
import React from "react"
import { createRoot } from "react-dom/client"
import { Switch } from "../../src/components/ui/base-ui/switch"
import "../../src/assets/styles/theme.css"
import "../../src/fork/ui/options/options-theme.css"

const params = new URLSearchParams(location.search)
const dark = params.get("theme") === "dark"
document.documentElement.classList.toggle("dark", dark)
if (params.get("scope") !== "shared") document.documentElement.setAttribute("data-translatebuff-options-theme", "")
document.body.style.cssText = "margin:32px;background:var(--rf-background);color:var(--rf-foreground);font-family:system-ui"
const states = [
  ["enabled-on", true, false], ["enabled-off", false, false],
  ["disabled-on", true, true], ["disabled-off", false, true],
]
function Fixture() {
  const [events, setEvents] = React.useState([])
  const record = event => setEvents(previous => [...previous.slice(-11), event])
  return <main style={{ maxWidth: 760 }} onClickCapture={event => record({kind:"click",detail:event.detail,target:event.target.tagName})}>
    <h1>Switch 状态对照 · {dark ? "暗色" : "亮色"} · {params.get("scope") === "shared" ? "共享组件" : "设置页主题"}</h1>
    <p>独立组件样本；没有扩展设置、账号、存储或网络业务接线。</p>
    {["default", "sm"].map(size => <section key={size} style={{background:"var(--rf-card)",padding:24,marginTop:20,border:"1px solid var(--rf-border)",borderRadius:12}}>
      <h2>{size}</h2>
      {states.map(([name, checked, disabled]) => <label key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:22,gap:24}}>
        <span>{name}</span>
        <Switch aria-label={size + "-" + name} size={size} defaultChecked={checked} disabled={disabled}
          onCheckedChange={(next, details) => record({kind:"change",name:size + "-" + name,next,type:details.event?.type,detail:details.event?.detail})} />
      </label>)}
    </section>)}
    <output data-fixture="events" style={{display:"block",marginTop:20,fontSize:12}}>{JSON.stringify(events)}</output>
  </main>
}
createRoot(document.getElementById("root")).render(<Fixture />)
`,
)
await build({
  configFile: false,
  root,
  base: "./",
  plugins: [
    phase === "before" && {
      name: "frozen-before-switch",
      enforce: "pre",
      load(id) {
        for (const file of [
          "src/components/ui/base-ui/switch.tsx",
          "src/fork/ui/options/options-theme.css",
        ]) {
          if (id === resolve(file))
            return execFileSync("git", ["show", `e1d90dc9:${file}`], { encoding: "utf8" })
        }
        return undefined
      },
    },
    react(),
  ],
  resolve: { alias: { "@": resolve("src") } },
  build: {
    outDir: resolve(".output/switch-fixtures", phase),
    emptyOutDir: true,
  },
})
