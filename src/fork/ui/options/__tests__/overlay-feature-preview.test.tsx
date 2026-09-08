// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { OverlayFeaturePreview } from "../overlay-feature-preview"

describe("UI-optimization feature previews", () => {
  it("shows the circular floating widget with a larger inverted brand icon", () => {
    const { container } = render(
      <OverlayFeaturePreview
        feature="floating-button"
        title="Floating button"
        description="Preview"
      />,
    )
    expect(container.querySelector(".size-12.bg-black.rounded-full")).not.toBeNull()
    expect(container.querySelector("img.size-10.invert")).not.toBeNull()
  })

  it("shows the three translation, speech and dictionary toolbar controls", () => {
    const { container } = render(
      <OverlayFeaturePreview feature="selection-toolbar" title="Toolbar" description="Preview" />,
    )
    expect(container.querySelectorAll("span.h-7")).toHaveLength(3)
    expect(container.querySelector(".rotate-45")).toBeNull()
  })

  it("shows a native-style context menu with a copy shortcut", () => {
    render(
      <OverlayFeaturePreview feature="context-menu" title="Context menu" description="Preview" />,
    )
    expect(screen.getByText("Ctrl+C")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Context menu: Preview" })).toHaveAttribute(
      "data-fork-overlay-preview",
    )
  })
})
