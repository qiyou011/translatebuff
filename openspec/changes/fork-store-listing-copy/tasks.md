## 1. 规格与身份门禁

- [x] 1.1 在按目标仓基线创建的开发分支上，核对 `fork-identity` 与 `fork-upstream-cloud-isolation` 增量规格及原有品牌测试；确认仅调整可见标题和指定语言短描述，不改稳定技术标识。
- [x] 1.2 先为双版 `manifest.name` 编写失败的身份测试：逐字验证两个新标题，并断言 `FORK_BRANDING.name`、`APP_NAME`、ZIP 命名和既有 Firefox `gecko.id` 不变；首次红灯必须来自旧标题。
- [x] 1.3 在 `src/fork/branding.ts` 增加独立按 edition 选取商店标题的接缝，只修改 `wxt.config.ts` 的 `manifest.name` 消费点；复跑 1.2 测试至绿。

## 2. 本地化短描述与品牌隔离

- [x] 2.1 扩展 `src/fork/i18n/chrome-messages.forktest.ts`：先验证 `cn+zh_CN`、`global+en` 精确文案仍为旧值（真实红灯），并断言 `global+zh_CN/zh_TW` 品牌始终为 `TranslateBuff`、`cn+en` 仍为“任译喵”；其他消息与元数据不变，英文总结不超过 132 字符。
- [x] 2.2 修改 `src/fork/i18n/chrome-messages.ts` 与 `wxt.config.ts` 的构建资源接线：传入生成资源路径识别的 locale，仅定点覆写两条目标总结；保留现有描述品牌替换，复跑 2.1 至绿，不改共用 YAML。

## 3. 真包验证和交付

- [x] 3.1 使用 `SKIP_FREE_API=true pnpm run test`、`pnpm lint` 核查回归；依仓库说明明确记录外部服务测试跳过，不将其视为在线翻译验证通过。
- [x] 3.2 在代码仓以国内/海外正式打包命令构建 Chrome、Edge、Firefox；逐包读取 manifest 与 `_locales/en`、`zh_CN`、`zh_TW`，验证目标文字、国内外品牌隔离、渠道与域名护栏；核查技术标识及扩展 ID 未漂移。
- [ ] 3.3 仅在用户另行批准正式发布后，按正式插件打包准则清理旧生成包并重建全渠道产物，检查 ZIP 完整性与 SHA256；不自动提交、推送、发布商店，也不混入独立的 360 CRX 自动签名改造。
