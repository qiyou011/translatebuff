import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../../../../..")
const build = JSON.parse(readFileSync(join(here, "rollback-build-preflight.json"), "utf8"))
assert.equal(build.status, "BUILT")
assert.equal(build.sourceRef, "4be99b341a7c940a48794232f066db43339cc2d2")
const candidatePath = join(repo, ".output/chrome-mv3")
const runId = new Date().toISOString().replaceAll(":", "-")
const output = join(here, "rollback-runs", runId)
mkdirSync(output, { recursive: true })
const ownedRoot = mkdtempSync(join(tmpdir(), "translatebuff-rollback-browser-"))
const profile = join(ownedRoot, "profile")
const snapshot = join(ownedRoot, "pre-upgrade-complete-profile")
const extensionPath = join(ownedRoot, "extension-under-test")
const playwrightPath =
  "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
const hash = (input) => createHash("sha256").update(input).digest("hex")
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
function digest(directory) {
  const rows = []
  const visit = (path) => {
    for (const entry of readdirSync(path).sort()) {
      const item = join(path, entry)
      if (statSync(item).isDirectory()) visit(item)
      else
        rows.push({
          path: relative(directory, item),
          bytes: statSync(item).size,
          sha256: hash(readFileSync(item)),
        })
    }
  }
  visit(directory)
  return { treeSha256: hash(JSON.stringify(rows)), fileCount: rows.length, files: rows }
}
const oldDigest = digest(build.artifactPath)
const candidateDigest = digest(candidatePath)
assert.equal(
  candidateDigest.treeSha256,
  "2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906",
)
const oldManifest = JSON.parse(readFileSync(join(build.artifactPath, "manifest.json"), "utf8"))
const newManifest = JSON.parse(readFileSync(join(candidatePath, "manifest.json"), "utf8"))
const require = createRequire(import.meta.url)
const storageHelper = resolve(
  dirname(require.resolve("wxt", { paths: [build.sourceRoot] })),
  "../../@wxt-dev/storage/dist/index.mjs",
)
const storageSource = readFileSync(storageHelper, "utf8")
const suffix = /const getMetaKey = \(key\) => key \+ "([^"]+)"/.exec(storageSource)?.[1]
assert.equal(suffix, "$")
const metaKey = `config${suffix}`
const report = {
  runId,
  status: "RUNNING",
  identity: {
    oldSourceSha: build.sourceRef,
    candidateSha: "5ac5122a6a4d390b3131f917dd09aa2caf5f5342",
    targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
    oldArtifact: {
      path: build.artifactPath,
      manifest: oldManifest,
      digest: oldDigest,
      dependencies: build.oldDependencies,
      supplement: build.supplement,
    },
    candidateArtifact: { path: candidatePath, manifest: newManifest, digest: candidateDigest },
    fixedOwnedExtensionPath: extensionPath,
    freshOwnedProfile: true,
    viewport: { width: 1440, height: 1000 },
    metadata: {
      helper: storageHelper,
      helperSha256: hash(storageSource),
      key: metaKey,
      rule: "getMetaKey(driverKey) reads helper suffix",
    },
  },
  stages: [],
  network: [],
  pageErrors: [],
  limitations: [
    "This is an unpacked-package cold swap at one fixed owned path/extensionId, not a signed store/CRX version update; both business manifests are 1.5.0.",
    "Only an anonymous synthetic schema100 configuration is used. No real account, cookie, membership token, or user profile is read.",
    "Full-profile restore discards all post-upgrade profile data, including new glossary entries; such data must be exported separately before rollback.",
    "runtime.reload is not used due the parent's observed CFT flag-loaded extension restriction. Every transition is a full browser/SW cold restart.",
    "Local OpenAI-compatible HTTP responses are controlled fixtures. They exercise actual old/new background transport/cache, not real paid providers.",
    "BrowserContext request events count observed attempts only; they are not an all-target CDP network audit or proof of zero network.",
  ],
}
let context,
  bridge,
  extensionId,
  chromium,
  executablePath,
  activePhase = "startup",
  oldBackupId,
  oldBackup,
  oldConfigMeta,
  oldConfig,
  server,
  serverPort
const localCalls = []
const translationRequests = new Map()
function save() {
  writeFileSync(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`)
}
async function until(check, label, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const result = await check()
    if (result) return result
    await pause(150)
  }
  throw new Error(`Timed out: ${label}`)
}
async function stage(name, run, { allowFailure = false } = {}) {
  activePhase = name
  const row = { name, status: "RUNNING", startedAt: new Date().toISOString() }
  report.stages.push(row)
  save()
  try {
    row.details = await run()
    row.status = "PASS"
  } catch (error) {
    row.status = "FAIL"
    row.error = String(error.message)
    if (!allowFailure) throw error
  } finally {
    row.finishedAt = new Date().toISOString()
    save()
    process.stdout.write(`${name}: ${row.status}\n`)
  }
  return row
}
async function shot(page, name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return relative(output, path)
}
function swapArtifact(from) {
  assert.ok(!context, "Only swap bundle after context is completely closed")
  rmSync(extensionPath, { recursive: true, force: true })
  cpSync(from, extensionPath, { recursive: true })
  return digest(extensionPath).treeSha256
}
async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: report.identity.viewport,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
    ],
  })
  report.identity.browserVersion = context.browser().version()
  report.identity.contextStartCount = (report.identity.contextStartCount ?? 0) + 1
  context.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      const url = new URL(request.url())
      report.network.push({
        phase: activePhase,
        method: request.method(),
        url: `${url.protocol}//${url.host}${url.pathname}`,
      })
    }
  })
  context.on("page", (page) =>
    page.on("pageerror", (error) =>
      report.pageErrors.push({ phase: activePhase, message: String(error.message).slice(0, 600) }),
    ),
  )
  const worker =
    context.serviceWorkers().find((item) => item.url().startsWith("chrome-extension:")) ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }))
  const id = new URL(worker.url()).hostname
  if (extensionId) assert.equal(id, extensionId, "Unpacked identity changed across package swap")
  else extensionId = id
  report.identity.extensionId = id
  bridge = await context.newPage()
  await bridge.goto(`chrome-extension://${id}/offscreen.html`)
  assert.equal(await bridge.evaluate(() => typeof chrome.storage.local.get), "function")
  return {
    method: "full-browser-cold-start-same-owned-profile-and-fixed-artifact-path",
    workerUrl: worker.url(),
    id,
  }
}
async function inspectLoadedPackage() {
  const manifest = await bridge.evaluate(() => chrome.runtime.getManifest())
  const cdp = await context.browser().newBrowserCDPSession()
  const targets = await cdp.send("Target.getTargets")
  const target = targets.targetInfos.find(
    (item) =>
      item.type === "service_worker" &&
      item.url === `chrome-extension://${extensionId}/background.js`,
  )
  assert.ok(target, "Real extension service worker target must exist")
  const attached = await cdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  })
  let requestId = 0
  const waiting = new Map()
  const scripts = []
  cdp.on("Target.receivedMessageFromTarget", (event) => {
    if (event.sessionId !== attached.sessionId) return
    const msg = JSON.parse(event.message)
    if (msg.method === "Debugger.scriptParsed") scripts.push(msg.params)
    if (msg.id && waiting.has(msg.id)) {
      const complete = waiting.get(msg.id)
      waiting.delete(msg.id)
      if (msg.error) complete.reject(new Error(JSON.stringify(msg.error)))
      else complete.resolve(msg.result)
    }
  })
  async function command(method, params = {}) {
    const id = ++requestId
    const result = new Promise((done, reject) => waiting.set(id, { resolve: done, reject }))
    await cdp.send("Target.sendMessageToTarget", {
      sessionId: attached.sessionId,
      message: JSON.stringify({ id, method, params }),
    })
    return result
  }
  try {
    await command("Debugger.enable")
    const script = await until(
      () => scripts.find((item) => item.url === target.url),
      "actual loaded background Debugger source",
      10000,
    )
    const actual = await command("Debugger.getScriptSource", { scriptId: script.scriptId })
    const sourceHash = hash(actual.scriptSource)
    const diskHash = hash(readFileSync(join(extensionPath, "background.js")))
    return {
      manifestVersion: manifest.version,
      manifestVersionName: manifest.version_name,
      workerUrl: target.url,
      actualLoadedBackgroundSha256: sourceHash,
      currentDiskBackgroundSha256: diskHash,
      loadedMatchesCurrentDisk: sourceHash === diskHash,
      sourceMethod: "CDP Debugger.getScriptSource attached to actual service_worker target",
    }
  } finally {
    await cdp.send("Target.detachFromTarget", { sessionId: attached.sessionId })
    await cdp.detach()
  }
}
async function registerCurrentBundle() {
  const before = await inspectLoadedPackage()
  const cdp = await context.browser().newBrowserCDPSession()
  let result
  try {
    result = await cdp.send("Extensions.loadUnpacked", { path: extensionPath })
    assert.equal(result.id, extensionId)
  } finally {
    await cdp.detach()
  }
  await close()
  const coldStart = await launch()
  const after = await inspectLoadedPackage()
  assert.equal(
    after.loadedMatchesCurrentDisk,
    true,
    "Explicit package registration must load the actual current disk background",
  )
  return {
    action:
      "CDP Extensions.loadUnpacked with --enable-unsafe-extension-debugging then full browser cold restart",
    before,
    result,
    coldStart,
    after,
  }
}
async function close() {
  if (context) {
    await context.close()
    context = undefined
    bridge = undefined
  }
}
async function state() {
  return bridge.evaluate(
    async ({ key, backupId }) => {
      const keys = [
        "config",
        key,
        "backup_ids",
        "rollbackIsolationMarker",
        "forkConfig",
        "forkSession",
      ]
      if (backupId) keys.push(backupId, `${backupId}$`)
      return chrome.storage.local.get(keys)
    },
    { key: metaKey, backupId: oldBackupId },
  )
}
function safeState(value) {
  return {
    meta: value[metaKey],
    mode: value.config?.pageTranslation?.mode,
    translateTitle: value.config?.pageTranslation?.page?.translateTitle,
    providerId: value.config?.pageTranslation?.providerId,
    providers: value.config?.providersConfig?.map((p) => ({
      id: p.id,
      provider: p.provider,
      keyPresent: !!p.apiKey,
    })),
    customAction: value.config?.selectionToolbar?.customActions?.find(
      (a) => a.id === "rollback-user-action",
    ),
    siteControl: value.config?.siteControl,
    disabledPatterns: value.config?.selectionToolbar?.disabledSelectionToolbarPatterns,
    backupIds: value.backup_ids,
    oldBackup: value[oldBackupId]
      ? {
          schemaVersion: value[oldBackupId].schemaVersion,
          sha256: hash(JSON.stringify(value[oldBackupId])),
        }
      : null,
    independentMarker: value.rollbackIsolationMarker,
    hasSession: value.forkSession !== undefined && value.forkSession !== null,
  }
}
function assertPreserved(value, schema) {
  assert.equal(value[metaKey]?.schemaVersion, schema)
  assert.equal(value.config.pageTranslation.providerId, "renyimiao-rollback-local")
  assert.equal(value.config.pageTranslation.mode, "translationOnly")
  assert.ok(
    value.config.selectionToolbar.customActions.some(
      (a) => a.id === "rollback-user-action" && a.name === "Rollback user action",
    ),
  )
  assert.deepEqual(value.rollbackIsolationMarker, {
    test: "real-old-new-old",
    containsToken: false,
  })
  assert.equal(value.forkSession === undefined || value.forkSession === null, true)
  if (oldBackupId) assert.deepEqual(value[oldBackupId], oldBackup)
}
async function message(type, data) {
  const raw = await bridge.evaluate(
    async ({ type: messageType, data: messageData }) =>
      chrome.runtime.sendMessage({
        id: Math.floor(Math.random() * 1e8),
        type: messageType,
        data: messageData,
        timestamp: Date.now(),
      }),
    { type, data },
  )
  if (raw?.err) {
    const error = new Error(raw.err.message ?? JSON.stringify(raw.err))
    error.details = raw.err
    throw error
  }
  assert.ok(raw && typeof raw === "object", "Background gave no response")
  return raw.res
}
async function databases() {
  return bridge.evaluate(async () => {
    const result = []
    for (const entry of await indexedDB.databases()) {
      if (!entry.name) continue
      const details = await new Promise((done, reject) => {
        const req = indexedDB.open(entry.name)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const value = {
            name: db.name,
            version: db.version,
            stores: Array.from(db.objectStoreNames),
          }
          db.close()
          done(value)
        }
      })
      result.push(details)
    }
    return result
  })
}
async function actualTranslation(label) {
  const value = await state()
  const provider = value.config.providersConfig.find((p) => p.id === "renyimiao-rollback-local")
  assert.ok(provider)
  const before = localCalls.length
  const cacheKey = `rollback-${label}-${randomUUID()}`
  const data = {
    text: `Rollback verification ${label}`,
    langConfig: { ...value.config.language, sourceCode: "eng", targetCode: "cmn" },
    providerRef: { kind: "local", config: provider },
    hash: cacheKey,
    scheduleAt: Date.now(),
    textFormat: "plain",
    hostedFeature: "pageTranslation",
  }
  translationRequests.set(label, data)
  const first = await message("enqueueTranslateRequest", data)
  assert.equal(first, "回退验证成功")
  assert.equal(
    localCalls.length,
    before + 1,
    "Actual transport must reach controlled localhost once",
  )
  const again = await message("enqueueTranslateRequest", { ...data, scheduleAt: Date.now() })
  assert.equal(again, first)
  assert.equal(localCalls.length, before + 1, "Repeat must hit real persistent background cache")
  return {
    result: first,
    cacheRepeat: again,
    localModelCalls: localCalls.length - before,
    cacheKey,
  }
}
async function cacheKeys() {
  return bridge.evaluate(async () => {
    const entry = (await indexedDB.databases()).find((item) => item.name === "TranslateBuffDB")
    if (!entry) return []
    return new Promise((done, reject) => {
      const request = indexedDB.open(entry.name)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction("translationCache", "readonly")
        const keys = transaction.objectStore("translationCache").getAllKeys()
        keys.onerror = () => reject(keys.error)
        keys.onsuccess = () => {
          const result = keys.result
          db.close()
          done(result)
        }
      }
    })
  })
}
async function reuseEarlierCache(label) {
  const data = translationRequests.get(label)
  assert.ok(data)
  const before = localCalls.length
  assert.equal(
    await message("enqueueTranslateRequest", { ...data, scheduleAt: Date.now() }),
    "回退验证成功",
  )
  assert.equal(localCalls.length, before)
  return { cacheKey: data.hash, transportCalls: 0 }
}
async function popupShot(name) {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  await until(async () => {
    const body = await page.locator("body").innerText()
    return body.length > 30 && /任译喵|Renyimiao|Translate/i.test(body)
  }, "popup rendered")
  await pause(700)
  const screenshot = await shot(page, name)
  const text = await page.locator("body").innerText()
  await page.close()
  return { screenshot, text }
}

try {
  ;({ chromium } = await import(pathToFileURL(playwrightPath).href))
  executablePath = chromium.executablePath()
  assert.ok(existsSync(executablePath))
  report.identity.executablePath = executablePath
  server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      })
      res.end()
      return
    }
    const body = Buffer.concat(chunks).toString()
    let input
    try {
      input = JSON.parse(body)
    } catch {
      input = {}
    }
    localCalls.push({ phase: activePhase, method: req.method, path: req.url, body: input })
    const structured = JSON.stringify(input).includes("t0")
    const content = structured ? JSON.stringify({ t0: "回退验证成功" }) : "回退验证成功"
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" })
    res.end(
      JSON.stringify({
        id: "rollback-local",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "rollback-test-model",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    )
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  serverPort = server.address().port
  report.identity.controlledLocalProvider = `http://127.0.0.1:${serverPort}/v1`
  await stage("real-old-package-schema100-seed-and-cold-start", async () => {
    assert.equal(swapArtifact(build.artifactPath), oldDigest.treeSha256)
    const firstStart = await launch()
    await until(
      async () => (await state())[metaKey]?.schemaVersion === 100,
      "old real schema100 startup",
    )
    const fixture = JSON.parse(
      readFileSync(join(repo, "src/fork/__tests__/fixtures/upstream-v146-config.json"), "utf8"),
    )
    assert.equal(fixture.schemaVersion, 100)
    const config = structuredClone(fixture.config)
    for (const provider of config.providersConfig) if ("apiKey" in provider) provider.apiKey = ""
    config.providersConfig.push({
      id: "renyimiao-rollback-local",
      name: "Rollback local provider",
      enabled: true,
      provider: "openai-compatible",
      apiKey: "",
      baseURL: `http://127.0.0.1:${serverPort}/v1`,
      model: { model: "use-custom-model", isCustomModel: true, customModel: "rollback-test-model" },
    })
    config.pageTranslation.providerId = "renyimiao-rollback-local"
    config.pageTranslation.mode = "translationOnly"
    delete config.pageTranslation.page.translateTitle
    config.selectionToolbar.customActions[0] = {
      ...config.selectionToolbar.customActions[0],
      id: "rollback-user-action",
      name: "Rollback user action",
      providerId: "renyimiao-rollback-local",
    }
    config.selectionToolbar.disabledSelectionToolbarPatterns = ["web.telegram.org", "discord.com"]
    config.siteControl = {
      mode: "whitelist",
      blacklistPatterns: [],
      whitelistPatterns: ["web.telegram.org", "discord.com"],
    }
    config.uiLanguage = "en"
    config.betaExperience.enabled = false
    await bridge.evaluate(
      async ({ config: seedConfig, key }) =>
        chrome.storage.local.set({
          config: seedConfig,
          [key]: { schemaVersion: 100, lastModifiedAt: Date.now() },
          rollbackIsolationMarker: { test: "real-old-new-old", containsToken: false },
          forkConfig: { schemaVersion: 1, membership: { tier: "free" } },
        }),
      { config, key: metaKey },
    )
    await close()
    const coldStart = await launch()
    await until(
      async () => (await state())[metaKey]?.schemaVersion === 100,
      "old validator accepted schema100",
    )
    const actual = await state()
    assertPreserved(actual, 100)
    assert.equal(actual.config.pageTranslation.page.translateTitle, undefined)
    return {
      firstStart,
      coldStart,
      loadedPackage: await inspectLoadedPackage(),
      actual: safeState(actual),
    }
  })
  await stage("old-real-backup-ui-and-db-v4-open", async () => {
    const popup = await popupShot("01-old-anonymous-popup")
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference/config-backup`)
    await options
      .getByRole("button", { name: "Backup now", exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
    const before = await state()
    await options.getByRole("button", { name: "Backup now", exact: true }).first().click()
    await until(async () => {
      const value = await state()
      return (value.backup_ids ?? []).length > (before.backup_ids ?? []).length
    }, "real old UI backup created")
    const after = await state()
    oldBackupId = after.backup_ids[0]
    const saved = await state()
    oldBackup = saved[oldBackupId]
    oldConfig = structuredClone(saved.config)
    oldConfigMeta = structuredClone(saved[metaKey])
    assert.equal(oldBackup.schemaVersion, 100)
    assert.deepEqual(oldBackup.config, oldConfig)
    writeFileSync(
      join(output, "actual-old-ui-backup-schema100.json"),
      `${JSON.stringify(oldBackup, null, 2)}\n`,
    )
    writeFileSync(
      join(output, "actual-old-config-metadata.json"),
      `${JSON.stringify(oldConfigMeta, null, 2)}\n`,
    )
    const ui = await shot(options, "02-old-real-schema100-backup")
    const translation = await actualTranslation("old-before-upgrade")
    const db = await databases()
    assert.ok(db.some((item) => item.version === 40 && item.stores.includes("translationCache")))
    assertPreserved(await state(), 100)
    return {
      popup,
      backup: {
        id: oldBackupId,
        schemaVersion: 100,
        sha256: hash(JSON.stringify(oldBackup)),
        metadata: saved[`${oldBackupId}$`],
        origin: "actual old options Backup now button",
      },
      db,
      translation,
      screenshot: ui,
    }
  })
  await stage("complete-owned-profile-backup-while-browser-closed", async () => {
    await close()
    cpSync(profile, snapshot, { recursive: true })
    const profileHash = digest(profile),
      snapshotHash = digest(snapshot)
    assert.equal(profileHash.treeSha256, snapshotHash.treeSha256)
    report.identity.fullProfileSnapshot = {
      createdWithBrowserCompletelyClosed: true,
      treeSha256: snapshotHash.treeSha256,
      fileCount: snapshotHash.fileCount,
      includesConfigAndIndexedDb: true,
    }
    return report.identity.fullProfileSnapshot
  })
  await stage("same-id-candidate-upgrade-100-to111-db-v6", async () => {
    assert.equal(swapArtifact(candidatePath), candidateDigest.treeSha256)
    const firstColdStart = await launch()
    const registration = await registerCurrentBundle()
    const coldStart = { firstColdStart, registration }
    await until(
      async () => (await state())[metaKey]?.schemaVersion === 111,
      "candidate real migration100 to111",
    )
    const current = await state()
    assertPreserved(current, 111)
    assert.equal(
      current.config.pageTranslation.page.translateTitle,
      true,
      "Old schema has no title preference; migration109 defaults true",
    )
    const translation = await actualTranslation("candidate-after-upgrade")
    const db = await databases()
    assert.ok(
      db.some(
        (item) =>
          item.version === 60 &&
          item.stores.includes("glossary") &&
          item.stores.includes("glossarySyncSnapshot"),
      ),
    )
    const popup = await popupShot("03-new-anonymous-popup")
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference/config-backup`)
    await options
      .locator('[data-slot="item"]')
      .filter({ hasText: /Schema version:\s*100/ })
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
    const oldCacheRetained = await reuseEarlierCache("old-before-upgrade")
    return {
      coldStart,
      actual: safeState(await state()),
      db,
      translation,
      oldCacheRetained,
      cacheKeys: await cacheKeys(),
      popup,
      screenshot: await shot(options, "04-new-keeps-actual-old-backup"),
    }
  })
  await stage("restore-explicit-old-config-and-metadata-before-package-downgrade", async () => {
    const prior = await state()
    assert.equal(prior[metaKey].schemaVersion, 111)
    assert.deepEqual(prior[oldBackupId], oldBackup)
    for (const page of context.pages()) if (page !== bridge) await page.close().catch(() => {})
    await bridge.evaluate(
      async ({ backup, key, meta }) =>
        chrome.storage.local.set({ config: backup.config, [key]: meta }),
      { backup: oldBackup, key: metaKey, meta: oldConfigMeta },
    )
    const restored = await state()
    assert.equal(restored[metaKey].schemaVersion, 100)
    assert.deepEqual(restored.config, oldBackup.config)
    await close()
    return {
      method:
        "explicit manual restore of the actual old UI backup config plus its captured schema100 storage metadata; candidate UI import would migrate forward",
      backupId: oldBackupId,
      restoredConfigSha256: hash(JSON.stringify(oldBackup.config)),
      metadata: oldConfigMeta,
    }
  })
  const direct = await stage(
    "config-only-real-old-package-downgrade",
    async () => {
      assert.equal(swapArtifact(build.artifactPath), oldDigest.treeSha256)
      const initialOldActivation = await launch()
      const registration = await registerCurrentBundle()
      await bridge.evaluate(
        async ({ backup, key, meta }) =>
          chrome.storage.local.set({ config: backup.config, [key]: meta }),
        { backup: oldBackup, key: metaKey, meta: oldConfigMeta },
      )
      await close()
      const finalOldColdStart = await launch()
      const coldStart = { initialOldActivation, registration, finalOldColdStart }
      await until(
        async () => (await state())[metaKey]?.schemaVersion === 100,
        "old startup kept restored100 config",
      )
      assertPreserved(await state(), 100)
      const dbBefore = await databases()
      const popup = await popupShot("05-direct-downgrade-old-popup")
      try {
        const translation = await actualTranslation("direct-old-downgrade")
        const candidateCacheRetained = await reuseEarlierCache("candidate-after-upgrade")
        const oldCacheRetained = await reuseEarlierCache("old-before-upgrade")
        const dbAfter = await databases()
        assert.deepEqual(dbAfter, dbBefore)
        return {
          coldStart,
          configRestored: true,
          finalOldBackupRestoreAfterExplicitRegistration: true,
          dbBefore,
          dbAfter,
          popup,
          cacheOperation: "PASS",
          translation,
          candidateCacheRetained,
          oldCacheRetained,
          cacheKeys: await cacheKeys(),
        }
      } catch (error) {
        report.directDowngrade = {
          status: "FAIL",
          configRestored: true,
          coldStart,
          dbBefore,
          popup,
          error: String(error.message),
          serializedError: error.details,
        }
        throw error
      }
    },
    { allowFailure: true },
  )
  report.directDowngrade ??= { status: direct.status, ...direct.details }
  save()
  await stage("restore-complete-pre-upgrade-profile-and-real-old-package", async () => {
    await close()
    rmSync(profile, { recursive: true, force: true })
    cpSync(snapshot, profile, { recursive: true })
    const restoredProfileHash = digest(profile)
    assert.equal(restoredProfileHash.treeSha256, report.identity.fullProfileSnapshot.treeSha256)
    assert.equal(swapArtifact(build.artifactPath), oldDigest.treeSha256)
    const coldStart = await launch()
    await until(
      async () => (await state())[metaKey]?.schemaVersion === 100,
      "full snapshot old100 startup",
    )
    assertPreserved(await state(), 100)
    const translation = await actualTranslation("old-after-full-profile-restore")
    const db = await databases()
    assert.ok(db.some((item) => item.version === 40 && item.stores.includes("translationCache")))
    assert.equal(
      db.some((item) => item.stores.includes("glossary")),
      false,
    )
    const popup = await popupShot("06-full-profile-restore-old-popup")
    const options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference/config-backup`)
    await options
      .locator('[data-slot="item"]')
      .filter({ hasText: /Schema version:\s*100/ })
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
    const restoredKeys = await cacheKeys()
    assert.ok(restoredKeys.includes(translationRequests.get("old-before-upgrade").hash))
    assert.equal(
      restoredKeys.includes(translationRequests.get("candidate-after-upgrade").hash),
      false,
    )
    assert.equal(restoredKeys.includes(translationRequests.get("direct-old-downgrade").hash), false)
    report.fullProfileRollback = {
      status: "PASS",
      configSchema: 100,
      dbNativeVersion: 40,
      backupId: oldBackupId,
      discardedPostUpgradeData: true,
    }
    return {
      coldStart,
      loadedPackage: await inspectLoadedPackage(),
      restoredProfileHashBeforeLaunch: restoredProfileHash.treeSha256,
      actual: safeState(await state()),
      db,
      translation,
      cacheKeys: restoredKeys,
      popup,
      screenshot: await shot(options, "07-full-profile-restore-old-options"),
    }
  })
  report.status = direct.status === "PASS" ? "PASS" : "PASS_WITH_CONFIG_ONLY_ROLLBACK_FAILURE"
} catch (error) {
  report.status = "FAIL"
  report.failure = {
    phase: activePhase,
    message: String(error.message),
    stack: String(error.stack),
  }
  process.stderr.write(`${activePhase}: ${error.message}\n`)
  process.exitCode = 1
} finally {
  await close().catch((error) => (report.cleanupError = String(error.message)))
  if (server) await new Promise((done) => server.close(done))
  rmSync(ownedRoot, { recursive: true, force: true })
  report.cleanup = {
    ownContextClosed: !context,
    ownFreshProfileAndSnapshotRemoved: !existsSync(ownedRoot),
    localServerClosed: server ? !server.listening : true,
  }
  report.localModelCalls = localCalls
  report.networkObservation = {
    source: "BrowserContext request events only",
    observedAttempts: report.network.length,
    paidLlmRemoteAttemptsObserved: report.network.filter(
      (row) =>
        !row.url.startsWith("http://127.0.0.1:") &&
        /\/chat\/completions|\/v1\/messages|\/v1\/responses/.test(row.url),
    ).length,
  }
  report.identity.candidateArtifactUnchanged =
    digest(candidatePath).treeSha256 === candidateDigest.treeSha256
  report.identity.oldArtifactUnchanged =
    digest(build.artifactPath).treeSha256 === oldDigest.treeSha256
  if (!report.identity.candidateArtifactUnchanged || !report.identity.oldArtifactUnchanged) {
    report.status = "FAIL"
    process.exitCode = 1
  }
  report.completedAt = new Date().toISOString()
  save()
  process.stdout.write(
    `${JSON.stringify({ status: report.status, report: join(output, "report.json"), directDowngrade: report.directDowngrade?.status, fullProfileRollback: report.fullProfileRollback?.status, stages: report.stages.map(({ name, status }) => ({ name, status })), cleanup: report.cleanup }, null, 2)}\n`,
  )
}
