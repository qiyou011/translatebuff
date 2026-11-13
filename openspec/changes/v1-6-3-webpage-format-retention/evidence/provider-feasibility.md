# 双服务前置验证记录（未完成）

记录日期：2026-11-13。生产基线与文件哈希见 baseline.json；进入实施时的未提交改动见 baseline-status.txt。尚未修改生产代码。

## 当前结论（第二轮更新）

用户已授权重新确定基线，原站和重建测试台见 acceptance-baseline.md；原材料缺失不再是阻塞。真实实验及失败样本见 [第二轮报告](provider-feasibility-round2.md)，用户选择保留完整 P0 后的探针实验与独立复评见 [技术路线复评](architecture-reassessment.md)。微软协议门槛仍未通过，尚未选定正式线协议，未进入生产接入。下方为第一轮历史记录，不覆盖后续结论。

## 已执行

- 现有微软、谷歌 API 和 inline-atoms 三个测试文件，64 个测试通过；SKIP_FREE_API=true。
- GitNexus 索引已更新，七个具体文件限定的 upstream impact 结果均 LOW，未返回结果分页截断。流程索引自身仍有预算告警，高阶工厂调用通过源码补核；详情见 impact-summary.md。这不是未来新增修改的自动放行。
- 通过真实 createPageTranslationQueues → requestPageMt → 服务 API 执行合成样本，不模拟翻译返回。脚本 provider-probe.test.ts 仅在 RUN_FORMAT_PROVIDER_PROBE=true 时联网；普通运行跳过。脚本通过只表示采集完成，不表示产品能力通过。
- 从用户原型提取 27 组 source，构造候选格式标记和原子占位符，保留实际请求及响应到 provider-probe-results.json。没有将人工 target 作为翻译输出。

## 传输问题与排除

首次微软 400 来源于 vitest.setup.ts 的 TextEncoder 替身把 Unicode 截为单字节。原生 Node 对同一请求返回 200，控制记录见 transport-control.json。实验脚本在测试期间使用 node:util 原生 TextEncoder 并最终恢复，不改共享测试环境或产品编码。

谷歌直连发生连接失败；读取现有 Windows 系统代理后，以进程级 HTTPS_PROXY=http://127.0.0.1:7897、NODE_USE_ENV_PROXY=1 运行成功。未修改系统代理或扩展服务配置。

## 微软候选结果

- [B0]…[/B0] 和 [[S0]]…[[E0]] 在简单样本中丢失开始标记，不能采用。
- ⟦A2⟧ 原子标记在 F01 长句中丢失，不能按正常结果恢复，更不能把代码追加末尾。
- {{2}} 原子标记在 F01 可保留，但对应试验出现英文冠词残留；不能只统计标记数量判质量。
- ⟦B编号⟧／⟦H编号⟧ 成对格式标记配合 ZXQATOM编号QXZ 原子标记，在本轮 27 组提取文本中未发现标记缺失、重复或新增；F01、F03、F04、F20、F24、F27 的局部语义对应可继续研究。
- 这仅验证候选线协议。实验序列化有意扁平化结构和空白，并未实现浏览器可见性、结构保留、P1 样式或控件隔离，因此 F10—F23 不得据此标记产品通过。还需测试源文仿造标记、损坏响应、语言方向及多轮稳定性，不能宣布微软可行性门槛完全通过。

## 谷歌候选结果

两个真实 HTML 样本保留 b、mark、translate=no 片段及其中代码／占位符，支持继续评估既有 HTML 通道。尚未覆盖完整属性保护、异常恢复、原子审计和 27 组正常 P0，任务 1.4 不勾选。

## 验收材料缺口

原型哈希与 acceptance-matrix.md 完全相符，27 组输入均可提取。但原型引用的独立“网页格式保留测试台.html”和 E009—E013 原始资料在已检查的项目、下载、桌面、文档位置未找到；部分其他项目目录无访问权限，未作全盘不存在结论。原记录 http://127.0.0.1:18843/ 的连接返回 ECONNREFUSED。

按原句追溯到项目官方仓库 https://github.com/leeguooooo/iphone-use ，其页面列出的官网是 https://iphone-use.leeguoo.com/en/ 。这是原反馈网站的候选线索，尚未核对原型中的 du-lede DOM，不能把候选网址直接当已确认原站。

以上为第一轮材料缺口。后续用户明确要求重新确定原站验收基线，已保存在线 HTML/CSS、六项定位与哈希，并从原型 source／fixtureCss 重建全部 27 组受控输入；详见 acceptance-baseline.md。最新任务状态以 tasks.md 及第二轮报告为准。

## 复现

```powershell
$env:SKIP_FREE_API='true'
$env:RUN_FORMAT_PROVIDER_PROBE='true'
$env:HTTPS_PROXY='http://127.0.0.1:7897'
$env:NODE_USE_ENV_PROXY='1'
pnpm exec vitest run openspec/changes/v1-6-3-webpage-format-retention/evidence/provider-probe.test.ts
```

实验原始文件保留合成文字、请求端点、响应和时间，不包含用户凭据。该命令会重新生成实验结果；本记录中的候选局限不能因一次成功被删除。
