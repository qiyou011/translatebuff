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
  /**
   * 需要置灰的 provider id。本组件被 4 个上游 importer 共用（语言检测 / 自定义动作 /
   * 划词工具栏 / 功能列表），故这里只负责渲染禁用态，**不做任何判定**——谁该置灰由
   * 持有 featureKey 的调用方决定，避免一处判定误伤其他功能。
   */
  disabledProviderIds?: readonly string[]
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
  disabledProviderIds,
  placeholder,
  className,
  triggerSize = "default",
  selectContentProps,
}: ForkProviderSelectorProps) {
  const { theme } = useTheme()
  const currentProvider = providers.find((provider) => provider.id === value)
  const groups = getForkProviderSelectorGroups(providers)
  const isDisabled = (id: string) => disabledProviderIds?.includes(id) ?? false

  const trigger = (
    <SelectTrigger className={className} size={triggerSize}>
      <SelectValue placeholder={placeholder}>
        {/* 选中值不在当前列表（如被过滤掉的任译喵）时 base-ui 用 null 调本 render；
            守卫 null 退化成 placeholder，避免 getProviderLogo(null) → 'kind' in null 崩。 */}
        {(provider: ProviderSelectorOption | null) =>
          provider ? (
            <ProviderIcon
              logo={getProviderLogo(provider, theme)}
              name={getProviderName(provider)}
              size="sm"
            />
          ) : null
        }
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
              <SelectItem key={provider.id} value={provider} disabled={isDisabled(provider.id)}>
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
              <SelectItem key={provider.id} value={provider} disabled={isDisabled(provider.id)}>
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
