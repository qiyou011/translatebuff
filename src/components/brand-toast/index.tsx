import { kebabCase } from "case-anything"
import * as React from "react"
import { Toaster } from "sonner"
import { browser } from "#imports"
import brandIcon from "@/assets/icons/renyimiao.svg?url&no-inline"
import { APP_NAME } from "@/utils/constants/app"

const brandIconUrl = new URL(brandIcon, browser.runtime.getURL("/")).href

const brandIconElement = (
  <img
    src={brandIconUrl}
    alt=""
    aria-hidden="true"
    width={20}
    height={20}
    style={{ display: "block", height: "20px", width: "20px" }}
  />
)

function BrandToast({
  position = "bottom-left",
  toastOptions,
  ...props
}: React.ComponentProps<typeof Toaster>) {
  return (
    <Toaster
      {...props}
      position={position}
      richColors
      icons={{
        warning: brandIconElement,
        success: brandIconElement,
        error: brandIconElement,
        info: brandIconElement,
        loading: brandIconElement,
      }}
      toastOptions={{
        ...toastOptions,
        className: [`${kebabCase(APP_NAME)}-toaster`, toastOptions?.className]
          .filter(Boolean)
          .join(" "),
      }}
      className="notranslate z-[2147483647]"
    />
  )
}

export default BrandToast
