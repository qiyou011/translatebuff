import Container from "@/components/container"
import { Separator } from "@/components/ui/base-ui/separator"
import { SidebarTrigger } from "@/components/ui/base-ui/sidebar"
import { cn } from "@/utils/styles/utils"

export function PageLayout({
  title,
  children,
  className,
  innerClassName,
}: {
  title: React.ReactNode
  children: React.ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <main className={cn("w-full pb-12", className)}>
      <div className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur-xl">
        <Container className="max-w-5xl">
          <header className="-ml-1.5 flex h-16 shrink-0 items-center gap-2.5">
            <SidebarTrigger />
            <Separator orientation="vertical" className="my-auto mr-1.5 h-4!" />
            <h1 className="text-xl font-semibold">{title}</h1>
          </header>
        </Container>
      </div>
      <Container className={cn("@container max-w-5xl pt-5", innerClassName)}>{children}</Container>
    </main>
  )
}
