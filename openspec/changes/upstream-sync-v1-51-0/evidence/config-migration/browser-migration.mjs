import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../../../../..")
const candidate = "5ac5122a6a4d390b3131f917dd09aa2caf5f5342"
const extensionPath = join(repo, ".output/chrome-mv3")
const playwrightPath =
  "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
const runId = new Date().toISOString().replaceAll(":", "-")
const output = join(here, "browser-runs", runId)
const hash = (input) => createHash("sha256").update(input).digest("hex")
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
const require = createRequire(import.meta.url)
// Resolve the installed helper, then derive the metadata suffix from its code.
const storageHelper = resolve(
  dirname(require.resolve("wxt")),
  "../../@wxt-dev/storage/dist/index.mjs",
)
const storageSource = readFileSync(storageHelper, "utf8")
const metadataSuffix = /const getMetaKey = \(key\) => key \+ "([^"]+)"/.exec(storageSource)?.[1]
assert.equal(metadataSuffix, "$", "The installed storage helper metadata mapping changed")
const metaKey = `config${metadataSuffix}`
const backupPrefix = /BACKUP_ID_PREFIX = "([^"]+)"/.exec(
  readFileSync(join(repo, "src/utils/constants/backup.ts"), "utf8"),
)?.[1]
assert.ok(backupPrefix)
const sourceFixture = join(repo, "src/fork/__tests__/fixtures/upstream-v146-config.json")
const envelope = JSON.parse(readFileSync(sourceFixture, "utf8"))
assert.equal(envelope.schemaVersion, 100)
const config = structuredClone(envelope.config)
for (const provider of config.providersConfig) {
  if ("apiKey" in provider) provider.apiKey = ""
}
const providerId = "renyimiao-browser-migration-local"
const provider = {
  id: providerId,
  name: "Migration local provider",
  enabled: true,
  provider: "openai-compatible",
  apiKey: "",
  baseURL: "http://127.0.0.1:9/v1",
  model: { model: "use-custom-model", isCustomModel: true, customModel: "migration-test-model" },
}
config.providersConfig.push(provider)
config.pageTranslation.providerId = providerId
config.pageTranslation.mode = "translationOnly"
config.pageTranslation.page.translateTitle = false
config.pageTranslation.batchQueueConfig = { maxItemsPerBatch: 16, maxCharactersPerBatch: 4000 }
config.selectionToolbar.customActions[0] = {
  ...config.selectionToolbar.customActions[0],
  id: "browser-migration-user-action",
  name: "Browser migration user action",
  providerId,
}
config.inputTranslation = {
  ...config.inputTranslation,
  providerId,
  enabled: true,
  fromLang: "sourceCode",
  toLang: "cmn",
  enableCycle: true,
  timeThreshold: 450,
}
config.selectionToolbar.disabledSelectionToolbarPatterns = ["web.telegram.org", "discord.com"]
config.siteControl = {
  mode: "whitelist",
  blacklistPatterns: [],
  whitelistPatterns: ["web.telegram.org", "discord.com"],
}
config.uiLanguage = "en"
config.betaExperience.enabled = false
const marker = { fixture: "v100-to-v111-browser", independentStorage: true, containsToken: false }
const independent = {
  forkConfig: { schemaVersion: 1, membership: { tier: "free" } },
  migrationIsolationMarker: marker,
}
const report = {
  runId,
  status: "RUNNING",
  identity: {},
  stages: [],
  network: [],
  pageErrors: [],
  limitations: [
    "Fresh-profile schema100 fixture is seeded into the candidate, then the real extension reload runs its background initializeConfig; no old package was installed.",
    "The schema100 backup is an explicitly seeded preexisting backup fixture, not an old-package automatic-backup observation.",
    "No login credential/session/token is seeded; independent no-token storage markers are checked. Authenticated membership preservation is not proved.",
    "DNS resolver rules were configured, but BrowserContext request events record remote attempts without response validation; this does not prove offline operation or zero network and is not network-isolation acceptance.",
    "Actual old-package rollback and IndexedDB compatibility with an old bundle remain pending.",
    "runtime.reload was not exercised; this runner explicitly cold-relaunches the same owned profile to restart the real background, following the parent task's reported CFT reload limitation.",
  ],
}
let context,
  profile,
  bridge,
  options,
  extensionId,
  activePhase = "startup"
let chromiumEngine, browserExecutable
const timestamps = { seededAt: Date.now() }
const backupId = `${backupPrefix}_${timestamps.seededAt}_${randomUUID()}`
const seededBackup = { schemaVersion: 100, config }

function artifactDigest(directory) {
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
  return { treeSha256: hash(JSON.stringify(rows)), files: rows }
}
function safeUrl(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return "[unparseable]"
  }
}
function save() {
  mkdirSync(output, { recursive: true })
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
async function stage(name, run) {
  activePhase = name
  const item = { name, status: "RUNNING", startedAt: new Date().toISOString() }
  report.stages.push(item)
  save()
  try {
    item.details = await run()
    item.status = "PASS"
  } catch (error) {
    item.status = "FAIL"
    item.error = String(error.message)
    throw error
  } finally {
    item.finishedAt = new Date().toISOString()
    save()
  }
  process.stdout.write(`${name}: ${item.status}\n`)
}
async function screenshot(page, name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return relative(output, path)
}
async function readState() {
  return bridge.evaluate(
    (keys) => chrome.storage.local.get(keys),
    [
      "config",
      metaKey,
      "backup_ids",
      backupId,
      `${backupId}${metadataSuffix}`,
      "forkConfig",
      "migrationIsolationMarker",
      "forkSession",
    ],
  )
}
function safeState(state) {
  const current = state.config
  return {
    metadata: state[metaKey],
    mode: current?.pageTranslation?.mode,
    providerId: current?.pageTranslation?.providerId,
    translateTitle: current?.pageTranslation?.page?.translateTitle,
    batch: current?.pageTranslation?.batchQueueConfig,
    providers: (current?.providersConfig ?? []).map((entry) => ({
      id: entry.id,
      provider: entry.provider,
      keyPresent: !!entry.apiKey,
      baseURL: entry.id === providerId ? entry.baseURL : undefined,
    })),
    userAction: current?.selectionToolbar?.customActions?.find(
      (entry) => entry.id === "browser-migration-user-action",
    ) && {
      id: "browser-migration-user-action",
      providerId: current.selectionToolbar.customActions[0].providerId,
      outputFieldIds: current.selectionToolbar.customActions[0].outputSchema.map(
        (field) => field.id,
      ),
    },
    input: current?.inputTranslation,
    siteControl: current?.siteControl,
    disabledSelectionToolbarPatterns: current?.selectionToolbar?.disabledSelectionToolbarPatterns,
    backupIds: state.backup_ids,
    oldBackupSchema: state[backupId]?.schemaVersion,
    oldBackupConfigSha256: state[backupId] ? hash(JSON.stringify(state[backupId].config)) : null,
    independent: {
      forkConfig: state.forkConfig,
      migrationIsolationMarker: state.migrationIsolationMarker,
    },
    hasSession: state.forkSession !== undefined && state.forkSession !== null,
  }
}
function assertPreserved(state) {
  const current = state.config
  assert.equal(state[metaKey]?.schemaVersion, 111)
  assert.equal(current.pageTranslation.providerId, providerId)
  assert.equal(current.pageTranslation.mode, "translationOnly")
  assert.equal(current.pageTranslation.page.translateTitle, false)
  assert.deepEqual(current.pageTranslation.batchQueueConfig, {
    maxItemsPerBatch: 16,
    maxCharactersPerBatch: 4000,
  })
  assert.deepEqual(
    current.providersConfig.find((entry) => entry.id === providerId),
    provider,
  )
  for (const original of config.providersConfig) {
    assert.ok(
      current.providersConfig.some((entry) => entry.id === original.id),
      `Provider lost: ${original.id}`,
    )
  }
  const action = current.selectionToolbar.customActions.find(
    (entry) => entry.id === "browser-migration-user-action",
  )
  assert.ok(action, "User action was lost")
  assert.equal(action.providerId, providerId)
  assert.equal(action.prompt, config.selectionToolbar.customActions[0].prompt)
  assert.equal(action.systemPrompt, config.selectionToolbar.customActions[0].systemPrompt)
  assert.deepEqual(
    action.outputSchema.map((entry) => entry.id),
    config.selectionToolbar.customActions[0].outputSchema.map((entry) => entry.id),
  )
  assert.deepEqual(current.inputTranslation, config.inputTranslation)
  assert.deepEqual(current.siteControl, {
    mode: "whitelist",
    blacklistPatterns: [],
    whitelistPatterns: ["*.web.telegram.org", "*.discord.com"],
  })
  assert.deepEqual(current.selectionToolbar.disabledSelectionToolbarPatterns, [
    "*.web.telegram.org",
    "*.discord.com",
  ])
  assert.deepEqual(state.forkConfig, independent.forkConfig)
  assert.deepEqual(state.migrationIsolationMarker, marker)
  assert.equal(
    state.forkSession === undefined || state.forkSession === null,
    true,
    "No session must be introduced",
  )
  assert.deepEqual(state[backupId], seededBackup, "The preexisting v100 backup changed")
}
async function openBridge() {
  let lastError
  for (let attempt = 0; attempt < 20; attempt++) {
    const page = await context.newPage()
    try {
      await page.goto(`chrome-extension://${extensionId}/offscreen.html`, { timeout: 5000 })
      assert.equal(await page.evaluate(() => typeof chrome.storage.local.get), "function")
      bridge = page
      return
    } catch (error) {
      lastError = error
      await page.close().catch(() => {})
      await pause(200)
    }
  }
  throw lastError
}
async function reloadExtension() {
  const closedWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith("chrome-extension:"))
  await context.close()
  const worker = await launchOwnContext()
  assert.equal(new URL(worker.url()).hostname, extensionId)
  await openBridge()
  await until(
    async () => (await readState())[metaKey]?.schemaVersion === 111,
    "real background schema111",
  )
  return {
    method: "full-browser-cold-relaunch-same-owned-profile",
    previousWorkerUrl: closedWorker?.url(),
    newWorkerUrl: worker.url(),
  }
}
async function setDifferentCurrentConfig() {
  await bridge.evaluate(async () => {
    const { config: activeConfig } = await chrome.storage.local.get("config")
    activeConfig.pageTranslation.mode = "bilingual"
    activeConfig.pageTranslation.page.translateTitle = true
    await chrome.storage.local.set({ config: activeConfig })
  })
  await until(
    async () => (await readState()).config?.pageTranslation?.mode === "bilingual",
    "control config change",
  )
}

async function launchOwnContext() {
  context = await chromiumEngine.launchPersistentContext(profile, {
    executablePath: browserExecutable,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
    ],
  })
  report.identity.browserVersion = context.browser().version()
  report.identity.contextStartCount = (report.identity.contextStartCount ?? 0) + 1
  assert.match(report.identity.browserVersion, /^151\./)
  context.on("request", (request) => {
    if (/^https?:/.test(request.url()))
      report.network.push({
        phase: activePhase,
        method: request.method(),
        url: safeUrl(request.url()),
      })
  })
  context.on("page", (page) =>
    page.on("pageerror", (error) => {
      report.pageErrors.push({ phase: activePhase, message: String(error.message).slice(0, 500) })
    }),
  )
  return (
    context.serviceWorkers().find((item) => item.url().startsWith("chrome-extension:")) ??
    context.waitForEvent("serviceworker", { timeout: 30000 })
  )
}

try {
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
    candidate,
  )
  const manifest = JSON.parse(readFileSync(join(extensionPath, "manifest.json"), "utf8"))
  const { chromium } = await import(pathToFileURL(playwrightPath).href)
  const executablePath = chromium.executablePath()
  chromiumEngine = chromium
  browserExecutable = executablePath
  assert.ok(existsSync(executablePath))
  mkdirSync(output, { recursive: true })
  report.identity = {
    candidateSha: candidate,
    targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
    extensionPath,
    manifest: {
      name: manifest.name,
      version: manifest.version,
      versionName: manifest.version_name,
      background: manifest.background,
    },
    manifestSha256: hash(readFileSync(join(extensionPath, "manifest.json"))),
    artifactBefore: artifactDigest(extensionPath),
    executablePath,
    sourceFixtureSha256: hash(readFileSync(sourceFixture)),
    sourceFixture: relative(repo, sourceFixture),
    metadataMapping: {
      source: storageHelper,
      sourceSha256: hash(storageSource),
      metaKey,
      rule: "getMetaKey(driverKey) => driverKey + suffix read from installed helper",
    },
    freshProfile: true,
    noUserProfileOrCredentialsRead: true,
  }
  writeFileSync(
    join(output, "seeded-v100-config.json"),
    `${JSON.stringify(seededBackup, null, 2)}\n`,
  )
  profile = mkdtempSync(join(tmpdir(), "translatebuff-migration-browser-"))
  const worker = await launchOwnContext()
  extensionId = new URL(worker.url()).hostname
  report.identity.extensionId = extensionId
  await openBridge()
  await until(
    async () => (await readState())[metaKey]?.schemaVersion === 111,
    "initial candidate startup",
  )

  await stage("seed-v100-and-preexisting-backup", async () => {
    for (const page of context.pages()) if (page !== bridge) await page.close().catch(() => {})
    await bridge.evaluate((seedStorage) => chrome.storage.local.set(seedStorage), {
      config,
      [metaKey]: { schemaVersion: 100, lastModifiedAt: timestamps.seededAt },
      backup_ids: [backupId],
      [backupId]: seededBackup,
      [`${backupId}${metadataSuffix}`]: {
        createdAt: timestamps.seededAt,
        extensionVersion: "fixture-from-4be99b34",
      },
      ...independent,
    })
    const before = await readState()
    assert.equal(before[metaKey]?.schemaVersion, 100)
    assert.deepEqual(before.config, config)
    assert.deepEqual(before[backupId], seededBackup)
    assert.equal(before.forkSession === undefined || before.forkSession === null, true)
    report.seededBackup = {
      id: backupId,
      origin: "seeded preexisting backup fixture",
      schemaVersion: 100,
    }
    return safeState(before)
  })
  await stage("reload-real-background-migrates-100-to-111", async () => {
    const workers = await reloadExtension()
    const actual = await readState()
    assertPreserved(actual)
    assert.equal(actual[metaKey].lastModifiedAt, timestamps.seededAt)
    return { workers, actual: safeState(actual) }
  })
  await stage("real-options-import-ui-restores-v100-envelope-as-v111", async () => {
    options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference`)
    await options.locator("#import-config-file").waitFor({ state: "attached", timeout: 30000 })
    const initialScreenshot = await screenshot(options, "01-after-upgrade-preferences")
    await setDifferentCurrentConfig()
    await options
      .locator("#import-config-file")
      .setInputFiles(join(output, "seeded-v100-config.json"))
    await options
      .getByText("Config imported successfully", { exact: true })
      .waitFor({ timeout: 30000 })
    await until(
      async () => (await readState()).config?.pageTranslation?.mode === "translationOnly",
      "UI imported mode",
    )
    const actual = await readState()
    assertPreserved(actual)
    assert.ok(actual.backup_ids.length >= 2, "UI import must back up the different current config")
    return {
      screenshots: [initialScreenshot, await screenshot(options, "02-import-success")],
      actual: safeState(actual),
      fileInputId: "import-config-file",
      importSuccessToastObserved: true,
    }
  })
  await stage("real-options-schema100-backup-restore-ui", async () => {
    await setDifferentCurrentConfig()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference/config-backup`)
    const card = options
      .locator('[data-slot="item"]')
      .filter({ hasText: /Schema version:\s*100/ })
      .first()
    await card.waitFor({ state: "visible", timeout: 30000 })
    const beforeScreenshot = await screenshot(options, "03-schema100-backup-visible")
    await card.getByRole("button", { name: "Restore", exact: true }).click()
    const dialog = options.getByRole("alertdialog")
    await dialog.waitFor({ state: "visible" })
    const dialogScreenshot = await screenshot(options, "04-restore-confirmation")
    await dialog.getByRole("button", { name: "Restore", exact: true }).click()
    await options
      .getByText("Config restored successfully", { exact: true })
      .waitFor({ timeout: 30000 })
    await until(
      async () => (await readState()).config?.pageTranslation?.mode === "translationOnly",
      "UI restored mode",
    )
    const actual = await readState()
    assertPreserved(actual)
    return {
      screenshots: [
        beforeScreenshot,
        dialogScreenshot,
        await screenshot(options, "05-restore-success"),
      ],
      actual: safeState(actual),
      restoreSuccessToastObserved: true,
    }
  })
  await stage("second-extension-reload-keeps-v111-and-options-usable", async () => {
    const workers = await reloadExtension()
    const actual = await readState()
    assertPreserved(actual)
    options = await context.newPage()
    await options.goto(`chrome-extension://${extensionId}/options.html#/preference/config-backup`)
    await options
      .getByText("Config backup", { exact: true })
      .last()
      .waitFor({ state: "visible", timeout: 30000 })
    assert.ok((await options.locator("body").innerText()).includes("Schema version: 100"))
    return {
      workers,
      actual: safeState(actual),
      screenshot: await screenshot(options, "06-after-second-reload"),
    }
  })
  report.status = "PASS"
} catch (error) {
  report.status = "FAIL"
  report.failure = {
    phase: activePhase,
    message: String(error.message),
    stack: String(error.stack),
  }
  if (options && !options.isClosed())
    report.failure.screenshot = await screenshot(options, "failure").catch(() => null)
  process.stderr.write(`${activePhase}: ${error.message}\n`)
  process.exitCode = 1
} finally {
  if (context) {
    try {
      await context.close()
    } catch (error) {
      report.cleanupError = String(error.message)
    }
  }
  if (profile) rmSync(profile, { recursive: true, force: true })
  report.cleanup = {
    ownContextClosed: !!context,
    ownFreshProfileRemoved: profile ? !existsSync(profile) : true,
  }
  report.networkObservation = {
    source: "Playwright BrowserContext request events; not an all-target CDP audit",
    responseValidation: false,
    requestAttempts: report.network.length,
    controlledLocalProviderAttempts: report.network.filter((entry) =>
      entry.url.startsWith("http://127.0.0.1:9/"),
    ).length,
    paidLlmEndpointAttemptsObserved: report.network.filter((entry) =>
      /\/chat\/completions|\/v1\/messages|\/v1\/responses/.test(entry.url),
    ).length,
    interpretation:
      "Only observed attempts are counted. No credentials or translation action were supplied; migration PASS makes no claim about complete business/network isolation.",
  }
  if (existsSync(extensionPath)) {
    report.identity.artifactAfter = artifactDigest(extensionPath)
    report.identity.artifactUnchanged =
      report.identity.artifactBefore?.treeSha256 === report.identity.artifactAfter.treeSha256
    if (!report.identity.artifactUnchanged) {
      report.status = "FAIL"
      process.exitCode = 1
    }
  }
  report.completedAt = new Date().toISOString()
  save()
  process.stdout.write(
    `${JSON.stringify(
      {
        status: report.status,
        report: join(output, "report.json"),
        stages: report.stages.map(({ name, status }) => ({ name, status })),
        cleanup: report.cleanup,
      },
      null,
      2,
    )}\n`,
  )
}
