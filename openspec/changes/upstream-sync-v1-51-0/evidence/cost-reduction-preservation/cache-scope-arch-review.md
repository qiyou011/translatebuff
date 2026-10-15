# 空有效术语集合缓存兼容：独立架构审查

审查基准：工作树 HEAD `e1d90dc928ca5fbbbba112e480131e1c909c93ce`；原业务 `4be99b341a7c940a48794232f066db43339cc2d2`；固定上游 `55bcef1e684fb4e70f4dce3063e7bd3066f46891`。本轮仅只读源码、测试定义、规格与 Git 历史，并写本文件；未修改生产或测试、运行测试、构建、操作浏览器或账号。现有其他工作者改动均保留。

## 1. 总体评价

**拟议最小修订审查通过。** 仅在内容脚本追加 `glossaryRevision` 的条件中增加 `glossaryTerms.length > 0`，可消除空有效集合引入的不必要缓存失效，同时保留非空术语缓存隔离、后台防护及合批约束。无需新增缓存层、迁移、版本号或批处理策略。

该结论是设计安全性判断，不是修订已落地或本轮测试通过；不推算请求、token 或金额的节省幅度。

## 2. 需求与最小实现

- 当前明确需求：保留原页面翻译降本机制；有效术语影响请求时仍正确隔离；不让“启用空库”或“编辑不匹配本段的词条”单独废弃等价的无术语译文。
- 最小改动位置：`src/utils/host/translate/translate-text.ts:382–389`。保留现有 `glossaryEnabled` 和 LLM/provider 条件，只增加非空有效集合判断，并更新相邻注释使其不再要求空快照随全局 revision 失效。
- 仍把实际解析出的 `glossaryTerms`、`glossaryRevision` 随请求发送；不要将 revision 归零、丢弃字段或改动队列 key。内容缓存等价性与在途任务分组有不同职责，当前无需合并两者。

## 3. 架构、数据流与安全性证据

### 空集合的请求语义相同

- `src/utils/glossary/prompt.ts:46–47,74–79`：空集合没有术语块，返回原 system prompt。
- `src/utils/prompts/translate.ts:139–151`：明确要求未命中术语时 prompt 字节不变，不能仅因拥有术语库废弃缓存。
- `src/utils/prompts/translate.ts:168–174`：显式 `[]` 通过 `??` 保留，不会再次解析并意外注入新词条。
- `src/utils/host/translate/translate-text.ts:147–155,371–389`：内容 hash 已包含实际生成的 system/user prompt；当前额外 revision 标签才造成空集合的额外身份变化。
- `git diff 4be99b34 e1d90dc -- src/utils/prompts/translate.ts`：prompt builder 的增量为术语支持；空数组仍返回原 prompt。`src/utils/constants/prompt.ts` 在两端 SHA-256 相同；固定上游 content 没有本轮新增的 revision 追加段。

因此，在文本、最终 provider、语言、有效 prompt、格式、上下文及额外 hash 标签等其他输入相同的条件下，空集合不需要再用全局 revision 区分内容缓存。这里恢复的是本次额外 revision 盐造成的兼容性损失，不承诺所有历史缓存无条件命中。

### 不会放宽混批或非空缓存保护

- `src/fork/page-translation/queues.ts:34–53`：合批 key 仍包含 revision 以及稳定排序的有效词条集合。
- 同文件 `:83–87,183–189,208–209`：下游请求 hash/dedup key 仍依赖该 batch key；入队继续 structuredClone 冻结快照。
- `src/fork/page-translation/llm.ts:32–57`：实际 prompt 取同一有效术语快照，单条降级仍从同一任务调用 `invoke([data], true)`，见 `queues.ts:141–146,155–178`。
- `src/entrypoints/background/page-translation.ts:93–108`：fork 本地 LLM 只在词条非空时对 caller hash 再加 revision/词条盐；空集合保持 caller hash，非空防护不变。
- 内容端非空词条继续追加 revision，且词条实际措辞已在 prompt/hash 内。修改、删除或范围变化不会把非空约束结果写进空集合键。
- 取消、强制重译、marker/公式完整性检查、失败结果不缓存，以及既有 provider/权限规则均不因这个条件变化而被修改。

### 删除最后一个匹配词条的两种情况

| 已有缓存 | 删除后有效集合 `[]` 的正确结果 |
| --- | --- |
| 只有非空词条约束结果 | 不命中该结果；它的 prompt/hash 和后台盐均不同。首次普通请求生成无术语结果，此后可复用。 |
| 添加词条之前已有无术语结果 | 允许复用这个等价无术语结果；它不是“删除后误命中含已删除术语约束的旧译文”。 |

即使旧非空任务在删除后迟到，仍写入旧非空身份；拟议修订没有将它改写到空集合身份。实际删除是否已持久化、matcher 是否收到失效通知是另一项既有生命周期问题，本次条件修改不证明真实账号删除问题已解决。

## 4. 过度设计检查

未发现需要新增抽象或基础设施的依据。只缩小内容 hash 的一个失效条件，保留严格队列分组和后台非空盐，是当前需求的最小设计。不应顺便去掉非空 revision、合并不同词条集合、扩大批量或修改重试、并发。

## 5. 必须同步的规格与验收边界

### 规格最小修订

1. `specs/fork-upstream-v151-admission/spec.md` 的“修改或删除术语后再次翻译”场景（当前 210–213 行）应去除“所有旧 revision 译文一律不可复用”的歧义，建议改为：

   > 新任务继续采用实际术语快照及 revision；非空有效术语仍按 revision 隔离，不得复用带已删除或已修改术语约束的旧译文。同一请求批次不混用不一致快照。删除至空有效集合时，允许复用其他有效输入相同的无术语缓存。

2. 同一 Requirement 下增加“空有效术语集合保持缓存兼容”场景：

   > WHEN 术语关闭、启用但库为空，或全局 revision 改变后本次匹配仍为空；THEN 在其他有效输入相同时复用相同无术语内容缓存，不因开关或不相关 revision 单独失效；新发任务仍携带实际 revision，合批/dedup 继续遵循 revision 和有效集合隔离。

3. `design.md` D5（当前 37–39 行）补一句：

   > 内容缓存仅对非空有效术语集合追加 revision；空集合保持无术语内容缓存身份。此规则不改变请求携带的快照，也不放宽队列按 revision 和有效集合分组。

203 行已有“区分影响结果的术语 revision”的措辞可保留；合批不同 revision 不混用的约束无需弱化。无需新建或修改另一套术语 schema、cloud-isolation 规则或底层队列契约。

### 必要回归

- 真实 `translateTextCore`：关闭 → 开启空集合复用；空匹配 revision 改变复用；非空相同词条不同 revision 仍失效；删除最后匹配词条不复用约束结果。
- 补充/确认“无术语 → 非空术语 → 删除至空”的序列能正确恢复原无术语缓存，不能把这种合法命中判为删除失败。
- 保留 `glossary.test.ts:70–82,103–122` 的删除/跨范围拆批及 `background.test.ts:184–228,254–307` 的编辑删除/同 revision 不同集合缓存保护；本轮未运行这些测试，不引用历史 PASS 作为本轮证据。
- 根代理已报告新内容回归中两个空集合用例 RED，非空 revision 和删除对照 PASS；本审查读取了 `cost-preservation-content.forktest.ts:68–102` 的定义，未独立运行。修订后由实施者记录 RED→GREEN 及相关回归结果。

## 6. 结论

建议按上述单条件修订实施并同步规格文字。未发现混批、非空旧缓存污染或首次删除方面的反证；真实删除生命周期问题及实际成本幅度仍需各自证据。

审查通过
