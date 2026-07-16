import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stateDir = path.join(rootDir, ".wxt")
const pidFile = path.join(stateDir, "ui-preview.pid")
const wxtCli = path.join(rootDir, "node_modules", "wxt", "bin", "wxt.mjs")

mkdirSync(stateDir, { recursive: true })

if (existsSync(pidFile)) {
  const existingPid = Number.parseInt(readFileSync(pidFile, "utf8"), 10)
  try {
    process.kill(existingPid, 0)
    process.exit(0)
  } catch {
    rmSync(pidFile, { force: true })
  }
}

writeFileSync(pidFile, String(process.pid))
process.on("exit", () => {
  try {
    if (readFileSync(pidFile, "utf8") === String(process.pid)) rmSync(pidFile, { force: true })
  } catch {
    // The PID file may already have been removed.
  }
})

const child = spawn(process.execPath, [wxtCli], {
  cwd: rootDir,
  env: {
    ...process.env,
    // Small debounce avoids rebuilding the same save event twice while still
    // keeping UI feedback effectively immediate.
    WXT_WATCH_DEBOUNCE: "250",
  },
  stdio: "inherit",
})

child.on("error", (error) => {
  console.error("无法启动 UI 快速预览：", error)
  process.exitCode = 1
})

child.on("exit", (code) => {
  process.exitCode = code ?? 1
})
