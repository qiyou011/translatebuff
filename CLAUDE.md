# CLAUDE.md — translatebuff-app（任译喵）

任译喵（英文标识 **Translatebuff**）翻译浏览器扩展，是 [read-frog](https://github.com/mengxi-ream/read-frog) 的**软 fork**：复用并同步上游翻译引擎，自建品牌 / 后端 / 会员。
技术栈：WXT + MV3 + React + Vercel AI SDK，pnpm + Nx，vitest。

## 最重要的规则：软 fork 边界纪律

本仓 `main` 与 `upstream/main` 共享 git 祖先，靠 **merge-only**（绝不 rebase/squash）同步。**动代码前先读**：

- **[FORK_GUIDE.md](./FORK_GUIDE.md)** — 可读版开发指南（心智模型、红黄绿分区、功能落点、常见任务速查）
- **[FORK.md](./FORK.md)** — 机械操作手册（同步仪式、take-theirs 热点清单、不变量）

一句话：**净新增代码全进 `src/fork/**`（C 类）；上游引擎照单全收（D 类）；A 类高频文件一律 take-theirs；B 类原地改仅限 [`scripts/fork-allowlist.json`](./scripts/fork-allowlist.json) 白名单**。加功能前先问"能不能只写在 `src/fork/`？"——绝大多数能。

红线（详见 FORK_GUIDE §7）：

- 绝不改上游 config zod schema / `DEFAULT_CONFIG` / migration / `providers.ts` / `models.ts` / `message.ts`。
- fork 配置用独立 storage key（`src/fork/config/`），绝不进上游 `configSchema`。
- 门禁 / 权限在服务端，扩展只读会员态、不做安全边界。

## 常用命令

```bash
pnpm dev                 # 开发（自动开 Chrome 装扩展）
pnpm run test            # 单元测试（vitest）
pnpm run build           # chrome 构建（另有 build:edge / build:firefox）
pnpm run type-check      # oxlint 类型检查
node scripts/pack.mjs store --channel <id>                          # 国内线正式包（不传 --edition 即 cn）
node scripts/pack.mjs store --edition global --all                 # 海外线全渠道正式包（.com）
node scripts/assert-fork-build.mjs                                  # 断言产物内 fork 域名已生效（按 edition 双向校验）
FORK_DIFF_BASE=origin/main node scripts/check-fork-boundary.mjs     # 断言无越界改动
node scripts/check-fork-brand.mjs                                  # 断言 locale/标题无上游残留 + 无小写 Translatebuff
```

环境要求：Node ≥ 22.22.0、pnpm 10.30.2（corepack 自动装）。

**发行版（edition）**：产物目录按线分开——国内 `.output/<browser>-mv3`、海外 `.output/<browser>-mv3-global`，可直接 load unpacked。
`cn` = 国内线（`.env.production`，translatebuff.cn），`global` = 海外线
（`.env.global.production`，translatebuff.com）。两线独立后端与用户池，商店条目、扩展 ID、渠道号、官网跳转
路径全部分开。⚠️ 绕过 `pack.mjs` 直接 `wxt zip` 会失去双向域名护栏——两线配置串味时构建成功、装上能用，
用户登录才炸。

## 测试注意（详见 [AGENTS.md](./AGENTS.md)）

- 本地跑测试设 `SKIP_FREE_API=true`（`free-api.test.ts` 打真实外部翻译服务，会因限流偶发失败）。
- 本地 `.env` 若覆盖 `WXT_WEBSITE_URL` 会让部分上游 guide 测试挂；CI 不带 `.env` 故常绿。

## 规格与需求

OpenSpec 在 `openspec/`：`specs/` 是已归档能力规格，`changes/` 是进行中变更。立项走 `/jyopsx-propose`。

## fork 目录约定（`src/fork/`）

```
branding.ts        品牌名 + 站点 URL
message.ts         独立 ForkProtocolMap（fork 专属消息，绝不进上游 message.ts）
background/        setupFork()：fork 后台接线唯一入口
identity/          fork 自主 semver（fork-version.json）
config/            fork 专属配置（独立 storage key + schema + 迁移链）
ui/<page>/App.tsx  各页面 fork 界面（popup 已有壳层参考页）
```

待建：`membership/`（会员登录）、`providers/`（fork provider 覆盖）、`components/`（设计系统 / 账户菜单）。

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **translatebuff** (13471 symbols, 35073 relationships, 257 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource                                       | Use for                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/translatebuff/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/translatebuff/clusters`       | All functional areas                     |
| `gitnexus://repo/translatebuff/processes`      | All execution flows                      |
| `gitnexus://repo/translatebuff/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
