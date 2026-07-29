## Why

任译喵即将同时上架多个扩展应用市场（Chrome 商店 / Edge Add-ons / Firefox AMO），并保留官网 zip 直装。后端与官网靠**渠道号**做来源归因，但当前渠道号 `7100` 是硬编码常量（`src/fork/membership/api.ts`），所有市场的安装都上报同一个号——**来源无法区分，获客与转化归因全部失真**。同时，用户从扩展跳转官网登录/注册、卸载填问卷时，链接未携带渠道标识，官网侧同样无法归因。

本变更让每个市场的产物携带**各自的渠道号**，并把渠道号贯通到"扩展上报"与"官网跳转"两条链路，且不触碰软 fork 边界。

## What Changes

- **渠道注册表**：新增单一真源，登记每个渠道的 `{号码, 浏览器}`；号码是后端分配的跨仓契约，未分配以 `null` 占位。
- **渠道号解析**：构建期按注入的渠道 id 解析出号码；未指定回落默认渠道 `zip`(7100)，未知 id / 未分配号码 fail-loud。
- **UA 归因**：7 段 UserAgent 第 4 段由硬编码 `7100` 改为按渠道解析，删除硬编码常量。
- **官网跳转 cid 归因**：登录跳转与卸载问卷跳转的官网 URL 追加 `?cid=<号码>`（同源于渠道号解析，统一助手），已核实 fork 内跳官网导航出口仅此两处。
- **多渠道打包管线**：打包脚本支持"单渠道补打"与"一键全渠道正式包"；产物名按渠道 id 命名以避免同浏览器双渠道文件覆盖；正式包路径强制显式指定渠道、未分配号码在构建期即拦截。

## Capabilities

### New Capabilities

- `fork-channel-attribution`: 渠道号的登记、构建期解析与护栏、向扩展上报（UA）与官网跳转（cid）两条链路的贯通，以及按渠道产出正式包的打包管线。

### Modified Capabilities

<!-- 登录/卸载跳转仅附加 cid 归因参数、不改其打开目标与流程；相关断言收在新能力 spec 内，故此处留空。 -->

## Impact

- **改动文件**（全部落在 `src/fork/**` 与 `scripts/**` 及白名单内 `wxt.config.ts`，软 fork 边界零越界）：
  - 新增 `src/fork/identity/channels.json`、`src/fork/identity/channel.ts`
  - 修改 `src/fork/membership/api.ts`（UA 段4）、`src/fork/membership/atoms.ts`（登录 cid）、`src/fork/background/uninstall-survey.ts`（卸载 cid）
  - 修改 `scripts/pack.mjs`（`--channel` / `--all`）、`scripts/assert-fork-build.mjs`（构建期号码非 null 断言）、`wxt.config.ts`（产物名按渠道 id）
- **跨仓依赖**（非本仓代码，作为本变更的外部前置/协同）：
  - 后端分配 `chrome-store` / `edge` / `firefox` 三个渠道号（分配前对应产物在打包时被跳过或拦截）。
  - 官网 `translatebuff-web` 读取 `cid` query 参数并落库归因（参数名与取值口径需与官网对齐，本变更按"渠道号"设计，对齐 UA 段4 与后端契约）。
- **待后端确认项**：订单/支付页跳转是否需携带 cid——取决于认证会话是否已由 UA 段4 携带渠道；确认后再定是否扩展至订单页。
