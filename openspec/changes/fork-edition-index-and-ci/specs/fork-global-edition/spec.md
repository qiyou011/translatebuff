## ADDED Requirements

### Requirement: 两条 edition 均须通过 CI 出包验证 [API层]

CI MUST 对**每条** edition 各真跑一次正式出包，且每次出包 MUST 走 `scripts/pack.mjs`——它是 env 注入与双向域名断言的唯一收口，绕开它的构建路径不具备护栏。任一 edition 出包失败或断言不通过，CI MUST 判红。

#### Scenario: [API层] 海外线配置被改坏时 CI 判红

- **GIVEN** `.env.global.production` 的某个 `WXT_*` 被删除或改成国内域
- **WHEN** CI 跑海外线出包
- **THEN** MUST 判红（缺失触发正向断言、国内域触发反向断言）
- **AND** MUST NOT 因为「国内线仍然构建成功」而整体判绿

#### Scenario: [API层] 国内线配置被改坏时 CI 判红

- **GIVEN** `.env.production` 的某个 `WXT_*` 被改成海外域
- **WHEN** CI 跑国内线出包
- **THEN** MUST 判红

#### Scenario: [API层] 每条 edition 至少覆盖一个渠道

- **GIVEN** 某 edition 下登记了多个渠道
- **WHEN** CI 验证该 edition
- **THEN** MUST 至少出一个该 edition 的正式包
- **AND** MUST NOT 要求打满该 edition 的全部渠道——渠道差异只在号码，一个代表渠道即可覆盖配置错误

#### Scenario: [API层] 断言覆盖全部已构建的产物目录

- **GIVEN** CI 构建了 chrome / edge / firefox 三个目标
- **WHEN** 跑产物域名断言
- **THEN** 每个已构建的产物目录 MUST 各被断言一次
- **AND** MUST NOT 只验其中一个目录就判通过

### Requirement: edition 分叉落点集中登记 [文档]

`src/fork/identity/edition.ts` MUST 在文件头维护一份「分叉落点索引」，列出全部按 edition 取值的位置及其职责。新增分叉点时 MUST 同步登记。

#### Scenario: [文档] 索引覆盖全部现存分叉点

- **WHEN** 审阅索引
- **THEN** MUST 覆盖：两份正式 env、两份测试 env、跳转路径表、渠道注册表与默认渠道、商店身份（名称 / 扩展 ID）、产物目录与文件名、打包脚本与断言脚本各自的配置源映射
- **AND** 每条 MUST 标明文件路径与它分的是什么

#### Scenario: [文档] 索引放在所有分叉点都会引用的模块里

- **GIVEN** 任何新增的 edition 分叉点都要读取当前 edition
- **WHEN** 开发者实现新分叉点
- **THEN** 索引 MUST 位于其必然会 import 的 `edition.ts`，而非独立文档文件
