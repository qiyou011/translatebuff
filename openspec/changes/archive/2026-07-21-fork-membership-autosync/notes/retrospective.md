# fork-membership-autosync 复盘

## 背景与目标

官网（`WXT_WEBSITE_URL`）已登录时，插件安装/打开后自动同步账号，免去 popup 点登录再跳官网重登。根因是既有登录接管纯被动（只监听 `cookies.onChanged` 变化事件），装插件前已登录 / SW 冷启时 cookie 早已存在、不再变化 → 不触发。补一个**主动探测**（`syncMembershipFromWebsite`）读已存在的 cookie、复用既有 `adoptCredential`。

## 遇到的问题及挑战

1. **fakeBrowser 未实现 cookies**：`@webext-core/fake-browser` 的 `cookies.get/set/onChanged` 全是 `throw "not implemented"`。测试无法用 fake cookie store，改用 `vi.spyOn(fakeBrowser.cookies, "get").mockResolvedValue(...)`；测 `setupMembership` 接线时还需 `vi.spyOn(fakeBrowser.cookies.onChanged, "addListener").mockImplementation(() => {})` 避免 registerCookieWatcher 抛错。

2. **`@/env` 是 t3-env 加载期快照、不可 `vi.stubEnv`**：`env.WXT_WEBSITE_URL` 在模块 import 时由 `createEnv` 一次性快照（不同于 `api.ts` 直读 `import.meta.env`）。测试 `vi.stubEnv` 改不动它。改为在测试里读 `env.WXT_WEBSITE_URL` 再断言 `cookies.get` 的调用参数，而非 stub。

3. **测试 spy 跨用例泄漏**：既有 `afterEach` 只 `unstubAllGlobals/Env`，不还原 `vi.spyOn`。「已有会话短路」用例**全量跑失败、隔离跑通过** → 诊断为前一用例的 `cookies.get` spy 泄漏。`afterEach` 补 `vi.restoreAllMocks()` 修复（唯一 spy 还原点）。

4. **`chrome.cookies.get` 重载致 `ReturnType` 落到 `void`**：`Awaited<ReturnType<typeof browser.cookies.get>>` 取到的是 callback 重载的返回 `void`（webext 类型 get 有 Promise + callback 两个重载，`ReturnType` 取最后一个），type-check 报 TS2322/TS2339。改用**调用式** `browser.cookies.get({...}).catch(() => null)`（按实参解析到 Promise 重载），既修类型又更简洁、还顺带承担了 catch 降级。

5. **既有 flaky 测试干扰判断**：全量套件 `config.test.ts` / `context-menu.test.ts` 2 处失败、隔离均过。为排除是否本次回归，`git stash` 掉本次改动跑 **baseline** 复现同样 2 处失败 → 证实为**既有 flaky**（全量并发/顺序敏感）、非本次引入。

## 架构/设计偏离说明

- 初稿设想「仅 SW 冷启探测一次」。架构审查 **Q1** 指出真实缺口：瞬时接管失败留下「有 cookie 无会话」+ warm SW 下打开 popup 不必然唤醒 SW → 增 fork 消息 `forkSyncMembership`，挂载时确定性唤醒后台。
- **Q2**：主动探测 + 被动监听可能并发双 adopt → 去重**下沉到 `adoptCredential`**（统一接管入口，一处覆盖 watcher/probe/message 三路径），而非只守探测侧。
- **Q4**：probe 读 cookie 的 url 取 `WXT_WEBSITE_URL`（对齐 `forkLogout` 的 remove），prod apex-only cookie 的域覆盖分歧记为「与既有 `forkLogout` 同一假设、待后端确认」，dev 两值相同无此问题。

## 总结与后续优化点

- **Simplify 高度审查提两个越界项**（本次不做，记为后续）：
  1. 给 `adoptCredential` 加「当前 session 凭据 == 目标则短路」使**真幂等**——当前既有 watcher 每次 cookie set（含 30 天续期）都全量 re-adopt（`fetchTokens` 开户轮询最多 ~9s）。这是 fork-membership-login 既有行为，非本次引入。
  2. 官网身份分散在三个 env facet（`WXT_WEBSITE_URL` / `WXT_OFFICIAL_SITE_ORIGINS` / `WXT_AUTH_COOKIE_DOMAINS`），probe 用前者、watcher 用后者，存在「probe 覆盖 ⊂ watcher 覆盖」的分裂。可统一为单一来源，或加 schema 跨字段校验 `WXT_WEBSITE_URL ∈ WXT_OFFICIAL_SITE_ORIGINS` 让不变量在构建期响亮失败。
- **可复用经验沉淀**：① fakeBrowser 的 cookies 命名空间未实现、须 spy；② t3-env 的 `env` 对象是加载期快照、`vi.stubEnv` 无效，测试直读其值断言；③ webext 重载 API（cookies.get 等）用**调用式**取 Promise 重载，勿用 `ReturnType<typeof>`（会落到 callback 重载的 void）。
