import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  createEditor,
} from "lexical"
import React, { useLayoutEffect, useState } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"

const api = {
  kind: document.documentElement.dataset.framework,
  versions: { react: React.version, lexical: globalThis.__LEXICAL_PACKAGE_VERSION__ },
  errors: [],
  commits: 0,
  ready: false,
}
window.__frameworkFixture = api

function articleHtml(scenario, revision) {
  // React 19.3 skips assigning equal __html strings. An inert attribute forces the real
  // innerHTML setter without changing the text/tag structure that carry is meant to match.
  if (scenario === "pending") {
    return `<p id="react-copy" data-html-revision="${revision}">FRAME_PENDING_CANARY is an unfinished paragraph whose identical React rewrite must not carry a pending translation node.</p>`
  }
  const word =
    scenario === "structure"
      ? "<strong>linked concept</strong>"
      : '<a href="/first">linked concept</a>'
  return `<p id="react-copy" data-html-revision="${revision}">FRAME_COMPLETE_CANARY explains the ${word} in a complete paragraph used to verify actual React rewriting.</p>`
}

function ReactArticle() {
  const [renderState, setRenderState] = useState({ revision: 0, scenario: "complete" })
  useLayoutEffect(() => {
    api.rewriteReact = (scenario = renderState.scenario) => {
      flushSync(() => setRenderState((previous) => ({ revision: previous.revision + 1, scenario })))
    }
    api.commits++
    api.ready = true
  })
  return (
    <div
      id="react-article"
      data-render-revision={renderState.revision}
      dangerouslySetInnerHTML={{ __html: articleHtml(renderState.scenario, renderState.revision) }}
    />
  )
}

function startLexical() {
  const mount = document.getElementById("fixture-root")
  mount.innerHTML =
    '<p class="notranslate">Controlled Reddit URL with real Lexical editors. No Reddit account or remote document is used.</p><div id="other-editor"></div><div id="reply-host"></div>'
  const shadow = document.getElementById("reply-host").attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent =
    "#reply-editor{font:18px/1.6 system-ui;white-space:pre-wrap;min-height:100px;border:2px solid #64748b;padding:14px;outline:none}p{margin:0}"
  shadow.append(style)
  const target = document.createElement("div")
  target.id = "reply-editor"
  shadow.append(target)
  function editorAt(element, namespace, initialText) {
    element.contentEditable = "true"
    element.setAttribute("data-lexical-editor", "true")
    element.setAttribute("role", "textbox")
    element.setAttribute("aria-label", namespace)
    element.style.whiteSpace = "pre-wrap"
    const editor = createEditor({
      namespace,
      onError(error) {
        api.errors.push(error.message)
      },
    })
    editor.setRootElement(element)
    // A small plain-text plugin using the real Lexical command/selection APIs.
    // It supports trusted browser typing; translation replacement uses the extension's own MAIN injector.
    editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        const selection = $getSelection()
        const text = typeof payload === "string" ? payload : payload.data
        if (!$isRangeSelection(selection) || typeof text !== "string") return false
        selection.insertText(text)
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
    const write = (text) =>
      editor.update(
        () => {
          $getRoot()
            .clear()
            .append($createParagraphNode().append($createTextNode(text)))
            .selectEnd()
        },
        { discrete: true },
      )
    write(initialText)
    const read = () => editor.getEditorState().read(() => $getRoot().getTextContent())
    return { editor, write, read }
  }
  const other = editorAt(
    document.getElementById("other-editor"),
    "Other controlled reply",
    "Other reply must stay untouched.",
  )
  const reply = editorAt(
    target,
    "Controlled deep reply",
    "  Original reply preserves its leading and trailing spaces.  ",
  )
  api.lexical = {
    read: () => ({
      target: reply.read(),
      other: other.read(),
      deepFocused: document.activeElement === shadow.host && shadow.activeElement === target,
      pageBridge: Boolean(window.__READ_FROG_INPUT_INJECTOR__),
      hasRealEditor: target.__lexicalEditor === reply.editor,
    }),
    write: (text) => reply.write(text),
    focusEnd: () => {
      target.focus()
      reply.editor.update(() => $getRoot().selectEnd(), { discrete: true })
    },
  }
  api.ready = true
}

if (api.kind === "react")
  createRoot(document.getElementById("fixture-root")).render(<ReactArticle />)
else if (api.kind === "lexical") startLexical()
else api.errors.push(`Unknown controlled fixture: ${api.kind}`)
