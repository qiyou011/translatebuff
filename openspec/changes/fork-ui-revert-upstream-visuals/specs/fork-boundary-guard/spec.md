## MODIFIED Requirements

### Requirement: in-place 编辑 allowlist

系统 SHALL 维护一份枚举清单 `scripts/fork-allowlist.json`，列出 fork 唯一允许原地编辑的上游文件；向清单增项 MUST 经过评审。清单 MUST 保持**逐文件枚举**语义，MUST NOT 引入目录前缀式放行——前缀会让日后落入该目录的任意源文件被静默放过。

清单 SHALL 覆盖 fork 对上游二进制素材与根级配置文件的替换（品牌图标、商店素材、`package.json`、`.env.example`），以及 fork 主动删除的上游文件；这些条目在同步模式下会出现在差集里，不登记就会被判越界。

#### Scenario: allowlist 覆盖已知原地编辑面

- **WHEN** 读取 `scripts/fork-allowlist.json`
- **THEN** 清单包含 `wxt.config.ts`、`src/entrypoints/background/index.ts`、`src/utils/constants/app.ts`、各 `app.tsx` 壳、auth/orpc 客户端、`uninstall-survey.ts` 与 9 个 `src/locales/*.yml`

#### Scenario: 素材替换逐条登记

- **GIVEN** `[数据层]` fork 替换了上游的 `public/icon/128.png` 与 `assets/banner.png`
- **WHEN** 以上游落脚点为基准执行边界判定
- **THEN** 两者均因在 `files` 数组中被逐条登记而放行

#### Scenario: 拒绝前缀式放行

- **GIVEN** `[数据层]` 有人向 allowlist 追加了目录前缀条目
- **WHEN** 评审该改动
- **THEN** MUST 拒绝；需要放行的文件逐条列出

### Requirement: CI 边界检查

系统 SHALL 提供一个可测试的边界判定函数，对改动文件分类：`src/fork/**` 与 allowlist 内文件放行，其余上游文件判为越界（violation）。CI MUST 在越界时使 PR 失败。

边界检查工作流 MUST 对**所有分支**的 Pull Request 生效，MUST NOT 只在目标分支为 `main` 时触发。长期分支（`main`、`change/*`）MUST 只接受经 PR 的合入。

判定基准 SHALL 分两种模式，工作流按分支名分流：

- **增量模式**（默认）：基准 `origin/<base_ref>`，差集语义是「本次 PR 自己改了什么」，用于日常 `feat/*` 与 `fix/*` PR。
- **同步模式**（分支名匹配 `feat/upstream-sync-*`）：基准 MUST 是本次合并进来的上游提交，差集语义是「fork 相对上游的自有改动」。同步分支上若误用增量模式，三点差集等于全量上游改动（数百个文件），会把同步 PR 全部判红。

  基准 SHALL 由「本分支上最近一个『第二父不是 base 分支祖先』的 merge 提交的第二父」推导，或由命令行 `FORK_SYNC_BASE=<sha>` 显式给定。推导 MUST NOT 依赖 `git rev-parse HEAD^2`——CI 中 `actions/checkout` 检出的是合成 merge ref，其第二父是 PR 分支 tip 而非上游提交，取它会让差集近乎为空、边界检查**空转恒绿**；本地在门禁步骤时 HEAD 通常也已不是合并提交。

  两条路径 MUST 都通过同一道校验：`git merge-base --is-ancestor $BASE HEAD` 成立，且 `git merge-base --is-ancestor $BASE origin/$BASE_REF` 不成立。

  基准推导失败或校验不通过时 MUST 硬失败退出，MUST NOT 回落到增量模式——静默降级等同于不做检查。

  同步模式的工作流 MUST 以 PR 分支 tip 为 HEAD 检出（`ref: ${{ github.event.pull_request.head.sha }}`），MUST NOT 依赖默认的合成 merge ref。

排查模式 `FORK_SCAN_ALL=1` 的基准取 `src/fork/identity/upstream-baseline.json` 的 `forkPointSha`，MUST NOT 硬编码在脚本或工作流里；该模式 MUST NOT 参与 CI 判定。

#### Scenario: 越界改动被标记

- **WHEN** 改动包含 `src/utils/message.ts`（不在 allowlist）与 `src/fork/x.ts`
- **THEN** 边界判定返回 violations 恰为 `["src/utils/message.ts"]`

#### Scenario: 合规改动通过

- **WHEN** 改动仅包含 `src/fork/**` 文件或 allowlist 内文件
- **THEN** 边界判定返回空 violations，CI 边界检查通过

#### Scenario: 非 main 目标分支的 PR 同样受检

- **GIVEN** `[数据层]` 一个 PR 的目标分支是 `change/fork-foundation`
- **WHEN** 该 PR 包含对 `src/components/ui/base-ui/button.tsx` 的原地修改
- **THEN** `fork-guard` 工作流被触发并判定越界，PR 失败

#### Scenario: 同步分支走同步模式

- **GIVEN** `[数据层]` 分支名为 `feat/upstream-sync-v1-43-6`，已合并上游 `53b54d68`，其后又有若干 fork 自有提交
- **WHEN** CI 执行边界检查
- **THEN** 基准推导为 `53b54d68`（而非 `origin/change/fork-foundation`，也不是分支 tip）；violations 中不含任何纯上游文件

#### Scenario: 基准推导不出时硬失败

- **GIVEN** `[数据层]` 分支上找不到符合条件的 merge 提交，且未给 `FORK_SYNC_BASE`
- **WHEN** 执行同步模式
- **THEN** 脚本以非零码退出并说明原因；MUST NOT 回落增量模式、MUST NOT 输出「Fork boundary OK」

#### Scenario: 基准等于 base 分支 tip 时判为无效

- **GIVEN** `[数据层]` 推导或显式给定的基准是 `origin/change/fork-foundation` 的 tip
- **WHEN** 执行校验 `git merge-base --is-ancestor $BASE origin/$BASE_REF`
- **THEN** 该条成立即判基准无效，脚本硬失败

#### Scenario: 排查模式基准取自机读真源

- **WHEN** 执行 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs`
- **THEN** 基准取自 `src/fork/identity/upstream-baseline.json` 的 `forkPointSha`；脚本与工作流中 MUST NOT 出现硬编码的 SHA 字面量
