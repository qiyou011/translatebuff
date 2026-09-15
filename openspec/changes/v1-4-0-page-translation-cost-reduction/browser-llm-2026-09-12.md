# 线上浏览器实测：会员 LLM 首轮

日期：2026-09-12，约14:54–15:03（Asia/Taipei）。用户完成正式环境登录后继续；使用现有 Chrome、已加载的候选构建及用户授权的会员账号。没有修改业务代码、持久配置或版本号。

## 结论与证据边界

- 两个正式网关模型的默认 JSON 协议均成功：16项一次请求完整返回，无网络重试或逐项降级。
- 同一16段样本，以旧 `%%` 提示协议、4/1000分组为对照：GLM输入token下降63.77%，Qwen下降67.28%；包含输出及推理的总token下降44.08%和39.45%。不能将输入降幅宣称为总token或实际账单降幅。
- 两个模型各3条人工HTML契约样本均保留5个短id，后台返回均恢复为正确标签上的canonical标记，未降级。
- 这是单次、小样本、两条网关模型别名的协议实测；不是六类原生provider覆盖，不是整页视觉/交互验收，不冻结16/4000及并发4。

## 环境

- 沿用 `browser-live-2026-09-12.md` 中核验的未打包扩展，ID `jjgoechanghiknlblangmfijblhggkdl`，加载目录 `.output/chrome-mv3`；显示版本仍为任译喵1.3.0（rf1.46.6），不是已发布的1.4.0。
- 登录后popup显示PRO；会员提供商指向 `https://open-ai.translatebuff.cn/v1`。只读取凭据存在性，不输出或落盘凭据、认证请求头、手机号。
- 使用 `GLM-5.3-Flash (0.32x)` 和 `Qwen3.8-Flash (0.52x)` 两个线上模型别名。保留其配置中的reasoning、temperature及provider options，不主动切换思考模式。
- 测后确认配置仍为页面16/4000、requestQueue rate8/capacity20、默认提示；10个正式网关模型配置仍有凭据。没有修改用户当前Google提供商选择。
- 通过原生Chrome DevTools执行真实扩展消息。Service Worker临时包装fetch，只统计模型、请求体字节数、JSON mode、键数、usage、状态与时间，不保存请求头及凭据。

## 固定纯文本样本与复现口径

源文件：`fixtures/mdn-viewport-2026-09-12.json`。取所有 `text.length >= 50` 的11个块，随后追加源文件前5块，保持上述顺序，共16项、1915个UTF-16字符。

对 `JSON.stringify(texts)` 的UTF-8字节计算SHA-256：`39294162256179f2ebb1d3b2a57512523bac7d371a815573847523f1b6d142ec`。本地从冻结文件导出与浏览器内实际发送数组的哈希一致。

新协议：通过popup向真实后台发送16个 `enqueueTranslateRequest`，`textFormat=plain`、`eng → cmn`、`hostedFeature=pageTranslation`、真实provider快照；独立 `v140-live-*` hash，`forceRetranslation=true`。保留真实页面批量工厂及队列，不绕过为直接模型调用。返回按消息封装的 `.res` 字符串和 `.err` 判断，不把Promise fulfilled当成翻译成功。无页面sessionId，此处为运行时取文回放，不涉及DOM回填。

旧协议对照：同一数组按4项/1000源字符分组，实际4批的字符数为753、692、429、41。复用源码中的默认system、旧批量规则及sentinel规则，目标名 `Simplified Mandarin Chinese`，标题/摘要使用缺省值。旧system长1915字符，SHA-256为 `e0afbed73906f6a646699e417f034de9e90647c486ec510f97dcd7614cfec4ec`；浏览器字符串与源码常量拼接的本地结果一致。

每批user prompt为默认 `Translate to Simplified Mandarin Chinese:` 加三个换行，输入以 `\n\n%%\n\n` 拼接；通过真实 `backgroundGenerateText` 消息、同一provider快照、maxRetries=0调用SDK。每批返回均按原分隔规则解出4项。此路径重建旧提示协议及分组，**并非加载旧版完整页面队列**，因此不作为旧版DOM耗时、首结果或并发性能基线。为限制线上占用，对照各批顺序运行；新协议先跑、旧协议后跑，非随机交叉实验。

## 每次请求的网关实际usage

所有12次请求均HTTP200。纯文本部分如下；`completion`包含网关报告的reasoning，不重复相加。`cached`是prompt中的缓存子集，未从输入token减除。

| 模型 | 协议/批次 | 请求体字节 | prompt | completion | reasoning | total | cached | 响应体完成ms |
| ---- | --------- | ---------: | -----: | ---------: | --------: | ----: | -----: | -----------: |
| GLM  | JSON 16项 |       3529 |    733 |       1373 |       969 |  2106 |      0 |        19100 |
| Qwen | JSON 16项 |       3521 |    735 |       1748 |      1298 |  2483 |      0 |        37064 |
| GLM  | 旧协议1   |       2944 |    553 |        641 |       510 |  1194 |      0 |         9657 |
| GLM  | 旧协议2   |       2885 |    544 |        437 |       304 |   981 |      0 |         6939 |
| GLM  | 旧协议3   |       2618 |    502 |        439 |       354 |   941 |    384 |         7716 |
| GLM  | 旧协议4   |       2230 |    424 |        226 |       207 |   650 |    384 |         4167 |
| Qwen | 旧协议1   |       2936 |    610 |        689 |       559 |  1299 |      0 |        14522 |
| Qwen | 旧协议2   |       2877 |    600 |        478 |       354 |  1078 |      0 |         9606 |
| Qwen | 旧协议3   |       2610 |    558 |        501 |       413 |  1059 |      0 |        11122 |
| Qwen | 旧协议4   |       2222 |    478 |        187 |       169 |   665 |      0 |         4419 |

| 模型 | 旧输入 → 新输入 | 输入下降 | 旧总token → 新总token | 总token下降 |
| ---- | --------------- | -------: | --------------------- | ----------: |
| GLM  | 2023 → 733      |   63.77% | 3766 → 2106           |      44.08% |
| Qwen | 2246 → 735      |   67.28% | 4101 → 2483           |      39.45% |

下降比例计算为 `1 - 新值 / 旧值`。旧GLM有768个cached prompt token，新协议没有命中；这里报告全部输入量，不换算现金费用或账号扣量。reasoning与生成内容具有随机性，总token仅为本轮观测，不是稳定降幅。

新请求实际携带 `response_format={type:json_object}`，返回均为t0至t15且值均为字符串，finish=stop。真实消息结果16/16非空、无err，端到端分别19130ms、37083ms。人工抽查前两项译文正常；未对全部纯文本做独立逐句质量评分，不能声明质量全面不退化。

单批响应较慢，且本轮没有旧版并行首结果及多次median：不以“4请求变1请求”推断首结果更快，不将顺序对照的总耗时作为页面加速比例。

## HTML紧凑协议契约实测

以下为人工组成的技术文档句子，不冒充真实页面HTML快照。每个模型发送同一组3项：

```html
<a data-rf-attr="0">Read documentation</a> before calling <code data-rf-attr="1">square</code>. Use
<strong data-rf-attr="0">functions</strong> to organize reusable code. See
<a data-rf-attr="0">examples</a> and <a data-rf-attr="1">reference</a>.
```

仍经 `enqueueTranslateRequest`，但format=html，使用独立 `v140-live-html-*` hash绕缓存。每个模型仅1次JSON请求，返回t0..t2均为字符串；线传user内容没有 `data-rf-attr`，有5个短id；模型输出同样保留5个短id且没有canonical标记。后台消息结果恢复5个canonical标记，标签种类及编号均正确。两模型第一句均按中文语序将code1移至a0之前，恢复正确；其余两句同样正确。无缺项或降级请求。

| 模型 | 请求体字节 | prompt | completion | reasoning | total | 响应体完成ms | 消息总ms |
| ---- | ---------: | -----: | ---------: | --------: | ----: | -----------: | -------: |
| GLM  |       1630 |    377 |        297 |       200 |   674 |         4603 |     4713 |
| Qwen |       1622 |    373 |        846 |       746 |  1219 |        20352 |    20465 |

此部分证明真实模型与后台线传/恢复契约，不包含真实DOM属性重建或视觉效果验收。

## 收尾与后续门槛

- 合计12次LLM请求，prompt6487、total14349（网关usage），包含以上所有请求；监控结束时active=0，本轮顺序运行观察峰值1，未验证并发4上限。
- 恢复fetch后核对与原函数一致；清理Service Worker和popup中的所有 `__v140*` 临时全局，结果均为空；关闭监控窗口及popup控制台。未清空用户缓存，回放留下独立测试hash缓存。会员登录保留。
- SDK提示 `providerOptions key 'openai-compatible'` 已弃用，建议 `openaiCompatible`。实际JSON mode已送达并成功，本轮仅记录兼容性告警，没有顺带修改提供商实现。
- 原登录阻断已解除。仍需三页完整样本、4/1000与8/2000与16/4000参数对照、更多模型及异常/降级场景、Google/MS载荷边界、并发2/4/6和真实页面首结果/交互多次median。tasks5.1–5.4保持未完成，不升版本、不提交、不推送、不归档。
