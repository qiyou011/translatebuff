## REMOVED Requirements

### Requirement: 微软翻译 fork 适配器与仅译文门禁

**Reason**: 上游 #2045 已提供官方的免鉴权 `edge.microsoft.com/translate/translatetext` 实现，并配套 `v092-to-v093` 配置迁移处理「微软 + 仅译文」的存量组合。fork 侧维护一份平行实现不再有收益，反而要在每次同步时对账端点与请求形状——`FORK.md` 已将其标为上游改动频率最高的换皮项。

**Migration**: 删除 `src/fork/providers/microsoft-translate.ts`、`translation-only-gate.ts`、`translation-mode-normalization.ts`、`src/fork/background/correct-legacy-translation-mode.ts`、`src/fork/ui/options/translation-mode.tsx`、`src/fork/ui/host-content/bind-translation-mode-shortcut.ts` 及其测试；从 `FORK_UI_REDIRECTS` 移除对应 3 条重定向。存量用户配置由上游 `v092-to-v093` 迁移：已选微软且处于仅译文模式的，改指 Google 翻译；无可用 Google 条目时回落双语模式。删除动作 MUST 分两步——先删重定向跑全绿，人工确认上游实现在国内网络下可用后再删文件。

## MODIFIED Requirements

### Requirement: 换皮边界与零编辑上游重定向

系统 SHALL 遵循「换皮」约定：provider 选择相关 UI 全部 fork 自绘，**复用**上游逻辑函数与 base-ui 原语，**MUST NOT** 编辑上游 composed UI 源文件，也 MUST NOT 在 fork 组件里直接 import 它们。provider 展示层的 fork 覆盖同样 MUST NOT 原地编辑上游 `provider-display.ts` 与 `provider-registry.ts`。上游 composed UI 到 fork 版的替换 SHALL 通过 `wxt.config.ts` 中的自定义 Vite resolve 插件完成；构建期 SHALL 断言重定向源存在。

由于 `buildStart` **只断言路径存在、不比对内容**，每次同步 MUST 对每条存活的重定向执行 `git diff <上次同步SHA>..<本次目标SHA> -- <from路径>`，逐条判断上游改动是否需要搬进 fork 副本，并把判断结论记入 PR。仅靠构建通过 MUST NOT 被视为换皮仍然正确。

#### Scenario: 零编辑上游源文件

- **WHEN** 执行 `FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs`
- **THEN** 无越界；被换皮的上游 composed UI 源文件均未被编辑

#### Scenario: 重定向源缺失时构建报错

- **GIVEN** `[数据层]` 上游移动或重命名了被换皮的源文件，重定向 `from` 绝对路径失效
- **WHEN** `[API层]` 执行构建（`buildStart`）
- **THEN** 抛出错误指明失效的重定向源，MUST NOT 静默把上游原版 UI 打进产物

#### Scenario: 存活重定向逐条做内容对账

- **GIVEN** `[数据层]` 某条重定向的 `from` 路径在上游依然存在，但内容被上游修改
- **WHEN** 执行同步的对账步骤
- **THEN** 该文件的上游 diff 被打印并逐条判断；判断结论（搬入 / 不搬入及理由）记入 PR

#### Scenario: 换皮迁移到上游新路径

- **GIVEN** `[数据层]` 上游把 `options/pages/api-providers/providers-config.tsx` 重构为目录桶 `providers-config/index.tsx`
- **WHEN** 更新 `FORK_UI_REDIRECTS` 的 `from` 指向新路径后执行构建
- **THEN** 构建通过，且选项页渲染的是 fork 版实现
