import type { Plugin } from "vite"
import { existsSync, readFileSync } from "node:fs"
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
import {
  computeForkVersion,
  computeForkVersionName,
  readForkVersion,
} from "./src/fork/identity/version"

const WXT_API_KEY_PATTERN = /^WXT_.*API_KEY/
const ALLOWED_BUNDLED_API_KEYS = new Set(["WXT_POSTHOG_API_KEY"])
const useLocalPackages = isLocalPackagesEnabled(process.env)
const shouldSkipEnvValidation = process.env.WXT_SKIP_ENV_VALIDATION === "true"

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

// fork「换皮」重定向：不编辑上游 composed UI 源文件，改由 resolve 插件按解析后的绝对路径
// 把上游 provider 选择器 / 选项 provider 页重定向到 fork 版（相对/@ import 都拦得住）。
const FORK_UI_REDIRECTS = [
  {
    from: path.resolve(__dirname, "src/components/llm-providers/provider-selector.tsx"),
    to: path.resolve(__dirname, "src/fork/components/provider-selector.tsx"),
  },
  {
    from: path.resolve(
      __dirname,
      "src/entrypoints/options/pages/api-providers/providers-config.tsx",
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
    // 选项页「保存建议」开关：功能 UI 已隐藏，开关留着会误导 → 重定向到 fork 空组件。
    from: path.resolve(
      __dirname,
      "src/entrypoints/options/pages/selection-toolbar/selection-toolbar-save-suggestion-toggle.tsx",
    ),
    to: path.resolve(__dirname, "src/fork/ui/selection-toolbar/save-suggestion-toggle.tsx"),
  },
]

function normalizeModuleId(id: string): string {
  return id
    .replace(/\\/g, "/")
    .split("?")[0]
    .replace(/\.(t|j)sx?$/, "")
}

function forkUiRedirectPlugin(): Plugin {
  const redirects = FORK_UI_REDIRECTS.map((redirect) => ({
    from: normalizeModuleId(redirect.from),
    to: redirect.to,
  }))
  // 预筛用：能命中重定向的 import，其 specifier 末段必为某个目标文件的 basename。
  const targetBasenames = new Set(redirects.map((redirect) => redirect.from.split("/").pop()))
  return {
    name: "fork-ui-redirect",
    enforce: "pre",
    buildStart() {
      // 构建期断言：上游一旦移动/重命名被换皮的文件，from 绝对路径失效 → resolveId 再不命中 →
      // 上游原版 UI 被静默打包（无报错、CI 全绿、皮悄悄掉）。这里把静默失效变成响亮的构建失败，
      // 与下方 check-api-key-env 的 buildStart 校验同构。
      for (const redirect of FORK_UI_REDIRECTS) {
        if (!existsSync(redirect.from)) {
          throw new Error(
            `\n\nfork-ui-redirect: 换皮目标源文件不存在，重定向将静默失效：\n` +
              `   - ${redirect.from}\n\n` +
              `上游可能已移动/重命名该文件，请同步更新 wxt.config 的 FORK_UI_REDIRECTS。\n`,
          )
        }
      }
    },
    async resolveId(source, importer, options) {
      if (!importer) {
        return null
      }
      // basename 预筛：先按末段早退，跳过全图 ~99.9% 的 import，避免对每个 import 都跑 this.resolve
      // （enforce:"pre" 下会给全项目模块解析翻倍）。命中重定向必然末段相等，故预筛安全且完整。
      const sourceBasename = normalizeModuleId(source).split("/").pop()
      if (!targetBasenames.has(sourceBasename)) {
        return null
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) {
        return null
      }
      const match = redirects.find((redirect) => normalizeModuleId(resolved.id) === redirect.from)
      if (!match) {
        return null
      }
      // 放行 fork 覆盖模块 import 它所替换的上游原版：否则 fork/*.ts 里 `export * from 上游`
      // 会被重定向回自身，形成自引循环。仅当 importer 正是该重定向的目标文件时跳过。
      if (importer && normalizeModuleId(importer) === normalizeModuleId(match.to)) {
        return null
      }
      return match.to
    },
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  manifestVersion: 3,
  // WXT top level alias - will be automatically synced to tsconfig.json paths and Vite alias
  alias: useLocalPackages
    ? {
        "@read-frog/definitions": path.resolve(
          __dirname,
          "../read-frog-monorepo/packages/definitions/src",
        ),
        "@read-frog/api-contract": path.resolve(
          __dirname,
          "../read-frog-monorepo/packages/api-contract/src",
        ),
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
    artifactTemplate: `${FORK_BRANDING.name.toLowerCase()}-${forkVersion}${forkPackSuffix}-{{browser}}.zip`,
    sourcesTemplate: `${FORK_BRANDING.name.toLowerCase()}-${forkVersion}${forkPackSuffix}-sources.zip`,
    includeSources: [".env.production"],
    excludeSources: ["docs/**/*", "assets/**/*", "repos/**/*", "readmes/**/*"],
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
      forkUiRedirectPlugin(),
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
