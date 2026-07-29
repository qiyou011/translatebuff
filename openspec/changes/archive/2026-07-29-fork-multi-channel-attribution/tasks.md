## 1. 渠道注册表与解析（基建）

- [x] 1.1 新增 `src/fork/identity/channels.json`：`zip={number:"7100",browser:"chrome"}`，`chrome-store`/`edge`/`firefox` 的 `number:null` + 对应 `browser`（验证：JSON 合法、四渠道齐全）
- [x] 1.2 新增 `src/fork/identity/__tests__/channel.test.ts`：写 `resolveChannelNumber` 失败测试——未设 env→`"7100"`、`"zip"`→`"7100"`、未知 id→抛错、`chrome-store`(null)→抛错（验证：`SKIP_FREE_API=true pnpm test channel` 先 FAIL）
- [x] 1.3 新增 `src/fork/identity/channel.ts`：实现 `resolveChannelNumber(id = import.meta.env.WXT_FORK_CHANNEL)` + `DEFAULT_CHANNEL="zip"`，读 `channels.json`（验证：1.2 测试转 PASS）
- [x] 1.4 在 `channel.test.ts` 追加 `appendChannelId` 失败测试——无 query→`?cid=7100`、已有 `?lang=zh`→`&cid=7100`、含 `#frag`→cid 落 fragment 前（验证：先 FAIL）
- [x] 1.5 在 `channel.ts` 实现 `appendChannelId(url)`（`URL` API 追加 `cid=resolveChannelNumber()`）（验证：1.4 测试转 PASS，纯逻辑不 import i18n）
- [ ] 1.6 提交本组；跑 `SKIP_FREE_API=true pnpm test channel` 全绿 + `pnpm type-check` 无红

## 2. UA 归因消费点

- [x] 2.1 改 `src/fork/membership/api.ts`：`buildUserAgent()` 第4段改用 `resolveChannelNumber()`，删除 `UA_CHANNEL = "7100"` 常量（验证：无残留常量引用、type-check 绿）
- [x] 2.2 更新 `src/fork/membership/__tests__/api.test.ts`：保留"默认段4=7100 / 恰7段"断言，追加 `vi.stubEnv("WXT_FORK_CHANNEL", ...)` 断言其他渠道号进段4（验证：`SKIP_FREE_API=true pnpm test api` 全绿）
- [ ] 2.3 提交本组

## 3. 官网跳转 cid 归因

- [x] 3.1 改 `src/fork/membership/atoms.ts`：登录跳转 URL **与订单跳转 URL** 均外包 `appendChannelId(...)`（`.../login?cid=<号>`、`.../orders?cid=<号>`；append 逻辑已由 1.4/1.5 单测覆盖）
- [x] 3.2 改 `src/fork/background/uninstall-survey.ts`：`setUninstallURL(appendChannelId(getWebsiteUrl("/uninstall-survey")))`（验证：源码自查、type-check 绿）
- [ ] 3.3 提交本组

## 4. 多渠道打包管线（scripts/，零 package.json）

- [x] 4.1 改 `scripts/pack.mjs`：`readFileSync` 读 `channels.json`，新增 `store --channel <id>`——推导 `browser`、set `WXT_FORK_CHANNEL`、`wxt zip -b <browser>`、跑 `assert-fork-build`+`check-fork-brand`；`number===null` 硬报错退出（验证：`node scripts/pack.mjs store --channel zip` 出 `-zip.zip` 并断言通过；`--channel chrome-store` 报"号码未分配"）
- [x] 4.2 `pack.mjs` 新增 `store --all`：遍历渠道，已分配→打包+断言，`null`→打印跳过续跑，结尾汇总"已出/已跳过"；真实构建或断言失败才 fail-fast（验证：`node scripts/pack.mjs store --all` 仅 `zip` 出包、其余打印跳过、退出 0）
- [x] 4.3 `pack.mjs` 裸 `store`（无 `--channel`/`--all`）改 fail-loud 报错退出，提示必须显式指定渠道（验证：`node scripts/pack.mjs store` 非零退出、不产包）
- [ ] 4.4 提交本组

## 5. 构建期护栏与产物命名

- [x] 5.1 【落点优化】构建期号码非 null 护栏改落 `wxt.config.ts` 生产 `buildStart`（`check-fork-channel` 插件）而非 `assert-fork-build.mjs`——后者只在 pack.mjs 调用时触发、挡不住直接 `wxt zip` 旁路；前者在任何生产 `wxt zip` 触发，真正前移崩溃、且免动 `.d.mts`。若 `WXT_FORK_CHANNEL` 已设则号码必须非 `null`，否则构建 fail-fast（验证：`WXT_FORK_CHANNEL=chrome-store` 构建 fail、`=zip` 通过；type-check 绿）
- [x] 5.2 改 `wxt.config.ts`（白名单内）：`zip.artifactTemplate` 读 `process.env.WXT_FORK_CHANNEL`——已设→`...-<渠道id>.zip`，未设→回退 `...-{{browser}}.zip`（验证：`--channel zip` 出 `-zip.zip`、裸 `pnpm zip` 出 `-chrome.zip`）
- [ ] 5.3 提交本组

## 6. 全量校验与回归

- [x] 6.1 fork 相关单测全绿（channel 8/8 + api 21/21）+ `pnpm type-check` 无红（全量套件 3 处失败均为 `src/utils/guide/` 本地 .env 覆盖 `WXT_WEBSITE_URL` 的既有现象，CI 无 .env 常绿、与本 diff 无关）
- [x] 6.2 `node scripts/check-fork-boundary.mjs`（vs 分支基点 change/fork-foundation）→ **Fork boundary OK**；改动仅 `src/fork/**`+`scripts/pack.mjs`+白名单 `wxt.config.ts` 输出无越界（确认全部落 `src/fork/**`+`scripts/**`+白名单 `wxt.config.ts`）
- [x] 6.3 回归：裸 `pnpm zip` → 产物 `translatebuff-1.0.0-chrome.zip`（`-{{browser}}` 保留、无渠道 id）；渠道号回落 7100（产物内联 7100 已验）
- [x] 6.4 冒烟：`node scripts/pack.mjs store --channel zip` → `translatebuff-1.0.0-zip.zip` + 域名/品牌断言通过；`--all` 出 zip、跳过 3 未分配、汇总正确（品牌校验只跑 1 次）；buildStart 护栏 `WXT_FORK_CHANNEL=chrome-store wxt build` 109ms fail-fast

## 7. 跨仓依赖挂接（非本仓代码，外部前置/协同）

- [x] 7.1 后端已分配并回填 `channels.json`：chrome-store=7101（任译喵-Google）、edge=7102（任译喵-Edge）、firefox=7103（任译喵-FireFox）；`--all` 已验证真打全部 4 渠道、产物名互不撞车
- [ ] 7.2 与官网 `translatebuff-web` 对齐 `cid` 参数名与取值口径（本变更按"渠道号"），推动官网读取 `cid` 落库归因
- [x] 7.3 已确认订单页需 cid（转化/支付归因）→ `useOpenForkOrders` 已补 `appendChannelId`，cid 出口扩为登录/订单/卸载三处
