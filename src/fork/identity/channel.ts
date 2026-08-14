// 渠道号：后端按此做来源归因的跨仓契约固定值。单一真源在 channels.json（Node 侧 pack.mjs 读 browser 段
// 推导构建目标、bundle 侧此处读 number 段解析渠道号），两端读不同字段、不重复。
//
// 渠道 id（zip / chrome-store / edge / firefox）由构建期 WXT_FORK_CHANNEL 注入：Vite 编译期静态替换
// （复用 api.ts 的 import.meta.env.WXT_* 血统、绕 t3-env 保 fork 边界）。函数内读、非模块顶层快照，
// 单测用 vi.stubEnv 运行期改它。

import channels from "./channels.json"

interface ChannelEntry {
  /** 后端分配的渠道号；null = 待分配（护栏拦截）。 */
  number: string | null
  /** WXT 构建目标。 */
  browser: string
}

// 渠道 id → 后端渠道（渠道供应商名称 / 号码）映射，供溯源：
//   zip=7100 任译喵-OFFICIAL_WEB · chrome-store=7101 任译喵-Google · edge=7102 任译喵-Edge · firefox=7103 任译喵-FireFox
//   360=7104 任译喵-360 · quark=7105 任译喵-夸克 · qq=7106 任译喵-QQ · sogou=7107 任译喵-搜狗
// 号码是后端「渠道标识(ID)」，id 是本仓构建期内部键。新增渠道若号码待分配，先以 number:null 占位（护栏拦截）。
const CHANNELS = channels as Record<string, ChannelEntry>

/** 默认渠道：官网 zip 直装（号码 7100）。未注入渠道 id 时回落于此。 */
export const DEFAULT_CHANNEL = "zip"

// 构建期解析渠道号：未设 → 默认 zip(7100)；未知 id / 号码未分配 → 抛错（fail-loud 护栏）。
// channels 形参默认取真实注册表；显式传入合成表以单测未知/未分配分支（现网全渠道已分配、无 null 可触发）。
export function resolveChannelNumber(
  id: string | undefined = import.meta.env.WXT_FORK_CHANNEL as string | undefined,
  registry: Record<string, ChannelEntry> = CHANNELS,
): string {
  const key = id || DEFAULT_CHANNEL
  const entry = registry[key]
  if (!entry) {
    throw new Error(`未知渠道 id: ${key}（可选：${Object.keys(registry).join(", ")}）`)
  }
  if (entry.number === null) {
    throw new Error(`渠道 ${key} 号码未分配（待后端分配）`)
  }
  return entry.number
}

// 给官网链接盖渠道戳：追加 ?cid=<渠道号>，供官网归因。用 URL API 稳健合并既有 query（以 &），
// 且 cid 落在 fragment 之前（官网 location.search 才读得到）。
export function appendChannelId(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.set("cid", resolveChannelNumber())
  return parsed.toString()
}
