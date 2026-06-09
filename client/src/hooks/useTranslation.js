import { useCallback } from 'react'
import { LOCALE_STORAGE_KEY } from '../constants.js'

export function useTranslation(locales) {
  const locale = typeof window !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) || 'sv' : 'sv'

  const t = useCallback((key, replaces = {}) => {
    let str = locales[locale]?.[key] || locales['sv']?.[key] || key
    Object.entries(replaces).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v)
    })
    return str
  }, [locale, locales])

  return t
}
