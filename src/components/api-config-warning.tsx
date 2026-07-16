import { getWebsiteUrl } from "@/fork/website-url"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"

export function APIConfigWarning({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-warning/70 bg-warning/60 px-3 py-2 text-center text-sm font-medium text-foreground",
        className,
      )}
    >
      {i18n.t("noAPIKeyConfig.warningWithLink.youMust")}{" "}
      <a
        href={getWebsiteUrl("/docs/api-key")}
        target="_blank"
        rel="noreferrer"
        className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {i18n.t("noAPIKeyConfig.warningWithLink.setTheAPIKey")}
      </a>{" "}
      {i18n.t("noAPIKeyConfig.warningWithLink.firstOnThe")}{" "}
      <button
        type="button"
        className="cursor-pointer rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => sendMessage("openOptionsPage", undefined)}
      >
        {i18n.t("noAPIKeyConfig.warningWithLink.optionsPage")}
      </button>{" "}
      {i18n.t("noAPIKeyConfig.warningWithLink.page")}.
    </div>
  )
}
