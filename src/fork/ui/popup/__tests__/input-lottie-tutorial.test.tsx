// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InputLottieTutorial } from "../input-lottie-tutorial"
import { SelectionLottieTutorial } from "../selection-lottie-tutorial"
import { SubtitleLottieTutorial } from "../subtitle-lottie-tutorial"

const state = vi.hoisted(() => ({ edition: "cn", theme: "light", reduced: false }))
const player = vi.hoisted(() => {
  const events = new Map<string, () => void>()
  const animation = {
    pause: vi.fn<() => void>(),
    play: vi.fn<() => void>(),
    destroy: vi.fn<() => void>(),
    goToAndStop: vi.fn<(frame: number, isFrame: boolean) => void>(),
    addEventListener: vi.fn<(name: string, callback: () => void) => void>((name, callback) => {
      events.set(name, callback)
    }),
  }
  return {
    events,
    animation,
    loadAnimation: vi.fn<(...args: unknown[]) => typeof animation>(() => animation),
  }
})
vi.mock("@/fork/identity/edition", () => ({ currentEdition: () => state.edition }))
vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: state.theme }),
}))
vi.mock("motion/react", () => ({ useReducedMotion: () => state.reduced }))
vi.mock("lottie-web/build/player/lottie_light", () => ({
  default: { loadAnimation: player.loadAnimation },
}))

beforeEach(() => {
  state.edition = "cn"
  state.theme = "light"
  state.reduced = false
  player.events.clear()
  vi.clearAllMocks()
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: true, json: async () => ({ layers: [] }) } as Response),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("input Lottie tutorial", () => {
  it("loads the selection animation and changes the viewport with the theme", async () => {
    const view = render(<SelectionLottieTutorial label="Selection" fallback={null} />)
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("selection-light.lottie.json"),
      expect.any(Object),
    )
    state.theme = "dark"
    view.rerender(<SelectionLottieTutorial label="Selection" fallback={null} />)
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("selection-dark.lottie.json"),
      expect.any(Object),
    )
    expect(player.loadAnimation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rendererSettings: expect.objectContaining({ viewBoxSize: "484 265.64575 376 250.35428" }),
      }),
    )
  })
  it.each(["cn", "global"])(
    "selects the %s subtitle resource and applies the theme viewport",
    async (edition) => {
      state.edition = edition
      const view = render(<SubtitleLottieTutorial label="Subtitles" fallback={null} />)
      await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledOnce())
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`video-${edition}.lottie.json`),
        expect.any(Object),
      )
      expect(player.loadAnimation).toHaveBeenCalledWith(
        expect.objectContaining({
          rendererSettings: expect.objectContaining({
            viewBoxSize: "44.7 272.13613 360 202.56387",
          }),
        }),
      )
      state.theme = "dark"
      view.rerender(<SubtitleLottieTutorial label="Subtitles" fallback={null} />)
      await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledTimes(2))
      expect(player.loadAnimation).toHaveBeenLastCalledWith(
        expect.objectContaining({
          rendererSettings: expect.objectContaining({
            viewBoxSize: "492.7 272.13613 360 202.56387",
          }),
        }),
      )
    },
  )

  it.each(["cn", "global"])(
    "loads the %s animation and switches themes with cleanup",
    async (edition) => {
      state.edition = edition
      const view = render(
        <InputLottieTutorial label="Input tutorial" fallback={<p>Static tutorial</p>} />,
      )
      await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledOnce())
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`input-${edition}-light.lottie.json`),
        expect.any(Object),
      )
      expect(player.loadAnimation).toHaveBeenLastCalledWith(
        expect.objectContaining({ renderer: "svg", loop: true }),
      )
      state.theme = "dark"
      view.rerender(
        <InputLottieTutorial label="Input tutorial" fallback={<p>Static tutorial</p>} />,
      )
      await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledTimes(2))
      expect(player.animation.destroy).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining(`input-${edition}-dark.lottie.json`),
        expect.any(Object),
      )
      view.unmount()
      expect(player.animation.destroy).toHaveBeenCalledTimes(2)
    },
  )

  it("shows a completed still frame when reduced motion is enabled", async () => {
    state.reduced = true
    render(<InputLottieTutorial label="Input tutorial" fallback={null} />)
    await waitFor(() => expect(player.loadAnimation).toHaveBeenCalledOnce())
    expect(player.loadAnimation).toHaveBeenCalledWith(expect.objectContaining({ autoplay: false }))
    act(() => player.events.get("DOMLoaded")!())
    expect(player.animation.goToAndStop).toHaveBeenCalledWith(320, true)
  })

  it("keeps a static tutorial available if animation loading fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"))
    render(<InputLottieTutorial label="Input tutorial" fallback={<p>Static tutorial</p>} />)
    expect(await screen.findByText("Static tutorial")).toBeVisible()
    expect(screen.queryByRole("img", { name: "Input tutorial" })).toBeNull()
  })
})
