## Context

`fork-guard.yml` 现在的构建与断言步骤：

```yaml
- run: pnpm run build # → .output/chrome-mv3
- run: pnpm run build:edge # → .output/edge-mv3
- run: pnpm run build:firefox # → .output/firefox-mv3
- run: node scripts/assert-fork-build.mjs # 默认只读 .output/chrome-mv3
```

三个问题叠在一起：

1. `pnpm run build` 直接调 `wxt build`，**绕过 `pack.mjs`**，不注入 `WXT_FORK_EDITION` → 恒为 cn。
2. 断言只跑一次、默认目录是 chrome → edge / firefox 白构建。
3. 海外线一次都没被构建过。

edition 分叉点共 7 处，横跨 dotenv / bundle 运行期 / Node 构建期三个上下文，已在 `fork-global-edition` 的 design D1–D3 论证过不能合并成单一文件。

## Goals / Non-Goals

**Goals:**

- 任一 edition 的配置被改坏，CI 立刻红。
- 新增分叉点的人有地方登记，且必然会看到那份登记。
- CI 增量成本可控。

**Non-Goals:**

- 不拆分支（已决策）。
- 不把 7 处分叉点合并成总表。
- 不在 CI 打满 12 个渠道包——渠道之间只差一个号码，配置错误一个代表渠道就能暴露。
- 不做索引的机器校验（见「风险」，做不到，靠放置位置缓解）。

## Decisions

### D1：CI 走 `pack.mjs`，不在 YAML 里重写 env 注入

新增步骤用真实命令：

```yaml
- name: Global edition build + assert
  run: node scripts/pack.mjs store --edition global --channel global-zip
```

`pack.mjs store` 内部已经串好「读该 edition 的配置 → 注入 → `wxt zip` → `assert-fork-build.mjs`（带 `FORK_OUT_DIR` 与 `WXT_FORK_EDITION`）」。CI 复用它，测的就是人实际会跑的那条路径。

**为什么不选**「在 YAML 里 `export` 一串 `WXT_*` 再 `wxt build`」：那等于把 `pack.mjs` 的注入逻辑抄一份到 CI。两边漂移时，CI 绿而真实打包红（或反过来），护栏变成噪音。

选 `global-zip` 作代表渠道：它是海外线默认渠道，chrome 目标，构建最快。

### D2：国内线是否也改走 `pack.mjs`（待决策）

两个选项：

|          | 保留现状                                    | 也改走 pack.mjs                   |
| -------- | ------------------------------------------- | --------------------------------- |
| 命令     | `pnpm run build` ×3 + 断言 ×1               | `pack.mjs store --channel zip`    |
| 覆盖     | 三浏览器产物，但只断言 chrome               | 单浏览器，但断言必过              |
| 与海外线 | 不对称，两条线测的不是一回事                | 对称                              |
| 上游同步 | `pnpm run build` 是上游脚本，同步时不会冲突 | 无影响（`pack.mjs` 是 fork 自建） |

倾向**保留 `pnpm run build` 三浏览器构建**（它顺带验证了三个目标都能编译，这是 `pack.mjs` 单渠道给不了的），但**把断言改成逐目录跑**（见 D3）。这样国内线覆盖面更广、海外线走真实命令，各取所长。

⚠️ 这条留给评审拍板，实施时以结论为准。

### D3：断言逐产物目录跑

`assert-fork-build.mjs` 已支持 `FORK_OUT_DIR`。CI 改成：

```yaml
- name: Assert bundle domains (all targets)
  run: |
    for d in chrome edge firefox; do
      FORK_OUT_DIR=.output/$d-mv3 node scripts/assert-fork-build.mjs
    done
```

零脚本改动，只改 workflow。修掉「edge / firefox 白构建」这个既有缺口。

### D4：索引放 `edition.ts` 文件头，不放独立文档

任何新增分叉点都必须 `import { currentEdition }`（bundle 侧）或 `resolveEdition`（Node 侧），也就是**必然打开这个文件**。索引放这里，改的人一定会看到；放 `FORK_GUIDE.md` 或新建 `docs/editions.md` 则要靠自觉去翻。

索引内容是一张表：分叉点路径 + 它分的是什么 + 运行上下文。不重复各处的取值细节（那会立刻过期），只回答「一共有哪几处、各管什么」。

**为什么不做机器校验**：想过写个测试扫描全仓 `currentEdition()` 调用点并与索引比对，但 `wxt.config.ts` / `pack.mjs` / `assert-fork-build.mjs` 里的分叉是字符串条件（`edition === "global"`），扫不准；两份 env 更是纯数据。做出来会是个高误报的脆弱测试，比没有更糟。

## 文件结构

| 文件                               | 改动                               |
| ---------------------------------- | ---------------------------------- |
| `src/fork/identity/edition.ts`     | 文件头加分叉落点索引（纯注释）     |
| `.github/workflows/fork-guard.yml` | 新增海外线出包步骤；断言改逐目录跑 |

无新增文件，无逻辑改动，无测试改动。

## Risks / Trade-offs

- **CI 时长 +约 30%**：多一次完整生产构建。换来的是海外线从零覆盖变成有护栏——目前没有更便宜的替代（配置错误只有真构建才暴露）。
- **索引会过期**：注释无强制力。放在 `edition.ts` 是把「看到它」的概率最大化，但保证不了。若将来分叉点涨到十几处，再考虑生成式方案。
- **`pack.mjs store` 在 CI 里会产出 zip**：无人消费，纯浪费几秒与磁盘。为此给 `pack.mjs` 加一个「只构建不打包」模式不划算（上一轮已确认不加 `build` 模式）。
- **CI 里 `.env` / `.env.global` 不存在**：测试域泄漏守卫会跳过（`assert-fork-build.mjs` 对缺失 `.env` 的处理是「无从泄漏、跳过」）。这是既有行为，不是本变更引入。
