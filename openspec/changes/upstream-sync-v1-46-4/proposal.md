## Why

三段式同步的最后一段：从 v1.43.6 追到上游最新 v1.46.4（`fe2957c8`）。这一段扛的是前两段刻意避开的全部难题——上游 options 页重构、4 条换皮重定向失效、4 块依赖上游后端的商业化功能，以及价值最高的一批翻译引擎修复。

MUL-62 点名的翻译质量修复大部分落在这一段：巨型段落切分丢正文（#2109，实测 paulgraham.com 只译出 1.1% 文本）、notranslate 标记误伤整页（#2085）、no-translation 标记吞掉可译段落（#2053）、间歇性滚动 bug（#2052）、双语译文被高浮动元素挤走（#2047）。躲不掉，只能正面处理。

## What Changes

### 上游 options 页重构（#1997 起 9 个提交）

上游把设置页重建成 sections + drill-in 结构，292 文件 / 1.4 万行。按 `FORK_GUIDE.md` C 类思路处理：**跟上游走完整重构，fork 定制改做换皮壳**，不在重构后的上游页面里原地改。

### 4 条换皮重定向迁移

| 失效的 `from`                                                                  | 上游新落点                                                         | 处理                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------- |
| `options/pages/translation/translation-mode.tsx`                               | `options/pages/translation/preference/translation-mode-select.tsx` | 重定向改指新路径                 |
| `options/pages/api-providers/providers-config.tsx`                             | `options/pages/api-providers/providers-config/index.tsx`           | 重定向改指目录桶                 |
| `options/pages/selection-toolbar/selection-toolbar-save-suggestion-toggle.tsx` | 上游已删除该开关                                                   | **删掉这条重定向与 fork 空组件** |
| `options/pages/config/google-drive-sync/index.tsx`                             | `options/pages/preference/config/google-drive-sync/index.tsx`      | 重定向改指新路径                 |

### 4 块影子功能全部隐藏

- **Built-in AI 分层配额**（#2059/#2064/#2065/#2094/#2095）：影子 `use-hosted-ai-status.ts` 恒返回未启用，`built-in-ai-usage` 页换空组件
- **Jalapeno Cloud / Atlas Cloud**（#2081/#2083/#2104）：**【破坏性变更】删除上游新增的 `src/entrypoints/partner-bridge.content/` 整个内容脚本**——它的 `matches` 打到 `jalapeno-cloud.ai`，会往 manifest 加一条站点注入权限，国内商店过审敏感；provider 清单里的两项与「Get API key」按钮由 fork 展示层过滤
- **账号套餐标识 plan-badge**（#2102）：换皮到 fork 的 `membership/tier`，或整块不渲染
- **AI 字幕 Pro/Ultra 分钟配额**（#2072）：`options/pages/video-subtitles/ai-quota/` **与字幕面板里的 `request-ai-subtitles-item.tsx`** 双双换空组件——后者才是用户点得到的真实入口，点下去会走 `ensureAiSubtitlesEntitled()` 弹上游订阅引导（转录后端方案未定，见 MUL-63）

### 微软翻译换回上游实现

上游 #2045 提供了官方的免鉴权端点实现。**【破坏性变更】删除 fork 侧 `src/fork/providers/microsoft-translate.ts` 与对应重定向**，回到上游实现。同时清理与之配套的 fork 模块：`translation-only-gate.ts`、`translation-mode-normalization.ts`、`correct-legacy-translation-mode.ts` 与 `translation-mode.tsx` 换皮——上游 `v092-to-v093` 迁移已覆盖同一场景。

### 配置迁移

schema `88` → `99`，带入上游 11 个迁移脚本。

## Capabilities

### New Capabilities

- `fork-upstream-feature-shadowing`: 上游依赖自有后端或自有计费的功能，在 fork 侧一律以影子模块隐藏；新增依赖上游后端的入口 MUST 在同步时被识别并处理。

### Modified Capabilities

- `fork-provider-ui`: 微软适配器的 fork 副本下线，改用上游实现；仅译文模式的门禁逻辑随之移除。
- `fork-boundary-guard`: 构建门新增 manifest 级站点断言；`FORK.md` 的「被 fork 影子接管的上游文件」对账表同步更新。

## Impact

- **阻塞依赖**：MUST 在 `upstream-sync-v1-43-6` 合入并人工验收通过后启动。
- **manifest 权限面变化**：删除 `partner-bridge.content` 后，产物 manifest MUST NOT 出现 `jalapeno-cloud.ai` 相关 host 权限——这是上架国内商店的硬要求，需在门禁里断言。防漏网靠 fork 侧 provider 枚举测试，**不用产物关键串扫描**（那四个串的真源在 A 类 take-theirs 文件里，扫描只能永久红灯）。
- **微软翻译行为变化**：换回上游实现后，仅译文模式下微软翻译按上游方案处理（provider 选择器隐藏微软）。存量用户由上游 `v092-to-v093` 迁移到 Google 翻译。
- **options 页 fork 定制全部重做**：现有 4 个定制页（`config-card`、`metric-card`、`auto-translate-languages`、`skip-languages`）上游已删，fork 侧对应定制作废。
- **`@read-frog/*` 契约**：`api-contract` `0.12.0` → `0.14.0`、`definitions` `0.4.0` → `0.4.4`，仍需 diff 四项常量。
- **不涉及**：AI 字幕功能本身是否立项（MUL-63 独立决策），本段只负责把它的 UI 入口隐藏干净。
