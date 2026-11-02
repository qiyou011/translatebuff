# 实施验证记录

> 后续用户已明确改用其他验证方式。本轮替代自动化验收已完成：5组真实本机HTTP联调、2200项相关回归通过；完整结果及边界见 [alternative-validation.md](./alternative-validation.md)。原实站/账号观察缺口仍保留，不再要求用户处理Chrome连接。

## 起点与环境

- 业务目标：`feat/1.6.1`。
- 冻结增量比较 SHA：`4b50206132b9f0a09dce9951a928c6fefd99c34e`。
- 实施分支：`codex/upstream-fixes-v1-6-1`，从同一 SHA 建立，原规划未提交文件保留。
- 本文件随实际命令及验收进展更新；尚未记录的项目均不代表通过，不自动提交、推送、发布或归档。

## 来源、工具链与既有状态

- pnpm 自管理12.10.1包装包的原生安装步骤未执行，Windows启动器指向不可执行占位脚本。运行该版本自带 `install.js` 后 `pnpm --version` 返回12.10.1，未修改仓库依赖声明或锁文件。
- 官方Git直连被重置；临时通过已监听的127.0.0.1:7897代理成功fetch，上游main为db6693f7，本轮仍固定5c533762。清单24条完整SHA均已核实属于固定上界祖先且不属于v1.51.0祖先。
- 完整接纳基线仍为1.46.6，选择性来源账本初始为空；原三份文件SHA256见 `baseline-fingerprints.json`。前轮9.2/9.3/10.5未勾选状态保持。
- GitNexus在Node22下出现文件身份散列失败，切换现有Codex Node24运行时完成重建：20522节点、41915边、410条已提取流程。默认流程提取有候选/分支预算截断，不能据此断言不存在额外流程；每个编辑符号须独立impact及必要源码补证。

## 修改生产代码前的基线

- 根套件：5018通过、4外部API有意跳过，3个既有超时（selective-upstream-history、upstream-v151-migration、store-listing）。fork：1016通过、迁移超时及options preference heading两项失败。两套并行执行时发生资源争用；随后分别复核，根失败三文件8项全部通过，fork options62项、迁移及输入上下文7项通过。原始输出完整保留，不将首轮计作全绿。
- 类型检查退出码0；冻结增量基准下Fork boundary OK。仓库依赖声明及锁文件无改动。

## P01 红灯

- 仅引入上游针对现有API的规则/验证测试：7失败、86通过，原因是规则字段未支持，而非模块加载错误。
- 仅执行新增LaTeXML集成用例：4失败，原因是SVG摘要未被转换/翻译，符合待修复行为。

## P01 绿灯

已回迁规则、重排模块、遍历/清理及管理器去重识别；相同5个相关测试文件279项通过。保留原SVG/内容节点及监听、规则开关和主题变量，重排mutation有单独识别。实站与最终实包仍待第8节验收。

## P03

来源管理器回归先14失败/59通过，回迁后73项通过。保留fork额外可见性检查；新增boxless门控覆盖shadow roots、滚动范围重查、恢复布局、移除与取消释放，不引入整体content-runtime迁移。

## 页面模块汇总

P07红灯1项/绿灯56项，P16红灯6项/绿灯240项，P17红灯2项/绿灯73项。完成页面模块后30文件504项通过（maxWorkers=4），含管理器/DOM/站点规则/虚拟段落恢复。没有以模拟测试替代后续真实站点验收。

## 设置模块汇总

P02实际fork导航5项先红后绿，P04/P05/P06合并picker回归先6失败/4通过、适配后10通过；保留旧组件与callback签名。实际fork options模块13文件93项通过。jsdom原有scrollTo未实现提示仍存在，未改实现或压制其输出。

## P14架构适用性

Chrome中间构建成功。host/selection/side三份产物均以独立IIFE开头、无静态模块导入；现代码Toast manager为模块内创建。`toast-isolation.forktest.tsx` 使用三个模块实例和真实manager/Provider验证单事件仅一条提示，通过。没有应用依赖共享runtime的删除Provider补丁，未构造无必要的红灯或宣称运行时代码已修改。最终实包仍须复核。

## 划词与字幕模块汇总

selection/side及Toast/字幕准入22文件272项通过。P08来源19项通过；P12来源4文件先20失败后69通过；P15先3失败后13通过。字幕根模块47文件404项、fork准入3文件11项通过，X/Netflix/AI转录保持关闭。

## Google传输

P13先1失败后12通过；P18先6失败后186通过；P19来源测试先16失败后47通过，实际fork批量回归先1失败后3通过。标点状态现已逐条传入批量恢复。保持本仓已分离的prepare/batch/restore接口，HTML换行保护贯穿请求而不改标签属性。fork页面队列、缓存、术语及MT/LLM回归12文件94项通过，最终完整fork套件也通过。

## 审查及实包发现的补充修复

- 独立审查发现旧YouTube会话可在异步provider/同轨检查/挂载结束后恢复。新增7项回归分别先失败；完成永久invalidated、scheduler/operation/cache版本校验与迟挂载清理后，两文件15项通过。复核无Important/Critical遗留。
- Chrome受控CSS菜单fixture发现可见父paragraph会递归翻译关闭子菜单，原mock管理器测试未覆盖真实walker。新增双语/仅译文×block/inline共4项真实遍历集成和2项调度回归，先6失败/251通过，适配后257项全部通过。菜单区域独立观察，递归与HTML请求均延迟隐藏区域，保留恢复和去重；普通无规则站点保留提前返回。独立复核通过。
- P03保留上游已存在的限制：长滚动布局中，display:contents单元若只有直接文本且没有可观察的内部子盒，可能回退到观察无盒单元而不触发翻译。本轮未宣称覆盖所有boxless形态；有子布局盒的实包fixture通过。

## 最终本地工程验证

所有测试在PowerShell设置 `SKIP_FREE_API=true`，完整套件顺序运行，maxWorkers=4。

| 命令/检查                                                           | 结果                                               | 原始记录                                             |
| ------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `pnpm run test --maxWorkers=4`                                      | 490文件通过，5184项通过，1文件/4项外部服务有意跳过 | final-root-tests.log                                 |
| `pnpm run test --config vitest.fork.config.ts --maxWorkers=4`       | 122文件、1025项通过                                | final-fork-tests.log                                 |
| `pnpm run type-check`                                               | 退出码0                                            | final-type-check.log                                 |
| 冻结FORK_DIFF_BASE下boundary                                        | 退出码0，官方来源验真与指纹通过                    | final-boundary.log                                   |
| brand、格式、严格OpenSpec校验                                       | 结果见各final日志及最终交接                        | final-brand.log / final-fmt.log / final-openspec.log |
| 国内Chrome/Edge/Firefox构建及逐目录断言                             | 均退出码0                                          | build-_.log / assert-_.log                           |
| `node scripts/pack.mjs store --edition global --channel global-zip` | 构建、zip、global域名/渠道断言退出码0              | build-global.log                                     |

Windows的pack脚本使用spawnSync直接启动pnpm；首次因PATH命中.cmd而status=null。仅给该进程PATH前置已安装12.10.1原生exe目录后按原脚本重跑成功，没有修改打包脚本、依赖或配置。构建仍提示已有上游域名字面量/界面链接，域名断言不等于所有场景零上游请求；没有盲删常量。

## 真实构建Chrome受控验收与缺口

Chrome 156.0.8078.76加载本轮 `.output/chrome-mv3`，临时独立profile；使用本机确定性OpenAI兼容fixture服务。通过真实fork provider、合批、DOM管线翻译和恢复，不证明真实Google或商业网关翻译质量。URL由Puppeteer响应受控HTML，不能当作对应网站线上内容已验收。

- arXiv LaTeXML摘要重排/翻译/还原同一SVG结构、GitHub新issue标题及排除字段、带子布局盒的display:contents、纯CSS菜单关闭不请求/hover后翻译、GameFAQs PRE分段与还原，5组均通过。GameFAQs两段实际合批为一请求、两item。
- CSS菜单初次实包失败有独立debug记录，修复后仅可见父文案先请求，hover后菜单单独请求；最终browser-harness.log全绿。
- Ctrl+A只有基础正文选择smoke。隐藏body检查返回hosts为空，没有证明overlay仍可见；ruby原生Selection字符串也不是去注音的consumer结果。这些不计作第8.2完整通过。
- 测试期间观察到的SW上游商业请求为0、页面runtime错误为0，仅限上述受控场景及观察时段；未替代扩展页/content各层的账号全链路审计。
- 原始结果 `browser-results.json`、5张browser-*.png和可重复脚本 `browser-harness.cjs` 留存。脚本依赖隔离安装的puppeteer-core 24.31.0，未改仓库依赖。

用户已选择使用现有已登录浏览器继续会员/模型网关/术语验收。Computer Use在绑定现有Chrome窗口时拒绝继续，原因原文：`could not determine the current browser URL on Windows with enough confidence to enforce policy`。已停止该轮所有后续电脑输入，未改用户浏览器扩展或登录状态。这是工具访问策略阻塞，不是账号验收通过，也不是用户选择延期。

第8.1至8.4仍未完整完成：线上站点的动态导航/取消/双模式组合，真实Google、ruby朗读/卡片/阅读模式/Toast/设置交互，YouTube有/无字幕和Shorts切换，以及已登录会员/网关/术语编辑删除/输入隐私及三层网络验收。不得用受控fixture或单元测试补签，也不得标为发布就绪。

## 候选绑定与回退

工作分支 `codex/upstream-fixes-v1-6-1`，HEAD仍为冻结目标4b502061；没有commit、push、发布或归档。`candidate-code.json`按当前源码及LF归一化计算聚合指纹，`build-artifacts.json`记录各产物目录/manifest/文件及聚合hash，避免用未提交HEAD假装候选代码唯一身份。海外zip仍沿用现有包版本1.6.0，没有擅自改发行版本。

需要回退时保留当前差异/证据后切回原目标分支；运行中测试profile已关闭，本轮未替换用户日常浏览器扩展。不要直接reset --hard或删除用户文件。原Git代理及Windows路径恢复配置保留。

## GitNexus最终门禁及简化复核

新源码用intent-to-add纳入未暂存diff，避免detect-changes遗漏新文件；没有实际暂存内容。最终CLI检查及同一LocalBackend的完整JSON均完成：76文件、203个变更符号、121条已提取受影响流程，risk=critical，结果无error/partial/truncated。CLI只展示前15符号，不能把这段展示当完整结果；`final-detect-full.json`包含全部203符号及121流程，`graph-review.md`逐条列出及对应模块验证。没有本轮commit，因此不伪造compare提交检查。

critical表示共享DOM、翻译和字幕链路的广泛影响，不能当成低风险；所有实际编辑前HIGH/CRITICAL提醒及UNKNOWN源码补证见impact.md。仍需真实线上验收验证站点变化、字幕时机与账户环境。

全文搜索索引先后出现buffer pool及Windows WAL错误。最终使用现有Node24、4GiB临时buffer pool、64MiB WAL阈值执行force/index-only重建，图和FTS都成功（20797节点、42642边），未修改仓库依赖。原始失败日志保留。流程抽取仍有全局入口、分支、深度预算：433条是已提取集合，121条受影响流程不是整个应用完整流程数量，缺席不代表无影响；这与本次detect返回本身不截断是两个不同层次的限制。

阶段4对实际代码差异复核：没有新增共享runtime、重复的fork字幕实现或整套picker；保持prepare/batch/restore分工、统一取消保护和菜单边界。未发现需要额外抽象或无关重构的内容，未为简化再次改变已验证行为。两轮独立审查通过；未完成浏览器事项继续保留，不因代码复核通过而勾选。
