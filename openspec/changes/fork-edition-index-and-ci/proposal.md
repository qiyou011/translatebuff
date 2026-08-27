## Why

edition（cn / global）维度已落地，但它的**可维护性**没跟上，两处具体缺口：

**一、差异落点没有索引。** 按 edition 分叉的取值散在 7 处（两份 env、路径表、渠道注册表、`channel.ts` 默认渠道、`wxt.config.ts` 商店身份与产物命名、`pack.mjs` 与 `assert-fork-build.mjs` 各自的配置源映射）。它们横跨 dotenv / bundle 运行期 / Node 构建期三个上下文，物理上合不成一个文件（详见 `fork-global-edition` 的 design D1–D3）。但现在连「一共有哪几处」都得靠 grep 才盘得出来——加第 8 处时没有地方登记，漏改的失败形态是静默的。

**二、CI 对海外线零覆盖。** `fork-guard.yml` 跑 `pnpm run build`（不经 `pack.mjs`，不注入 edition），再跑一次 `assert-fork-build.mjs`（默认 `.output/chrome-mv3`）。所以：海外线一次都没构建过，edge / firefox 产物构建了但从未被断言。海外配置被改坏——比如某个 `WXT_*` 漏配回落到国内域——CI 全绿，直到有人手动打包才发现。

## What Changes

- **`edition.ts` 顶部挂差异落点索引**：一张表列出全部分叉点及其职责，作为「加新分叉点必须登记」的落脚处。纯注释，零逻辑改动。
- **CI 增加海外线出包验证**：`fork-guard.yml` 新增一步，用 `pack.mjs store --edition global --channel global-zip` 真跑一次海外正式包——走的是人实际会用的那条命令，而不是在 YAML 里重写一遍 env 注入。
- **CI 的断言覆盖补全**：现有 `assert-fork-build.mjs` 只验 chrome 产物，edge / firefox 白构建；改为逐个产物目录都验。
- **不做的事**：不拆分支（已确认）；不把 7 处分叉点合并成总表（跨三个运行上下文，代价大于收益）；不在 CI 里打全部 12 个渠道包（每线一个代表渠道即可覆盖配置错误，全打是纯浪费）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `fork-global-edition`：新增「两条 edition 均须在 CI 通过出包验证」与「分叉落点须集中登记」两条要求。

## Impact

**依赖**

- CI 环境已有 `.env.production` 与 `.env.global.production`（均随仓入库），海外线出包所需配置齐备，无需新增 secrets。

**待决策**

- 国内线是否也改走 `pack.mjs store --channel zip`（与海外线对称、测的是真实命令），还是保留现有 `pnpm run build`。见 design D2。

**风险**

- **CI 时长增加**：现有 3 次构建，新增 1 次海外构建约 +30%。海外那次同时覆盖「配置正确」与「双向域名断言生效」两件事，是目前唯一能拦住海外配置回归的手段，这个代价值得。
- **索引会过期**：注释型索引没有强制力，加了第 8 处分叉点却不登记，索引就开始骗人。缓解办法是把它放在 `edition.ts`——任何新分叉点都必须 import 这个模块，改的人一定会看到那张表。做不到机器校验，这是取舍。

⚠️ 本变更从 MUL-67 的架构讨论中拆出：产品已确认**不拆分支**（插件侧分线代码仅占 fork 代码 ~1%，而拆分支会让每次上游同步的对账成本翻倍）。本变更是「不拆分支」这个决定的配套护栏。
