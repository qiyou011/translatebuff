> TDD 铁律：每个「写失败测试」任务都必须跑一次并**看到真实红灯**，把失败输出贴进任务记录。若第一次就绿，停下来按 CLAUDE.md 三选一给出证据，禁止补一个必然失败的断言凑红灯。

## 0. 开工前的外部卡点

- [x] 0.1 国内版 Firefox 已在 AMO 上架 → 国内 `gecko.id` 保持 `translatebuff@translatebuff.com` 不动，海外另起 `overseas@translatebuff.com`（2026-08-26 产品确认，无破坏性变更）
- [x] 0.2 海外渠道号已定：`global-zip=7150` / `global-chrome-store=7151` / `global-edge=7152` / `global-firefox=7153`（2026-08-26 产品确认，取 71 段内号码以避开官网 cid 段位校验，官网侧零改动）
- [ ] 0.3 确认海外登录后端域与 oneapi 翻译网关域的正式值；未到位则 7.1 以海外官网域占位并在文件内注明「上线前替换」

## 1. edition 基建

- [x] 1.1 写 `src/fork/identity/__tests__/edition.test.ts` 失败测试：`resolveEdition(undefined)` 回落 `"cn"`、`resolveEdition("global")` 返回 `"global"`、`resolveEdition("eu")` 抛错且错误信息列出可选值、`currentEdition()` 用 `vi.stubEnv("WXT_FORK_EDITION", "global")` 运行期读到新值
- [x] 1.2 实现 `src/fork/identity/edition.ts`（`ForkEdition` / `DEFAULT_EDITION` / `resolveEdition` / `currentEdition`），`currentEdition` 必须函数内读 `import.meta.env.WXT_FORK_EDITION`、不做模块顶层快照，跑至全绿

## 2. 站点路径表

- [x] 2.1 写 `src/fork/__tests__/website-routes.test.ts` 失败测试：`cn` 下四条基础路径为 `/login`、`/orders`、`/uninstall-survey`、`/feedback`；`global` 下为 `/login`、`/account/orders`、`/extension/uninstall-survey`、`/help`（用 `vi.stubEnv` 切 edition）
- [x] 2.2 实现 `src/fork/website-routes.ts`（`WebsiteRoute` 联合类型 + `websiteRouteBasePath`），跑至全绿
- [x] 2.3 补 `website-locale.ts` 注释说明「扩展 UI 语言 → 官网 locale」是单向映射，官网独有的 pt 与扩展独有的 vi 都不进表，两侧不对称是预期（不改代码，只加注释）

## 3. 渠道注册表按 edition 分区

- [x] 3.1 写 `src/fork/identity/__tests__/channel.test.ts` 新增失败用例：渠道 `edition` 与当前 edition 不符时抛错且信息指明所属 edition；`global` 下未注入渠道 id 回落 `global-zip`；`cn` 下仍回落 `zip` 且返回 `"7100"`
- [x] 3.2 `channels.json` 每项加 `"edition": "cn"`（现有 8 个显式标注）；`channel.ts` 的 `ChannelEntry` 加 `edition` 字段、`DEFAULT_CHANNEL` 改为按 edition 取、`resolveChannelNumber` 加 edition 校验（保留既有「未知 id」「号码未分配」两重校验的错误信息不变），跑至全绿
- [x] 3.3 `channels.json` 新增四项：`global-zip`（chrome，`"7150"`）/ `global-chrome-store`（chrome，`"7151"`）/ `global-edge`（edge，`"7152"`）/ `global-firefox`（firefox，`"7153"`），全部标 `"edition": "global"`；在 `channel.ts` 注释写明「号码必须留在 71 段内，否则官网 cid 校验静默回落 7100」

## 4. Client-Language 参数化

- [x] 4.1 写 `src/fork/membership/__tests__/client-language.test.ts` 失败测试：`en→en-us`、`zh-CN→zh-cn`、`zh-TW→zh-tw`、`ja→ja-jp`、`ru→ru-ru`；未收录的 `es` / `ko` / `tr` / `vi` / 未知值一律回落 `en-us`；任一结果不含 `/`
- [x] 4.2 实现 `src/fork/membership/client-language.ts`（`DEFAULT_CLIENT_LANGUAGE` + `toClientLanguage`），跑至全绿
- [x] 4.3 写 `api.ts` 的失败测试：`buildAuthHeaders(cred, "en-us")` 的 `Client-Language` 头为 `en-us`；不传第二参时为 `DEFAULT_CLIENT_LANGUAGE`
- [x] 4.4 `api.ts` 把 `CLIENT_LANGUAGE` 常量改为参数：`buildAuthHeaders(cred, clientLanguage = DEFAULT_CLIENT_LANGUAGE)`，`authedGet` / `fetchLoginStatus` / `fetchTokens` 透传，`fetchTokensWithRetry` 在 options 里加 `clientLanguage?`，跑至全绿
- [x] 4.5 `background/membership.ts` 的 `adoptCredential` 读 `config.uiLanguage` → `resolveUiLocale` → `toClientLanguage`，一次算出并透传给三个 fetch；补一条测试锁定「中文界面仍发 `zh-cn`」防国内线回归

## 5. 对外跳转与反馈入口改造

- [x] 5.1 写失败测试：`global` 下订单 URL 为 `{官网域}/account/orders?cid=…`、简体中文界面为 `{官网域}/zh-hans/account/orders?cid=…`（locale 前缀在最前）；`cn` 下逐字保持现状
- [x] 5.2 `membership/atoms.ts` 的 `useOpenForkLogin` / `useOpenForkOrders` 改走 `websiteLocalePath(locale, websiteRouteBasePath(...))`，跑至全绿
- [x] 5.3 `background/uninstall-survey.ts` 改走 `websiteRouteBasePath("uninstallSurvey")`，补两条 edition 的路径断言测试
- [x] 5.4 `ui/options/featurebase.ts` 删掉硬编码的 `https://www.translatebuff.cn/feedback`，改 `getWebsiteUrl(websiteRouteBasePath("feedback"))`；更新 `__tests__/feedback-portal.forktest.ts` 的断言为两条 edition 各一条，并确认元数据参数仍全部落到 query 上

## 6. manifest 身份按 edition

- [x] 6.1 `wxt.config.ts` 读 `process.env.WXT_FORK_EDITION` 经 `resolveEdition` 归一，manifest `name` 取 `global → FORK_BRANDING.name` / `cn → FORK_BRANDING.displayName`
- [x] 6.2 `wxt.config.ts` 的 `gecko.id` 按 edition 取：`cn → translatebuff@translatebuff.com`（既有值，已上架 AMO 不可改）、`global → overseas@translatebuff.com`；`zip.includeSources` 加入 `.env.global.production`
- [x] 6.3 跑 `pnpm run test` + `node scripts/check-fork-brand.mjs` 确认 `APP_NAME` 与 kebab 形式 `translate-buff` 未受影响（自定义元素名必须含连字符，否则内容脚本 attachShadow 崩溃）

## 7. 海外正式配置与打包命令

- [x] 7.1 新建 `.env.global.production`：复制 `.env.production` 的公开性警告注释头，域名值改 `.com`（官网域取实际部署的 `https://www.translatebuff.com`，`WXT_OFFICIAL_SITE_ORIGINS` 含裸域与 www 两个 origin，`WXT_AUTH_COOKIE_DOMAINS` 为 `translatebuff.com`），登录后端域与网关域按 0.3 填正式值或占位；`git add -f` 强制跟踪
- [x] 7.2 `.env.example` 补 `.env.global.production` 与 edition 的说明段
- [x] 7.3 `scripts/pack.mjs` 新增 `--edition cn|global`：解析并经 `resolveEdition` 校验（未知值硬报错）、按 edition 选配置源文件、注入 `WXT_FORK_EDITION`；`global` 时把配置文件解析结果一并注入子进程 env（复用 test 模式的 `parseDotenv` + `spawnSync env` 路径）
- [x] 7.4 `scripts/pack.mjs` 的 `--all` 按 edition 圈定渠道范围（只遍历本 edition 的渠道）；配置源文件缺失时抛错终止，不得回落另一 edition 续跑
- [x] 7.5 验证命令契约未回归：`node scripts/pack.mjs store`（裸 store 仍硬报错）、`node scripts/pack.mjs store --channel zip`（缺省走 cn、产物与本变更前一致）

## 8. 双向域名断言与验收

- [x] 8.1 写 `scripts/__tests__` 失败测试：给定「当前 edition 的 env 文本 + 另一 edition 的 env 文本 + 产物文本」，本线域名缺失判失败、另一线域名命中判失败、两者都满足判通过
- [x] 8.2 `scripts/assert-fork-build.mjs` 按 `FORK_EDITION` 选正向配置源，新增反向断言（读另一 edition 的 env 解析出禁止域名，命中即 `process.exit(1)` 并列出命中项）；上游域名告警、测试域泄漏守卫、合作方站点断言三项保持原样，跑至全绿
- [x] 8.3 端到端验收：`node scripts/pack.mjs store --edition global --all` 打出四个海外包，逐个解包确认 manifest `name` 为 `TranslateBuff`、`gecko.id` 为 `overseas@translatebuff.com`、产物含 `.com` 域且不含 `.cn` 域；并实测插件跳官网的 `?cid=` 在官网侧落到正确渠道（不是 `7100`）
- [x] 8.4 国内线回归验收：`node scripts/pack.mjs store --all` 产物与本变更前逐字比对（manifest、域名、渠道号、文件名），任一处不同即视为回归
- [x] 8.5 跑全量门禁：`pnpm run test`（本地设 `SKIP_FREE_API=true`）、`pnpm run lint`、`FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs`、`node scripts/check-fork-brand.mjs`，贴原始输出
- [x] 8.6 更新 `CLAUDE.md` 与 `.env.example` 的常用命令段，写明 edition 用法与「绕过 pack.mjs 直接 wxt zip 会失去双向域名护栏」这条风险

## 9. 测试包的 edition 维度（2026-08-26 追加）

- [x] 9.1 写 `scripts/__tests__/pack-test-edition.test.ts`：未知 edition 硬报错、`global` 缺 `.env.global` 点名该文件、`cn` 缺 `.env` 不误报成 `.env.global`（红灯：`test --edition global` 原本静默成功、打出的是国内测试包）
- [x] 9.2 `scripts/pack.mjs` 的 `test` 模式接入 `--edition`：配置源 `cn → .env` / `global → .env.global`，注入 `WXT_FORK_EDITION`；缺配置点名报错、不回落另一线
- [x] 9.3 `wxt.config.ts` 的测试包产物名加 `-global` 后缀（`translatebuff-<版本>-test-global-<浏览器>.zip`），国内测试包名保持 `-test-<浏览器>` 不变
- [x] 9.4 测试包补反向域名断言：另一线的**生产**域混入即 fail-fast（红灯实证：`.env.global` 漏配 `WXT_API_URL` 时产物含 `translatebuff.cn` 8 处，断言点名后修复）
- [x] 9.5 两条线测试包实打验收：海外 `含 translatebuff.cn: 0 处`；国内 `translatebuff-1.2.0-test-chrome.zip` 名称与测试域均未回归

- [x] 9.6 `check-fork-boundary.mjs` 的 `FORK_ROOT_FILES` 登记 `.env.global.production` 与 `.env.global`（红灯实证：`git add -f` 后两者均被判越界），并补两条单测锁定
- [x] 9.7 产物目录按 edition 分开（`wxt.config.ts` 的 `outDirTemplate` 追加 `-global`；`pack.mjs` 与 `assert-fork-build.mjs` 的目录推导同步跟随），国内目录名保持 `.output/<browser>-mv3` 不变；两条线各打一次实测三个浏览器目标共 6 个目录并存、内容零串味

## 10. 发版前检查（阻塞海外包上架）

- [ ] 10.1 **确认海外官网已部署 `/plugin` → `/extension` 改名**：`curl -sSL -o /dev/null -w "%{http_code}" https://www.translatebuff.com/extension/uninstall-survey` 必须为 200。2026-08-26 实测为 404（线上仍是 `/plugin` 时代），此项不通过则海外包的卸载问卷是死链
- [x] 10.2 卸载问卷路径取直连新路径（方案 B，2026-08-26 产品确认），接受官网部署前是死链；不改用裸路径承接
