import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { build } from "vite"

const root = resolve(".wxt/merge-ui-fixture")
await mkdir(root, { recursive: true })
await writeFile(
  resolve(root, "index.html"),
  '<!doctype html><html><head><meta charset="utf-8"><title>Isolated merge UI contracts</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
)
await writeFile(
  resolve(root, "main.tsx"),
  `
import React from "react"
import { createRoot } from "react-dom/client"
import { Button } from "../../src/components/ui/base-ui/button"
import { ButtonGroup } from "../../src/components/ui/base-ui/button-group"
import { Switch } from "../../src/components/ui/base-ui/switch"
import { Checkbox } from "../../src/components/ui/base-ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../../src/components/ui/base-ui/radio-group"
import { Input } from "../../src/components/ui/base-ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../src/components/ui/base-ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "../../src/components/ui/base-ui/dialog"
import { Popover, PopoverTrigger, PopoverContent } from "../../src/components/ui/base-ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../src/components/ui/base-ui/tooltip"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../src/components/ui/base-ui/tabs"
import { ConfigItem } from "../../src/entrypoints/options/components/config-item"
import { EntityEditorLayout } from "../../src/entrypoints/options/components/entity-editor-layout"
import "../../src/assets/styles/theme.css"
import "../../src/fork/ui/options/options-theme.css"

const params = new URLSearchParams(location.search)
const dark = params.get("theme") === "dark"
const width = Number(params.get("width")) || 944
document.documentElement.classList.toggle("dark",dark)
if(params.get("scope")!=="shared") document.documentElement.setAttribute("data-translatebuff-options-theme", "")
document.body.style.cssText="margin:24px;background:var(--rf-background);color:var(--rf-foreground);font-family:system-ui"
function Fixture(){return <main data-fixture="ui" style={{width,maxWidth:"100%"}}>
  <h1>合并契约独立组件回归 · {dark?"暗色":"亮色"}</h1>
  <p>真实共享组件与编译主题；不包含扩展设置、账号、存储或业务接线。</p>
  <section data-fixture="states"><h2>状态与选择</h2><div className="fixture-row">
    <label>On <Switch aria-label="Switch on" defaultChecked /></label>
    <label>Off <Switch aria-label="Switch off" /></label>
    <label>Disabled <Switch aria-label="Switch disabled" defaultChecked disabled /></label>
    <label>Checked <Checkbox aria-label="Checkbox checked" defaultChecked /></label>
    <label>Unchecked <Checkbox aria-label="Checkbox unchecked" /></label>
    <label>Disabled <Checkbox aria-label="Checkbox disabled" defaultChecked disabled /></label>
    <RadioGroup aria-label="Radio group" defaultValue="alpha"><label><RadioGroupItem value="alpha" aria-label="Radio alpha"/>Alpha</label><label><RadioGroupItem value="beta" aria-label="Radio beta"/>Beta</label></RadioGroup>
  </div></section>
  <section data-fixture="buttons"><h2>按钮与输入</h2><div className="fixture-row">
    <Button>默认按钮</Button><Button variant="outline">边框按钮</Button><Button variant="outline-accent">定制化样本</Button><Button variant="accent">强调样本</Button><Button variant="ghost">文字按钮</Button><Button disabled>禁用按钮</Button>
    <Tooltip><TooltipTrigger render={<Button variant="outline-accent"/>}>定制化组合样本</TooltipTrigger><TooltipContent>临时说明</TooltipContent></Tooltip>
    <Popover><PopoverTrigger render={<Button variant="outline-accent"/>}>AI助手组合样本</PopoverTrigger><PopoverContent>临时助手内容</PopoverContent></Popover>
    <Button size="icon-sm" aria-label="Icon button"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10" stroke="currentColor"/></svg></Button>
  </div><p className="text-warning" data-fixture="warning">布局回退警告样本</p><Input aria-label="Normal input" placeholder="临时输入"/><Input aria-label="Invalid input" defaultValue="invalid" aria-invalid="true"/><Input aria-label="Disabled input" defaultValue="disabled" disabled/></section>
  <section data-fixture="portals"><h2>下拉与弹层</h2><div className="fixture-row">
    <Select defaultValue="alpha" items={[{value:"alpha",label:"Alpha model"},{value:"beta",label:"Beta model"}]}><SelectTrigger aria-label="Fixture model"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alpha">Alpha model</SelectItem><SelectItem value="beta">Beta model</SelectItem><SelectItem value="blocked" disabled>Disabled model</SelectItem></SelectContent></Select>
    <Dialog><DialogTrigger render={<Button variant="outline"/>}>打开测试对话框</DialogTrigger><DialogContent><DialogTitle>Fixture dialog</DialogTitle><DialogDescription>临时内容，不读写任何账号或配置。</DialogDescription><Input aria-label="Dialog input"/><DialogClose render={<Button/>}>完成</DialogClose></DialogContent></Dialog>
    <Dialog><DialogTrigger render={<Button variant="outline"/>}>打开宽编辑器样本</DialogTrigger><DialogContent data-custom-action-layout-editor="" className="flex h-[90vh] max-h-[90vh] flex-col overflow-y-auto sm:max-w-[min(1280px,calc(100%-2rem))] lg:overflow-hidden"><DialogTitle>Wide primitive fixture</DialogTitle><DialogDescription>复用实际宽度与列类名的公共Dialog样本，只有临时内容。</DialogDescription><div data-fixture="wide-grid" className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2"><div data-fixture="wide-editor" className="flex min-h-[60vh] min-w-0 flex-col lg:min-h-0"><Input aria-label="Wide editor input" defaultValue="Disposable editor"/></div><div data-fixture="wide-preview"><ButtonGroup aria-label="Preview width"><Button variant="outline" size="xs">320</Button><Button variant="outline" size="xs">500</Button></ButtonGroup><div data-fixture="preview-scroll" className="overflow-auto p-4"><div data-fixture="preview-card" style={{width:500}}>临时500px卡片预览</div></div></div></div></DialogContent></Dialog>
    <Popover><PopoverTrigger render={<Button variant="outline"/>}>打开测试浮层</PopoverTrigger><PopoverContent aria-label="Fixture popover">临时浮层内容</PopoverContent></Popover>
  </div></section>
  <section data-fixture="tabs"><h2>页签</h2><Tabs defaultValue="first"><TabsList><TabsTrigger value="first">第一个</TabsTrigger><TabsTrigger value="second">第二个</TabsTrigger></TabsList><TabsContent value="first">First panel</TabsContent><TabsContent value="second">Second panel</TabsContent></Tabs></section>
  <section data-fixture="layout"><ConfigItem id="custom-actions" orientation="vertical" title="独立编辑器布局"><EntityEditorLayout list={<div data-fixture="list">临时列表</div>} editor={<div data-fixture="editor"><label>名称<Input aria-label="Fixture editor name" defaultValue="Disposable action"/></label></div>}/></ConfigItem></section>
</main>}
createRoot(document.getElementById("root")).render(<Fixture/>)
const style=document.createElement("style")
style.textContent='[data-fixture="ui"]>h1{font-size:20px;font-weight:600;margin-bottom:8px}[data-fixture="ui"]>p{font-size:13px;margin-bottom:20px}[data-fixture="ui"]>section{background:var(--rf-card);border:1px solid var(--rf-border);padding:16px;border-radius:12px;margin-bottom:16px}[data-fixture="ui"] h2{font-weight:600;margin-bottom:14px}.fixture-row{display:flex;flex-wrap:wrap;align-items:center;gap:18px;margin-bottom:16px}.fixture-row>label{display:flex;align-items:center;gap:8px}[data-fixture="buttons"]>input{margin-top:12px}[data-slot="radio-group"] label{display:flex;align-items:center;gap:8px}'
document.head.append(style)
`,
)
await build({
  configFile: false,
  root,
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": resolve("src") } },
  build: { outDir: resolve(".output/merge-ui-fixture"), emptyOutDir: true },
})
