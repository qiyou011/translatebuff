// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OverlayFeaturePreview } from "../overlay-feature-preview"

describe("UI-optimization feature previews", () => {
  it("uses the 944 × 248 Figma scene with a centered 672 × 176 browser", () => {
    const { container } = render(
      <OverlayFeaturePreview
        feature="floating-button"
        title="Floating button"
        description="Preview"
      />,
    )

    expect(screen.getByRole("img", { name: "Floating button: Preview" })).toHaveClass(
      "h-[248px]",
      "max-w-none",
    )
    expect(container.querySelector('[data-slot="overlay-preview-browser"]')).toHaveClass(
      "h-[176px]",
      "w-[672px]",
    )
    expect(container.querySelector('[data-slot="overlay-preview-main-button"]')).toHaveClass(
      "size-10",
    )
    expect(container.querySelectorAll('[data-slot="overlay-preview-tool-button"]')).toHaveLength(2)
  })

  it("uses the Figma selection toolbar dimensions and three controls", () => {
    const { container } = render(
      <OverlayFeaturePreview feature="selection-toolbar" title="Toolbar" description="Preview" />,
    )
    expect(container.querySelector('[data-slot="overlay-preview-selection-toolbar"]')).toHaveClass(
      "h-9",
      "w-28",
    )
    expect(container.querySelectorAll('[data-slot="overlay-preview-toolbar-action"]')).toHaveLength(
      3,
    )
  })

  it("uses the Figma 192 × 136 context-menu illustration", () => {
    render(
      <OverlayFeaturePreview feature="context-menu" title="Context menu" description="Preview" />,
    )
    expect(screen.getByText(/contextMenu\.translate|翻译/)).toBeInTheDocument()
    expect(screen.getByTestId("overlay-preview-context-menu")).toHaveClass("h-[136px]", "w-48")
    expect(screen.getByRole("img", { name: "Context menu: Preview" })).toHaveAttribute(
      "data-fork-overlay-preview",
    )
  })
})
