---
"@read-frog/extension": patch
---

fix(input-translation): match the inline correction bar and language menu to the editor theme

Use isolated, opaque light/dark palettes with readable labels and keyboard focus. Keep the upward language menu inside the same theme and interaction boundary, constrain it to the viewport, and preserve search, focus, and the original draft when the page theme changes.
