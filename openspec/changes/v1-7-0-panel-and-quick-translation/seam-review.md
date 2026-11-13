# 1.7.0 原地接缝审查

基线：`e7bf249251bb8f7dab1ed36d3e5932a4fd03e140`。以下为逐组审阅的最小接缝；产品实现主体在 `src/fork`。

## 后台协调与备份

后台唯一写入、导入导出/重置覆盖 fork 配置，普通设置写入接入修订事务；会员凭据不从备份恢复。

回归依据：config/storage、backup-import、main-config-bridge、membership、config-sync。

- `src/entrypoints/background/config-backup.ts`
- `src/entrypoints/options/pages/preference/config/config-backup/components/backup-config-item.tsx`
- `src/entrypoints/options/pages/preference/config/manual-config-sync/index.tsx`
- `src/entrypoints/options/pages/preference/config/reset-config/index.tsx`
- `src/hooks/use-export-config.ts`
- `src/types/backup.ts`
- `src/utils/atoms/config.ts`
- `src/utils/backup/storage.ts`

## 扩展启动接线

仅在实际 UI 入口启动时安装配置提交桥，组件导入不改变写入行为。

回归依据：主配置原有回归、fork 路由集成、双版构建。

- `src/entrypoints/options/main.tsx`
- `src/entrypoints/popup/main.tsx`
- `src/entrypoints/selection.content/index.tsx`
- `src/entrypoints/side.content/index.tsx`
- `src/entrypoints/translation-hub/main.tsx`

## 站点禁用

监听配置禁用并调用既有 stop 取消在途写入；启动前重复校验站点准入。

回归依据：watch-site-translation、page-translation-title、runtime。

- `src/entrypoints/host.content/runtime.ts`
- `src/entrypoints/host.content/__tests__/runtime.test.ts`
- `src/entrypoints/host.content/translation-control/__tests__/page-translation-title.test.ts`

## 共享功能设置与导航

复用 fork FeatureSettings，语言控制器提供受控接缝，触发间隔复用既有校验组件，翻译导航默认展开。

回归依据：feature-language、quick-panels、options-routes-smoke、navigation-fixes。

- `src/entrypoints/options/app-sidebar/features-nav.tsx`
- `src/entrypoints/options/pages/input-translation/index.tsx`
- `src/entrypoints/options/pages/input-translation/trigger/index.tsx`
- `src/entrypoints/options/pages/video-subtitles/index.tsx`
- `src/entrypoints/selection.content/selection-toolbar/translate-button/target-language-selector.tsx`

## 字幕快照

可选配置读取器及队列快照，失效时清理旧请求，下载文件名带实际目标语言；默认接口仍兼容原调用。

回归依据：主字幕16文件、subtitle-snapshot、subtitle-admission、字幕缓存语言隔离。

- `src/entrypoints/subtitles.content/__tests__/translated-subtitles-downloader.test.ts`
- `src/entrypoints/subtitles.content/__tests__/universal-adapter-destroy.test.ts`
- `src/entrypoints/subtitles.content/translated-subtitles-downloader.ts`
- `src/entrypoints/subtitles.content/translation-coordinator.ts`
- `src/entrypoints/subtitles.content/universal-adapter.ts`
- `src/utils/subtitles/processor/__tests__/translator.test.ts`

## 译文颜色

样式根注册 fork 色值投射；设置页仅追加 fork 控件，其他预设/customCSS 保留。

回归依据：translation-color 交互/DOM、style-injector、translation-sections。

- `src/entrypoints/options/pages/translation/__tests__/translation-sections.test.tsx`
- `src/entrypoints/options/pages/translation/translation-style/index.tsx`
- `src/utils/host/translate/ui/style-injector.ts`

## 发行记录

独立 fork 版本 1.7.0；不改上游引擎版本。

回归依据：品牌和双版产物检查。

- `.changeset/panel-and-quick-translation.md`

## 选择性补丁与重定向对账

复核 page-translation 的新增站点准入，未动既有 DOM 分段、遍历、取消与 SVG 修复。features-nav 只增加 defaultOpen，保留路由进入展开及手动关闭。字幕销毁回归增加配置身份 fixture；原生准入测试改为保留 Netflix 轨道但继续拒绝 AI 与侧栏。UniversalVideoAdapter 在上述可选注入接缝之外保留原有视频切换/源轨/销毁机制。对账后只更新这些文件及对应 ledger/redirect 指纹。

Google API 的指纹漂移在实施基线已存在：源码与基线逐字节 LF 归一化比较相同，SHA256 为 `33d369201c634cc251e09796d6a12626e1ddcc0610fa2ecf4a43b259d6ba62f8`；最近修改来自 `137beca2`（Google 阿拉伯文字源检测）。本次仅修正其 ledger 指纹，源码未改。

## 启动期间写入

`src/utils/config/default-translate-provider.ts` 增加可选事务提交器，`src/entrypoints/background/index.ts` 传入后台 updateMain；网络探测后的默认提供商升级基于事务内最新配置计算，保留用户选择。旧调用默认行为不变。新增 default-translate-provider 回归先失败再通过。自定义动作修复移至 fork 初始化屏障内，避免与本次迁移并行写入。
