## MODIFIED Requirements

### Requirement: 三浏览器构建门

系统 SHALL 在合入长期分支前要求 chrome、edge、firefox 三个目标的 `wxt build` 与 `pnpm run test` 全部通过。

构建门 SHALL 额外包含一项 manifest 级断言：产物 manifest 的 `content_scripts` 与 `host_permissions` 中 MUST NOT 出现合作方站点 `jalapeno-cloud.ai`。

构建门 MUST NOT 包含「产物中不得出现某关键串」式的断言——上游商业化标识的真源位于 A 类 take-theirs 文件，此类断言不可满足。防漏网由 fork 侧的 provider 枚举测试承担。

#### Scenario: 构建门作为合并前置

- **WHEN** CI 运行 `pnpm run build`、`build:edge`、`build:firefox` 与 `pnpm run test`
- **THEN** 任一失败即阻止 PR 合入

#### Scenario: manifest 含合作方站点时阻断

- **GIVEN** `[数据层]` 合作方内容脚本被重新带入
- **WHEN** 构建门执行 manifest 断言
- **THEN** 断言失败并打印命中的站点，PR 不得合入
