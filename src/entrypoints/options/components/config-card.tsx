import { cn } from "@/utils/styles/utils"

export function ConfigCard({
  id,
  title,
  description,
  children,
  className,
  titleClassName,
}: {
  id?: string
  title: React.ReactNode
  description: React.ReactNode
  children: React.ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "-mx-4 mb-3 flex scroll-mt-24 flex-col gap-y-5 rounded-xl border-b-0! bg-card px-6 py-7 last:mb-0 lg:flex-row lg:gap-x-12 xl:gap-x-16",
        className,
      )}
    >
      <div className="shrink-0 lg:basis-2/5">
        <h2 className={cn("mb-1.5 text-lg font-semibold", titleClassName)}>{title}</h2>
        <div className="max-w-md text-[15px] leading-6 text-muted-foreground">{description}</div>
      </div>
      <div className="min-w-0 p-0 lg:basis-3/5">{children}</div>
    </section>
  )
}
