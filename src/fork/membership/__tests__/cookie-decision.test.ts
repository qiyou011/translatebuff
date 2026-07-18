import { describe, expect, it } from "vitest"
import { decideCookieAction } from "../cookie-decision"

const OFFICIAL_HOSTS = ["localhost", "translatebuff.com"]

function change(over: { removed: boolean; cause?: string; name?: string; domain?: string }) {
  return {
    removed: over.removed,
    cause: over.cause ?? "explicit",
    cookie: { name: over.name ?? "Login-Credential", domain: over.domain ?? "localhost" },
  }
}

describe("decideCookieAction（cookie watcher 判定）", () => {
  it("官网域写入 Login-Credential → adopt（接管）", () => {
    expect(decideCookieAction(change({ removed: false }), OFFICIAL_HOSTS)).toBe("adopt")
  })

  it("续期先触发 removed+overwrite → ignore（不误判登出）", () => {
    expect(decideCookieAction(change({ removed: true, cause: "overwrite" }), OFFICIAL_HOSTS)).toBe(
      "ignore",
    )
  })

  it("登出移除（removed 且 cause≠overwrite）→ clear（清态）", () => {
    expect(decideCookieAction(change({ removed: true, cause: "explicit" }), OFFICIAL_HOSTS)).toBe(
      "clear",
    )
    expect(decideCookieAction(change({ removed: true, cause: "expired" }), OFFICIAL_HOSTS)).toBe(
      "clear",
    )
  })

  it("cookie 名非精确 Login-Credential → ignore（不子串误触）", () => {
    expect(
      decideCookieAction(
        change({ removed: false, name: "Login-Credential-Extra" }),
        OFFICIAL_HOSTS,
      ),
    ).toBe("ignore")
    expect(
      decideCookieAction(
        change({ removed: false, name: "better-auth.session_token" }),
        OFFICIAL_HOSTS,
      ),
    ).toBe("ignore")
  })

  it("非官网域 → ignore", () => {
    expect(decideCookieAction(change({ removed: false, domain: "evil.com" }), OFFICIAL_HOSTS)).toBe(
      "ignore",
    )
  })

  it("官网域带前导点/子域也命中", () => {
    expect(
      decideCookieAction(change({ removed: false, domain: ".translatebuff.com" }), OFFICIAL_HOSTS),
    ).toBe("adopt")
    expect(
      decideCookieAction(
        change({ removed: false, domain: "www.translatebuff.com" }),
        OFFICIAL_HOSTS,
      ),
    ).toBe("adopt")
  })
})
