// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { i18n } from "@/utils/i18n"
import { ConnectionTestButton } from "../connection-test-button"

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: vi.fn<typeof executeTranslate>(),
}))
afterEach(cleanup)

it("does not show stale connection feedback after editing the model credentials", async () => {
  const pending = Promise.withResolvers<string>()
  vi.mocked(executeTranslate).mockReturnValue(pending.promise)
  const client = new QueryClient()
  const provider = buildRenyimiaoProvider("model", "old-test-key")
  const tree = (apiKey: string) => (
    <QueryClientProvider client={client}>
      <ConnectionTestButton providerConfig={{ ...provider, apiKey }} />
    </QueryClientProvider>
  )
  const { rerender } = render(tree("old-test-key"))
  fireEvent.click(screen.getByRole("button"))
  await waitFor(() => expect(executeTranslate).toHaveBeenCalledOnce())
  rerender(tree("new-test-key"))
  await act(async () => pending.resolve("Connected"))
  await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled())
  expect(screen.getByRole("button")).toHaveTextContent(
    i18n.t("options.apiProviders.testConnection.button"),
  )
  client.clear()
})
