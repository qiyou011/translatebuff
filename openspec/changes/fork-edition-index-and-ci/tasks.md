> 本变更零逻辑改动（一处注释 + 一份 workflow），故无 TDD 红灯环节。验证靠「改坏配置看 CI 是否判红」的反向实证。

## 0. 待评审确认

- [x] 0.1 design D2 已定：国内线保留 `pnpm run build` 三浏览器构建（2026-08-27 产品确认按建议）

## 1. 差异落点索引

- [x] 1.1 `src/fork/identity/edition.ts` 文件头加索引表：列全 7 处分叉点（两份正式 env / 两份测试 env / `website-routes.ts` / `channels.json` + `channel.ts` 默认渠道 / `wxt.config.ts` 商店身份与产物命名 / `pack.mjs` 配置源映射 / `assert-fork-build.mjs` 配置源映射），每条标明路径、分的是什么、运行上下文
- [x] 1.2 索引末尾写明「新增分叉点必须登记到此表」，并说明为何不做机器校验（字符串条件与纯数据 env 扫不准，高误报比没有更糟）

## 2. CI 双线出包

- [x] 2.1 `fork-guard.yml` 新增海外线步骤：`node scripts/pack.mjs store --edition global --channel global-zip`
- [x] 2.2 断言改逐目录跑：`chrome` / `edge` / `firefox` 三个 `.output/<browser>-mv3` 各跑一次 `assert-fork-build.mjs`（修既有的「edge/firefox 白构建」缺口）
- [x] 2.3 按 0.1 的结论决定国内线是否改走 `pack.mjs`

## 3. 反向实证（本变更的核心验证）

- [x] 3.1 本地模拟「海外配置被改坏」：临时把 `.env.global.production` 的 `WXT_API_URL` 改成 `.cn` 域，跑 `pack.mjs store --edition global --channel global-zip`，**必须** fail-fast 并点名 `translatebuff.cn`；改回
- [x] 3.2 本地模拟「海外配置漏配」：临时删掉 `.env.global.production` 的 `WXT_WEBSITE_URL`，同上命令**必须**报缺失；改回
- [x] 3.3 本地模拟「edge 产物被改坏」：往 `.output/edge-mv3` 里塞一个含 `.cn` 域的文件，逐目录断言**必须**判红（证明 2.2 真的补上了缺口）
- [x] 3.4 确认改动前后国内线产物零变化：`pack.mjs store --all` 产物与本变更前逐字比对

## 4. 收尾

- [x] 4.1 全量门禁：`pnpm run test` / `lint` / `fmt:check` / `check-fork-boundary` / `check-fork-brand`
- [x] 4.2 提交并提 PR 到 `change/fork-foundation`（需用户授权）

## 5. 实施中发现并修复的两个护栏漏洞（反向实证暴露）

- [x] 5.1 `checkEditionDomains` 的禁止清单被 `own` 过滤 → 把本线 env 改成另一线的域时，那个域同时进 own 与 other，过滤后清单清空、护栏自我注销（实测坏配置 exit 0 且打印「无另一线域名」）。去掉过滤 + 补测试锁定
- [x] 5.2 文案豁免让国内线的反向护栏整条空转 —— 它唯一的禁止域 `www.translatebuff.com` 出现在 9 份 locale 里被豁免，而当年抓到 `branding.ts` 死常量靠的正是这条。新增源码层交叉扫描（排除 `src/locales` 与测试夹具、扫描前剥注释），实测能重新抓到 `branding.ts` 那类
- [x] 5.3 `vitest.fork.config.ts` 的 `testTimeout` 放宽到 20s，消除 `.forktest.ts` 的随机超时（连跑 3 次全绿）
