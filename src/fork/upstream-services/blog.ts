import type { LatestBlogPost } from "@read-frog/definitions"
import type { getLatestBlogDate as UpstreamGetLatestBlogDate } from "@/utils/blog"

export * from "@/utils/blog"

export async function getLatestBlogDate(
  ..._args: Parameters<typeof UpstreamGetLatestBlogDate>
): Promise<LatestBlogPost | null> {
  return null
}
