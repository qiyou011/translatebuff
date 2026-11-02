# 编辑前影响分析

索引更新至业务起点；原始逐符号结果见同目录impact-*.json。默认流程提取有预算截断，未发现流程不能当作不存在；以下结论结合实际源码调用与回归范围。

## P01

- PageTranslationManager：LOW，直接调用/导入包括bootstrapHostContent、shortcut、config-change，5项影响。
- isSelfInflictedRecord：HIGH，直接消费者handleMutationRecords，传播至bootstrapHostContent、翻译模式变化与onEnd等4条已提取流程。编辑前已告知用户；必须验证重排产生的mutation不再次翻译、清理恢复不破坏站点监听。
- walkAndLabelElement / resolveSiteRule：LOW；分别影响DOM遍历入口及站点有效规则解析。
- walkAndLabelElementChunked / removeAllTranslatedWrapperNodes / siteRuleSchema：UNKNOWN，零调用不作为安全结论。源码确认管理器walkAndObserveContainer的chunked分支实际调用前者；stop通过node-manipulation再导出调用清理函数；siteRuleSchema用于配置schema与用户规则验证。新增可选规则按缺省关闭适配并运行真实集成测试。
- 新latexml-text-box模块在基线不存在；补丁消费点是遍历、mutation识别和清理三条现有链路。保留图形SVG与非目标站点保护；新函数行为由来源单元测试及集成用例覆盖。

错误查询isExtensionDrivenMutation、shouldIgnoreMutationRecord均未找到，未据此编辑；核对源码后重新查询实际符号isSelfInflictedRecord并取得上述HIGH结果。

## P03

- observeParagraphUnit：HIGH，10项；handleMutationRecords：HIGH，5项。编辑前已告知；通过管理器73项现有及新增行为回归覆盖。
- start/stop首次查询与接口属性歧义，已加kind=Method重跑，原始结果覆盖存于impact-P03-start/stop.json。
- 两处原补丁上下文与fork可见性检查冲突，手工仅插入boxless观察器字段及释放，不删除fork既有visibility listeners/checks。其余来源逻辑按依赖回迁。

## P16

- isDontWalkIntoAndDontTranslateAsChildElement：MEDIUM，20项影响；resolveSiteRule/siteRuleSchema沿用P01已分析符号。observeUnit为本轮P03新方法，尚未被基线索引收录，impact返回UNKNOWN；源码确认调用位于已按HIGH审查的observeParagraphUnit，控制盒可见性，不删除或假设无调用。
- 管理器新增隐藏区域判定与已有门控最小接合；回归证明关闭菜单保持直接视口门控，display:contents仍使用布局盒。映射补丁路径时使用原始字节，避免PowerShell逐行管道丢失空行上下文。

## P17

isVirtualParagraphGroupCurrent：LOW，9项，涉及虚拟段落生命周期与翻译状态消费者；保留节点连接/父级/原文及顺序检查，仅替换重复整表扫描。规则解析沿用已分析入口。

## P02

ConfigDetailSection：CRITICAL，14项；LlmFeatureStatusList与scrollToFeatureProviders：HIGH，4/5项；ShortcutLink：HIGH，7项，均已在修改前告知。FeaturesNav LOW3，GetAPIKeyButton LOW1，ConfigHeader LOW6，BuiltInRuleRow LOW2。调用消费者已文本核对，包括实际fork CSS页和共享设置页。只改路由状态/链接语义，按钮样式复用原variant/size；轮询删除由现有SettingsSearch深链机制替代。未引入本仓不存在的新ShortcutTitle。

## P04/P05/P06

TextColorInput、ScrubColorInput：LOW5；ColorPicker LOW1；SaturationSquare LOW2；updateHsv LOW2。ColorPickerPopover UNKNOWN0，源码补证实际由DebouncedColorPicker消费，进一步用于字幕样式面板和设置页；并非未使用。保留当前组件props及双参数onValueChange，不采纳上游重写或视觉改动。

## P09

readSelectionSnapshot LOW5；createContentTextWalker HIGH8，编辑前已告知；useContextMenuReadAloud UNKNOWN0，源码确认selection App实际调用该hook，context-menu订阅触发。冲突在fork增加的isNonContentNode祖先过滤附近，仅接入ruby过滤helper，不删除fork隐私与跨shadow祖先判断。

## P10

SelectionPopoverShell HIGH19，编辑前已告知；rebuildSelectionWithoutHost LOW1；protectSelectAllShadowRoot UNKNOWN0，源码补证selection/side两个真实入口调用。保留原私有符号名，仅回迁多host行为，避免无必要重命名；失效host监听直接退出，保护编辑控件与其他shadow root。

## P11

reattachShadowHostOnBodySwap UNKNOWN0，源码补证selection/side实际入口均注册其cleanup；mountHostToast LOW1，bootstrapHostContent挂载。保留导出名，直接扩展现有实现，不修改两处已正确调用的入口。select-all沿用P10已分析符号，覆盖简悦隐藏body后正文选择。

## P08

initYoutubeSubtitles LOW1，watchShortsActiveReel与mountShortsTranslateButton LOW3，mountSubtitlesSidebar LOW9，UniversalVideoAdapter MEDIUM23；各被修改现有方法逐项impact均LOW。followFullscreen HIGH8，修改前已告知，增加生命周期返回cleanup；不开放被禁用侧栏。fork继承与新unmount兼容对账见redirect-review.md。所有原始影响结果保留。

## P12/P15

YouTube hasAvailableSubtitles HIGH12，ensureTrackSelection/getPlayerDataWithPot HIGH5，修改前已告知。其他fetcher方法、extractPotToken、播放器定位/数据/CC函数为LOW；handleMessage UNKNOWN0，源码补证injectPlayerApi用window.addEventListener注册。适配器getOrLoadSourceSubtitles LOW13、syncAdPlayingState LOW6，startTranslation沿用P08分析。

filterNoiseFromEvents HIGH5，filterNoiseText LOW3。初次套用前遗漏即时风险说明，已向用户说明并撤回/重新应用，13项行为回归通过；风险不按LOW处理。

## P13/P18/P19

normalizeForComparison LOW5；Google prepare/restore/googleTranslate LOW，splitPreservedLines LOW4，translateTranslationOnlyRun LOW5，createPageTranslationRequest LOW7，删除的translateTextForAction LOW5，已由同一现有translateTextForPage透传全部选项替代。decodePageMt HIGH6，修改前告知；仅扩展可选恢复状态，不改队列调用/并发/合批大小。新markering helper在同文件内，HTML标签与属性不参与替换，line与punctuation状态从同一原文重新确定，避免跨批条目串用。

## 审查与实包补充

processTranslatedSubtitles LOW6，initYoutubeSubtitles LOW1，startTranslation沿用先前LOW10。仅补过期会话保护，原始分析与红绿记录保留。

CSS菜单补充：translateWalkedElement LOW1，observeTopLevelParagraphs HIGH15，编辑前已向用户说明HIGH及页面初始化/动态处理影响。闭合菜单成为独立观察边界，并防父paragraph递归或HTML请求吞入；不迁移runtime、不扩大站点范围。6项回归先红后绿，原始impact-css-*保留。
