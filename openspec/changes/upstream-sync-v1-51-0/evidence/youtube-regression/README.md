本目录仅测试受控 YouTube watch 页面，不代表真实 YouTube 应用或账号验收。文档以 `https://www.youtube.com/watch?v=...` 装载；播放器对象、自动字幕 JSON3 和视频媒体均由 fixture 提供。扩展 MAIN 桥、native adapter、fetch/JSON3 parser/optimizer、实际视频时钟、翻译队列、Shadow DOM 字幕与菜单均来自原样加载的实包。

```sh
BUILD_EDITION=domestic BUILD_ENVIRONMENT=production \
  /Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  openspec/changes/upstream-sync-v1-51-0/evidence/youtube-regression/youtube.mjs
```

支持 `TEST_REPO`、`EXTENSION_PATH`、`YOUTUBE_EVIDENCE_DIR`、`PLAYWRIGHT_MODULE`、`BROWSER_EXECUTABLE`。默认新建自有 headed profile；只清理自己创建的临时目录和服务器。不依赖用户浏览器或真实收费账号。

`P09` 用浏览器 Canvas/MediaRecorder 生成可实际播放的 WebM，按真实 `video.currentTime` 采样字幕。包含单 segment 长 duration 和下一 segment offset 的自动字幕数据，验证 200ms 估算之后仍可见，并在事件结束后的空档消失。所有样本与实际 `timeupdate` 写入 JSON。

`P13` 用可信鼠标拖动、pointer capture、浏览器 `releasePointerCapture` 产生真正 `lostpointercapture`，验证失去 capture 后移动不继续拖动、随后新拖拽仍可用、字幕点击与拖拽不泄漏至播放器。打开真实字幕样式长菜单，使用可信滚轮滚动并操作选项，检查菜单在播放器范围内、受控 native 菜单实际叠在其上方。注入的 native 菜单仅用于 z-order 对照，不是 Google 原生菜单实现。

网络不统一阻断。只 fulfil 此次 fixture 的 watch 文档、fixture JS、WebM 和 timedtext；其他请求继续真实执行。日志不保留请求头、Cookie、Authorization、密钥或查询串。完整商业验收和真实 Shorts、广告、导航、DRM/签名/PO token、真实 YouTube 页面仍需另验。

2026-10-15 实包结果：`runs/2026-10-15T04-59-32.424Z/result.json` 中 P09、P13 均 PASS。候选 SHA `5ac5122a6a4d390b3131f917dd09aa2caf5f5342`，Chrome for Testing `151.0.7922.34`，207 个实包文件首尾未变。Playwright 238 条、页面 CDP 147 条、Default netlog 92 个去重启动 URL；受控 provider 1 次有效批次请求，商业分类命中 0，未全局屏蔽商业网络。这些计数不能替代完整商业场景验收。

真实执行路径是 `https://www.youtube.com/watch?v=fixtureP09a1` 的受控文档/播放器公有 API → 实包 `interceptor.content` MAIN bridge → 实包 YouTube native fetcher 请求 `https://www.youtube.com/api/timedtext`，请求确含 `fmt=json3`、`kind=asr`、`lang=en` → 实包 format detector/scrolling-ASR parser/optimizer → scheduler → 实包 Shadow DOM 字幕。未调用私有 parser/adapter helper，也未直接向扩展发假字幕响应。WebM 是浏览器实际录制的 16 秒 Canvas VP8 媒体（该轮 108 KB 左右，精确 bytes/SHA 见 JSON），实际播放到 13.65 秒后暂停；171 次 `video.currentTime` 字幕采样及 51 个真实 `timeupdate` 事件保留在 JSON。MediaRecorder 的 WebM 容器 duration metadata 为 Infinity，未模拟/覆盖 `currentTime` 属性；因此不覆盖真实 YouTube 的有限时长 metadata、编码或签名媒体行为。断言完成后仅为截图 seek 至 3.5 秒。

P09 将四条原文记作 A/B/C/D（全文在 `youtube.mjs` 和原始 JSON）。A 为单 segment，原生事件 1.0–4.0 秒；B/C 为同事件两段，B 持续到 C 的 1 秒 offset，即 5.0–6.0 秒，C 占 6.0–7.0 秒；D 为最后单 segment，事件 9.0–13.0 秒。下列实际样本全部原文精确相符；非空时窗的每个样本也均显示受控译文标记。采样窗口避开浏览器 `timeupdate` 约 250ms 的边界调度区间，不宣称毫秒级渲染精度。

| 断言窗口（video 秒） | 预期可见 cue               | 实际样本范围  | 样本数 | 结果 |
| -------------------- | -------------------------- | ------------- | ------ | ---- |
| 1.6–2.3              | A，超过固定 200ms          | 1.662–2.299   | 9      | PASS |
| 3.3–3.8              | A，仍在声明结束前          | 3.341–3.739   | 6      | PASS |
| 4.35–4.8             | 空，无过期 A               | 4.381–4.780   | 6      | PASS |
| 5.4–5.8              | B，直到下一 segment offset | 5.421–5.741   | 5      | PASS |
| 6.4–6.8              | C，保留事件剩余时长        | 6.461–6.782   | 5      | PASS |
| 7.35–8.0             | 空，无过期 B/C             | 7.422–7.980   | 8      | PASS |
| 12.2–12.7            | D，最后 segment 持续       | 12.220–12.621 | 6      | PASS |
| 13.3–13.6            | 空，D 已到期               | 13.342–13.581 | 4      | PASS |

P13 记录 44 个可信 pointer 事件（包括 3 次真实 `lostpointercapture`）。初次拖拽字幕 top 从 466.594px 到 376.594px；主动释放浏览器 capture 后 top 为 343.266px，继续持鼠标移动仍为 343.266px；重新拖拽后为 384.516px。丢 capture 的等待按此次新增 loss 事件计数，未用第一次正常 pointerup 的 loss 冒充。字幕文本点击、拖拽及菜单选项的播放器冒泡事件增量均为 `[]`。

长样式菜单本体位于字幕 Shadow host 内，边界 `x=700,y=117.094,w=272,h=458`，全部在 `x=28,y=101.094,w=960,h=540` 的播放器内。可信滚轮使真实 scrollTop 从 0 到 195px（scrollHeight610/clientHeight415），实际选择 Original only 并由 storage 证实后恢复 Bilingual，菜单保持可操作。扩展 host z-index60，受控 native-menu probe z-index100；重叠区真实 `elementFromPoint` 命中 native probe。native probe 只证明叠放规则，不代表 Google 菜单源码已验。截图见该轮的 `P09-real-video-near-end.png`、`P13-trusted-drag-after-capture-loss.png`、`P13-long-menu-within-player.png`、`P13-native-menu-above-subtitles-menu.png`。

最初两轮 raw FAIL 结果保持原样：第一轮选择了 BaseUI 隐藏 checkbox，第二轮 provider stub 未按 `%%` 为每行加译文标记；仅测试脚本修正后获得上述通过。所有 owned profile/server 已在 finally 清理。

最初 YouTube tree hash 为 `cc6251ce53132d3954fae33caafec74d0d2d63103d565dc297e3103aad863ab7`，其行序列化字段为 `{path,sha256}`。主 runner 字段为 `{path,bytes,sha256}`，同一 207 文件按主算法得到 `2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906`。两者都是按目录名排序递归、相对路径、紧凑 JSON 的 SHA-256。新增 runner 已改用主算法并在结果记录算法；旧 raw 不改。运行 `node .../youtube-regression/reconcile-artifacts.mjs` 可生成全新 timestamp reconciliation：对照已完成主 runner baseline，逐文件比对路径/大小/SHA，并对照所有旧 YouTube raw 的路径/SHA；任何不符会失败。
