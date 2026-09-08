---
"@read-frog/extension": patch
---

fix(input-translation): keep translated drafts undoable until the interaction actually ends

Editing a translated draft now keeps the inline correction bar and its original-text snapshot. A true focus exit temporarily hides the bar, and returning to the original input restores it; a confirmed send, Escape, or undo permanently ends the session. An open language menu consumes the first Escape itself, while same-language notices remain one-shot feedback.
