import { env } from "@/env"

const LOCAL_PREVIEW_ROUTES = ["/guide"]

function isLocalPreview() {
  try {
    const url = new URL(env.WXT_WEBSITE_URL)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

export function getWebsiteUrl(path = "") {
  const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path

  if (
    isLocalPreview() &&
    normalizedPath &&
    !LOCAL_PREVIEW_ROUTES.some((route) => normalizedPath.startsWith(route))
  ) {
    return `${env.WXT_WEBSITE_URL}#${normalizedPath}`
  }

  return normalizedPath
    ? new URL(normalizedPath, `${env.WXT_WEBSITE_URL}/`).toString()
    : env.WXT_WEBSITE_URL
}
