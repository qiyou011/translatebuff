// 任译喵登录 mock 替身（dev-only）——同时替身「官网登录页」+「平台后端」。
// 背景：官网真登录与后端测试域都没就绪，先用本 mock 把插件侧登录链路跑通；
//       真态对接只需把 .env 的 WXT_WEBSITE_URL / WXT_RENYIMIAO_API_URL 换成真值，插件代码零改动。
// 铁律：零新依赖，全用 node 内置模块（node:http 等）。scripts/ 不进扩展产物，仅本地开发用。
//
// 为什么后端「强校验请求头、绝不认自动携带的 cookie」：
//   真态官网域与 API 域不同，跨域 fetch 不会自动带 cookie，插件必须读 cookie 值显式塞进
//   Login-Credential 头。若 mock 同域时认自动 cookie，就会掩盖 header 路径 → 假绿。
//   故本 mock 只认显式头，裸 cookie 一律 401，逼出真态的 header 装配路径。

import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

// 固定端口 4173（与 .env 里 WXT_RENYIMIAO_API_URL 对齐；独立于真官网 translatebuff-web dev 的 3000，不冲突）。
const PORT = Number.parseInt(process.env.MOCK_RENYIMIAO_PORT ?? "4173", 10)

// 登录页写进 cookie 的固定凭据值；后端只校验 Login-Credential 头「存在且非空」，不强绑此字面量。
const MOCK_CREDENTIAL = "mock-login-credential-aitrans"

// mock sk_key：默认占位（绝不硬编码真 key）；本地自测可用环境变量注入真值（不进仓库）：
//   MOCK_SK_KEY=<你的真key> node scripts/mock-renyimiao/server.mjs
const MOCK_SK_KEY = process.env.MOCK_SK_KEY ?? "sk-mock-renyimiao-0000000000000000000000"

// 平台标识头的固定期望值（任译喵 = AITRANS 产品线、aitrans-pc 应用）。
const EXPECT_PRODUCT_LINE = "AITRANS"
const EXPECT_APP_ID = "aitrans-pc"

// —— CORS：放行扩展 origin（chrome-extension://<id>）+ 本地调试；放行全部自定义凭据头 + 预检 ——
function applyCors(req, res) {
  const origin = req.headers.origin ?? ""
  const allowSpecific =
    origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost")
  // 反射具体 origin（而非 "*"）才能与 Allow-Credentials 共存；其余场景回退 "*"。
  res.setHeader("Access-Control-Allow-Origin", allowSpecific ? origin : "*")
  if (allowSpecific) res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Login-Credential, Saas-Product-Line, Saas-App-Id, Useragent, Client-Language, Content-Type",
  )
  res.setHeader("Access-Control-Max-Age", "600")
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(body))
}

// 强校验显式请求头：Login-Credential（非空）+ Saas-Product-Line + Saas-App-Id + 7 段 Useragent。
// 注意 node 把 header 名统一小写；自定义头 Useragent 小写为 "useragent"，与标准 "user-agent" 不冲突。
// 返回 null 表示通过，返回字符串表示失败原因。
function checkAuthHeaders(req) {
  const credential = req.headers["login-credential"]
  const productLine = req.headers["saas-product-line"]
  const appId = req.headers["saas-app-id"]
  const userAgent = req.headers["useragent"]

  if (!credential) return "缺少 Login-Credential 头（不接受自动携带的 cookie）"
  if (productLine !== EXPECT_PRODUCT_LINE) return `Saas-Product-Line 必须为 ${EXPECT_PRODUCT_LINE}`
  if (appId !== EXPECT_APP_ID) return `Saas-App-Id 必须为 ${EXPECT_APP_ID}`
  if (userAgent?.split("/").length !== 7) return "Useragent 必须为 7 段（以 / 分隔）"
  return null
}

// GET /common_bll/v2/member/login_status —— 返回假用户信息。
// 形状对齐参考站/后端契约：envelope `{ data: { member: { mobile, ... } } }`（api.ts 取 data.member.mobile 为手机号）。
function handleLoginStatus(req, res) {
  const reason = checkAuthHeaders(req)
  if (reason) return sendJson(res, 401, { code: 401, message: reason })

  // 30 天后的到期时间戳（秒），模拟 VIP 有效期。
  const vipExpireTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  return sendJson(res, 200, {
    data: {
      member: {
        mobile: "13800138000",
        nickname: "任译喵体验用户",
        avatar: "",
        user_id: "mock-10086",
        is_vip: true,
        vip_level: 1,
        vip_expire_time: vipExpireTime,
      },
    },
  })
}

// GET /claw_bff/v1/tokens —— 返回固定 sk_key（本迭代只给 key，翻译网关 base_url 仅占位、不消费）。
function handleTokens(req, res) {
  const reason = checkAuthHeaders(req)
  if (reason) return sendJson(res, 401, { code: 401, message: reason })

  // base_url 跟随实际请求 host，端口/主机变了也始终正确（smoke 用临时端口时同样成立）。
  // 形状对齐参考站/后端契约：envelope `{ data: { base_url, tokens: [{ sk_key }] } }`。
  const host = req.headers.host ?? `localhost:${PORT}`
  return sendJson(res, 200, {
    data: {
      base_url: `http://${host}/mock-gateway`,
      tokens: [
        {
          sk_key: MOCK_SK_KEY,
          token_name: "mock",
          remain_quota: 1000000,
          shrimp_coin: 1000000,
          expired_time: -1,
          status: 1,
        },
      ],
    },
  })
}

// 任意登录路径（/、/zh-hans/login、/en/login …）都回同一张静态登录页。
// 每次请求现读文件：改 HTML 无需重启 server。把凭据字面量注入页面，保证与后端一致。
function serveLoginPage(res) {
  const template = readFileSync(path.join(scriptDir, "login.html"), "utf8")
  const html = template.replaceAll("__MOCK_CREDENTIAL__", MOCK_CREDENTIAL)
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(html)
}

function requestHandler(req, res) {
  applyCors(req, res)

  // 预检直接 204，带上上面已 set 的 CORS 头。
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const { pathname } = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${PORT}`}`)

  // 用后缀匹配路由：兼容插件可能带或不带 /api 前缀（任译喵文档与 spec 两种写法都覆盖）。
  if (pathname.endsWith("/member/login_status")) return handleLoginStatus(req, res)
  if (pathname.endsWith("/v1/tokens")) return handleTokens(req, res)

  // 翻译网关占位（tokens.base_url 指向此）——本迭代不发翻译请求，仅给个友好响应避免困惑。
  if (pathname.startsWith("/mock-gateway")) {
    return sendJson(res, 200, { message: "mock one-api 翻译网关占位，本迭代不消费" })
  }

  return serveLoginPage(res)
}

export function createMockServer() {
  return createServer(requestHandler)
}

// 直接 `node scripts/mock-renyimiao/server.mjs` 运行时才自动监听；被 smoke 引入时不自动起。
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  createMockServer().listen(PORT, () => {
    console.log(`任译喵 mock 替身已启动：http://localhost:${PORT}`)
    console.log(
      "  · 登录页       ：GET http://localhost:%d/login（任意路径都回登录页，含 /zh-hans/login 等）",
      PORT,
    )
    console.log(
      "  · 用户信息接口 ：GET http://localhost:%d/common_bll/v2/member/login_status",
      PORT,
    )
    console.log("  · 密钥接口     ：GET http://localhost:%d/claw_bff/v1/tokens", PORT)
    console.log(
      "提示：把 .env 的 WXT_WEBSITE_URL 与 WXT_RENYIMIAO_API_URL 都指向 http://localhost:%d",
      PORT,
    )
  })
}
