## MODIFIED Requirements

### Requirement: 换皮边界与零编辑上游重定向

系统 SHALL 遵循「换皮」约定：provider 选择相关 UI 全部 fork 自绘，**复用**上游逻辑函数（`getSelectableProvidersForCapability`、`buildFeatureProviderPatch`、`executeTranslate`、`extractErrorMessage`、provider 谓词）与 base-ui 原语，**MUST NOT** 编辑上游 composed UI 源文件（`provider-selector.tsx`、`providers-config.tsx`、`feature-provider-selector-list.tsx`、上游 popup `providers-field.tsx`），也 MUST NOT 在 fork 组件里直接 import 它们。**provider 展示层的 fork 覆盖（logo 解析、内置 AI provider logo 常量）同样 MUST NOT 原地编辑上游 `src/utils/providers/provider-display.ts` 与 `provider-registry.ts`，SHALL 改为 fork 模块 + 换皮重定向。** 上游 composed UI 到 fork 版的替换 SHALL 通过 `wxt.config.ts` 中的自定义 Vite resolve 插件（按解析后的绝对路径重定向）完成，全局生效；构建期 SHALL 断言重定向源存在（上游移动/重命名时报错而非静默回落）。

#### Scenario: 零编辑上游源文件

- **WHEN** 执行 `FORK_DIFF_BASE=origin/change/fork-foundation node scripts/check-fork-boundary.mjs`
- **THEN** 无越界；上游 `provider-selector.tsx`/`providers-config.tsx`/`feature-provider-selector-list.tsx`/上游 popup `providers-field.tsx` 均未被编辑

#### Scenario: provider 展示层经重定向覆盖

- **GIVEN** `[数据层]` fork 需要把任译喵实例的 logo 解析为品牌图标
- **WHEN** 任一处 import 解析到上游 `provider-display.ts` 或 `provider-registry.ts` 的绝对路径
- **THEN** 被重定向到 fork 版；上游两个源文件的 git diff 为空

#### Scenario: resolve 插件全局重定向

- **GIVEN** `[数据层]` `wxt.config.ts` 注册了 fork 的 Vite resolve 插件
- **WHEN** 任一处 import 解析到上游 `provider-selector.tsx` 或 `providers-config.tsx` 的绝对路径
- **THEN** 被重定向到对应 fork 版；四处选择器与选项页均使用 fork 实现

#### Scenario: 重定向源缺失时构建报错

- **GIVEN** `[数据层]` 上游移动或重命名了被换皮的源文件，重定向 `from` 绝对路径失效
- **WHEN** `[API层]` 执行构建（`buildStart`）
- **THEN** 抛出错误指明失效的重定向源，MUST NOT 静默把上游原版 UI 打进产物
