import { toast } from "sonner"
import { getWebsiteUrl } from "@/fork/website-url"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

export function showNotebaseLimitExceededToast() {
  toast.error(i18n.t("action.saveToNotebaseLimitExceeded"), {
    action: {
      label: i18n.t("action.upgrade"),
      onClick: () => {
        void sendMessage("openPage", {
          url: getWebsiteUrl("/pricing"),
          active: true,
        })
      },
    },
  })
}
