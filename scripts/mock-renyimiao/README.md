# 任译喵登录 mock 替身（dev-only）

`fork-membership-login` 变更的本地 mock：官网真登录与后端测试域都没就绪，先用它把**插件侧**登录链路跑通。真态对接只需切 `.env`，插件代码零改动。

- **零新依赖**：全用 node 内置模块（`node:http` 等）。
- **不进产物**：`scripts/` 本就不打进扩展。
- 固定端口 **4173**（可用 `MOCK_RENYIMIAO_PORT` 覆盖）。

## 起 mock

```bash
node scripts/mock-renyimiao/server.mjs
```

启动后同时提供「替身官网登录页」与「替身平台后端」两类端点：

| 端点                                         | 作用                                                         |
| -------------------------------------------- | ------------------------------------------------------------ |
| `GET /`、`GET /zh-hans/login` 等任意登录路径 | 静态登录页，点「模拟登录」写入可读 `Login-Credential` cookie |
| `GET /common_bll/v2/member/login_status`     | 返回假手机号 + 用户信息（含 VIP 判定字段）                   |
| `GET /claw_bff/v1/tokens`                    | 返回固定 `sk_key`                                            |
| `GET /mock-gateway`                          | 翻译网关占位（本迭代不消费）                                 |

> 两个 API 端点均按**路径后缀**匹配，带不带 `/api` 前缀都命中。

## 接上插件（dev）

起 mock 后，把 `.env`（本仓 `.env` 通常本地私有、不入库）里两个变量都指向 mock：

```dotenv
WXT_WEBSITE_URL=http://localhost:4173
WXT_RENYIMIAO_API_URL=http://localhost:4173
```

- `WXT_WEBSITE_URL`：popup 点登录跳转的官网域 → 指向 mock 登录页。
- `WXT_RENYIMIAO_API_URL`：插件后台调 `login_status` / `tokens` 的后端域 → 指向 mock 后端。

> 注意：此登录后端域 ≠ 翻译网关常量 `RENYIMIAO_GATEWAY_BASE_URL`，二者不是同一个域，勿混。

手验链路：popup 点登录 → 跳 mock 登录页 → 点「模拟登录」写 cookie → 插件后台接管 → 设置页「任译喵 API Key」自动填充；点登录页「模拟登出」清 cookie → 插件清空会话与 key。

## 为什么后端强校验请求头、不认自动 cookie

真态官网域与 API 域**不同**，跨域 `fetch` 不会自动带 cookie，插件必须**读 cookie 值显式塞进 `Login-Credential` 头**。mock 同域时浏览器会自动带 cookie，若 mock 认这个自动 cookie，就会**掩盖** header 装配路径 → 假绿。

故 mock 后端只认**显式请求头**，缺任一即 `401`：

- `Login-Credential`（非空；**不接受**自动携带的 `Cookie`）
- `Saas-Product-Line: AITRANS`
- `Saas-App-Id: aitrans-pc`
- `Useragent`：7 段（以 `/` 分隔，段数必须等于 7）

## 切真（零改代码）

官网真登录 + 后端测试域就绪后，仅把 `.env` 的 `WXT_WEBSITE_URL` 与 `WXT_RENYIMIAO_API_URL` 换成真值即可，插件侧代码不动。

## 冒烟测试

```bash
node scripts/mock-renyimiao/smoke.mjs
```

起临时端口跑一遍：带全头 → `200`、缺头/错头 → `401`、只带 Cookie 无显式头 → `401`（验证不认自动 cookie）、登录页 → `200 HTML`、OPTIONS 预检 → `204`。
