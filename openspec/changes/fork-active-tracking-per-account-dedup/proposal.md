## Why

活跃埋点的去重键 `local:forkActiveTracking` 只存一个 UTC 日期串，不带任何身份维度——同一台设备当天换账号后 `translate_active` 不再上报，新账号在中台当天看不到活跃记录。

数据侧确认口径是**账号级日活**（后端另有一层去重兜底）。又因为活跃口径本就包含未登录用户，身份维度必须能同时表达游客与各个已登录账号。

## What Changes

- 去重记录由「单个日期串」改为「身份 → 日期」的映射：游客一个桶，每个已登录账号各一个桶。任一身份当天首次翻译都会上报一次。
- 身份取值：未登录为 `anon`；已登录取 `phone`（国内线）或 `email`（海外线），两者皆空时回落 `loginCredential`。**不取 `loginCredential` 作为首选**——它每次登录都会换，同一账号重登会被当成新身份而重复上报。
- 上报编排调整读取顺序：先读会话算出身份，再做去重判定与落标记。
- 写入时顺带丢弃非当日的历史条目，映射不会随账号数无限增长。
- 旧格式（裸日期字符串）读到即视为无记录，不做数据迁移。
- 【破坏性变更】`local:forkActiveTracking` 的存储形态变更，无向后兼容读取。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `fork-active-tracking`：去重口径由「设备 × UTC 自然日」改为「身份 × UTC 自然日」，身份含游客与各已登录账号。

## Impact

**代码**

- `src/fork/analytics/active-dedup.ts`：存储结构与读写接口改为按身份分桶。
- `src/fork/analytics/track-active.ts`：先取会话算身份，再判去重。
- 会员侧 `clearMembership()` 不改——换账号由身份分桶天然覆盖，无需在登出时清记录。

**数据**

- 上报量上升：同一设备上游客与每个账号当天各上报一次。账号级去重由后端承担。
- 升级当天，存量用户的旧格式记录被视为无记录，可能多报一次。
- 埋点台账中 `translate_active` 的去重口径描述需同步为「按身份 + 自然日去重」。

**风险**

- **身份取 `phone`/`email` 意味着去重桶键含 PII**。这两个字段本就以明文存在同一扩展的 `forkSession` 里，本变更不新增暴露面，但也不因此把它写进上报报文——报文字段一个不动。
- **同账号在两条 edition 上的身份不同**（国内 `phone`、海外 `email`），跨线不共享去重桶。两条线本就是独立用户池，不构成问题。

⚠️ 本提案与需求仓 `AI/translatebuff` 的 `openspec/changes/v1-8-1-translatebuff-active-tracking-per-account-dedup/proposal.md` 保持一致，两边同步修改。
