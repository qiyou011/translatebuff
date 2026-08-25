## Context

任译喵是 read-frog 的软 fork，靠 merge-only 同步上游翻译引擎，边界纪律见 `FORK_GUIDE.md`。当前落后上游 120 提交，配置 `CONFIG_SCHEMA_VERSION = 86`（上游 93）。

微软删除了旧鉴权端点 `edge.microsoft.com/translate/auth`（404），线上微软翻译完全不可用。上游已在 `f4bcbf08` 修复，但该补丁**既不能 merge 也不能 cherry-pick**，三处硬约束：

| 约束           | 实测事实                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 迁移链撞车     | 上游补丁是 v092→v093；fork 停在 v86，而上游已占用 `v086-to-v087.ts` 至 `v098-to-v099.ts`，自建同名迁移必冲突，且迁移链是 A 类「绝不改」 |
| UI 文件不存在  | 上游改的 4 个 options 文件全是分叉后 #1997 重构新建，fork 分叉点 `e15e5b68` 也没有                                                      |
| 配置字段已改名 | 上游把 `config.translate` 改名为 `config.pageTranslation`，i18n key 也重组，fork v86 没有这些字段                                       |

边界门禁 `scripts/check-fork-boundary.mjs` 是**纯路径判定**（比对 `src/fork/**` 前缀与 `scripts/fork-allowlist.json`），不读文件内容——改任何上游文件都判越界。用户明确禁止改 `fork-allowlist.json` 与 `check-fork-boundary.mjs`，并要求避免后续拉上游时冲突面扩大。

## Goals / Non-Goals

**Goals:**

- 微软翻译在双语模式下真实可用（真实页面翻译成功，不是仅测试通过）。
- 「微软 × 仅译文」这个必然损坏页面的组合无法形成，且用户能看懂为什么。
- 存量用户配置不丢设置。
- 边界门禁越界数 0，不动 `fork-allowlist.json`、不改 `check-fork-boundary.mjs`。
- fork 副本的新逻辑有直接测试覆盖。

**Non-Goals:**

- **不删 warmup 链**（`src/utils/subtitles/warmup/microsoft-warmup.ts` 等 4 个文件）。它已是死代码（除自身测试外无 importer），与本次同源但可独立，另行立项。
- **不做整体上游同步**（MUL-60 的 120 提交），本次只移植微软相关修复。
- **不改门禁机制**。门禁在同步场景 100% 失效是结构性缺陷（历史同步 PR#7 的 137 个改动里 133 个会判越界），但那是独立议题。
- **不追平上游的配置字段改名**。fork 保持 `config.translate`。
- **不隐藏微软**（上游做法），改用置灰。

## Decisions

### D1：fork 复刻适配器 + 构建期重定向，而非原地改上游文件

在 `src/fork/providers/microsoft-translate.ts` 放置修好的适配器，经 `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 交由 `forkUiRedirectPlugin` 在 Vite `resolveId` 阶段接管上游路径。

**为什么不原地改上游文件**：门禁纯路径判定，改了就越界；而 allowlist 与门禁脚本都被明确排除。用户的取舍是宁可 fork 接管文件，也不要后续同步的冲突面越滚越大。

**为什么这个机制可靠**：已有 8 条现役重定向，且不限 UI 组件（`src/entrypoints/translation-hub/atoms.ts` 是状态模块）。插件的 basename 预筛对本次三个 importer 全部命中（末段均为 `microsoft`）；buildStart 断言在上游移动/改名时抛错，把静默失效变成响亮的构建失败。

**代价（已知并接受）**：fork 永久接管该文件，上游后续修复不自动流入，且插件只断言路径存在、不比内容，漂移无告警。

### D2：HTML 实体解码放在 fork 适配器内，共享归一化文件零改动

新端点常开标签对齐器，输入必须 `escapeText`，输出必须解码一次。上游把 `microsoft-translate` 加进 `src/utils/host/translate/translation-output-normalization.ts` 的解码集合。

**为什么不照抄**：该文件被 `execute-translate.ts:84` 用于**所有** provider，复刻它等于让 fork 接管谷歌的解码路径，代价远高于收益。

**额外收益**：`translation-queues.ts:715` 的 `microsoftBatchTranslate` 直接调适配器、**绕过**归一化。解码放适配器内让这条路径也正确，比上游那版更一致。

### D3：`setupFork()` 里一次性纠正存量配置，不写上游迁移

`src/fork/providers/translation-mode-normalization.ts` 提供纯函数（读到 `provider === "microsoft-translate"` 且 `mode === "translationOnly"` 时返回 `bilingual`），`src/fork/background/correct-legacy-translation-mode.ts` 在 `setupFork()` 里调用它并写回。

**为什么不写迁移**：见 Context 的迁移链撞车。

**为什么不是「读时纯函数、不写回」**（这是本决策实施期的修订，原方案与架构审查建议如此）：实测 fork 侧**没有**可挂载的读取点——页面翻译真正读 mode 的地方是 `src/utils/host/translate/core/translation-modes.ts:339`，属上游翻译引擎核心；挂上去要么越界，要么得复刻整个引擎核心文件（放弃 MUL-60 判定的「引擎零冲突资产」）。纯函数因此没有消费方，等于存量用户的坏配置不会被纠正，违反验收标准 3。

**为什么 `setupFork()` 这次是安全的**（架构审查曾以「覆盖不了运行中切换」反对它）：运行中切换现在已由三个 UI 门禁（D4）全部堵住，该反对理由不再成立。新装竞态也不适用——`getLocalConfig()` 在配置未初始化时返回 `null`，此时无存量可纠正、直接跳过；配置损坏时它回退 `DEFAULT_CONFIG`，而默认组合是「微软 + 双语」不含坏组合，因此也不会误写覆盖用户配置。写入走 `setLocalConfig`，只更新 `lastModifiedAt`，不触碰 `schemaVersion` meta，不干扰上游迁移链。

**为什么不放 `src/fork/config/`**：该目录的契约是 fork 独立存储键（`src/fork/config/constants.ts` 注释明确「绝不进上游 configSchema」），而本归一化读的是上游 config，放进去是职责污染。

### D4：三个模式写入口全部拦截，共用一个判定函数

全仓 `config.translate.mode` 只有三个写入口，缺一不可：

| 写入口                                                                                  | 接管方式                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/entrypoints/popup/components/translation-mode-selector.tsx:48`                     | fork 副本，改 `src/fork/ui/popup/App.tsx:12` 的 import（**不占 redirect**——唯一 importer 是 fork 自己） |
| `src/entrypoints/options/pages/translation/translation-mode.tsx:36`                     | fork 副本 + redirect（importer 是上游 `translation/index.tsx`）                                         |
| `src/entrypoints/host.content/translation-control/bind-translation-mode-shortcut.ts:40` | fork 副本 + redirect（importer 是上游 `host.content/runtime.ts:12`）                                    |

判定统一走 `src/fork/providers/translation-only-gate.ts`。注意 featureKey 用 `"translate"`——上游最新版已改名为 `"pageTranslation"`，照抄会 type error。

**为什么 options 那个不能漏**：它直接 `setTranslateConfig(deepmerge(translateConfig, { mode }))`，无任何门禁。切进「仅译文」后 `execute-translate.ts:48` 带 `textFormat: "html"` 调适配器，触发 D5 的硬抛错 → 页面翻译整体失败。

### D5：html 输入硬失败，而非降级

适配器收到 `textFormat === "html"` 直接抛错、不发请求。

**为什么不降级成 plain**：新端点会以目标语相关的方式破坏带属性的 HTML（属性名被翻译、引号被转成弯引号、标签名被吞），无法后处理还原。配置门禁（D4）负责让这个组合形不成，硬抛错是兜底——阻断任何残留路径经 `innerHTML` 注入损坏的标记。

### D6：置灰落在持有 featureKey 的那一层

置灰判定放 `src/fork/ui/options/feature-provider-selector-list.tsx`（该文件第 43/48 行已持有 `featureKey`），仅 `featureKey === "translate"` 时生效。

**为什么不放 `src/fork/components/provider-selector.tsx` / `provider-selector-groups.ts`**：它们是 feature 无关的共享组件。上游 `@/components/llm-providers/provider-selector` 有 4 个 importer 会被重定向到 fork 版——语言检测、自定义动作、划词工具栏、feature 列表。在组件内按 mode 置灰会把这些无关场景的微软一并灰掉。

`src/fork/ui/translation-hub/translation-service-dropdown.tsx` 明确排除：它选的是「对比哪些服务」，不写 `translate.providerId`。

### D7：CI 用 `SKIP_FREE_API: true` 而非 `--exclude` glob

`fork-guard.yml:22` 的 `pnpm run test` 补 `SKIP_FREE_API: true`。`.github/` 是门禁豁免前缀，不动 allowlist、不改门禁脚本。

**为什么必须补**：重定向在 vitest 下不生效（见 R2），`free-api.test.ts:17-23` 会打真实微软端点。该用例**今天就是红的**（端点 404 正是本 bug），补了才能让构建门反映本仓改动。

**为什么不用 glob**：`--exclude="**/free-api.test.ts"` 只挡这一个文件名；日后在 `src/fork/providers/__tests__/` 加实机冒烟测试仍会真打网络、复现 429 偶发红。env 形式由 `free-api.test.ts:4` 那类 `describe.skip` 守卫承载，沿用同一守卫的 fork 测试自动跳过，且本地仍可按需开跑。与 `release.yml:63` 现有写法一致。

## 接口契约

fork 适配器 MUST 保持与上游逐字一致的导出名与重载签名，三个 importer 才能零改动拿到 fork 实现：

```ts
// src/fork/providers/microsoft-translate.ts
export async function microsoftTranslate(
  source: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string>
export async function microsoftTranslate(
  source: string[],
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string[]>
```

```ts
// src/fork/providers/translation-only-gate.ts
export function providerSupportsTranslationOnlyMode(provider: string): boolean
export function canEnterTranslationOnlyMode(config: Config): boolean
```

```ts
// src/fork/providers/translation-mode-normalization.ts —— 纯判定
export function normalizeTranslationMode(config: Config): TranslationMode

// src/fork/background/correct-legacy-translation-mode.ts —— 唯一写回点，由 setupFork() 调用
export async function correctLegacyTranslationMode(): Promise<boolean>
```

fork UI 副本 MUST 保留上游消费方依赖的导出契约：

| fork 副本                                                    | 必须保留                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fork/ui/options/translation-mode.tsx`                   | 具名导出 `TranslationMode`（`translation/index.tsx:18` 是具名导入）；`ConfigCard id="translation-mode"`（`command-palette/search-items.ts:125` 靠该 id 跳转，改掉会静默断链） |
| `src/fork/ui/host-content/bind-translation-mode-shortcut.ts` | 具名导出 `bindTranslationModeShortcutKey`（`host.content/runtime.ts:12`）                                                                                                     |
| `src/fork/ui/popup/translation-mode-selector.tsx`            | default 导出（`src/fork/ui/popup/App.tsx:12` 是默认导入）                                                                                                                     |

依赖在 v86 均已存在，无需新增：`attachRequestErrorMeta`（`src/utils/request/retry-policy.ts:64`）、`escapeText` / `decodeHTMLStrict`（`entities@^8.0.0`）、`resolveProviderConfigOrNull`（`src/utils/constants/feature-providers.ts:69`）。

## 数据流

```
translation-queues.ts:21 ─┐
api/index.ts:5 (桶导出) ──┼─ import "@/utils/host/translate/api/microsoft"
execute-translate.ts:11 ──┘        │
                                   ▼  Vite resolveId 重定向（仅构建期，vitest 下不生效）
                   src/fork/providers/microsoft-translate.ts
                                   │
              textFormat==="html" ─┴─→ throw（不发请求）
                                   │
                     escapeText(输入) → POST edge.microsoft.com/translate/translatetext
                                   │      （无鉴权头、裸字符串数组、from/to 已 encodeURIComponent）
                     decodeHTMLStrict(输出) ←─ 响应
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
execute-translate.ts:84                          translation-queues.ts:715
normalizeTranslationOutput()                     microsoftBatchTranslate
（上游原样：仅 google-translate 解码）              （绕过归一化）
        └──────────── 两条路径各解码恰好一次 ────────────┘
```

## Risks / Trade-offs

**R1 — fork 永久接管适配器，上游修复不自动流入。** 插件 buildStart 只断言上游路径存在、不比内容，漂移无告警。
_应对_：写入 `FORK.md` 的 take-theirs 热点清单，每次同步手工比一次内容。

**R2 — 重定向在 vitest 下不生效。** `vitest.config.ts` 只注册 `WxtVitest()`，而 `node_modules/wxt/dist/testing/wxt-vitest-plugin.mjs` 返回硬编码插件表，不转发 `wxt.config.ts` 的 `vite()` 钩子。后果：上游原版测试继续绿但测的是休眠代码；`src/components/llm-providers/__tests__/feature-provider-selector-list.test.tsx:6` 尤其危险——它测的正是要加置灰的那个文件的上游版，新逻辑零覆盖。
_应对_：所有 fork 副本在 `src/fork/**/__tests__/` 直接 import fork 模块补测，不依赖继承上游测试。模式切换快捷键至今零覆盖（既有 `bind-translation-shortcut.test.ts` 测的是另一个文件），必须从零写。

**R3 — 下次同步会静默双重解码。** 上游 `translation-output-normalization.ts` 是 D 类，迟早 merge 进来并带入含 `microsoft-translate` 的解码集合，届时归一化与 fork 适配器各解一次。反例：原文含字面量 `&amp;` → escape 成 `&amp;amp;` → 解一次得 `&amp;`（对）→ 再解得 `&`（错）。且不冲突、不红。
_应对_：加漂移哨兵测试，断言上游归一化对 `microsoft-translate` 仍不解码，把静默变成红灯。

**R4 — CI 中不再有微软端点的实机验证**（pr-test 排除、release 跳过、fork-guard 本次也排除）。端点二次下线时自动化侧无人报警。
_应对_：人工验收清单显式包含「微软翻译实机跑通」；本地可不设 `SKIP_FREE_API` 跑实机用例确认连通性。

**R5 — 上游 `api/__tests__/microsoft.test.ts` 保持原样，绿但测的是休眠代码。** 这是换皮方案的固有代价（上游原版连同其测试一起休眠）。
_应对_：作为已知限制写进交付说明，覆盖由 fork 侧测试承担。

**R6 — locale 文案可能触发品牌门禁。** `scripts/check-fork-brand.mjs` 会扫真实 locale 文件的禁用 token（`Read Frog` / `陪读蛙` / `陪讀蛙` / `読書カエル` / 小写 b 的 `Translatebuff`）。
_应对_：新增文案避开这些 token，提交前跑 `node scripts/check-fork-brand.mjs`。

**回滚策略**：本次改动全部可逆——移除 `wxt.config.ts` 的 3 条 redirect 条目即回落到上游原版实现（回到当前的失效状态，但不引入新故障）；`src/fork/**` 新增文件可整体删除；`fork-guard.yml` 的 env 单独回退不影响功能。

## Open Questions

无。探索阶段的全部裁决点（门禁策略、迁移方式、置灰 vs 隐藏、warmup 范围、快捷键行为、CI 排除写法、归一化落点）均已确认，架构审查已通过。
