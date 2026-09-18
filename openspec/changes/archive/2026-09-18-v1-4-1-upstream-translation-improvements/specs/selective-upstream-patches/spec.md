## ADDED Requirements

### Requirement: 文件级多来源账本

系统 SHALL 在 src/fork/identity/selective-upstream-patches.json 中登记完整来源 SHA 与每个最终文件的累计指纹，MUST 支持一个文件对应多个来源。

#### Scenario: 多提交修改同一文件

- **WHEN** 多个选定补丁修改同一路径
- **THEN** files 仅保留一个该路径条目，包含 LF 归一化最终内容的 SHA256 和全部贡献来源；sources 使用唯一完整 40 位 SHA

#### Scenario: 非法条目

- **WHEN** 出现重复路径、重复来源、畸形 SHA、未知来源引用或错误内容指纹
- **THEN** 边界校验失败，不自动改写指纹以接受漂移

### Requirement: 官方来源和过期校验

系统 MUST 从固定官方仓库获取 main 以验证来源对象和祖先关系，并 SHALL 在分类变更文件前校验整个账本。

#### Scenario: 缺少对象或非官方提交

- **WHEN** 来源对象不可解析、不是官方 main 祖先，或 Git 校验返回执行错误
- **THEN** 校验失败并给出原因，退出码 128 不得解释为正常的非祖先结果

#### Scenario: 未触及的过期条目

- **WHEN** 账本中任意来源已是当前完整同步基线 upstreamRef 或 lastSyncedSha 的祖先，即使其文件本次未修改
- **THEN** 完整账本预检失败，要求在真实 merge 后清理冗余来源和对应文件贡献关系

### Requirement: 有限边界例外

系统 SHALL 仅对来源与最终内容均通过校验的路径提供选择性移植例外，MUST 保留原有 fork 边界和完整同步基线。

#### Scenario: 额外修改

- **WHEN** 补丁外文件被修改或登记文件发生未审查漂移
- **THEN** 原有边界规则或指纹校验阻止该修改，不能通过扩大通用 allowlist 绕过

### Requirement: 累计补丁撤销

系统 SHALL 支持按来源撤销补丁，并 MUST 重建受影响文件的剩余累计结果。

#### Scenario: 撤销共享文件的一条来源

- **WHEN** 撤销与其他补丁共享文件的来源
- **THEN** 先重建并验证剩余内容，再更新指纹与贡献关系、移除来源，不能仅删除账本行或覆盖其他补丁
