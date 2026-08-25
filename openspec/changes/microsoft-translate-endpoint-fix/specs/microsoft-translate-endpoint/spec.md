## ADDED Requirements

### Requirement: fork 接管微软翻译适配器

系统 SHALL 在 `src/fork/providers/microsoft-translate.ts` 提供微软翻译适配器，并经 `forkUiRedirectPlugin` 重定向接管上游 `src/utils/host/translate/api/microsoft.ts`。上游原文件 MUST NOT 被编辑。fork 副本 MUST 保持与上游相同的导出名与函数签名，使三个 importer（`execute-translate.ts`、`api/index.ts` 桶导出、`background/translation-queues.ts`）无需改动即可拿到 fork 实现。

#### Scenario: 构建产物走 fork 适配器

- **WHEN** 执行 `pnpm run build` 后检查产物
- **THEN** 微软翻译调用解析到 `src/fork/providers/microsoft-translate.ts`，上游 `api/microsoft.ts` 不出现在运行路径中

#### Scenario: 上游文件零编辑

- **WHEN** 对本次变更运行 `FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs`
- **THEN** 输出 `Fork boundary OK`，越界文件数为 0

#### Scenario: 上游移动文件时构建响亮失败

- **GIVEN** 上游把 `src/utils/host/translate/api/microsoft.ts` 移动或改名
- **WHEN** 执行构建
- **THEN** `forkUiRedirectPlugin` 的 buildStart 断言抛错，指出重定向目标源文件不存在，而不是静默回落到上游实现

### Requirement: 免鉴权端点请求编码

适配器 SHALL 请求 `https://edge.microsoft.com/translate/translatetext`，MUST NOT 再请求已下线的 `edge.microsoft.com/translate/auth`，且 MUST NOT 携带 `Ocp-Apim-Subscription-Key` 或 `Authorization` 头。请求体 MUST 为裸 JSON 字符串数组（旧的 `[{ Text }]` 形状会被服务端拒绝）；`from` 与 `to` 是仅有的生效查询参数，二者 MUST 经 `encodeURIComponent` 编码；`fromLang` 为 `auto` 时 MUST 传空串。

新端点对每个请求都运行标签对齐器，裸 `<` 会被融合成伪标签，故送出前每条文本 MUST 经 `escapeText` 转义。

#### Scenario: 请求形状正确

- **WHEN** 以 `["a < b"]`、`from=en`、`to=zh` 调用适配器
- **THEN** 请求 URL 指向 `translatetext` 端点、无鉴权头，请求体为字符串数组且 `<` 已转义为实体

#### Scenario: 自动检测语种传空 from

- **WHEN** 以 `fromLang = "auto"` 调用适配器
- **THEN** 查询参数 `from` 为空串，请求正常发出

### Requirement: 输出实体解码恰好一次

适配器 SHALL 在返回前对响应文本执行一次 `decodeHTMLStrict`。上游共享文件 `src/utils/host/translate/translation-output-normalization.ts` MUST NOT 被修改——其解码集合仍只含 `google-translate`，微软的解码由 fork 适配器自行承担，确保 `execute-translate.ts` 与 `translation-queues.ts` 两条调用路径都只解码一次。

系统 SHALL 提供漂移哨兵测试：断言上游归一化对 `microsoft-translate` 仍不解码。该测试在下次同步上游把微软加进解码集合时 MUST 失败，把静默的双重解码变成响亮的红灯。

#### Scenario: 实体只解一次

- **GIVEN** 原文包含字面量 `&amp;`
- **WHEN** 经微软翻译往返
- **THEN** 结果中该片段为 `&amp;`，既未残留 `&amp;amp;`（漏解）也未变成 `&`（双解）

#### Scenario: 哨兵捕获上游漂移

- **WHEN** 上游归一化把 `microsoft-translate` 加入 HTML 解码集合
- **THEN** 漂移哨兵测试失败并指出需要移除 fork 适配器内的解码

### Requirement: html 输入硬失败

新端点没有保留标记的模式，会以目标语相关的方式破坏带属性的 HTML（属性名被翻译、引号被转成弯引号、标签名被吞），且无法后处理还原。适配器在收到 `textFormat === "html"` 时 MUST 直接抛错，MUST NOT 发出请求，以阻断任何残留路径经 `innerHTML` 注入损坏的标记。

#### Scenario: html 格式被拒绝

- **WHEN** 以 `options.textFormat = "html"` 调用适配器
- **THEN** 立即抛出错误、不发起网络请求

### Requirement: 网络与响应错误携带重试元数据

适配器 SHALL 对网络异常调用 `attachRequestErrorMeta` 标注 `{ kind: "network", isRetryable: true }`；对非 2xx 响应 SHALL 标注 `statusCode` 与 `responseHeaders`，使上游重试策略可据此决策。

#### Scenario: 非 2xx 响应带状态码

- **WHEN** 端点返回 429
- **THEN** 抛出的错误携带 `statusCode = 429` 与响应头

### Requirement: 「微软 + 仅译文」组合不可形成

「仅译文」页面模式经 `innerHTML` 重渲染 provider 输出，与无标记支持的微软端点组合必然损坏页面。系统 SHALL 在 `config.translate.mode` 的**全部三个写入口**拦截该组合的形成：popup 模式切换按钮、options 模式选择器、模式切换快捷键。

三者 MUST 共用同一判定函数（`src/fork/providers/translation-only-gate.ts`），该函数经 `resolveProviderConfigOrNull(config, "translate")` 取网页翻译 provider——注意 fork 的 featureKey 是 `translate`，不是上游最新版的 `pageTranslation`。

拦截 MUST 保持当前模式不变并说明原因，MUST NOT 静默失败。

#### Scenario: popup 按钮拦截并说明

- **GIVEN** 网页翻译 provider 为微软、当前为双语模式
- **WHEN** 点击 popup 模式切换按钮
- **THEN** 模式不变，按钮呈禁用外观但仍可悬停，tooltip 说明微软不支持仅译文模式

#### Scenario: options 模式选择器拦截

- **GIVEN** 网页翻译 provider 为微软
- **WHEN** 在 options 模式选择器中选择「仅译文」
- **THEN** 模式不写入配置，并就地说明原因

#### Scenario: 快捷键拦截并提示

- **GIVEN** 网页翻译 provider 为微软、当前为双语模式
- **WHEN** 按下模式切换快捷键
- **THEN** 模式不变，弹出 toast 说明微软不支持仅译文模式

#### Scenario: 非微软 provider 不受影响

- **GIVEN** 网页翻译 provider 为谷歌或任译喵
- **WHEN** 经上述任一入口切到「仅译文」
- **THEN** 正常切换，无拦截、无提示

### Requirement: 仅译文模式下微软在网页翻译选择器中置灰

系统 SHALL 在「仅译文」模式激活时，把微软翻译在**网页翻译**的 provider 选择器中呈现为禁用态并说明原因，而非从列表隐藏——该选择器是 fork 自有 UI，由 fork 自行维护，置灰比消失更可解释。

置灰判定 MUST 落在持有 `featureKey` 的 `src/fork/ui/options/feature-provider-selector-list.tsx`，且 MUST 仅在 `featureKey === "translate"` 时生效。`src/fork/components/provider-selector.tsx` 与 `provider-selector-groups.ts` MUST NOT 承载此判定——它们是 feature 无关的共享组件，上游 `@/components/llm-providers/provider-selector` 的四个 importer 都会被重定向到它，在其中置灰会误伤语言检测、自定义动作与划词工具栏。

`src/fork/ui/translation-hub/translation-service-dropdown.tsx` MUST NOT 置灰——它选择的是「对比哪些服务」，不写 `translate.providerId`。

#### Scenario: 仅译文模式下网页翻译行微软置灰

- **GIVEN** 当前为「仅译文」模式
- **WHEN** 打开 options 的功能 provider 列表
- **THEN** 网页翻译行的微软项呈禁用态并说明原因，仍可见、不可选

#### Scenario: 其他功能行不受影响

- **GIVEN** 当前为「仅译文」模式
- **WHEN** 查看划词翻译、语言检测、自定义动作等行
- **THEN** 微软项正常可选，无禁用态

#### Scenario: 双语模式下无禁用态

- **GIVEN** 当前为双语模式
- **WHEN** 打开功能 provider 列表
- **THEN** 所有行的微软项均正常可选

### Requirement: 存量配置一次性纠正

已选中「微软 + 仅译文」的存量用户配置 SHALL 在后台启动时（`setupFork()`）被纠正为 `bilingual` 并写回存储。判定 MUST 由纯函数承担，写回 MUST 只在读到确实带该组合的配置时发生——配置未初始化（`getLocalConfig()` 返回 `null`）时 MUST 安静跳过，避免与上游 `ensureInitializedConfig` 的新装竞态；读写失败 MUST NOT 冒泡打断 `setupFork()` 的其余接线。

系统 MUST NOT 新增上游配置迁移脚本：fork 的 `CONFIG_SCHEMA_VERSION` 停在 86，而上游已占用 `v086-to-v087.ts` 至 `v098-to-v099.ts`，自建同名迁移会在下次同步时正面冲突，且迁移链属 fork 边界纪律的 A 类「绝不改」。

归一化 MUST NOT 落在 `src/fork/config/`——该目录的契约是 fork 独立存储键，而本归一化读的是上游 config。

#### Scenario: 存量组合被纠正

- **GIVEN** 存量配置为 `provider = microsoft-translate` 且 `mode = translationOnly`
- **WHEN** 后台启动执行 `setupFork()`
- **THEN** 配置被写回为 `mode = bilingual`，`translate` 下其余字段与其他配置项原样保留

#### Scenario: 其他组合不写

- **GIVEN** 存量配置为 `provider = google-translate` 且 `mode = translationOnly`
- **WHEN** 后台启动执行 `setupFork()`
- **THEN** 不发生写入，模式保持 `translationOnly`

#### Scenario: 配置未初始化时跳过

- **GIVEN** 新装或上游 `initializeConfig` 尚未跑完，`getLocalConfig()` 返回 `null`
- **WHEN** 后台启动执行 `setupFork()`
- **THEN** 不发生写入、不抛错

#### Scenario: 不新增上游迁移

- **WHEN** 检查 `src/utils/config/migration-scripts/`
- **THEN** 无新增文件，`CONFIG_SCHEMA_VERSION` 保持 86

### Requirement: fork 副本自带测试覆盖

因 `WxtVitest()` 不转发 `wxt.config.ts` 的 vite 插件，重定向在 vitest 下不生效——上游原版测试会继续通过但测的是休眠代码。所有 fork 副本的新逻辑 SHALL 在 `src/fork/**/__tests__/` 中直接 import fork 模块补测，MUST NOT 依赖继承上游测试。

需覆盖：适配器（请求编码、解码、html 拒绝、错误元数据）、门禁判定函数、运行时归一化、置灰判定（仅 `featureKey === "translate"`）、options 模式选择器、模式切换快捷键。其中模式切换快捷键至今零覆盖——既有的 `bind-translation-shortcut.test.ts` 测的是另一个文件（页面翻译开关）。

fork 副本 MUST 保留上游消费方依赖的导出契约：options 模式选择器导出具名 `TranslationMode` 并保留 `ConfigCard id="translation-mode"`（`command-palette/search-items.ts` 靠该 id 做设置项跳转）；快捷键导出具名 `bindTranslationModeShortcutKey`；popup 模式选择器保持 default 导出。

#### Scenario: 每个 fork 副本都有直接覆盖

- **WHEN** 运行 `pnpm run test`
- **THEN** 上述各项均有直接 import fork 模块的测试通过

#### Scenario: 导出契约不断链

- **WHEN** 构建后打开 options 并经命令面板跳转到「翻译模式」设置项
- **THEN** 正确滚动定位到该卡片，未因 fork 副本改动导出名或卡片 id 而断链
