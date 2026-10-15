// Controlled local documents. These are never evidence of a live third-party site.
const style = `body{font:18px/1.6 system-ui;margin:32px;max-width:920px;color:#17212b;background:white}p{margin:20px 0}button{font:inherit}input,textarea{font:inherit;display:block;width:680px;margin:18px 0}iframe{width:800px;height:180px;border:1px solid #aaa}.notranslate{color:#64748b}`

export function documentHtml(title, body, script = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${style}</style></head><body>${body}<script>${script}</script></body></html>`
}

export function fixture(pathname) {
  if (pathname === "/frame")
    return documentHtml(
      "Same origin frame",
      '<p id="frame-text">Select this ordinary sentence inside the frame to open the translation toolbar.</p>',
    )
  if (pathname === "/iframe")
    return documentHtml(
      "Frame fixture",
      '<h1>Frame permission fixture</h1><iframe id="allowed" src="/frame"></iframe><iframe id="opaque" sandbox="allow-scripts" src="/frame?opaque=1"></iframe>',
    )
  if (pathname === "/privacy")
    return documentHtml(
      "Input privacy fixture",
      `
    <p class="notranslate">Only deterministic fixture text is entered below.</p>
    <label>Ordinary text<input id="ordinary" data-field="ordinary" value="Selected ordinary sentence. PUBLIC_CONTEXT_CANARY belongs to this text input."></label>
    <label>Search<input id="search" data-field="search" type="search" value="Selected search sentence. PUBLIC_SEARCH_CANARY belongs to this search input."></label>
    <label>Textarea<textarea id="paragraphs" data-field="paragraphs">Unrelated first paragraph.

Selected textarea sentence. PUBLIC_PARAGRAPH_CANARY is in this paragraph.

Unrelated final paragraph.</textarea></label>
    <label>Email<input id="email" data-field="email" type="email" value="PRIVATE_EMAIL_CANARY@example.invalid"></label>
    <label>Phone<input id="tel" data-field="tel" type="tel" value="PRIVATE_PHONE_CANARY"></label>
    <label>Password<input id="password" data-field="password" type="password" value="PRIVATE_PASSWORD_CANARY"></label>
    <label>One time code<input id="otp" data-field="otp" autocomplete="one-time-code" value="PRIVATE_OTP_CANARY"></label>
    <label>Payment<input id="payment" data-field="payment" autocomplete="cc-number" value="PRIVATE_PAYMENT_CANARY"></label>
  `,
    )
  if (pathname === "/glossary")
    return documentHtml(
      "Glossary fixture",
      '<main><p id="term">The QuantumWidget uses StableToken during an ordinary controlled translation.</p></main>',
    )
  if (pathname === "/site/wikipedia")
    return documentHtml(
      "Wikipedia controlled fixture",
      '<main id="mw-content-text"><h2 id="short">Cat</h2><p id="long">This longer paragraph remains eligible when the global minimum character threshold is increased.</p></main>',
    )
  if (pathname === "/site/ar5iv")
    return documentHtml(
      "Paper controlled fixture",
      '<main class="ltx_document"><p id="inline">The first <code class="ltx_verbatim">foo()</code> and second <code class="ltx_verbatim">foo()</code> identifiers must remain intact in this scientific paragraph.</p><pre id="code-only"><code class="ltx_verbatim">const untouchedCode = 42;</code></pre></main>',
    )
  if (pathname === "/site/kaggle")
    return documentHtml(
      "Kaggle controlled fixture",
      '<main><div class="learnGuide"><p id="guide">The mathematical expression <span class="katex" data-fixture-formula="true"><math><mi>x</mi><mo>+</mo><mn>1</mn></math></span> must remain visible after this guide paragraph is translated.</p></div><p id="outside">Outside guide content keeps ordinary layout.</p></main>',
    )
  return documentHtml(
    "Controlled translation title",
    `
    <main><h1>Browser extension regression fixture</h1>
    <p id="normal">A complete English paragraph verifies the actual installed extension and the controlled local provider.</p>
    <p id="dynamic">This original dynamic paragraph will gain a temporary inline wrapper after translation.</p>
    <sub style="line-height:0;display:block;width:180px"><p id="footnote" style="width:180px;line-height:0">A long footnote paragraph needs several visible translated lines with a normal line height instead of overlapping content.</p></sub>
    <p id="body-marker">The replacement document must keep the extension selection host and its mounted controls alive.</p>
    <button id="page-control" class="notranslate">Page control</button><output id="page-clicks" class="notranslate">0</output></main>
  `,
    'document.querySelector("#page-control").onclick=()=>document.querySelector("#page-clicks").textContent=String(Number(document.querySelector("#page-clicks").textContent)+1)',
  )
}
