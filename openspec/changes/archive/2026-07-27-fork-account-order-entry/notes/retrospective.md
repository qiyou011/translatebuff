# fork-account-order-entry 复盘

## 背景与目标

起步是「popup 账户二级菜单加『我的订单』入口 + 头像区分免费/pro」，实机反馈中扩展为**账户面板增强**：popup 与选项页侧边栏补充会员信息（类型 / 到期 / 剩余用量）+ 我的订单入口。会员判定**复刻官网 `deriveTier`**（主档订阅且未过期 → pro）。全程 C 类 fork、零 allowlist、不碰上游引擎。

## 遇到的问题及挑战

### 1.（探索澄清）会员类型信号与用户表述不一致

用户说「会员类型由后端返回」，但探索官网发现：官网**用前端 `deriveTier` 推断**（主档 `token_name==='subscription'` 且未过期），**从不读后端 `tier` 字段**（该字段类型里声明了但全仓未用）。→ 澄清后用户确认**复刻 deriveTier**，避免采信未验证的后端 tier 字段。

### 2.（架构审查两点更优解，偏离用户初始倾向）

用户初始倾向「会员信息存 ForkSession 登录快照 + 纯快照」。架构审查给出更优：

- **A 独立 atom**：用量是动态值，钉进登录快照会陈旧；改存独立 `forkMembershipInfo` 键，还免掉 session schema 扩展/迁移。
- **B popup 打开刷新**：现状已登录用户 tokens 实质永不重取（有会话即短路），纯快照用量陈旧数周；改为 popup 挂载触发一次 `fetchTokens` 重派生。
  → 用户采纳两点。

### 3. fetchTokens 加性扩展不破坏既有消费

`fetchTokens` 加 `tokens` 字段供派生，但被 `fetchTokensWithRetry`/`adoptCredential`/`ensureMembershipKey` 三处消费 + 轮询靠 null 判定。→ 只追加字段、保持 `skKey`/`baseUrl`/null 语义；api 测试的 withRetry 断言改 `toMatchObject` 容纳新字段。

### 4.（硬约束）登出必须显式清会员信息

`forkMembershipInfo` 是独立 storage 键，**不被 `clearForkSession` 整键删带走**。→ `clearMembership` 显式 `clearMembershipInfo()`，否则登出后残留上一用户 PRO/用量幽灵态。

### 5. i18n 加 key 需 wxt prepare 重生成类型

给 `src/locales/*.yml` 加 `forkMembership` 段后，`i18n.t("forkMembership.x")` type-check 报 key 不存在——需先 `WXT_SKIP_ENV_VALIDATION=true pnpm wxt prepare` 重新生成 `#i18n` 类型。已沉淀记忆 `i18n-key-needs-wxt-prepare`。（注：后续只**改文案值**不加 key，则不需 prepare。）

### 6. JSX 闭合标签笔误

侧边栏 Write 时误写 `</DropdownMenuTrigger>`（应 `</DropdownMenu>`），自查发现并修正——重写整文件时闭合标签易错，改后先 type-check 兜底。

### 7. 实机反馈迭代 3 处 UI 微调

apply 完成实机后，用户提出：① 会员徽章前置到入口 trigger（参考官网头像标签）；② 二级菜单不再重复手机号 + 徽章；③ 会员信息改两行「本月剩余 X Token / 会员到期 yyyy-mm-dd」。→ 抽 `TierBadge`（trigger 复用）、`ForkAccountMenuBody` 去手机号头改两行、9 语言文案调整（值改不涉 key，无需 prepare）。

## 架构/设计偏离说明

- **会员信息存储**：从用户初始倾向「session 快照」→ 架构审查采纳「独立 atom + popup 刷新」，已写入 design 最终版（非偏离，是审查驱动的方案定稿；理由：用量动态、快照陈旧）。
- **MembershipInfo 精简**：design 含 `totalQuota`，apply 去掉——简洁展示只显 `remainQuota`（不做总量/百分比/进度条，YAGNI），spec 也只要求 remainQuota。
- **展示细节实机迭代**：spec 定「简洁展示、不照抄官网」，具体布局在实机反馈中定稿——徽章从 content 头移到 trigger 前置、文案从一行「到期 · 剩余」改两行「本月剩余 / 会员到期」。spec 断言未涉具体布局，属预期内的实机打磨。
- **跨仓复刻**：`tier.ts` 逐字复刻官网 `credits.ts`，无 git merge 关系，靠头注释同源指针 + 黄金用例测试（搬官网 `credits.test.ts`）控漂移。
- **simplify**：4 个审查代理一致指向两壳会员展示块重复 → 抽 `ForkAccountMenuBody`；实机阶段再抽 `TierBadge` 供两壳 trigger 复用。

## 总结与后续优化点

**做对的**：探索澄清了会员信号（避免用不可靠的后端 tier 字段）；架构审查拦下「登录快照用量陈旧」，改独立 atom + popup 刷新；tier 复刻同源 + 黄金测试控跨仓漂移；simplify 消除两壳重复、实机快速迭代。非平凡 fork 方案两轮审查（explore + apply 前）值回票价。

**后续优化点**：

1. **fetchTokens null 契约接缝**：skKey 空时 `adoptCredential` 不写会员信息、`refreshMembershipInfo` 写 free 默认——两路径对「无 skKey」表现不一，审查记备查，因爆炸半径小（无 token ≈ free）未拆。
2. **tier.ts 主档选 3 遍**：`deriveMembershipInfo` 对同一 tokens 跑 3 次 `pickPrimaryToken`——复刻官网同源，冷路径 + 极小数组可忽略，改会增与官网漂移，未优化。
3. **用量刷新无去抖**：popup 低频打开，`fetchTokens` 无节流可忽略。
4. **实机 7.5 复验**：入口徽章 / 两行文案 / free 只入口徽章 / 登出无残留——UI 微调后待用户最终实机确认。
