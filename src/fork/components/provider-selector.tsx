import type { ComponentProps } from "react"
import type { ForkProviderGroupKey } from "./provider-selector-groups"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import ProviderIcon from "@/components/provider-icon"
import { useTheme } from "@/components/providers/theme-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { FORK_BRANDING } from "@/fork/branding"
import { i18n } from "@/utils/i18n"
import { getProviderLogo, getProviderName } from "@/utils/providers/provider-display"
import { getForkProviderSelectorGroups } from "./provider-selector-groups"

// fork 换皮版 provider 选择器：base-ui Select + fork 分组（任译喵置顶组）。
// 复用上游显示叶子 ProviderIcon 与逻辑；不引用上游 composed UI（provider-selector）。

type TriggerSize = ComponentProps<typeof SelectTrigger>["size"]

interface ForkProviderSelectorProps {
  providers: ProviderSelectorOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  triggerSize?: TriggerSize
  selectContentProps?: Pick<
    ComponentProps<typeof SelectContent>,
    "container" | "positionerClassName"
  >
}

function getGroupLabel(key: ForkProviderGroupKey): string {
  return key === "renyimiao"
    ? FORK_BRANDING.displayName
    : i18n.t("translateService.normalTranslator")
}

// 任译喵组内去掉冗余的「任译喵 」前缀（组头已带品牌），平铺展示模型名；仅展示层，不改配置 name。
function getGroupedItemName(
  provider: ProviderSelectorOption,
  groupKey: ForkProviderGroupKey,
): string {
  const name = getProviderName(provider)
  const prefix = `${FORK_BRANDING.displayName} `
  return groupKey === "renyimiao" && name.startsWith(prefix) ? name.slice(prefix.length) : name
}

export default function ForkProviderSelector({
  providers,
  value,
  onChange,
  placeholder,
  className,
  triggerSize = "default",
  selectContentProps,
}: ForkProviderSelectorProps) {
  const { theme } = useTheme()
  const currentProvider = providers.find((provider) => provider.id === value)
  const groups = getForkProviderSelectorGroups(providers)

  const trigger = (
    <SelectTrigger className={className} size={triggerSize}>
      <SelectValue placeholder={placeholder}>
        {(provider: ProviderSelectorOption) => (
          <ProviderIcon
            logo={getProviderLogo(provider, theme)}
            name={getProviderName(provider)}
            size="sm"
          />
        )}
      </SelectValue>
    </SelectTrigger>
  )

  // 单组 / 空组：flat 渲染，空时 disabled（对齐上游 UngroupedSelect；空态兜底不崩）
  if (groups.length <= 1) {
    return (
      <Select<ProviderSelectorOption>
        value={currentProvider}
        onValueChange={(provider) => {
          if (provider) onChange(provider.id)
        }}
        itemToStringValue={(provider) => provider.id}
        disabled={providers.length === 0}
      >
        {trigger}
        <SelectContent className="min-w-fit" {...selectContentProps}>
          <SelectGroup>
            {(groups[0]?.providers ?? []).map((provider) => (
              <SelectItem key={provider.id} value={provider}>
                <ProviderIcon
                  logo={getProviderLogo(provider, theme)}
                  name={getProviderName(provider)}
                  size="sm"
                />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Select<ProviderSelectorOption>
      value={currentProvider}
      onValueChange={(provider) => {
        if (provider) onChange(provider.id)
      }}
      itemToStringValue={(provider) => provider.id}
    >
      {trigger}
      <SelectContent className="min-w-fit" {...selectContentProps}>
        {groups.map((group) => (
          <SelectGroup key={group.key}>
            <SelectLabel>{getGroupLabel(group.key)}</SelectLabel>
            {group.providers.map((provider) => (
              <SelectItem key={provider.id} value={provider}>
                <ProviderIcon
                  logo={getProviderLogo(provider, theme)}
                  name={getGroupedItemName(provider, group.key)}
                  size="sm"
                />
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
