// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, renderHook } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { NotebaseConnectionField } from "@/entrypoints/options/pages/custom-actions/action-config-form/notebase-connection-field"
import { AiQuotaSection } from "@/entrypoints/options/pages/video-subtitles/ai-quota"
import { RequestAiSubtitlesItem } from "@/entrypoints/subtitles.content/ui/subtitles-settings-panel/components/request-ai-subtitles-item"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("mounts no cloud transcription entry or hosted queries even when enabled", () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>())
  const client = new QueryClient()
  // Closed leaf must not read the form, initialize its cloud session or query connection data.
  const form = new Proxy(
    {},
    {
      get() {
        throw new Error("Closed Notebase leaf accessed form")
      },
    },
  )
  const { container } = render(
    <QueryClientProvider client={client}>
      <AiQuotaSection />
      <RequestAiSubtitlesItem />
      <NotebaseConnectionField form={form as never} />
    </QueryClientProvider>,
  )
  const { result } = renderHook(() => useHostedAiStatus({ enabled: true }))
  expect(container).toBeEmptyDOMElement()
  expect(result.current).toMatchObject({ isPending: false, isSignedIn: false, status: undefined })
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(fetch).not.toHaveBeenCalled()
  client.clear()
})
