import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const phase = process.argv[2]
assert.ok(["before", "after"].includes(phase))
const root = dirname(fileURLToPath(import.meta.url))
const record = JSON.parse(readFileSync(resolve(root, `browser-${phase}.json`), "utf8"))
let cases = 0
for (const theme of [
  "light",
  "dark",
  ...(phase === "after" ? ["sharedLight", "sharedDark"] : []),
]) {
  const switches = record[theme].result.value
  for (const size of ["default", "sm"]) {
    for (const state of ["enabled", "disabled"]) {
      const on = switches.find((item) => item.name === `${size}-${state}-on`)
      const off = switches.find((item) => item.name === `${size}-${state}-off`)
      assert.equal(on.checked, "true")
      assert.equal(off.checked, "false")
      assert.notEqual(
        on.track,
        "rgba(0, 0, 0, 0)",
        `${theme}/${size}/${state}: on track is transparent`,
      )
      assert.notEqual(
        on.track,
        off.track,
        `${theme}/${size}/${state}: tracks must distinguish state`,
      )
      assert.ok(on.thumbX - off.thumbX >= 8, `${theme}/${size}/${state}: on thumb must move right`)
      for (const item of [on, off]) {
        assert.ok(item.thumbX >= 0 && item.thumbX + item.thumbWidth <= item.width + 0.1)
        assert.ok(item.thumbY >= 0 && item.thumbY + item.thumbHeight <= item.height + 0.1)
        assert.equal(item.opacity, state === "disabled" ? "0.5" : "1")
      }
      cases++
    }
  }
}
if (phase === "after") {
  assert.equal(record.smClick, "true")
  assert.equal(record.smKey, "false")
  assert.equal(record.disabledAfterClick, "true")
  assert.equal(record.dragFinal, "true")
  assert.deepEqual(
    record.dragEvents.filter((item) => item.kind === "change").map((item) => item.next),
    [true],
  )
  const midpoint = record.dragMid.result.value.find((item) => item.name === "default-enabled-off")
  assert.ok(midpoint.thumbX > 2 && midpoint.thumbX < 22, "drag must have an intermediate position")
}
console.log(
  JSON.stringify({
    phase,
    statePairs: cases,
    status: "PASS",
    scope: "real isolated component fixture; not actual extension settings UI",
  }),
)
