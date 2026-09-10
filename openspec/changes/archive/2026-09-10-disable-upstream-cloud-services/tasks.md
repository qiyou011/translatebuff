# 上游云服务隔离实施任务

归档决策（2026-09-10）：用户确认“测试已验证完成”，并在获知任务仍为 14/20 后明确授权“强制归档”。保留以下六项未勾选状态，不以概括性测试确认替代各项独立证据；品牌、模型名称与静态预览补充及已知问题详见 [archive-closeout.md](archive-closeout.md)。

依据：[design.md](design.md)、[隔离规格](specs/fork-upstream-cloud-isolation/spec.md)、[认证规格变更](specs/fork-backend-repoint/spec.md)。

目标：保留翻译核心和任译喵业务，通过现有重定向禁用三类上游云服务，并在请求前兼容旧模型引用。沿用 TypeScript、React、WXT、ORPC、Vitest，不新增依赖。本清单保持责任与验收粒度，不预写完整 SDK 实现。

全局约束：新增功能代码仅进 `src/fork/**`；上游原地新增改动预算仅为 `wxt.config.ts` 注册；不扩大 allowlist、不改核心引擎/模型分类/全局重试/消息协议，不新增配置迁移或扩大既有同步算法，不删除用户数据、不改自有域名。超出边界重新评审。已获实施确认，实施及验收记录见 [implementation.md](implementation.md)；未勾选项不代表验收通过。

## 1. 设计确认与接入检查

- [x] 1.1 完成修订方案架构复审：请求前运行时兼容、语言三入口降级、纯身份叶子消除循环、fork 内部显式调用、共享队列与端口错误边界；结论为“审查通过”，不代表功能验收通过。
- [x] 1.2 实施前对实际覆盖符号及 fork 身份判断抽取执行 GitNexus impact，核对动态调用、导出及重试消费点；HIGH/CRITICAL 先报告、UNKNOWN 补文本证据。记录最终覆盖清单，禁止扩改 `isBuiltInAiProviderId` 或 `computeForkConfigSync` 算法。

## 2. 运行时模型兼容与语言降级

- [x] 2.1 先补候选规则及冷启动用例，再抽取 `src/fork/providers/renyimiao-identity.ts` 纯叶子并由原模块重导出，实现 `upstream-services/provider-registry.ts` 薄包装；验证有效 local 不变、配置顺序、启用/能力/key 条件、无候选和语言/笔记排除，无 storage/网络副作用或新增导入循环。
- [x] 2.2 先覆盖显式 system 快照和既有调用绕过场景，再实现 `upstream-services/provider-ref.ts` 的序列化/可用性协作包装；按需读取一次当前配置，显式调用 fork 函数，生成真实 local ref 或前置不可重试结果，不查询 hosted 状态。接入现有重定向与审查后的指纹。
- [x] 2.3 为 `upstream-services/language.ts` 三入口建立降级用例后实现薄包装；验证显式 local 优先、无 ref 时使用配置、旧 system 本地降级和直接 LLM 返回 null，禁止进入三次尝试；断言 backgroundGenerateText/RPC 均零调用，保留原本地及有效 local 路径。
- [x] 2.4 在既有 fork 划词/输入/自定义动作消费边界接入最终 provider 与无候选引导；补页面/字幕整链路测试，验证提示词、模型参数、温度、缓存、统计及执行模型展示一致、不复用 hosted 身份缓存；新增兼容不写配置，现有种子/登录同步保持原样。

## 3. 服务出口与后台禁用

- [x] 3.1 在 `src/fork/upstream-services/__tests__/auth-disabled.forktest.ts` 先建立失败用例，再实现两套认证适配器及重定向/指纹；useSession/getSession 无会话、不加载、不请求、不订阅，非读取操作本地拒绝，自有会员凭据不变。
- [x] 3.2 先覆盖普通/流式和前台/后台 RPC，再实现两套适配器及最小禁用 transport；保留 orpcClient/orpc/backgroundOrpcClient 契约，fetch/backgroundFetch 零请求，不模拟 router、不伪造成功、不回退上游。
- [x] 3.3 先覆盖冷启动、旧状态、Cookie 变化及旧笔记任务，再实现 hosted-ai-status/notebase-pending-save 包装；状态消息返回 null、缓存清理导出可用，笔记处理器不执行、不新增业务监听、不删除数据。
- [x] 3.4 在 fork 消费边界落实独立禁用错误和既有不可重试语义；测试正常/禁用任务并存、无 failQueue 连带失败、无重试/轮询/loading 悬挂，覆盖端口只传 message 的实际消费者，不能依赖元数据跨端口或修改全局规则。

## 4. UI 与博客闭环

- [x] 4.1 先建立博客直接调用和工具兼容用例，再实现 `upstream-services/blog.ts`；在既有 fork 弹窗和设置页叶子移除查询及提示，返回 null，旧缓存不重新显示通知。
- [x] 4.2 核对并补齐上游账号、云笔记、托管 AI、云转录及相关引导入口的禁用和挂载测试；不启动查询、不诱导上游登录购买，保留自有账号、普通字幕、自定义动作/词典，保持笔记建议无入口/无生成调用。

## 5. 自动验证与构建

- [x] 5.1 运行 `SKIP_FREE_API=true pnpm run test`、`SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork`、`pnpm run type-check`、`pnpm run fmt:check`；覆盖 design 功能矩阵和冷启动/旧配置/无候选/显式引用/正常 local 场景。记录外部 free-api 测试跳过，不修改上游测试迎合禁用逻辑。
- [ ] 5.2 通过 `node scripts/pack.mjs test --edition cn` 和 `node scripts/pack.mjs test --edition global` 构建双线 Chrome 测试包；读取实际渠道注册表选择 Chrome 正式渠道，用 `store --edition ... --channel ...` 构建正式配置包，不猜渠道号、不发布。验证四类构建隔离及域名守卫，沿用 Edge/Firefox 构建门。
- [ ] 5.3 使用测试夹具验证源文件缺失、指纹变化、契约不兼容明确失败，不改真实上游文件制造漂移；运行增量边界检查，使用实际分叉提交 `cc6a65974dbec43c9643f246d26ccff65701d2bf`，不以移动远程 HEAD 替代基线。

## 6. 真实浏览器回归与维护交付

- [ ] 6.1 加载并核实双发行版新包，在 Service Worker、扩展页面和 content script 记录启动/重载/UI 挂载/会话变化/旧配置网络证据，确认三类服务零请求；正式配置做无副作用隔离检查。记录版本、edition、构建提交、环境及逐项结果。
- [ ] 6.2 按 design 功能矩阵验证页面/划词/输入/字幕/语言检测/自定义动作与内置词典，以及云转录/Notebase/笔记建议关闭边界；回归 Discord 三空格翻译、编辑后撤销、失焦再聚焦、菜单搜索。覆盖有候选/无候选旧配置和有效 local；字幕高级处理使用具备 LLM 能力的模型。
- [ ] 6.3 回归任译喵未登录、会话恢复、凭据获取/过期、额度异常、正常网关调用、官网联动及登出，确认自有域名/状态/原同步机制不变，不将 key 存在视为会员证明。账号/服务条件不足明确待验收，不做未授权支付或发布。
- [x] 6.4 更新 `FORK.md` 的适配点、实际同步提交、契约包/新出口检查、指纹、双套测试及回归清单；记录无迁移的局部回滚方式与恢复旧请求风险，补充本次用户可见变更的 `.changeset/*.md`（`@read-frog/extension`，conventional commit 内容）。
- [ ] 6.5 交付前校验 OpenSpec 并自查规格覆盖；准备提交时运行 GitNexus detect_changes(scope=all)，不接受 partial/truncated；核实仅预期文件变动，提交/推送/发布按用户授权分别执行。
