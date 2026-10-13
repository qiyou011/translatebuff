## 1. 实施前契约与影响

- [x] 1.1 按本仓 AGENTS.md 执行 GitNexus 影响分析，确认后台启动、会员请求、report、登录／订单／卸载链接的全部调用点及高风险依赖。
- [x] 1.2 与海外官网同名变更确认 `aitrans_install_promo` cookie 的 `{cid, recordedAt}`、毫秒单位、同环境域名、现有渠道 Cookie 规则和只认可 `7154`。

## 2. 安装选择与持久化

- [x] 2.1 为推广记录解析和安装决策写聚焦测试，覆盖早于安装且不足 30 天、等时、未来、恰满 30 天、错误时间、未认可号、不同官网域及包内号 `7150`—`7153`。
- [x] 2.2 实现后台专用安装渠道模块：`onInstalled` 的 `install` 回调入口同步捕获安装时间，只读取同配置同环境官网 cookie，选择 `7154` 或实际包内号。
- [x] 2.3 实现版本化固定记录与内存状态；覆盖更新不补认、普通冷启动、首次保存失败的同进程重试、重启后缺失记录回落、存储读取失败时不覆写未知旧值。

## 3. 统一请求门禁

- [x] 3.1 在 `src/fork/background/index.ts` 的会员同步和启动上报之前建立渠道决策、安装事件处理及页面消息入口；以并发测试证明新安装首发请求等待同一决策，普通冷启动不会无限等待。
- [x] 3.2 调整 `src/fork/membership/api.ts` 和其他请求入口：异步取得固定渠道后显式构造 7 段 `Useragent`；验证会员与 report 第 4 段一致，国内线仍用原包内号。

## 4. 上报与官网跳转

- [x] 4.1 复用现有 `click_event` report 客户端，使启动 `launch_channel_id` 为固定号、启动和活跃 `origin_cid` 为整数包内号；验证事件触发、去重与注册归因规则未改变。
- [x] 4.2 将登录、订单／支付、卸载问卷出站 URL 的 `cid` 改为固定号，并测试既有 query、fragment 和官网不会因单独 `cid` 写推广记录。

## 5. 联调与验证

- [ ] 5.1 与已具备推广记录的海外官网联调安装前／安装后推广、30 天边界、拒绝权限或同意、cookie／存储失败、测试／正式域隔离和四种海外包；核对启动与活跃事件的 report 请求体均含整数 `origin_cid`。使用重新打包安装的 `1.5.0` 验证真实会员与 report 请求的 UA 第 6 段为 `1.5.0`，以及只有普通 `aitrans_cid=66666` 时海外 Edge 包仍使用 `7152`。
- [x] 5.2 运行聚焦测试、类型检查及目标海外包构建；按本仓规则运行 GitNexus `detect_changes`，完成用户可见功能对应的 changeset，并执行 `jy-openspec validate v1-5-0-install-channel-attribution --strict`。

## 6. 本地构建包 UA 版本修复（2026-10-13）

- [x] 6.1 将 `src/fork/membership/api.ts` 中硬编码的 UA 版本 `1.0.1` 改为 `readForkVersion()`，补充会员请求及登录、匿名 report 请求的版本一致性回归测试；新增 `.changeset/fix-request-useragent-version.md`。
- [x] 6.2 按用户确认将 `src/fork/identity/fork-version.json` 从 `1.4.1` 更新为 `1.5.0`；确认分支名不会自动改变发布版本，构建 manifest 使用 `1.5.0`。
- [x] 6.3 补充海外 Edge 新装仅有普通 `aitrans_cid=66666` 时保留 `7152`、只查询 `aitrans_install_promo` 的回归测试；同步 proposal、design 和规格中的版本来源及渠道验收场景。

### 本地验证记录

- UA 修复及渠道回归：9 个测试文件、97 项测试通过，类型检查通过。
- 发布配置更新为 `1.5.0` 后：版本、会员请求、report 请求三个测试文件共 47 项测试通过，`pnpm build` 通过；`.output/chrome-mv3/manifest.json` 的 `version` 为 `1.5.0`，`version_name` 为 `任译喵 1.5.0（rf 1.46.6）`。
- 本轮构建验证为默认 Chrome 产物，海外测试包需重新打包；真实浏览器与后端联调尚未完成，保留任务 5.1 未勾选。
