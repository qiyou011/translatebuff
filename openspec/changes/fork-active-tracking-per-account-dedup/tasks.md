## 1. 去重底座改为按身份分桶

- [x] 1.1 在 `active-dedup.test.ts` 补失败用例：不同身份各自独立去重、写入时丢弃非当日条目、旧格式裸字符串视为无记录（先跑出红灯）
- [x] 1.2 改 `active-dedup.ts`：存储结构改为 `Record<身份, 日期>`，读写按身份取值，写入时只保留当日条目，转绿

## 2. 上报编排接入身份

- [x] 2.1 在 `track-active.test.ts` 补失败用例：游客与已登录账号各报一次、换账号当天重报、同账号重登不重报（先跑出红灯）
- [x] 2.2 改 `track-active.ts`：先读会话算身份（`anon` / `phone || email || loginCredential`），再判去重与落标记，转绿

## 3. 验证与出包

- [x] 3.1 跑全量单测（CI 口径 env），确认无回归
- [x] 3.2 重新打国内官网 zip：`node scripts/pack.mjs store --channel zip`
- [x] 3.3 用 Chrome for Testing 实测：游客翻译上报一次 → 写入会话模拟登录 → 再翻译必须重新上报

## 4. 需求同步

- [x] 4.1 把 proposal 同步到需求仓 `AI/translatebuff/openspec/changes/v1-8-1-translatebuff-active-tracking-per-account-dedup/proposal.md`
