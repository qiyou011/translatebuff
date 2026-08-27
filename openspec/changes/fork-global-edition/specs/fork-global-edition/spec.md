## ADDED Requirements

### Requirement: edition 维度与正式配置源选取 [API层]

正式打包 MUST 接受 edition 参数（`cn` / `global`），并按其选取该线的正式环境配置源；构建期 MUST 把当前 edition 注入产物，供运行期按线取值。edition 缺省 MUST 为 `cn`，保证既有命令行为不变。未知 edition MUST 构建期抛错，MUST NOT 静默回落。

#### Scenario: [API层] 未指定 edition 时缺省国内线

- **GIVEN** 打包命令未传 `--edition`
- **WHEN** 执行正式打包
- **THEN** MUST 按 `cn` 线的配置源构建
- **AND** 产物运行时域名 MUST 与本变更前的国内包完全一致

#### Scenario: [API层] 指定 global 时取海外配置源

- **GIVEN** 打包命令传入 `--edition global`
- **WHEN** 执行正式打包
- **THEN** 产物运行时的官网域、授信 origin、cookie 域、登录后端域、翻译网关域 MUST 全部为海外线取值
- **AND** MUST NOT 出现任何 `cn` 线取值

#### Scenario: [API层] 未知 edition 即时抛错

- **GIVEN** 打包命令传入 `--edition eu`（不在 `cn` / `global` 之内）
- **WHEN** 解析 edition
- **THEN** MUST 抛错并列出可选 edition
- **AND** MUST NOT 回落缺省值继续构建

#### Scenario: [API层] 海外配置源缺失即时抛错

- **GIVEN** 传入 `--edition global` 但海外正式配置文件不存在
- **WHEN** 执行打包
- **THEN** MUST 抛错终止
- **AND** MUST NOT 以 `cn` 配置继续构建出一个名为海外包的产物

### Requirement: 产物域名双向断言 [API层]

构建后断言 MUST 按当前 edition 双向校验产物域名：本线域名 MUST 出现（证明配置注入生效），另一线域名 MUST NOT 出现（防两线配置串味）。任一方向不满足 MUST 判构建失败。既有的上游域名告警与测试域泄漏守卫 MUST 保持生效。

#### Scenario: [API层] 海外包缺失海外域名判失败

- **GIVEN** 以 `--edition global` 构建
- **WHEN** 产物文本中不含海外官网域
- **THEN** 断言 MUST 失败并指明缺失的域名
- **AND** MUST 提示可能原因为 env 注入未生效或 shell 残留 `WXT_*`

#### Scenario: [API层] 海外包含国内域名判失败

- **GIVEN** 以 `--edition global` 构建
- **WHEN** 产物文本中出现 `translatebuff.cn`
- **THEN** 断言 MUST 失败并列出命中的域名

#### Scenario: [API层] 国内包含海外域名判失败

- **GIVEN** 以缺省或 `--edition cn` 构建
- **WHEN** 产物文本中出现 `translatebuff.com`
- **THEN** 断言 MUST 失败并列出命中的域名

#### Scenario: [API层] 测试域泄漏守卫不受 edition 影响

- **GIVEN** 本地存在 dev 用的测试后端配置文件
- **WHEN** 以任一 edition 打正式包且产物含测试后端域
- **THEN** MUST 判构建失败，行为与本变更前一致

### Requirement: 官网跳转路径按 edition 解析 [API层]

插件对外跳转（登录、订单、卸载问卷、反馈）的路径 MUST 按当前 edition 解析为该线官网的真实路径。路径表 MUST 为单一真源，MUST NOT 在各调用点分别硬编码。多语言前缀规则两线一致（`as-needed`，默认 locale 为 `en` 时无前缀）。

#### Scenario: [API层] 海外线四条路径取海外官网形态

- **GIVEN** edition 为 `global` 且界面语言为英文
- **WHEN** 解析登录 / 订单 / 卸载问卷 / 反馈路径
- **THEN** MUST 分别为 `/login`、`/account/orders`、`/extension/uninstall-survey`、`/help`

#### Scenario: [API层] 国内线四条路径保持现状

- **GIVEN** edition 为 `cn` 且界面语言为英文
- **WHEN** 解析上述四条路径
- **THEN** MUST 分别为 `/login`、`/orders`、`/uninstall-survey`、`/feedback`

#### Scenario: [API层] 海外线路径同样带多语言前缀

- **GIVEN** edition 为 `global` 且界面语言为日语
- **WHEN** 解析订单路径
- **THEN** MUST 为 `/ja/account/orders`（locale 前缀在最前，MUST NOT 为 `/account/ja/orders`）

#### Scenario: [API层] 官网独有语种不进映射表

- **GIVEN** 海外官网支持葡萄牙语但扩展无葡萄牙语界面
- **WHEN** 维护「扩展 UI 语言 → 官网 locale」映射表
- **THEN** 表内 MUST NOT 含 `pt` 条目（无消费方）
- **AND** 两侧语种集合不对称 MUST 视为预期状态，MUST NOT 靠补齐无消费方的条目来对齐

#### Scenario: [API层] 未映射语言回退默认无前缀

- **GIVEN** 界面语言未在官网 locale 映射表内（如 vi）
- **WHEN** 解析任一路径
- **THEN** MUST 回退无前缀形态，MUST NOT 拼出不存在的前缀导致 404

#### Scenario: [API层] 跳转链接仍携带渠道号

- **GIVEN** 任一 edition 下解析出的登录 / 订单 / 卸载问卷跳转 URL
- **WHEN** 生成最终 URL
- **THEN** MUST 追加 `cid` 查询参数为当前渠道号
- **AND** `cid` MUST 位于 fragment 之前

### Requirement: 后端语言头按界面语言映射 [API层]

平台后端请求的 `Client-Language` 头 MUST 由当前界面语言映射为完整 locale 形式（如 `en-us`），MUST NOT 使用短码。映射表 MUST 只收已实测确认后端有译文的取值，其余一律回落 `en-us`。此规则对两条 edition 同时生效。

#### Scenario: [API层] 简体中文界面取 zh-cn

- **GIVEN** 界面语言为简体中文
- **WHEN** 装配平台请求头
- **THEN** `Client-Language` MUST 为 `zh-cn`，与本变更前的国内包取值一致

#### Scenario: [API层] 英文界面取 en-us

- **GIVEN** 界面语言为英文
- **WHEN** 装配平台请求头
- **THEN** `Client-Language` MUST 为 `en-us`

#### Scenario: [API层] 未确认译文的语种回落 en-us

- **GIVEN** 界面语言为西班牙语（映射表未收录）
- **WHEN** 装配平台请求头
- **THEN** MUST 为 `en-us`
- **AND** MUST NOT 拼出 `es-es` 之类未经实测的取值

#### Scenario: [API层] 取值 MUST NOT 含路径分隔符

- **GIVEN** 任一映射结果
- **WHEN** 写入请求头
- **THEN** 取值 MUST 为 `<语言>-<地区>` 两段小写形式，MUST NOT 含 `/`

### Requirement: 反馈入口地址随 edition 解析 [UI层]

反馈门户 URL MUST 由 edition 与官网域共同解析得出，MUST NOT 在源码中硬编码任一线的域名或路径。反馈链接 MUST 继续携带定位用户环境所需的元数据（浏览器、扩展版本、页面地址）。

#### Scenario: [UI层] 海外线反馈指向海外帮助页

- **GIVEN** edition 为 `global`
- **WHEN** 从选项页侧边栏或网页悬浮球打开反馈
- **THEN** URL MUST 指向海外官网的帮助页路径

#### Scenario: [UI层] 国内线反馈指向国内反馈页

- **GIVEN** edition 为 `cn`
- **WHEN** 打开反馈
- **THEN** URL MUST 指向国内官网的反馈页路径

#### Scenario: [UI层] 元数据参数不丢失

- **GIVEN** 调用方传入浏览器、扩展版本、页面地址等元数据
- **WHEN** 构造反馈 URL
- **THEN** 每一项非空元数据 MUST 出现在查询参数中
