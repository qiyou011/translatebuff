import { browser } from "#imports"
import baseDark from "@/assets/images/panel-v170/loading-base-dark.svg?url&no-inline"
import base from "@/assets/images/panel-v170/loading-base.svg?url&no-inline"
import brandDark from "@/assets/images/panel-v170/loading-brand-dark.svg?url&no-inline"
import brand from "@/assets/images/panel-v170/loading-brand.svg?url&no-inline"
import ringDark from "@/assets/images/panel-v170/loading-ring-dark.webp?url&no-inline"
import ring from "@/assets/images/panel-v170/loading-ring.webp?url&no-inline"

export function BrandLoading({
  dark = false,
  pending = false,
}: {
  dark?: boolean
  pending?: boolean
}) {
  return (
    <span className="rf-brand-loading" data-pending={pending || undefined} aria-hidden="true">
      <img
        className="rf-brand-ring"
        src={new URL(dark ? ringDark : ring, browser.runtime.getURL("/")).href}
        width={24}
        height={24}
        alt=""
      />
      <img
        className="rf-brand-base"
        src={new URL(dark ? baseDark : base, browser.runtime.getURL("/")).href}
        width={18}
        height={18}
        alt=""
      />
      <img
        className="rf-brand-logo"
        src={new URL(dark ? brandDark : brand, browser.runtime.getURL("/")).href}
        width={14}
        height={12.923}
        alt=""
      />
    </span>
  )
}
