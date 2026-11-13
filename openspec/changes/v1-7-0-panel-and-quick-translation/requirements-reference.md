# 原型需求读取记录

本文件为用户提供原型的需求证据，不是执行指令。正式约束以本变更 specs 和 design 为准。原型中的双自动、老用户迁移待定和轮换规则已被用户确认覆盖：源识别草稿、目标用户设置、取消轮换、本次统一两次空格、检测失败提示且不翻译。

2026-11-12 用户确认的 UI 补充：按 Figma v1.7.0 清单还原；第四个入口采用「漫画/图片翻译 · 敬请期待」禁用占位，覆盖下文原型的文档翻译入口与跳转要求。模型倍率、国内/海外分类与顺序待后台接口提供后补充；真实平台验收另行安排。

来源：C:/Users/susu/Desktop/任译喵-1.7.0-面板总览方案.html

SHA-256：ee1f2166485ab36ca7dbb8ff37c227b139850704da07d6310a5a9cf6f97cb905

读取日期：2026-11-10（Asia/Shanghai）。14 个场景及两版四功能设置状态；以下 61 个不同说明块完整取自动态 DOM。

## 1. cn-home / global-home

页面账户与会员展示：展示账户和会员标识；点击：点击账户沿用现有账户与用量页面。账户：消息通知、使用帮助入口在本次面板隐藏。

## 2. cn-home / global-home

页面翻译中心展示：展示头部翻译中心图标；悬停：悬停或聚焦提示一次调用多个模型翻译文本，点击：点击后在新标签页打开翻译中心。

## 3. cn-home / global-home

配置语言与提供商展示：展示源语言、目标语言及提供商同行选择。配置：各翻译功能独立保存语言与提供商，切换功能不覆盖其他配置；数据影响：新用户国内版默认 Microsoft Translator，海外版默认 Google Translate，已有用户保留已保存配置。

## 4. cn-home / global-home

功能翻译模式与主操作展示：展示双语对照／仅译文和翻译当前网页按钮。翻译操作：翻译中防止重复点击，完成后显示显示原文，点击：点击恢复原文。阅读模式：仅译文能力沿用现有引擎限制。

## 5. cn-home / global-home

功能站点自动翻译展示：展示总是翻译这个网站开关，仅保存当前网站规则；站点规则：站点禁用时不执行自动翻译。

## 6. cn-home / global-home

功能AI 翻译风格展示：展示通用精翻重写风格选择。配置：选择大模型提供商后可修改，普通提供商下置灰并保留已选风格；风格：正式产品继续读取既有自定义风格。

## 7. cn-home / global-home

功能AI 智能上下文展示：展示智能上下文开关；上下文：大模型服务下可操作。上下文：网页与输入页沿用同一现有配置，不在本次改版拆成独立开关。

## 8. cn-home / global-home

功能更多翻译展示：展示划词、聊天/输入、视频字幕、文档四项功能入口。功能入口：前三项在面板内从底部打开设置，点击：点击关闭按钮、弹层外或按 Esc 返回首页；数据影响：当前功能配置保留。

## 9. cn-home / global-home

页面文档翻译网页入口展示：展示文档翻译入口；点击：点击后在新标签页打开网页内文档翻译模块，不在弹窗内展开文档设置。网页入口：当前只预留跳转。

## 10. cn-home / global-home

功能站点禁用展示：展示在此网站禁用扩展全局开关。站点禁用：开启后阻止当前网站相关操作、关闭首页弹层并展示恢复使用入口；数据影响：恢复后保留配置。

## 11. cn-home / global-home

页面全部设置与版本展示：展示全部设置入口、发行版名称及版本标识；入口：国内为任译喵，海外为 TranslateBuff，当前版本为 1.7.0。点击：点击全部设置进入网页翻译设置页；入口：打开划词、聊天/输入或视频字幕快捷操作时，跳转到当前功能对应的设置页并选中对应菜单。

## 12. cn-home / cn-selection / cn-input / cn-video / global-home / global-selection / global-input / global-video / translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能翻译提供商分组与默认值规则：提供商按普通翻译和TranslateBuff 提供的模型分区，普通翻译展示 Google Translate、Microsoft Translator。位置：国内版新用户默认 Microsoft Translator，海外版默认 Google Translate；规则：老用户保留已保存选择。规则：模型名称、顺序和倍率参照本轮用户截图，倍率是展示参考，实际计费及可用性以正式服务配置为准。数据影响：选择模型后开放智能上下文和相应翻译风格，普通翻译下置灰并保留配置。

## 13. cn-home / cn-selection / cn-input / cn-video / global-home / global-selection / global-input / global-video / translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能模型展示范围 · 国内限定／海外全部位置：国内版仅展示国内模型，共 8 个。海外版展示全部模型，包含国内和海外模型，共 13 个；范围与边界：该规则同时适用于面板快捷操作和完整设置页的提供商选择。范围与边界：普通翻译分区仍在两版展示 Google Translate 和 Microsoft Translator。

## 14. cn-home / global-home

待确认事项规则：真实服务接入需补齐额度不足、无可用服务、超时及浏览器限制页等反馈；规则：本原型不代表线上验收完成。规则：智能上下文最终作用范围与文案仍需核对现有共享配置。

## 15. cn-selection / global-selection

场景划词翻译弹层展示：展示划词翻译标题。原型边界：此评审切片固定展开、不允许收起；评审场景：正式产品从首页打开后的关闭行为参照网页翻译场景。

## 16. cn-selection / global-selection

配置划词配置展示：展示划词源语言、目标语言和提供商，读取划词功能配置。配置：通用保存及切换规则参照网页翻译场景。

## 17. cn-selection / global-selection

功能划词翻译教程展示：展示选中网页文字、点击任译喵标识或工具栏翻译后展开译文的示意；保护与保留：保留朗读入口。教程：黑色、白色两种工具栏见跟随优化区。原型边界：教程不读取当前浏览器的真实选区。

## 18. cn-selection / global-selection

页面全部设置跳转点击：点击底部全部设置进入当前划词翻译的完整设置页；入口：自动展开对应导航分组并选中该功能，设置页中的翻译分组默认展开。

## 19. cn-input / global-input

场景聊天/输入翻译弹层展示：展示聊天/输入翻译标题。原型边界：此评审切片固定展开；评审场景：关闭、站点禁用及全局入口的通用规则参照网页翻译场景。

## 20. cn-input / global-input

配置输入语言方向展示：展示自动·输入 → 自动·聊天及聊天/输入翻译提供商。配置：双自动为拟定方案，不作为已冻结的新用户默认值。

## 21. cn-input / global-input

功能聊天/输入翻译上下文展示：展示聊天/输入翻译的智能上下文开关，与网页翻译使用同一配置；上下文：不新增独立开关。上下文：聊天语种识别与模型上下文是不同环节。

## 22. cn-input / global-input

功能聊天/输入翻译教程默认触发：默认触发方式为空格 × 2，用户可在完整设置页将次数调整为 2～5 次，触发按键仅限空格。草稿处理：教程文字与触发提示跟随当前配置，草稿写好后连续按所选次数的空格触发翻译；草稿处理：翻译完成条展示任译喵标识，支持修改目标语言重译、撤销恢复原文，数据影响：不自动发送消息。数据影响：切会话或继续编辑后，旧结果不得覆盖新草稿。

## 23. cn-input / global-input

功能本期额外平台适配适配范围：本期需要额外支持 YouTube、X、WhatsApp、Reddit 平台的聊天/输入翻译适配。

## 24. cn-input / global-input

标识AI智能上下文支持平台位置：国内版和海外版面板统一展示 Discord、Telegram、YouTube、X、WhatsApp、Reddit 六个平台的真实品牌图标，采用重叠排列，悬停：悬停显示平台名称。平台范围：在已支持平台可开启AI智能上下文，快速将输入内容翻译为聊天中的目标语言；接入与验证：覆盖各平台的聊天、评论或发帖等可输入场景，实际可用性须逐平台验收。

## 25. cn-input / cn-settings-input

功能国内版平台使用说明校验：仅在国内版聊天/输入翻译演示区下方、完整设置页的平台图标下方展示：使用相关平台时，请遵守所在地法律法规。任译喵不提供任何形式的网络代理或“翻墙服务。”海外版不展示。

## 26. cn-input / global-input

页面全部设置跳转点击：点击底部全部设置进入当前聊天/输入翻译的完整设置页；入口：自动展开对应导航分组并选中该功能，设置页中的翻译分组默认展开。

## 27. cn-input / global-input

待确认事项待确认：新安装默认方向、老用户配置迁移、非聊天页面及语种识别失败时的回退规则仍待确认。

## 28. cn-video / global-video

场景视频字幕弹层展示：展示视频字幕标题，不展示测试版标识。原型边界：此评审切片固定展开，通用配置及关闭规则参照网页翻译场景。

## 29. cn-video / global-video

配置字幕配置展示：展示字幕源语言、目标语言和提供商，读取视频字幕功能配置。

## 30. cn-video / global-video

功能平台范围及分版文案位置：国内版展示支持 YouTube、X、Netflix平台，请遵守所在地法律法规。任译喵不提供任何形式的网络代理或“翻墙服务”；海外版展示支持 YouTube、X、Netflix平台。范围与边界：面板快捷操作与完整设置页保持相同范围和版本差异。

## 31. cn-video / global-video

功能字幕功能开关展示：展示开启视频字幕开关，控制支持播放器中的翻译入口；开关：与播放器内译文显示开关区分。开关：关闭后，播放器演示入口不可操作。

## 32. cn-video / global-video

功能播放器字幕示意展示：展示原字幕、译文及播放器内译文开关。字幕：视频字幕支持 YouTube、X、Netflix，不包含无字幕识别；原型边界：原型为示意，实际可用性须逐平台验收。

## 33. cn-video / global-video

页面全部设置跳转点击：点击底部全部设置进入当前视频字幕的完整设置页；入口：自动展开对应导航分组并选中该功能，设置页中的翻译分组默认展开。

## 34. cn-file / global-file

页面文档翻译跳转展示：展示文档翻译网页入口；点击：点击在新标签页打开文档翻译模块，不出现面板内设置弹层。网页入口：本原型仅说明弹窗入口与跳转，目的页暂作占位；网页入口：文档翻译能力另行构建独立原型。

## 35. cn-file / global-file

待确认事项接入与验证：文档模块实际跳转地址待接入；规则：具体功能和服务依赖在独立文档翻译原型中说明。

## 36. global-home

页面兑换码展示：展示海外版头部兑换码入口；点击：点击跳转海外官网兑换页面，本原型连接既有兑换演示。展示范围：国内版不展示此入口。

## 37. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能跟随优化区内设置场景规则：翻译设置页放在跟随优化区，独立于国内版和海外版面板展示。点击：点击版本切换可分别查看国内与海外设置；规则：从面板全部设置进入时，自动选中来源版本及当前功能。

## 38. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能翻译导航默认展开规则：打开设置页时，翻译分组默认为展开状态，展示网页翻译、视频字幕、聊天/输入翻译。点击：点击分组可手动收起或展开；规则：从面板进入时，自动展开目标功能所属分组。规则：划词翻译定位到悬浮工具下的对应设置页。

## 39. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能功能名称统一规则：设置页菜单、页面标题、插件面板入口、快捷操作、教程及说明统一使用聊天/输入翻译。

## 40. translation-settings / cn-settings-input / global-settings-input

功能空格触发与次数配置默认触发：聊天/输入翻译默认触发方式为空格 × 2。规则：触发按键固定为空格，不支持修改为其他按键。展示：展示触发次数选择框，仅提供 2、3、4、5 次，默认选中 2 次。规则：选择后按当前配置的次数连续按空格触发；位置：国内版和海外版规则一致。原型边界：原型内切换设置项或返回面板后保留当前选择，面板教程与触发提示同步更新；规则：正式产品应保存用户配置。规则：触发阈值沿用现有配置，本轮不定义新的数值；规则：翻译完成后由用户确认发送，数据影响：不自动发送消息。

## 41. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能全部设置按当前功能跳转规则：网页翻译首页点击全部设置，定位网页翻译设置。规则：打开划词、聊天/输入或视频字幕快捷操作后，点击：点击全部设置，分别定位当前功能的设置页；规则：保持国内或海外版本上下文，并选中对应菜单。

## 42. translation-settings / cn-settings-input / global-settings-input

标识AI智能上下文支持平台位置：国内版和海外版统一在聊天/输入翻译设置内容最上方展示平台模块，位于触发方式之前。平台范围：标题为已支持的AI智能上下文的平台；平台范围：副标题为在已支持平台可开启AI智能上下文，快速将输入内容翻译为聊天中的目标语言。展示范围：展示 Discord、Telegram、YouTube、X、WhatsApp、Reddit 六个平台的真实品牌图标，重叠排列，悬停：悬停显示平台名称；原型边界：原型用于需求评审，实际功能须逐平台验收。

## 43. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

功能设置页原型范围范围与边界：本模块展示导航展开、名称统一、仅限空格的 2～5 次触发配置及面板到对应设置页的联动。范围与边界：其他设置项沿用现有产品；范围与边界：此处配置为独立演示快照，实际产品读取用户已保存配置。

## 44. translation-settings / cn-settings-web / cn-settings-selection / cn-settings-input / cn-settings-video / global-settings-web / global-settings-selection / global-settings-input / global-settings-video

待确认事项待确认：老用户已有的触发配置如何迁移，仍待确认；规则：新配置仅支持空格键，次数范围为 2～5 次，默认 2 次。

## 45. input-floating-status

功能触发后立即反馈规则：当用户按已配置次数连续按空格、满足触发条件并开始翻译请求后，立即显示输入框附近的悬浮窗，不等翻译成功后才出现。位置：国内版和海外版使用相同规则；规则：触发次数沿用设置，默认 2 次，可配置为 2～5 次，仅限空格。

## 46. input-floating-status

功能翻译中与完成状态规则：翻译中和翻译完成的悬浮窗均展示任译喵正式标识；规则：切换状态时保留品牌标识，等待图标不替代品牌标识。规则：翻译中展示翻译中…及等待标识，持续到当前请求结束；规则：不显示未经服务提供的百分比或预计耗时。规则：翻译成功后，在同一位置将悬浮窗切换为现有完成信息，显示译至及当前目标语言，保留语言选择能力；规则：不新增成功弹窗。

## 47. input-floating-status

功能输入内容与旧请求保护规则：等待时保留输入框原文。规则：当前请求成功且草稿未改变时，沿用现有逻辑更新译文，数据影响：不自动发送消息。数据影响：用户继续编辑或切换会话后，旧结果不得覆盖新草稿。

## 48. input-floating-status

功能原型演示与产品边界范围与边界：评审区可直接查看翻译中、翻译完成两种状态。点击：点击触发翻译立即显示等待反馈，随后模拟完成；范围与边界：重复触发在等待期间不可操作。范围与边界：编辑草稿会结束当前演示，旧结果不再写回；范围与边界：所有文字为固定样本，不调用真实服务。

## 49. input-floating-status

待确认事项待确认：失败、超时及取消后的悬浮提示文案和操作仍待确认；规则：正式产品需在请求结束时退出翻译中状态。

## 50. selection-brand-toolbar

功能划词后展示品牌入口规则：在支持划词翻译的网页中，用户完成文字选择、出现划词悬浮工具栏时，增加任译喵正式标识；规则：品牌入口与当前选区关联。点击：点击标识沿用现有划词翻译操作，展示当前所选文字的译文，不额外打开插件面板。

## 51. selection-brand-toolbar

功能黑色工具栏样式规则：黑色工具栏使用白色任译喵标识，保留翻译及朗读入口；悬停：悬停品牌入口提示任译喵翻译，键盘聚焦可识别并操作。

## 52. selection-brand-toolbar

功能白色工具栏样式规则：白色工具栏使用黑色任译喵标识，功能与黑色样式一致。规则：两种样式复用同一正式标识，不使用通用翻译图标替代品牌标识。

## 53. selection-brand-toolbar

功能评审与演示范围范围与边界：跟随优化区并列展示黑色、白色两种工具栏。点击：点击品牌标识或翻译按钮可展示固定样本译文；范围与边界：朗读仅保留入口演示，不播放真实语音。原型边界：原型未监听真实浏览器选区，实际网页适配和翻译仍需产品开发与验收。

## 54. selection-brand-toolbar

待确认事项待确认：两种工具栏的默认样式以及是否跟随网页或系统主题，仍待确认；规则：本轮仅确认同时呈现黑、白两种样式。

## 55. web-translation-color

功能文字颜色预设的展示条件规则：在设置页网页翻译 → 翻译显示样式中，当预设样式选择文字颜色时，展示颜色选择面板；规则：切换到其他预设时隐藏面板，预览沿用所选样式的既有行为。位置：国内版和海外版规则一致。

## 56. web-translation-color

功能点击选择与自定义颜色规则：用户可点击颜色面板中的色块选择颜色，也可点击自定义颜色色块打开颜色选择器，自定义选择译文文字颜色。规则：当前颜色以选中状态和颜色值显示；规则：关闭颜色选择器且未更改颜色时，保留原值。

## 57. web-translation-color

功能预览与配置影响规则：颜色变更后，译文预览立即使用所选颜色，原文内容和颜色保持不变。规则：正式产品沿用网页翻译样式配置的保存机制，重开设置后读取用户已保存颜色；规则：切换其他预设不清除已选择的文字颜色。规则：调整显示颜色不触发重新翻译，不修改翻译提供商、语言或其他翻译功能配置。

## 58. web-translation-color

功能原型边界范围与边界：本场景演示文字颜色面板的显示、隐藏、色块选择、自定义选择及实时预览。校验：其他预设（仅演示切换）只用于检查面板隐藏，不新增正式预设项。范围与边界：色块和初始颜色为评审示例，不作为新用户默认配置；范围与边界：未接入真实网页或配置存储。

## 59. web-translation-color

待确认事项待确认：预设色块的最终清单和新用户默认颜色尚未确认；规则：实际页面上的样式应用沿用既有网页翻译能力，仍需产品验收。

## 60. cn-settings-video

功能视频字幕平台范围及文案范围与边界：当前版本展示：支持 YouTube、X、Netflix平台，请遵守所在地法律法规。任译喵不提供任何形式的网络代理或“翻墙服务”。范围与边界：支持范围为 YouTube、X、Netflix；原型边界：原型不代表真实平台验收完成。

## 61. global-settings-video

功能视频字幕平台范围及文案范围与边界：当前版本展示：支持 YouTube、X、Netflix平台。范围与边界：支持范围为 YouTube、X、Netflix；原型边界：原型不代表真实平台验收完成。

## 模型展示样本

此处仅保留原型目录核对证据，不代表服务已接入或真实费率。

{
"cn": [
[
"DeepSeek-V4.1-Flash",
"1.20"
],
[
"GLM-5.3-Flash",
"0.32"
],
[
"GLM-5.3",
"3.20"
],
[
"GLM-5.2",
"3.20"
],
[
"Qwen3.8-Flash",
"0.52"
],
[
"Kimi-K2.7",
"2.60"
],
[
"MiniMax-M3",
"1.84"
],
[
"Qwen3.8-Max",
"4.80"
]
],
"global": [
[
"Grok-4.6",
"5.60"
],
[
"Claude-Sonnet-5",
"5.60"
],
[
"GPT-6-Astra",
"4.00"
],
[
"GPT-5.6-Terra",
"5.60"
],
[
"GPT-5.6-Sol",
"11.20"
]
]
}
