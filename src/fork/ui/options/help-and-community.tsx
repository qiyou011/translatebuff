import { IconMail } from "@tabler/icons-react"
import {
  FluidCard,
  FluidCardDescription,
  FluidCardGroup,
  FluidCardHeader,
  FluidCardMedia,
  FluidCardTitle,
} from "@/components/ui/base-ui/fluid-card"
import { ConfigSection } from "@/entrypoints/options/components/config-section"
import { PageLayout } from "@/entrypoints/options/components/page-layout"
import { i18n } from "@/utils/i18n"

// 换皮：上游 options/pages/help-and-community/index.tsx。
// 上游那页 6 张卡里只有「邮件联系」在 fork 站得住，其余全指向 read-frog 自家资源：
//   · 使用教程 → {官网}/docs —— 两条线实测都 404（fork 官网没有文档站）
//   · 功能建议 / 报告问题 → Featurebase 门户。fork 已把它换皮到自家反馈页
//     （src/fork/ui/options/featurebase.ts），但换皮后两张卡指向同一个地址、语义重复，
//     且国内 /feedback 实测 404
//   · Discord / 微信群 → 上游自己的社区，fork 无对应
// 故整页收敛为一张邮件卡。
//
// 上游的 locale key 与微信二维码图并未删除：它们是上游资源，删了只会在同步时制造冲突，
// 而没人渲染的 key 不产生任何产物体积（yml 按需取值）。
//
// 与 locale 里的卡片描述保持同一个地址。上游源码把 mailto 写死成 contact@readfrog.app，
// 而卡片描述早已是 fork 自己的邮箱——显示一个、点开另一个，换皮时一并修正。
// 改邮箱时这里和 src/locales/*.yml 的 options.helpAndCommunity.email.description 必须同改。
const SUPPORT_EMAIL = "support@translatebuff.com"

export function HelpAndCommunityPage() {
  return (
    <PageLayout
      title={i18n.t("options.helpAndCommunity.title")}
      description={i18n.t("options.helpAndCommunity.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <ConfigSection
        title={i18n.t("options.helpAndCommunity.help.title")}
        titleClassName="border-b-0"
      >
        <FluidCardGroup columns={2}>
          <FluidCard
            href={`mailto:${SUPPORT_EMAIL}`}
            external
            label={i18n.t("options.helpAndCommunity.email.title")}
          >
            <FluidCardHeader>
              <FluidCardMedia icon={IconMail} />
              <FluidCardTitle>{i18n.t("options.helpAndCommunity.email.title")}</FluidCardTitle>
              <FluidCardDescription>
                {i18n.t("options.helpAndCommunity.email.description")}
              </FluidCardDescription>
            </FluidCardHeader>
          </FluidCard>
        </FluidCardGroup>
      </ConfigSection>
    </PageLayout>
  )
}
