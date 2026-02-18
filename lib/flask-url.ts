const DEFAULT_FLASK_BASE = "http://localhost:5000"

export function resolveFlaskEndpoint(targetPath: string, fallbackBase: string = DEFAULT_FLASK_BASE): string {
  const normalizedPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`
  const fallbackUrl = `${fallbackBase}${normalizedPath}`
  const rawUrl =
    process.env.FLASK_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_FLASK_SERVER_URL?.trim() || ""

  if (!rawUrl) {
    return fallbackUrl
  }

  try {
    const hasProtocol = /^https?:\/\//i.test(rawUrl)
    const normalized = hasProtocol ? rawUrl : `http://${rawUrl}`
    const url = new URL(normalized)

    url.pathname = normalizedPath

    return url.toString()
  } catch (error) {
    console.warn("FLASK_SERVER_URL の解析に失敗したため既定値を使用します:", error)
    return fallbackUrl
  }
}
