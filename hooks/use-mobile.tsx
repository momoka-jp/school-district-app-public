import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
    const onChange = (matches: boolean) => {
      setIsMobile(matches)
    }

    const mql = window.matchMedia(query)
    onChange(mql.matches)

    const listener = (event: MediaQueryListEvent | MediaQueryList) => {
      onChange("matches" in event ? event.matches : mql.matches)
    }

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", listener)
      return () => mql.removeEventListener("change", listener as EventListener)
    }

    if (typeof mql.addListener === "function") {
      mql.addListener(listener)
      return () => mql.removeListener(listener)
    }

    const onResize = () => onChange(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return !!isMobile
}
