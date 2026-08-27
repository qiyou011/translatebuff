// 发行版（edition）：cn = 国内线（translatebuff.cn），global = 海外线（translatebuff.com）。
// 两条线独立部署、独立后端与用户池，产物必须互不串味——域名、商店身份、官网跳转路径都由它分流。
//
// 构建期由 scripts/pack.mjs 注入 WXT_FORK_EDITION：Vite 编译期静态替换 import.meta.env.WXT_FORK_EDITION
// （复用 channel.ts 的血统，绕 t3-env 保 fork 边界）。Node 侧（wxt.config.ts / pack.mjs）走 process.env，
// 两处共用本文件的 resolveEdition 一份解析实现。

export type ForkEdition = "cn" | "global"

const EDITIONS: readonly ForkEdition[] = ["cn", "global"]

/** 默认发行版：国内线。未注入时回落于此，保证既有命令行为不变。 */
export const DEFAULT_EDITION: ForkEdition = "cn"

// 归一 edition：空/未传 → 默认；未知值抛错（fail-loud，绝不静默回落——回落会打出一个
// 名为海外、实指国内后端的包，构建期无声、用户登录才炸）。
export function resolveEdition(raw?: string): ForkEdition {
  if (!raw) {
    return DEFAULT_EDITION
  }
  if (!EDITIONS.includes(raw as ForkEdition)) {
    throw new Error(`未知 edition: ${raw}（可选：${EDITIONS.join(", ")}）`)
  }
  return raw as ForkEdition
}

// 当前发行版。函数内读、非模块顶层快照——与 resolveChannelNumber 同款理由：单测用 vi.stubEnv 运行期改它。
export function currentEdition(): ForkEdition {
  return resolveEdition(import.meta.env.WXT_FORK_EDITION as string | undefined)
}
