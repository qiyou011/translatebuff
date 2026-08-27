## Why

任译喵要上架海外市场，但本仓只能打出指向 `translatebuff.cn` 的国内包。`.env.production` 是正式包的唯一配置源、域名写死在里面，`scripts/pack.mjs store` 只有「渠道」一个维度——没有任何接缝可以打出第二套域名的正式包。

海外线不是「换个域名」：`translatebuff.com` 是独立部署、独立后端、独立用户池（见需求仓 `v1-0-0-translatebuff-overseas`），官网路由结构也与国内不同。同时仓内还有 4 处 env 换不掉的硬编码（反馈页地址、后端语言头、扩展显示名、Firefox 扩展 ID），照现状打出的「海外包」会指向国内后端、显示中文名、并与国内包抢同一个 AMO 扩展 ID。

## What Changes

- **Firefox 扩展 ID 按线拆分**：国内版已在 AMO 上架，其 `translatebuff@translatebuff.com` **保持不动**（AMO 的扩展 ID 一经上架不可更改，改动等同发布成新扩展、存量用户断更新）；海外版另起 `overseas@translatebuff.com`。两版 ID 不同即可各自上架，无破坏性影响。
- **新增 edition 维度**：打包命令新增 `--edition cn|global`，正式环境配置拆成两份，构建期把 edition 注入产物。缺省行为保持现状（不传即国内），已有渠道命令不受影响。
- **海外后端与站点指向**：官网域、授信 origin、cookie 域按 edition 取 `.com` 值；登录后端域与翻译网关域先以海外官网域占位，上线前替换为后端提供的正式值。
- **域名断言按 edition 生效**：产物域名正向断言与测试域泄漏守卫改为读当前 edition 的配置，并新增反向断言——海外包不得含 `.cn` 域，国内包不得含 `.com` 域，防止两条线的配置串味。
- **渠道注册表按 edition 分区**：新增四个海外渠道（官网直装 `7150` / Chrome Web Store `7151` / Edge `7152` / Firefox `7153`）。未知渠道、跨 edition 取渠道、号码未分配一律构建期抛错。
- **官网跳转路径按 edition 分化**：登录、订单、卸载问卷、反馈四条对外跳转按海外官网现状取路径（订单在账户中心下、卸载问卷与引导在插件产品页下、反馈并入帮助页）。多语言前缀规则两线一致；官网独有的葡萄牙语不进映射表（扩展无该界面语言，加了是死代码），两侧语种集合不对称是预期。
- **扩展显示名按 edition 取值**：国内取中文品牌名，海外取英文品牌名。技术标识（`APP_NAME`、自定义元素名、IndexedDB 库名）保持不变，绝不随 edition 漂移。
- **后端语言头按界面语言映射**：`Client-Language` 由写死的 `zh-cn` 改为按当前界面语言映射完整 locale，未确认有译文的语种回落 `en-us`——与官网侧同一张映射表。国内版中文界面取值不变；国内版非中文界面由恒定 `zh-cn` 改为对应 locale，属预期修正。
- **测试包同样按 edition 分线**：`pack.mjs test` 接入 `--edition`，配置源 `cn → .env` / `global → .env.global`（两份均为本地 gitignored 配置），产物名以 `-test-global` 区分；测试包新增与正式包同款的反向域名断言，防止漏配某个 `WXT_*` 时静默回落到另一条线的生产域。**编译产物目录也按 edition 分开**（海外为 `.output/<browser>-mv3-global`，国内保持原名），否则两条线共用同一目录、后跑的静默覆盖前一条，而目录内没有任何标识能看出装的是哪条线。
- **不做的事**：账户菜单展示 Google 邮箱与订阅状态（已拆为独立需求）；海外商店条目的素材、截图、开发者账号（非代码工作）；国内线现有渠道号与上架流程不动。

## Capabilities

### New Capabilities

- `fork-global-edition`：edition（cn / global）打包维度——两套正式环境配置的选取与注入、按 edition 的产物域名双向断言、按 edition 的站点跳转路径解析。

### Modified Capabilities

- `fork-identity`：扩展显示名与 Firefox `gecko.id` 由固定字面量改为按 edition 取值。
- `fork-backend-repoint`：生产后端指向由单一 `.env.production` 改为按 edition 选取配置源，断言随之按 edition 校验。
- `fork-channel-attribution`：渠道注册表增加 edition 归属，新增海外渠道；解析时校验渠道与当前 edition 匹配。
- `fork-account-order-entry`：订单页跳转路径由固定 `/orders` 改为按 edition 解析。

## Impact

**依赖**

- 后端分配的海外渠道号 `7150`（官网直装）/ `7151`（Chrome Web Store）/ `7152`（Edge）/ `7153`（Firefox）。号码落在 71 段内，两个官网仓现有的 `/^71\d{2}$/` cid 校验原样放行，官网侧零改动。
- 海外登录后端域（common_bll / claw_bff）与 oneapi 翻译网关域的正式值，上线前替换。
- 海外官网 `translatebuff.com` 的路由结构；本变更按其当前形态实现，官网改路径需同步知会本仓。
- 官网写 `Login-Credential` cookie 的实际 host（海外站为 `www.translatebuff.com`）——插件冷启动读 cookie 与登出删 cookie 都按此域配置。

**待决策**

- 海外包是否需要独立的 PostHog project 与 Google OAuth client id；当前两份 env 中这两项仍是占位值，由 CI secrets 注入。

**风险**

- **界面文案跨线共用品牌主域**：9 份 locale 共 5 条串写死 `translatebuff.com`（联系邮箱、Notebase 登录引导 ×3、社区提示词 URL），国内包也带这份文案——产品已确认保留、不按 edition 分线（2026-08-26）。反向域名断言据此把「文案来源的域名」与「端点配置的域名」分流：前者仅回声，后者 fail-fast。代价是端点常量若恰好与文案同域会被豁免遮蔽。
- **【发版阻塞】海外卸载问卷路径依赖官网尚未部署的改名**：插件直连 `/extension/uninstall-survey`，而海外官网的 `/plugin` → `/extension` 改名虽已在官网仓合并、**线上尚未部署**，2026-08-26 实测该路径 404（裸 `/uninstall-survey` 反而被官网 redirects 表承接、能通）。产品已确认直连新路径、接受部署前是死链（方案 B）。**海外包发版前必须先确认官网已部署**，否则用户卸载时看到 404。
- **插件的引导页跳转依赖官网的旧路径承接表**：`background/index.ts` 的 `getWebsiteUrl("/guide/step-1")` 是不带产品页前缀的裸路径，靠海外官网 `src/consts/redirects.ts` 跳到实际位置。那张表的注释写明它是为「已发布插件版本里写死的」留的——官网若清理该表，插件引导页会静默 404。这是跨仓隐式契约，官网侧改动需知会本仓。
- 两条线的配置串味是本变更最主要的失败形态，且症状滞后——海外包指向国内后端时构建照样成功、安装照样能用，直到用户登录才发现打不通。双向域名断言就是为此设置，任何绕过 `pack.mjs` 直接 `wxt zip` 的路径都会失去这层保护。
- `Client-Language` 取值若不在后端译文表内，后端不回退英文，直接把字面量 `err not found` 当错误消息返回并展示给用户；映射表只收已实测确认的取值。
- edition 维度进入 `wxt.config.ts` 与 `scripts/`，属软 fork 的 A/B 类文件，须走 `scripts/fork-allowlist.json` 白名单并在下次同步上游时逐项对账。

⚠️ 本 proposal 只覆盖「打得出、指得对、不串味」的海外包。海外版的账号身份展示（邮箱替代手机号）与订阅状态展示是独立需求，本变更完成后海外包的账户菜单仍会尝试展示手机号字段。

⚠️ 本提案与需求仓 `AI/translatebuff` 的 `openspec/changes/v1-6-0-translatebuff-extension-global-edition/proposal.md` 保持一致，两边同步修改。
