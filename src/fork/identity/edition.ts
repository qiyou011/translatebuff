// 发行版（edition）：cn = 国内线（translatebuff.cn），global = 海外线（translatebuff.com）。
// 两条线独立部署、独立后端与用户池，产物必须互不串味——域名、商店身份、官网跳转路径都由它分流。
//
// 构建期由 scripts/pack.mjs 注入 WXT_FORK_EDITION：Vite 编译期静态替换 import.meta.env.WXT_FORK_EDITION
// （复用 channel.ts 的血统，绕 t3-env 保 fork 边界）。Node 侧（wxt.config.ts / pack.mjs）走 process.env，
// 两处共用本文件的 resolveEdition 一份解析实现。
//
// ── 分叉落点索引 ────────────────────────────────────────────────────────────────
// 按 edition 取值的位置全在下表。**新增分叉点必须登记到这里。**
//
// | 位置                                    | 分的是什么                          | 运行上下文        |
// |-----------------------------------------|-------------------------------------|-------------------|
// | .env.production / .env.global.production| 域名类变量（官网、授信 origin、     | dotenv，构建期注入 |
// |                                         | cookie 域、登录后端、翻译网关）     |                   |
// | .env / .env.global                      | 同上，但指测试后端（本地 gitignored）| dotenv，构建期注入 |
// | fork/website-routes.ts                  | 登录/订单/卸载问卷/反馈四条跳转路径 | bundle 运行期     |
// | fork/identity/channels.json             | 渠道号与 edition 归属               | JSON，两侧共读    |
// | fork/identity/channel.ts DEFAULT_CHANNEL| 各线默认渠道                        | bundle 运行期     |
// | wxt.config.ts                           | 商店显示名、Firefox 扩展 ID、        | Node 构建期       |
// |                                         | 产物目录后缀、测试包文件名后缀      |                   |
// | scripts/pack.mjs                        | edition → 配置源文件、渠道范围       | Node 打包         |
// | scripts/assert-fork-build.mjs           | edition → 配置源文件、默认产物目录   | Node 断言         |
//
// 这些落点横跨 dotenv / bundle 运行期 / Node 构建期三个上下文，物理上合不成一个文件——
// env 值必须留 dotenv（WXT 注入链 + 「禁止服务端密钥」的边界写在文件头），channels.json 必须是 JSON
// （.mjs 与 TS 两侧共读），wxt.config.ts 拿不到 bundle 侧的 currentEdition()。详见
// openspec/changes/fork-global-edition/design.md 的 D1–D3。
//
// 刻意不做机器校验：wxt.config.ts / pack.mjs 里的分叉是字符串条件（edition === "global"），
// 两份 env 更是纯数据，扫描比对必然高误报——一个会误报的脆弱测试比没有更糟。索引放在本文件
// 而非独立文档，是因为任何新分叉点都必须 import 这里的 currentEdition / resolveEdition，改的人一定看得到。
// ────────────────────────────────────────────────────────────────────────────────

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
