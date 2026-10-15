import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const phase = process.argv[2]
assert.ok(["before", "after"].includes(phase))
const root = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(root, `ui-theme-${phase}.json`), "utf8"))
function luminance(color) {
  const channels = color
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map(Number)
    .map((value) => {
      const linear = value / 255
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4
    })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((left, right) => right - left)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const light = data.light.result.value
const dark = data.dark.result.value
const ratios = {
  lightButton: contrast(light.button.color, light.button.background),
  lightWarning: contrast(light.warning.color, light.warning.background),
  darkWarning: contrast(dark.warning.color, dark.warning.background),
}
for (const [name, ratio] of Object.entries(ratios)) {
  assert.ok(ratio >= 4.5, `${name} readability target failed: ${ratio.toFixed(3)}`)
}
const wide = data.wide.result.value
assert.ok(wide.dialog.width >= 1000, "wide editor must not be constrained to a regular dialog")
assert.ok(
  wide.previewScroll.scrollWidth <= wide.previewScroll.clientWidth + 1,
  "500px desktop preview must fit its pane",
)
for (const button of wide.smallButtons) {
  assert.ok(
    button.width < 100 && button.height <= 28,
    "segmented preview controls must stay compact",
  )
}
if (phase === "after") {
  const read = (name) => JSON.parse(readFileSync(resolve(root, name), "utf8"))
  const composed = read("ui-composed-buttons-after.json")
  for (const theme of ["light", "dark"]) {
    assert.equal(composed[theme].result.value.length, 3)
    for (const button of composed[theme].result.value) {
      assert.ok(contrast(button.color, button.background) >= 4.5, `${theme} ${button.slot}`)
    }
  }
  const interactions = read("ui-interactions-after.json")
  for (const theme of ["light", "dark"]) {
    const states = interactions[theme].result.value
    for (const key of [
      "switchChecked",
      "checkboxChecked",
      "radioBetaChecked",
      "tabSecondSelected",
    ]) {
      assert.equal(states[key], "true", `${theme} ${key}`)
    }
    assert.ok(states.model.startsWith("Beta model"))
    assert.ok(states.focusedVisible)
    assert.notEqual(states.focusedShadow, "none")
    assert.deepEqual(states.ordinaryButton, { width: 132, height: 40 })
  }
  assert.ok(Object.values(interactions.disabledEnabledChecks).every((value) => value === false))
  assert.equal(interactions.disabledModelEnabled, false)
  assert.equal(interactions.regularDialog.result.value.width, 640)
  assert.notEqual(interactions.lightPopoverDismissAfterSettled, "true")
  const responsive = read("ui-responsive-after.json")
  for (const theme of ["narrow", "narrowDark"]) {
    const value = responsive[theme].result.value
    assert.ok(value.mainScrollWidth <= value.main.width + 1)
    assert.ok(value.editorInput.width > 300)
  }
  const narrow = responsive.narrowDialog.result.value
  assert.ok(narrow.dialog.width <= narrow.viewport.width - 31)
  assert.ok(narrow.dialog.y >= 0)
  assert.ok(narrow.dialog.y + narrow.dialog.height <= narrow.viewport.height + 1)
  const smallDesktop = responsive.smallDesktopDialogStable.result.value
  assert.equal(smallDesktop.dialog.width, 1068)
  assert.ok(smallDesktop.previewScroll.scrollWidth > smallDesktop.previewScroll.clientWidth)
}
console.log(JSON.stringify({ phase, status: "PASS", ratios, wideDialogWidth: wide.dialog.width }))
