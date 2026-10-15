// @vitest-environment jsdom

import type { Mock } from "vitest"
import { beforeEach, expect, it, vi } from "vitest"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PageTranslationManager } from "../page-translation"

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: vi.fn<() => Promise<typeof DEFAULT_CONFIG>>(async () => DEFAULT_CONFIG),
}))
vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: vi.fn<() => boolean>(() => true),
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPageTitle: vi.fn<() => void>(),
}))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: vi.fn<() => void>(),
}))
vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<() => Promise<void>>(async () => undefined),
}))
vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: vi.fn<() => void>(),
  translateNodes: vi.fn<() => void>(),
  translateNodesBilingualMode: vi.fn<() => void>(),
  translateWalkedElement: vi.fn<() => void>(),
}))

beforeEach(() => vi.clearAllMocks())

function fixture() {
  document.head.innerHTML = `<style>
    .box-dropdown { display: inline-block; visibility: visible; }
    .dropdown-menu { display: block; visibility: hidden; opacity: 0; }
    .show-dropdown .dropdown-menu { visibility: visible; opacity: 1; }
    .dropdown-item { display: block; }
  </style>`
  document.body.innerHTML = `
    <div class="box-dropdown"><button>User</button>
      <div class="dropdown-menu">
        <a class="dropdown-item">ตั๋วของฉัน</a>
        <a class="dropdown-item">ประวัติการสั่งซื้อ</a>
      </div>
    </div>
    <div id="unrelated">Unrelated control</div>
  `
  const manager = new PageTranslationManager()
  // Exercise real labeling and mutation handling without starting providers or timers.
  const internal = manager as unknown as {
    isPageTranslating: boolean
    walkId: string
    intersectionObserver: {
      observe: Mock<(element: Element) => void>
      disconnect: Mock<() => void>
    }
    walkBlockedElementsCache: Set<HTMLElement>
    observeTopLevelParagraphs: (root: HTMLElement, config: typeof DEFAULT_CONFIG) => Promise<void>
    observeMutations: (root: HTMLElement) => void
    handleMutationRecords: (records: MutationRecord[], root: HTMLElement) => Promise<void>
  }
  internal.isPageTranslating = true
  internal.walkId = "dropdown-menu"
  internal.intersectionObserver = {
    observe: vi.fn<(element: Element) => void>(),
    disconnect: vi.fn<() => void>(),
  }
  return {
    manager,
    internal,
    box: document.querySelector<HTMLElement>(".box-dropdown")!,
    menu: document.querySelector<HTMLElement>(".dropdown-menu")!,
  }
}

function attributeChange(target: HTMLElement, attributeName = "class"): MutationRecord {
  return { type: "attributes", target, attributeName } as unknown as MutationRecord
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function transition(target: HTMLElement, propertyName = "visibility") {
  const event = new Event("transitionend", { bubbles: true })
  Object.defineProperty(event, "propertyName", { value: propertyName })
  target.dispatchEvent(event)
}

function interactionFixture() {
  const result = fixture()
  let visible = false
  const nativeStyle = window.getComputedStyle.bind(window)
  const styles = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = nativeStyle(element)
    if ((element === result.menu || result.menu.contains(element)) && visible) {
      Object.defineProperty(style, "visibility", { value: "visible" })
    }
    return style
  })
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id)
  })
  return {
    ...result,
    styles,
    requestFrame,
    cancelFrame,
    reveal: (value = true) => {
      visible = value
    },
    runFrame: async () => {
      const batch = [...frames.values()]
      frames.clear()
      batch.forEach((callback) => callback(0))
      await flush()
    },
    cleanup: () => {
      result.manager.stop()
      styles.mockRestore()
      requestFrame.mockRestore()
      cancelFrame.mockRestore()
    },
  }
}

it.each(["pointerover", "mouseover", "focusin"])(
  "scans CSS-only revealed content after %s without a DOM mutation",
  async (eventType) => {
    const test = interactionFixture()
    try {
      await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
      test.internal.observeMutations(document.body)
      test.internal.intersectionObserver.observe.mockClear()
      test.reveal()
      test.box
        .querySelector("button")!
        .dispatchEvent(new Event(eventType, { bubbles: true, composed: true }))
      await test.runFrame()
      expect(test.menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
      expect(
        test.internal.intersectionObserver.observe.mock.calls.map(([element]) => element),
      ).toEqual([...test.menu.querySelectorAll("a")])
    } finally {
      test.cleanup()
    }
  },
)

it.each(["transitionend", "animationend", "animationstart", "toggle"])(
  "rechecks a delayed CSS reveal at %s on an ancestor",
  async (eventType) => {
    const test = interactionFixture()
    try {
      await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
      test.internal.observeMutations(document.body)
      test.box.dispatchEvent(new Event("pointerover", { bubbles: true }))
      await test.runFrame()
      expect(test.menu).not.toHaveAttribute("data-read-frog-walked")
      test.internal.intersectionObserver.observe.mockClear()
      test.reveal()
      const event = new Event(eventType, { bubbles: eventType !== "toggle" })
      Object.defineProperty(event, "propertyName", { value: "opacity" })
      test.box.dispatchEvent(event)
      await test.runFrame()
      expect(test.menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
    } finally {
      test.cleanup()
    }
  },
)

it("coalesces interaction events into one frame and observes a revealed subtree only once", async () => {
  const test = interactionFixture()
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    test.internal.intersectionObserver.observe.mockClear()
    test.reveal()
    for (const type of ["pointerover", "mouseover", "focusin"])
      test.box.dispatchEvent(new Event(type, { bubbles: true }))
    expect(test.requestFrame).toHaveBeenCalledTimes(1)
    await test.runFrame()
    expect(
      test.internal.intersectionObserver.observe.mock.calls.map(([element]) => element),
    ).toEqual([...test.menu.querySelectorAll("a")])
    test.box.dispatchEvent(new Event("pointerover", { bubbles: true }))
    await test.runFrame()
    expect(test.requestFrame).toHaveBeenCalledTimes(1)
  } finally {
    test.cleanup()
  }
})

it("ignores unrelated interactions and extension spinner events", async () => {
  const test = interactionFixture()
  const spinner = document.createElement("span")
  spinner.className = "read-frog-spinner"
  test.box.append(spinner)
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    vi.mocked(getLocalConfig).mockClear()
    test.styles.mockClear()
    document.getElementById("unrelated")!.dispatchEvent(new Event("pointerover", { bubbles: true }))
    spinner.dispatchEvent(new Event("animationend", { bubbles: true }))
    await test.runFrame()
    expect(test.requestFrame).not.toHaveBeenCalled()
    expect(getLocalConfig).not.toHaveBeenCalled()
    expect(test.styles).not.toHaveBeenCalled()
  } finally {
    test.cleanup()
  }
})

it("handles hover on translated text inside a host control", async () => {
  const test = interactionFixture()
  const wrapper = document.createElement("span")
  wrapper.className = "notranslate read-frog-translated-content-wrapper"
  wrapper.textContent = "用户"
  test.box.querySelector("button")!.append(wrapper)
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    test.reveal()
    wrapper.dispatchEvent(new Event("pointerover", { bubbles: true }))
    await test.runFrame()
    expect(test.menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
  } finally {
    test.cleanup()
  }
})

it("discovers a CSS-only menu beside its hover trigger", async () => {
  const test = interactionFixture()
  test.box.after(test.menu)
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    test.reveal()
    test.box.querySelector("button")!.dispatchEvent(new Event("pointerover", { bubbles: true }))
    await test.runFrame()
    expect(test.menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
  } finally {
    test.cleanup()
  }
})

it("keeps a menu pending when the pointer leaves before the scheduled check", async () => {
  const test = interactionFixture()
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    test.reveal()
    test.box.dispatchEvent(new Event("pointerover", { bubbles: true }))
    test.reveal(false)
    await test.runFrame()
    expect(test.menu).not.toHaveAttribute("data-read-frog-walked")
    expect(test.internal.walkBlockedElementsCache.has(test.menu)).toBe(true)
  } finally {
    test.cleanup()
  }
})

it("does not scan CSS-revealed content when translation stops during the config read", async () => {
  const test = interactionFixture()
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    let finishRead!: (config: typeof DEFAULT_CONFIG) => void
    vi.mocked(getLocalConfig).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve
      }),
    )
    test.reveal()
    test.box.dispatchEvent(new Event("pointerover", { bubbles: true }))
    await test.runFrame()
    test.manager.stop()
    finishRead(DEFAULT_CONFIG)
    await flush()
    expect(test.menu).not.toHaveAttribute("data-read-frog-walked")
  } finally {
    test.cleanup()
  }
})

it("cancels queued interaction checks and removes listeners when translation stops", async () => {
  const test = interactionFixture()
  const removeListener = vi.spyOn(document.body, "removeEventListener")
  try {
    await test.internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
    test.internal.observeMutations(document.body)
    test.box.dispatchEvent(new Event("pointerover", { bubbles: true }))
    expect(test.requestFrame).toHaveBeenCalledTimes(1)
    test.manager.stop()
    expect(test.cancelFrame).toHaveBeenCalledTimes(1)
    expect(removeListener).toHaveBeenCalledWith("pointerover", expect.any(Function), true)
    expect(removeListener).toHaveBeenCalledWith("focusin", expect.any(Function), true)
    test.reveal()
    await test.runFrame()
    expect(test.menu).not.toHaveAttribute("data-read-frog-walked")
  } finally {
    removeListener.mockRestore()
    test.cleanup()
  }
})

it("observes hidden menu links when a visible ancestor gains its open class", async () => {
  const { internal, box, menu } = fixture()
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  expect(menu).not.toHaveAttribute("data-read-frog-walked")
  internal.intersectionObserver.observe.mockClear()

  box.classList.add("show-dropdown")
  await internal.handleMutationRecords([attributeChange(box)], document.body)
  await flush()

  const links = [...menu.querySelectorAll("a")]
  expect(menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
  links.forEach((link) => expect(internal.intersectionObserver.observe).toHaveBeenCalledWith(link))
})

it("observes a hidden descendant when an ancestor changes its inline style", async () => {
  const { internal, box, menu } = fixture()
  document.head.innerHTML = ""
  box.style.display = "block"
  menu.style.display = "block"
  menu.style.visibility = "inherit"
  box.style.visibility = "hidden"
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  internal.intersectionObserver.observe.mockClear()

  box.style.visibility = "visible"
  await internal.handleMutationRecords([attributeChange(box, "style")], document.body)
  await flush()

  expect(menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
})

it("does not rescan menus for unrelated ancestor changes or menus that remain hidden", async () => {
  const { internal, box, menu } = fixture()
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  internal.intersectionObserver.observe.mockClear()
  const unrelated = document.getElementById("unrelated")!
  unrelated.classList.add("active")
  box.classList.add("active")

  await internal.handleMutationRecords(
    [attributeChange(unrelated), attributeChange(box)],
    document.body,
  )
  await flush()

  expect(menu).not.toHaveAttribute("data-read-frog-walked")
  expect(internal.intersectionObserver.observe).not.toHaveBeenCalled()
})

it("observes a revealed menu only once for repeated records in one batch", async () => {
  const { internal, box, menu } = fixture()
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  internal.intersectionObserver.observe.mockClear()
  box.classList.add("show-dropdown")

  await internal.handleMutationRecords([attributeChange(box), attributeChange(box)], document.body)
  await flush()

  expect(internal.intersectionObserver.observe.mock.calls.map(([element]) => element)).toEqual([
    ...menu.querySelectorAll("a"),
  ])
})

it("releases removed hidden menus from the walkability cache", async () => {
  const { internal, box, menu } = fixture()
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  expect(internal.walkBlockedElementsCache.has(menu)).toBe(true)
  box.remove()

  await internal.handleMutationRecords(
    [
      {
        type: "childList",
        target: document.body,
        addedNodes: [],
        removedNodes: [box],
      } as unknown as MutationRecord,
    ],
    document.body,
  )

  expect(internal.walkBlockedElementsCache.has(menu)).toBe(false)
})

it("does not retain extension translation wrappers in the hidden-element cache", async () => {
  const { internal } = fixture()
  const wrapper = document.createElement("span")
  wrapper.className = "notranslate read-frog-translated-content-wrapper"
  wrapper.innerHTML = '<span class="notranslate">译文</span>'
  document.body.append(wrapper)

  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)

  expect(internal.walkBlockedElementsCache.has(wrapper)).toBe(false)
  expect(internal.walkBlockedElementsCache.has(wrapper.firstElementChild as HTMLElement)).toBe(
    false,
  )
})

it("scans a menu when its visibility transition finishes after the ancestor mutation", async () => {
  const { manager, internal, box, menu } = fixture()
  internal.observeMutations(document.body)
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  internal.intersectionObserver.observe.mockClear()
  const getComputedStyle = window.getComputedStyle.bind(window)
  let transitioning = true
  const styles = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = getComputedStyle(element)
    if (element === menu && transitioning) {
      Object.defineProperty(style, "visibility", { value: "hidden" })
    }
    return style
  })

  try {
    box.classList.add("show-dropdown")
    await internal.handleMutationRecords([attributeChange(box)], document.body)
    await flush()
    expect(menu).not.toHaveAttribute("data-read-frog-walked")

    transitioning = false
    transition(menu)
    await vi.waitFor(() => expect(menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu"))

    expect(menu).toHaveAttribute("data-read-frog-walked", "dropdown-menu")
    expect(internal.intersectionObserver.observe.mock.calls.map(([element]) => element)).toEqual([
      ...menu.querySelectorAll("a"),
    ])
  } finally {
    styles.mockRestore()
    manager.stop()
  }
})

it("ignores unrelated transitions on a hidden menu", async () => {
  const { manager, internal, menu } = fixture()
  internal.observeMutations(document.body)
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  internal.intersectionObserver.observe.mockClear()

  try {
    transition(menu, "opacity")
    await flush()
    expect(menu).not.toHaveAttribute("data-read-frog-walked")
    expect(internal.intersectionObserver.observe).not.toHaveBeenCalled()
  } finally {
    manager.stop()
  }
})

it("removes transition listeners when page translation stops", async () => {
  const { manager, internal, menu } = fixture()
  internal.observeMutations(document.body)
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  const removeListener = vi.spyOn(document.body, "removeEventListener")

  try {
    manager.stop()
    expect(removeListener).toHaveBeenCalledWith("transitionend", expect.any(Function), true)
    expect(removeListener).toHaveBeenCalledWith("transitioncancel", expect.any(Function), true)
    transition(menu)
    await flush()
    expect(menu).not.toHaveAttribute("data-read-frog-walked")
  } finally {
    removeListener.mockRestore()
  }
})

it("does not scan a revealed menu if translation stops during the config read", async () => {
  const { manager, internal, box, menu } = fixture()
  await internal.observeTopLevelParagraphs(document.body, DEFAULT_CONFIG)
  box.classList.add("show-dropdown")
  internal.observeMutations(document.body)
  let finishRead!: (config: typeof DEFAULT_CONFIG) => void
  vi.mocked(getLocalConfig).mockReturnValueOnce(
    new Promise((resolve) => {
      finishRead = resolve
    }),
  )

  transition(menu)
  await vi.waitFor(() => expect(finishRead).toBeTypeOf("function"))
  manager.stop()
  finishRead(DEFAULT_CONFIG)
  await flush()

  expect(menu).not.toHaveAttribute("data-read-frog-walked")
})
