import { readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import ViteYaml from "@modyfi/vite-plugin-yaml"
import { defineConfig } from "wxt"
import { z } from "zod"
import {
  createExtensionClientEnvSchema,
  isLocalPackagesEnabled,
  resolveExtensionEnv,
} from "./src/env/shared"
import { FORK_BRANDING } from "./src/fork/branding"
import { resolveChannelNumber } from "./src/fork/identity/channel"
import {
  computeForkVersion,
  computeForkVersionName,
  readForkVersion,
} from "./src/fork/identity/version"
import { forkUiRedirectPlugin } from "./src/fork/ui-redirect-plugin"

const WXT_API_KEY_PATTERN = /^WXT_.*API_KEY/
const ALLOWED_BUNDLED_API_KEYS = new Set(["WXT_POSTHOG_API_KEY"])
const useLocalPackages = isLocalPackagesEnabled(process.env)
const shouldSkipEnvValidation = process.env.WXT_SKIP_ENV_VALIDATION === "true"
// Root of the read-frog monorepo whose source is aliased in when developing
// with local packages. Defaults to the sibling checkout; override with
// WXT_MONOREPO_PATH to point at a git worktree (relative or absolute).
const monorepoRoot = process.env.WXT_MONOREPO_PATH
  ? path.resolve(process.env.WXT_MONOREPO_PATH)
  : path.resolve(__dirname, "../read-frog-monorepo")

// fork 身份：正式发布版本（fork 自主 semver）；version_name 保留上游基线溯源
const pkgVersion = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8"))
  .version as string
const forkReleaseVersion = readForkVersion()
const forkVersion = computeForkVersion(forkReleaseVersion)
const forkVersionName = computeForkVersionName(
  pkgVersion,
  forkReleaseVersion,
  FORK_BRANDING.displayName,
)
// 打包意图（由 scripts/pack.mjs 注入）：FORK_PACK=test → 产物加 -test 后缀，区分测试包 / 正式包。
const forkPackSuffix = process.env.FORK_PACK === "test" ? "-test" : ""

// 渠道 id（由 scripts/pack.mjs 注入 WXT_FORK_CHANNEL）。设了则产物名以渠道 id 命名（同浏览器双渠道不撞车），
// 未设则回退 {{browser}}（dev 裸 `wxt zip` 行为不变）。号码校验借 bundle 侧 resolveChannelNumber（单一真源）。
const forkChannelId = process.env.WXT_FORK_CHANNEL
const forkChannelSuffix = forkChannelId ? `-${forkChannelId}` : "-{{browser}}"

// fork「换皮」重定向：不编辑上游 composed UI 源文件，改由 resolve 插件按解析后的绝对路径
// 把上游 provider 选择器 / 选项 provider 页重定向到 fork 版（相对/@ import 都拦得住）。
export const FORK_UI_REDIRECTS = [
  {
    // 反馈门户地址：上游指向自家 feedback.readfrog.app，任译喵走自己的反馈页。
    // 换皮构造器一处覆盖两个入口（options 侧边栏、网页悬浮球）。
    from: path.resolve(__dirname, "src/utils/featurebase.ts"),
    to: path.resolve(__dirname, "src/fork/ui/options/featurebase.ts"),
  },
  {
    // options 侧边栏「产品」组：上游是路线图 + 反馈、都指向它自家 Featurebase 门户；
    // 任译喵没有路线图页，反馈走自己的站点。
    from: path.resolve(__dirname, "src/entrypoints/options/app-sidebar/product-nav.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/options/product-nav.tsx"),
  },
  {
    // popup 语言选择器：上游写死 w-30，popup 加宽后中间留白过大，改成 flex-1 均分。
    from: path.resolve(__dirname, "src/entrypoints/popup/components/language-options-selector.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/popup/language-options-selector.tsx"),
  },
  {
    // popup 博客入口：上游直拼博客地址，本地预览下丢 hash 路由前缀。
    from: path.resolve(__dirname, "src/entrypoints/popup/components/blog-notification.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/popup/blog-notification.tsx"),
  },
  {
    // 品牌图标：上游把 read-frog.png import 死在多个组件顶部（悬浮球、字幕条），
    // 逐个换皮组件太贵；直接重定向资源本身，一条覆盖全部引用点。
    from: path.resolve(__dirname, "src/assets/icons/read-frog.png"),
    to: path.resolve(__dirname, "src/fork/assets/renyimiao.svg"),
  },
  {
    // options 功能示意区：上游用 read-frog 界面的静态截图，fork 换成实时 CSS 插画。
    from: path.resolve(__dirname, "src/entrypoints/options/pages/context-menu/index.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/options/context-menu-page.tsx"),
  },
  {
    // options 功能示意区：上游用 read-frog 界面的静态截图，fork 换成实时 CSS 插画。
    from: path.resolve(__dirname, "src/entrypoints/options/pages/floating-button/index.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/options/floating-button-page.tsx"),
  },
  {
    // options 功能示意区：上游用 read-frog 界面的静态截图，fork 换成实时 CSS 插画。
    from: path.resolve(__dirname, "src/entrypoints/options/pages/selection-toolbar/index.tsx"),
    to: path.resolve(__dirname, "src/fork/ui/options/selection-toolbar-page.tsx"),
  },
  {
    // 笔记库详情链接：本地预览走 hash 路由，上游直拼会 404。
    from: path.resolve(__dirname, "src/utils/notebase/pending-save.ts"),
    to: path.resolve(__dirname, "src/fork/utils/notebase-pending-save.ts"),
  },
  {
    // provider 图标解析：任译喵实例按 customModel 解析出真实模型品牌图。
    // 上游有 30 余处 import 这个模块，改不动它们的 import，故走重定向。
    from: path.resolve(__dirname, "src/utils/providers/provider-display.ts"),
    to: path.resolve(__dirname, "src/fork/providers/provider-display.ts"),
  },
  {
    // 帮助按钮：上游点开的是 read-frog 的 GitHub issues，改指任译喵站点。
    // URL 硬编码在组件内部、无接缝可注入，只能整份换皮（见 fork 副本头注）。
    from: path.resolve(__dirname, "src/components/help-button.tsx"),
    to: path.resolve(__dirname, "src/fork/components/help-button.tsx"),
  },
  {
    // 账号菜单的对外链接：登录 / Web 应用指向任译喵站点。上游 popup.tsx 与 sidebar.tsx
    // 直接 import 这个模块，改不到它们的 import 语句，故走重定向。
    from: path.resolve(__dirname, "src/components/user-account-menu/shared.tsx"),
    to: path.resolve(__dirname, "src/fork/components/user-account-menu-shared.ts"),
  },
  {
    from: path.resolve(__dirname, "src/components/llm-providers/provider-selector.tsx"),
    to: path.resolve(__dirname, "src/fork/components/provider-selector.tsx"),
  },
  {
    from: path.resolve(
      __dirname,
      "src/entrypoints/options/pages/api-providers/providers-config/index.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/options/providers-config.tsx"),
  },
  {
    from: path.resolve(
      __dirname,
      "src/entrypoints/translation-hub/components/translation-service-dropdown.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/translation-hub/translation-service-dropdown.tsx"),
  },
  {
    // 共享选择状态 atom：默认全选会漏出默认 LLM，故换皮到 fork 版（只覆盖 2 个选择 atom）。
    from: path.resolve(__dirname, "src/entrypoints/translation-hub/atoms.ts"),
    to: path.resolve(__dirname, "src/fork/ui/translation-hub/atoms.ts"),
  },
  {
    // 自定义 AI 指令编辑器的「笔记库连接」区块：远程笔记库是上游功能，任译喵不提供 → 重定向到 fork 空组件。
    from: path.resolve(
      __dirname,
      "src/entrypoints/options/pages/custom-actions/action-config-form/notebase-connection-field.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/options/notebase-connection-field.tsx"),
  },
  {
    // 选项页「通用」页功能提供商宿主：未登录/无 key 时对任译喵门禁（隐藏 + 登录引导），换皮到 fork 版。
    from: path.resolve(
      __dirname,
      "src/components/llm-providers/feature-provider-selector-list.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/options/feature-provider-selector-list.tsx"),
  },
  {
    // 选项页「配置」页「Google Drive 云端同步」卡片：上游功能，任译喵不提供 → 重定向到 fork 空组件。
    // 目录桶导入（config/index.tsx `import { GoogleDriveSyncCard } from "./google-drive-sync"`），
    // from 指向桶真身 index.tsx；预筛已修复支持桶导入（见 src/fork/ui-redirect-plugin.ts）。
    from: path.resolve(
      __dirname,
      "src/entrypoints/options/pages/preference/config/google-drive-sync/index.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/options/google-drive-sync-card.tsx"),
  },
]

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  manifestVersion: 3,
  // WXT top level alias - will be automatically synced to tsconfig.json paths and Vite alias
  alias: useLocalPackages
    ? {
        "@read-frog/definitions": path.resolve(monorepoRoot, "packages/definitions/src"),
        "@read-frog/api-contract": path.resolve(monorepoRoot, "packages/api-contract/src"),
      }
    : {},
  manifest: ({ mode, browser }) => ({
    name: FORK_BRANDING.displayName,
    version: forkVersion,
    version_name: forkVersionName,
    description: "__MSG_extDescription__",
    default_locale: "en",
    // Fixed extension ID for development
    ...(mode === "development" &&
      (browser === "chrome" || browser === "edge") && {
        key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw2KhiXO2vySZtPu5pNSbyKhYavh8Be7gXmCZt8aJf6tQ/L3JK0qzL+3JSc/o20td3Jw+B2Dcw+EI93NAZr24xKnTNXQiJpuIuHb8xLXD0Ra/HrTVi4TJIhPdESogoG4uL6CD/F3TxfZJ2trX4Bt9cdAw1RGGeU+xU0g+YFfEka4ZUCpFAmTEw9H3/DU+nCp8yGaJWyiVgCTcFe38GZKEPt0iMJkTw956wz/iiafLx0pNG/RaztG9cAPoQOD2+SMFaeQ+b/G4OG17TYhzb09AhNBl6zSJ3jTKHSwuedCFwCce8Q/EchJfQZv71mjAE97bzwvkDYPCLj31Z5FE8HntMwIDAQAB",
      }),
    permissions: [
      "storage",
      "tabs",
      "alarms",
      "cookies",
      "contextMenus",
      "identity",
      "scripting",
      "webNavigation",
      ...(browser !== "firefox" ? ["offscreen", "sidePanel"] : []),
    ],
    host_permissions: [
      "*://*/*", // Required for scripting.executeScript in any frame
    ],
    // Allow images/SVGs referenced by content-script UI <img> tags to be loaded from
    // moz-extension:// URLs on regular pages. Firefox enforces this more strictly.
    web_accessible_resources: [
      {
        resources: ["assets/*.png", "assets/*.svg", "assets/*.webp"],
        matches: ["*://*/*", "file:///*"],
      },
    ],
    // Firefox-specific settings for MV3
    ...(browser === "firefox" && {
      // Override default CSP to exclude `upgrade-insecure-requests` (Firefox MV3 default),
      // which would upgrade custom provider HTTP URLs (e.g. LAN) to HTTPS.
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
      browser_specific_settings: {
        gecko: {
          // fork 专属 Firefox 扩展 ID，区别于上游 read-frog，避免 AMO 上架撞车
          id: "translatebuff@translatebuff.com",
          strict_min_version: "112.0",
          data_collection_permissions: {
            required: ["none"],
            optional: ["technicalAndInteraction"],
          },
        },
      },
    }),
  }),
  zip: {
    // fork 品牌命名：translatebuff-<版本>[-test]-<浏览器>.zip。artifactTemplate 才是 WXT 真·文件名模板；
    // 刻意不用 {{version}}（它取的是中文全角 version_name、会产出丑名），干净版本号从 forkVersion 注入。
    // -test 后缀由 FORK_PACK env 驱动（scripts/pack.mjs 打测试包时置 FORK_PACK=test）。sourcesTemplate 同步改，
    // 否则 firefox 的 sources 包文件名仍走默认丑名。
    artifactTemplate: `${FORK_BRANDING.name.toLowerCase()}-${forkVersion}${forkPackSuffix}${forkChannelSuffix}.zip`,
    sourcesTemplate: `${FORK_BRANDING.name.toLowerCase()}-${forkVersion}${forkPackSuffix}-sources.zip`,
    includeSources: ["**/*", ".env.production"],
    excludeSources: ["docs/**/*", "assets/**/*", "repos/**/*", "readmes/**/*"],
  },
  hooks: {
    "vite:build:extendConfig": (entrypoints, viteConfig) => {
      const entrypoint = entrypoints.length === 1 ? entrypoints[0] : undefined
      if (entrypoint?.type !== "content-script") return

      const output = viteConfig.build?.rollupOptions?.output
      if (!output) return

      for (const outputOptions of Array.isArray(output) ? output : [output]) {
        outputOptions.assetFileNames = (assetInfo) =>
          assetInfo.names.some((name) => name.endsWith(".css"))
            ? `content-scripts/${entrypoint.name}.[ext]`
            : "assets/[name]-[hash].[ext]"
      }
    },
  },
  dev: {
    server: {
      // Prefer 3333 over WXT's default 3000 while still allowing WXT to pick
      // another open port when 3333 is already taken.
      port: 3333,
      strictPort: false,
    },
  },
  // Keep the dev server running for extensions loaded manually in the user's
  // existing Chrome profile. WXT's temporary browser runner is not needed.
  webExt: {
    disabled: true,
  },
  vite: (configEnv) => ({
    resolve: {
      // CodeMirror breaks with "Unrecognized extension value in extension set"
      // if the bundle contains more than one copy of these packages (#1782).
      dedupe: [
        "@codemirror/state",
        "@codemirror/view",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/autocomplete",
        "@codemirror/search",
        "@codemirror/commands",
        "@lezer/common",
      ],
    },
    plugins: [
      forkUiRedirectPlugin(FORK_UI_REDIRECTS),
      // Lets the runtime i18next facade (src/utils/i18n) `import` the `src/locales/*.yml`
      // files as JS objects so i18next can bundle them for runtime language switching.
      //
      // This does NOT replace `@wxt-dev/i18n/module` (still registered in `modules` above).
      // That module reads the same .yml files via its own fs-based mechanism — a separate
      // path from this Vite `import` — and is kept ONLY for two build-time jobs it still owns:
      //   1. Emitting `_locales/*/messages.json`, which the browser uses to localize the
      //      manifest `__MSG_extName__` / `__MSG_extDescription__` below. That is chosen by
      //      the browser UI language at load time and is NOT runtime-switchable (platform
      //      constraint), so it stays with @wxt-dev/i18n.
      //   2. Generating the `#i18n` key types (.wxt/i18n/structure.d.ts) that the facade
      //      reuses for autocomplete/type-checking at every `i18n.t('key')` call site.
      // Runtime UI string lookup itself no longer goes through @wxt-dev/i18n.
      ViteYaml(),
      ...(configEnv.mode === "production"
        ? [
            {
              // 渠道号构建期护栏：若注入了渠道 id（WXT_FORK_CHANNEL），其号码必须已分配。把「运行期首个
              // 请求才崩」前移到构建期，封死绕过 pack.mjs 直接 `wxt zip` 打出运行期崩包的旁路。
              name: "check-fork-channel",
              buildStart() {
                // 借 resolveChannelNumber 的「未知 id / 号码未分配」校验（与 bundle 侧同一真源）：
                // 设了渠道即校验、只借它抛错，未知/未分配 → 构建 fail-fast。未设 → dev/默认 zip(7100) 不检查。
                if (forkChannelId) resolveChannelNumber(forkChannelId)
              },
            },
            {
              name: "check-api-key-env",
              buildStart() {
                z.object(
                  createExtensionClientEnvSchema(
                    configEnv.mode === "production",
                    shouldSkipEnvValidation,
                  ),
                ).parse(resolveExtensionEnv(process.env))

                const apiKeyVars = Object.keys(process.env)
                  .filter((key) => WXT_API_KEY_PATTERN.test(key))
                  .filter((key) => !ALLOWED_BUNDLED_API_KEYS.has(key))

                if (apiKeyVars.length > 0) {
                  throw new Error(
                    `\n\nFound WXT_*_API_KEY environment variables that may be bundled:\n` +
                      `${apiKeyVars.map((k) => `   - ${k}`).join("\n")}\n\n` +
                      `Please unset these variables before building for production.\n`,
                  )
                }
              },
            },
          ]
        : []),
    ],
  }),
})
