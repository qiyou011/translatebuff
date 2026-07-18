// mock 替身冒烟测试（dev-only）：起 server → 带/不带凭据头分别断言 200 / 401。
// 重点验证「不认自动 cookie」：只带 Cookie 头、不带显式 Login-Credential 头 → 必须 401（防假绿）。
// 运行：node scripts/mock-renyimiao/smoke.mjs

import process from "node:process"
import { createMockServer } from "./server.mjs"

const MOCK_SK_KEY = "sk-mock-renyimiao-0000000000000000000000"

// 完整合规头（7 段 UA：client_name/版本/OS/渠道号/OS 版本/语言/sn）。
const validHeaders = {
  "Login-Credential": "mock-login-credential-aitrans",
  "Saas-Product-Line": "AITRANS",
  "Saas-App-Id": "aitrans-pc",
  Useragent: "aitrans-pc/1.0.0/macOS/8188/14.0/zh-CN/mock-sn",
  "Client-Language": "zh-CN",
}

let passed = 0
let failed = 0

function check(name, condition) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}`)
  }
}

async function run() {
  const server = createMockServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()
  const base = `http://localhost:${port}`

  try {
    // 1. login_status 带全头 → 200 + 手机号
    {
      const res = await fetch(`${base}/common_bll/v2/member/login_status`, {
        headers: validHeaders,
      })
      const body = await res.json()
      check("login_status 带全头 → 200", res.status === 200)
      check(
        "login_status 返回手机号（data.member.mobile）",
        typeof body.data?.member?.mobile === "string" && body.data.member.mobile.length > 0,
      )
      check("login_status 含 VIP 判定字段", typeof body.data?.member?.is_vip === "boolean")
    }

    // 2. login_status 缺 Login-Credential → 401
    {
      const { "Login-Credential": _omit, ...noCredential } = validHeaders
      const res = await fetch(`${base}/common_bll/v2/member/login_status`, {
        headers: noCredential,
      })
      check("login_status 缺 Login-Credential → 401", res.status === 401)
    }

    // 3. login_status Saas-Product-Line 错误 → 401
    {
      const res = await fetch(`${base}/common_bll/v2/member/login_status`, {
        headers: { ...validHeaders, "Saas-Product-Line": "WRONG" },
      })
      check("login_status Saas-Product-Line 错误 → 401", res.status === 401)
    }

    // 4. login_status UA 非 7 段 → 401
    {
      const res = await fetch(`${base}/common_bll/v2/member/login_status`, {
        headers: { ...validHeaders, Useragent: "aitrans-pc/1.0.0/macOS" },
      })
      check("login_status UA 非 7 段 → 401", res.status === 401)
    }

    // 5. 关键：只带 Cookie、不带显式头 → 401（不认自动 cookie，防假绿）
    {
      const res = await fetch(`${base}/common_bll/v2/member/login_status`, {
        headers: { Cookie: "Login-Credential=mock-login-credential-aitrans" },
      })
      check("只带 Cookie、无显式头 → 401（不认自动 cookie）", res.status === 401)
    }

    // 6. tokens 带全头 → 200 + 固定 sk_key + base_url
    {
      const res = await fetch(`${base}/claw_bff/v1/tokens`, { headers: validHeaders })
      const body = await res.json()
      check("tokens 带全头 → 200", res.status === 200)
      check(
        "tokens 返回固定 sk_key（data.tokens[0].sk_key）",
        body.data?.tokens?.[0]?.sk_key === MOCK_SK_KEY,
      )
      check(
        "tokens 返回 base_url(/mock-gateway)",
        typeof body.data?.base_url === "string" && body.data.base_url.endsWith("/mock-gateway"),
      )
    }

    // 7. tokens 缺头 → 401
    {
      const res = await fetch(`${base}/claw_bff/v1/tokens`, {})
      check("tokens 缺头 → 401", res.status === 401)
    }

    // 8. 兼容带 /api 前缀的路径（后缀匹配）
    {
      const res = await fetch(`${base}/api/claw_bff/v1/tokens`, { headers: validHeaders })
      check("tokens 带 /api 前缀 → 200", res.status === 200)
    }

    // 9. 任意登录路径 → 200 HTML 登录页
    {
      const res = await fetch(`${base}/zh-hans/login`)
      const html = await res.text()
      check("登录路径 → 200 HTML", res.status === 200 && html.includes("模拟登录"))
    }

    // 10. OPTIONS 预检 → 204 + CORS 头
    {
      const res = await fetch(`${base}/claw_bff/v1/tokens`, {
        method: "OPTIONS",
        headers: {
          Origin: "chrome-extension://abcdefghijklmnop",
          "Access-Control-Request-Method": "GET",
        },
      })
      check("OPTIONS 预检 → 204", res.status === 204)
      check(
        "预检放行扩展 origin",
        res.headers.get("access-control-allow-origin") === "chrome-extension://abcdefghijklmnop",
      )
      const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase()
      check("预检放行 Login-Credential 头", allowHeaders.includes("login-credential"))
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }

  console.log(`\nsmoke 结果：${passed} 通过，${failed} 失败`)
  process.exit(failed === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error("smoke 运行异常：", error)
  process.exit(1)
})
