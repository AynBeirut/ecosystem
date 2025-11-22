import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // Modern browsers support addEventListener on MediaQueryList
    if (typeof (mql as MediaQueryList).addEventListener === 'function') {
      (mql as MediaQueryList).addEventListener('change', onChange)
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      return () => (mql as MediaQueryList).removeEventListener('change', onChange)
    }

    // Older browsers expose addListener/removeListener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (mql as any).addListener === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mql as any).addListener(onChange)
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return () => (mql as any).removeListener(onChange)
    }

    return undefined
  }, [])

  return Boolean(isMobile)
}
