import brandIcon from "@/fork/assets/renyimiao.svg?url&no-inline"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

export function BrandMark({
  className,
  iconClassName,
  nameClassName,
  showName = true,
}: {
  className?: string
  iconClassName?: string
  nameClassName?: string
  showName?: boolean
}) {
  const name = i18n.t("name")

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} translate="no">
      <img
        src={brandIcon}
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
        className={cn("size-7 shrink-0 rounded-md", iconClassName)}
      />
      <span className={cn(showName ? "truncate font-semibold" : "sr-only", nameClassName)}>
        {name}
      </span>
    </span>
  )
}
