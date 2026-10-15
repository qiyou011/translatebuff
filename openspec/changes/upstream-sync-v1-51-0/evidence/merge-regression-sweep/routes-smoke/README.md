# Options 路由集成冒烟

本轮在 fork Vitest 的真实重定向解析下挂载 `App`、`AppShell`、29 个实际 lazy 页面和真实页面子组件。最终命令的机器结果见 `complete-run.json`，逐测试日志见 `complete-run.log`：**62 passed / 0 failed / 0 skipped**。

## 覆盖

- 29 个 `ROUTE_DEFS` 全覆盖；另有一项断言固定测试矩阵与生产路由定义逐项一致，新增路由不能静默漏测。
- 配置 A 为未经调整的 `DEFAULT_CONFIG` 深拷贝；配置 B 开启保存的 note suggestion、新内置动作、Beta、AI content aware、AI segmentation 开关，29 个路由各执行一次，共 58 项。配置 B 仍使用当前合法 schema，不冒充旧版本配置迁移测试。
- `/advanced` 必须真正跳转术语库；`/advanced/glossary/:glossaryId` 使用独立合成记录，必须进入编辑页并显示术语库名称，不能以 missing-record 重定向通过。
- 每个路由断言实际页面 H1、页面拥有的区块/控件、实际可操作元素、没有 Suspense/recovery/备份加载提示、查询结束且没有查询错误。两个 CSS 深链必须挂载实际 CodeMirror `.cm-editor .cm-content`。
- 合成自有模型/会员会话：使用真实 `buildRenyimiaoProvider`、`saveForkSession`、会员 hooks 和配置 atoms；验证实际 API 设置页显示模型及只读密钥字段。所有值都是专用假数据，不使用用户凭据。
- 已存自定义动作：通过实际 `?actionId=…&tab=notebase` 消费深链，必须回到真实可编辑本地配置、开关仍开启、未挂载 notebase 区块、无 recovery。
- Layout 交互：点击实际“编辑 Layout”按钮，断言实际 DialogContent 带有 `data-custom-action-layout-editor=""` 标记，等待实际 lazy CodeMirror 和实际预览的两层 ShadowRoot，正常关闭，动作配置不变；没有执行模型或语音。此标记接线断言不等于真实浏览器宽度验收。

## 边界

保留真实配置 atoms、storage adapter、配置 schema、准入 resolver、membership hooks、表单/编辑器/预览、搜索及自动保存导航。每个测试使用独立 Jotai store、清空的 fakeBrowser 存储及查询缓存。

本文件新增的替身仅为后台 `sendForkMessage` RPC 传输（挂载补同步返回完成；意外 RPC 抛错）、Dexie 存储传输（术语库/空术语表/空 batch 统计）、禁止实际网络的 fetch 边界，以及 jsdom 缺少的 matchMedia、ResizeObserver、IntersectionObserver、滚动与 Range 几何 API。术语库 repository、React Query hooks 和 BatchSavingsNote 均真实执行；没有 mock 页面或消除故障组件。

沿用仓库全局 `vitest.setup.ts` 的 i18n 键、LocaleBoundary passthrough、Iconify 惰性图标及 fakeBrowser 约定。因此这份结果是 **jsdom 路由与组件集成证据**，不等于翻译文案、视觉像素、真实布局宽度、浏览器扩展内部页、真实账户/后台、模型生成或云服务端到端验收。未运行浏览器、未触碰用户 profile、未改生产或已有测试。

## 失败保留与排查

- `initial-run.log`：49 pass / 10 fail。8 项是测试夹具的错误选择器或重复名称单值匹配，2 项是未实现 batch 统计表的存储边界。
- `second-run.log`：57 pass / 2 fail；真实 BatchSavingsNote 查询到缺少的 Dexie 表后重试。补全**读表存储边界**，保留真实 hook，见 `third-run.log` 的 59/59。
- `fourth-run.log` + `run.json`：60 pass / 1 fail；合成模型名称出现在多个真实 UI 位置，测试改为限定 provider 区块的多值匹配，没有修改产品。
- `final-run.log/json`：加入完整 options providers、搜索/滚动组件后 61/61。
- `layout-interaction-initial.log`：Layout 交互单项通过；其余 61 项因命令明确使用 `-t` 而未执行，不把该诊断运行算成完整覆盖。
- `complete-run-pre-marker.log/json`：加入宽编辑器标记断言前的 62 项同次执行通过记录。
- `complete-run.log/json`：包含实际 DialogContent 标记断言的全部 62 项同次执行通过，无 skip、无意外 fetch；本范围未确认新增产品故障。

## 复现命令

```sh
SKIP_FREE_API=true pnpm run test --config vitest.fork.config.ts src/fork/ui/options/__tests__/options-routes-smoke.forktest.tsx
pnpm exec oxlint --type-aware --type-check src/fork/ui/options/__tests__/options-routes-smoke.forktest.tsx src/fork/ui/options/__tests__/options-routes-smoke.fixture.ts
pnpm exec oxfmt --check src/fork/ui/options/__tests__/options-routes-smoke.forktest.tsx src/fork/ui/options/__tests__/options-routes-smoke.fixture.ts
```

两个新增文件的类型/ lint 命令 exit 0（无诊断，`type-check-final.log`），格式检查 exit 0（`format-check-final.log`）。图索引状态只读记录在 `index-status.log`；没有重建索引或执行 Git mutation。工作树其他已有 UI 修复由主代理管理。
