import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing"
import { env } from "@/env"
import {
  adoptCredential,
  clearMembership,
  ensureMembershipKey,
  setupMembership,
  syncMembershipFromWebsite,
} from "@/fork/background/membership"
import { loadForkSession, saveForkSession } from "@/fork/membership/session"
import { renyimiaoApiKey, renyimiaoBaseUrl, renyimiaoModelIds } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"

const API_BASE = "https://api.test.local"
const CRED = "cred-login-xyz"
const SK = "sk-mock-renyimiao-0000000000000000000000"

const fetchMock = vi.fn<(...args: any[]) => any>()

function jsonResponse(status: number, body: unknown) {
  return { status, json: vi.fn<(...args: any[]) => any>().mockResolvedValue(body) }
}

// 按 URL 路由：login_status 返用户信息、tokens 返 sk_key。各测试可覆盖。
function routeOk() {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("login_status")) {
      return Promise.resolve(
        jsonResponse(200, { data: { member: { mobile: "13800000000", nickname: "小明" } } }),
      )
    }
    if (url.includes("tokens")) {
      return Promise.resolve(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    }
    if (url.includes("/models")) {
      return Promise.resolve(jsonResponse(200, { data: [] })) // 空 → syncRenyimiaoModels no-op，实例集不变
    }
    return Promise.resolve(jsonResponse(404, {}))
  })
}

async function readKey(): Promise<string> {
  const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
  return renyimiaoApiKey(config.providersConfig)
}

beforeEach(() => {
  fakeBrowser.reset()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("WXT_RENYIMIAO_API_URL", API_BASE)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("adoptCredential（接管编排）", () => {
  it("成功：存 fork 会话（手机号/用户）+ 单写 sk_key 进全部任译喵实例", async () => {
    routeOk()
    await adoptCredential(CRED)

    const session = await loadForkSession()
    expect(session?.loginCredential).toBe(CRED)
    expect(session?.phone).toBe("13800000000")
    expect(session?.user).toMatchObject({ nickname: "小明" })

    expect(await readKey()).toBe(SK)
  })

  it("login_status 返 401 → 端到端清态（无会话、key 空）", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("login_status")) return Promise.resolve(jsonResponse(401, {}))
      return Promise.resolve(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
    })
    // 预置一份陈旧会话，验证 401 会清掉。
    await saveForkSession({ loginCredential: "stale", phone: "1", user: {} })

    await adoptCredential(CRED)

    expect(await loadForkSession()).toBeNull()
    expect(await readKey()).toBe("")
  })

  it("登录后写动态 base_url + 主动拉一次模型重建实例集", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("login_status")) {
        return Promise.resolve(jsonResponse(200, { data: { member: { mobile: "13800000000" } } }))
      }
      if (url.includes("tokens")) {
        return Promise.resolve(
          jsonResponse(200, { data: { base_url: "https://dyn.gw", tokens: [{ sk_key: SK }] } }),
        )
      }
      if (url.includes("/models")) {
        return Promise.resolve(
          jsonResponse(200, { data: [{ id: "GLM-5.2" }, { id: "Kimi-k2.7" }] }),
        )
      }
      return Promise.resolve(jsonResponse(404, {}))
    })

    await adoptCredential(CRED)

    const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
    expect(renyimiaoApiKey(config.providersConfig)).toBe(SK)
    expect(renyimiaoBaseUrl(config.providersConfig)).toBe("https://dyn.gw/v1")
    expect(renyimiaoModelIds(config.providersConfig).sort()).toEqual(["GLM-5.2", "Kimi-k2.7"])
  })

  it("拉模型失败 → 降级不阻断：会话/key/base_url 仍写入、保留静态实例", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("login_status")) {
        return Promise.resolve(jsonResponse(200, { data: { member: { mobile: "13800000000" } } }))
      }
      if (url.includes("tokens")) {
        return Promise.resolve(
          jsonResponse(200, { data: { base_url: "https://dyn.gw", tokens: [{ sk_key: SK }] } }),
        )
      }
      if (url.includes("/models")) {
        return Promise.resolve({ status: 500, statusText: "err", text: () => Promise.resolve("") })
      }
      return Promise.resolve(jsonResponse(404, {}))
    })

    await adoptCredential(CRED)

    const config = await storageAdapter.get(CONFIG_STORAGE_KEY, DEFAULT_CONFIG, configSchema)
    expect(renyimiaoApiKey(config.providersConfig)).toBe(SK)
    expect(renyimiaoBaseUrl(config.providersConfig)).toBe("https://dyn.gw/v1")
    expect(renyimiaoModelIds(config.providersConfig).length).toBeGreaterThan(0) // 静态 seed 仍在
    expect((await loadForkSession())?.phone).toBe("13800000000")
  })
})

describe("clearMembership（清态编排）", () => {
  it("登录后清态：会话清空、全部任译喵实例 key 清空", async () => {
    routeOk()
    await adoptCredential(CRED)
    expect(await readKey()).toBe(SK)

    await clearMembership()

    expect(await loadForkSession()).toBeNull()
    expect(await readKey()).toBe("")
  })
})

describe("adoptCredential 在途去重（防主动探测 + 被动监听并发双接管）", () => {
  it("同凭据并发只接管一次：login_status 仅请求一遍", async () => {
    let loginStatusCalls = 0
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("login_status")) {
        loginStatusCalls += 1
        return Promise.resolve(jsonResponse(200, { data: { member: { mobile: "13800000000" } } }))
      }
      if (url.includes("tokens")) {
        return Promise.resolve(jsonResponse(200, { data: { tokens: [{ sk_key: SK }] } }))
      }
      if (url.includes("/models")) return Promise.resolve(jsonResponse(200, { data: [] }))
      return Promise.resolve(jsonResponse(404, {}))
    })

    await Promise.all([adoptCredential(CRED), adoptCredential(CRED)])

    expect(loginStatusCalls).toBe(1)
    expect((await loadForkSession())?.loginCredential).toBe(CRED)
  })

  it("接管完成后释放在途标记：可再次接管同凭据", async () => {
    routeOk()
    await adoptCredential(CRED)
    await clearMembership()
    fetchMock.mockClear()
    routeOk()

    await adoptCredential(CRED) // 标记已释放，应能再次实际接管
    expect(fetchMock).toHaveBeenCalled()
    expect(await readKey()).toBe(SK)
  })
})

describe("syncMembershipFromWebsite（冷启动/挂载主动同步）", () => {
  it("无会话 + 官网 cookie 存在 → 读 WXT_WEBSITE_URL 的 cookie 并接管", async () => {
    routeOk()
    const getSpy = vi.spyOn(fakeBrowser.cookies, "get").mockResolvedValue({ value: CRED })

    await syncMembershipFromWebsite()

    expect(getSpy).toHaveBeenCalledWith({
      url: `${env.WXT_WEBSITE_URL}/`,
      name: "Login-Credential",
    })
    expect((await loadForkSession())?.loginCredential).toBe(CRED)
    expect(await readKey()).toBe(SK)
  })

  it("已有会话 → 短路：不读 cookie、不发请求", async () => {
    await saveForkSession({ loginCredential: CRED, phone: "13800000000", user: {} })
    const getSpy = vi.spyOn(fakeBrowser.cookies, "get").mockResolvedValue({ value: CRED })

    await syncMembershipFromWebsite()

    expect(getSpy).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("无 cookie → 不接管、不发请求", async () => {
    routeOk()
    vi.spyOn(fakeBrowser.cookies, "get").mockResolvedValue(null)

    await syncMembershipFromWebsite()

    expect(await loadForkSession()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("cookies.get 抛错 → 优雅返回、不接管", async () => {
    routeOk()
    vi.spyOn(fakeBrowser.cookies, "get").mockRejectedValue(new Error("boom"))

    await expect(syncMembershipFromWebsite()).resolves.toBeUndefined()
    expect(await loadForkSession()).toBeNull()
  })
})

describe("setupMembership 冷启接线", () => {
  it("冷启即主动探测：cookie 在则接管", async () => {
    routeOk()
    vi.spyOn(fakeBrowser.cookies.onChanged, "addListener").mockImplementation(() => {})
    vi.spyOn(fakeBrowser.cookies, "get").mockResolvedValue({ value: CRED })

    setupMembership()

    await vi.waitFor(async () => {
      expect((await loadForkSession())?.loginCredential).toBe(CRED)
    })
  })
})

describe("ensureMembershipKey（R6 挂载补偿）", () => {
  it("已登录但 key 空 → 用会话凭据重取 tokens 并注入", async () => {
    // 模拟 SW 回收致中断：会话已存、但 provider key 为空。
    await saveForkSession({ loginCredential: CRED, phone: "13800000000", user: {} })
    expect(await readKey()).toBe("")
    routeOk()

    await ensureMembershipKey()

    expect(await readKey()).toBe(SK)
  })

  it("无会话 → 不补 key、不发请求（对账：无会话则 key 必空）", async () => {
    routeOk()
    await ensureMembershipKey()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await readKey()).toBe("")
  })

  it("key 已在 → 幂等短路、不重复请求", async () => {
    routeOk()
    await adoptCredential(CRED) // 先登录写入 key
    fetchMock.mockClear()

    await ensureMembershipKey()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
