/** 官网明确推广记录的跨仓契约：只认可本期批准的 7154。 */
export const INSTALL_PROMOTION_COOKIE_NAME = "aitrans_install_promo"
export const INSTALL_PROMOTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function selectInstallChannel(
  packageCid: string,
  cookieValue: string | null | undefined,
  installAt: number,
): string {
  if (!cookieValue || !Number.isSafeInteger(installAt)) return packageCid
  try {
    // 官网用 js-cookie 写入 JSON，浏览器 cookies API 返回的是 URL 编码后的原始值。
    const record: unknown = JSON.parse(decodeURIComponent(cookieValue))
    if (!record || typeof record !== "object") return packageCid
    const { cid, recordedAt } = record as Record<string, unknown>
    if (
      cid === "7154" &&
      typeof recordedAt === "number" &&
      Number.isSafeInteger(recordedAt) &&
      recordedAt >= 0 &&
      recordedAt < installAt &&
      installAt - recordedAt < INSTALL_PROMOTION_WINDOW_MS
    ) {
      return cid
    }
  } catch {
    // 无效 cookie 不是安装前推广证据。
  }
  return packageCid
}

export interface SavedInstallChannel {
  version: 1
  installAt: number
  selectedCid: string
  websiteOrigin: string
}

export function readFixedChannel(
  value: unknown,
  packageCid: string,
  websiteOrigin: string,
): string | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<SavedInstallChannel>
  return record.version === 1 &&
    record.websiteOrigin === websiteOrigin &&
    Number.isSafeInteger(record.installAt) &&
    [packageCid, "7154"].includes(record.selectedCid ?? "")
    ? record.selectedCid!
    : null
}

interface DecisionDependencies {
  packageCid: string
  websiteOrigin: string
  readSaved: () => Promise<unknown>
  writeSaved: (record: SavedInstallChannel) => Promise<void>
  readCookie: () => Promise<string | null>
}

export function createInstallChannelDecision(deps: DecisionDependencies) {
  let selected: Promise<string> | undefined
  let pendingSave: SavedInstallChannel | undefined

  async function save(record: SavedInstallChannel) {
    try {
      await deps.writeSaved(record)
      pendingSave = undefined
    } catch {
      pendingSave = record
    }
  }

  function install(installAt: number): Promise<string> {
    selected = (async () => {
      let cookie: string | null = null
      try {
        cookie = await deps.readCookie()
      } catch {
        // 权限、存储或同意限制下使用包内号。
      }
      const selectedCid = selectInstallChannel(deps.packageCid, cookie, installAt)
      const record: SavedInstallChannel = {
        version: 1,
        installAt,
        selectedCid,
        websiteOrigin: deps.websiteOrigin,
      }
      await save(record)
      return selectedCid
    })()
    return selected
  }

  async function get(): Promise<string> {
    if (!selected) {
      const coldRead = (async () => {
        try {
          const value = await deps.readSaved()
          const fixed = readFixedChannel(value, deps.packageCid, deps.websiteOrigin)
          if (fixed) return fixed
        } catch {
          // 未知旧值时仅在本进程使用包内号，不覆盖存储。
        }
        return deps.packageCid
      })()
      selected = coldRead
    }
    const snapshot = selected
    const value = await snapshot
    if (selected !== snapshot) return selected
    if (pendingSave) void save(pendingSave)
    return value
  }

  return { install, get }
}
