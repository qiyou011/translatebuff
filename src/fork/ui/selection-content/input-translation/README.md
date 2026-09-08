# Fork input translation

This directory owns TranslateBuff's input-translation orchestration, chat-context
language selection, inline bar, editor theme and menu event boundary.

- `../App.tsx` mounts this hook exactly once. Do not also mount the upstream hook.
- Keep translation engines, configuration, provider resolution and the input
  replacement message protocol upstream; do not fork their implementations here.
- `InputTranslationLanguageSelect` owns only the special upward themed portal.
  Language data/filtering and unchanged list/input/item primitives remain shared.
- `__tests__/upstream-drift.test.ts` pins four reviewed upstream files at
  read-frog `02ad422c1e1260960e141e4012a20d93e85082aa` (1.46.6). If it fails after
  an upstream merge, inspect the diff, port relevant fixes, run tests and browser
  checks, then update the reviewed hashes. Never auto-refresh hashes to silence it.
- Test the fork files directly: WXT redirects are not used by this module.

Run `SKIP_FREE_API=true pnpm exec vitest run src/fork/ui/selection-content/input-translation`.
After syncing upstream also verify the real editor: three spaces, search/paste,
menu keyboard selection, blur/refocus, Escape, original-text retranslation and
undo after editing. Do not send test messages to public channels.
