# 复盘 · fork-multi-channel-attribution

## 背景与目标

任译喵上多个应用市场（Chrome 商店 / Edge / Firefox）+ 官网 zip 直装，后端与官网按渠道号做来源归因。原渠道号 `7100` 硬编码在 `api.ts`，所有市场共用一个号 → 来源无法区分、获客/转化归因失真。目标：每个市场产物携带各自渠道号，贯通「UA 上报」与「官网 cid 跳转」两条链路，且不破软 fork 边界。

两条锁定决策：① 渠道正交于浏览器（同一 chrome 构建能出 zip=7100 与 chrome-store=7101 两个渠道）；② 默认 7100 + 发布护栏。

## 遇到的问题及挑战

1. **package.json 越界坑（探查期发现，改变了机制选型）**：原方案想用 `pnpm zip:chrome-store` 命名脚本，探查 `check-fork-boundary.mjs` 发现 `package.json` 既不在 allowlist 也不在豁免前缀 → 改它触发越界。故构建入口全部落 `scripts/pack.mjs`（`scripts/` 属豁免区），零 package.json 改动。

2. **同浏览器双渠道文件名撞车**：正交模型下 `zip` 与 `chrome-store` 都是 chrome 构建，默认产物名 `-{{browser}}.zip` 会互相覆盖且渠道号看不出。解法：产物名改按渠道 id（`-zip.zip` / `-chrome-store.zip`），dev 裸打包仍回退 `-{{browser}}`。

3. **buildStart 护栏落点纠偏**：tasks 原写「号码非 null 断言落 `assert-fork-build.mjs`」，实现时发现它只在 pack.mjs 调用时触发、**挡不住直接 `WXT_FORK_CHANNEL=edge wxt zip` 旁路**。改落 `wxt.config.ts` 生产 `buildStart`（`check-fork-channel` 插件）——任何生产构建都触发，真正把「运行期首个请求才崩」前移到构建期，且免动 `.d.mts`。实测 109ms fail-fast。

4. **cid 出口中途扩容**：探索期定 login + uninstall 两处、订单页作为「登录后页」排除；实施后用户确认订单/支付页也需按渠道归因转化 → 扩为三处。因当初把 cid 收敛成通用助手 `appendChannelId(url)`，新增订单出口只改一行。

5. **号码分配后测试失效（关键）**：后端分配 chrome-store=7101 后，原来拿 chrome-store 当「number=null」示例的两个测试（channel.test / api.test）失效。解法：给 `resolveChannelNumber` 加可注入 `registry` 形参（默认真实表），null 护栏分支改用注入合成表测试；同时把 chrome-store 从「抛错」断言升级为「段4=7101」正向断言（号码就位后反而能写更强的测试）。

6. **零散小坑**：`resolveChannelNumber` 的 `channels` 形参撞模块顶层 `import channels` → `no-shadow` lint 报错，改名 `registry`；oxlint `vitest/require-to-throw-message` 要求 `toThrow` 带消息 → 顺手把断言精确到 `/未分配/`。

7. **guide 测试的本地 .env 假失败**：全量套件 3 处 `src/utils/guide/` 失败，核实为本地 `.env` 覆盖 `WXT_WEBSITE_URL`、断言期望上游 `readfrog.app` 的既有现象（CI 无 .env 常绿），与本变更无关。

## 架构/设计偏离说明

- **tasks 5.1 落点**：`assert-fork-build.mjs` → `wxt.config` 生产 buildStart（更优，封死直接 `wxt zip` 旁路）。
- **`resolveChannelNumber` 签名**：增 `registry` 注入形参——号码分配后为保 null 护栏分支可单测而加，属正当依赖注入 seam。
- **cid 出口数**：设计 2 处（login/uninstall）→ 实际 3 处（+订单页，用户确认转化归因需要）。spec Requirement 与场景已同步。
- **Simplify 阶段收敛**：wxt.config buildStart 改调 channel.ts 的 `resolveChannelNumber`（两 TS 消费点共享单一校验体）；`check-fork-brand` 移出 `--all` 每渠道循环、只跑一次。跨运行时的 pack.mjs（.mjs）保留自身 node 侧校验（无法 import .ts，且提供 spawn 前快速失败），属合理分工，未强抽共享模块。

## 总结与后续优化点

- **null 占位 + 三层护栏**（解析期 throw / pack.mjs CLI / 构建期 buildStart）让「渠道号未就位」显式暴露而非静默错误发包。这套模式对未来新增渠道（如国内 360/QQ/搜狗商店）**零脚本改动可扩**——`channels.json` 加一行即可。
- **单一真源 channels.json 双端消费**（bundle 读 number、Node 读 browser 推导目标）是本次做对的核心，避免了渠道↔浏览器填错配。
- **后续待办**：① 官网 `translatebuff-web` 读 `cid` 落库归因，需覆盖登录/订单/卸载**三个页**；② `pack.mjs test` 暂不支持逐渠道 QA 包（用户确认不需要，store 包 QA）；真机已验证 edge 包登录跳转正确带 `cid=7102`，归因链路端到端跑通。
