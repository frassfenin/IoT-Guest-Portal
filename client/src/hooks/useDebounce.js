import { useState, useCallback } from 'react'

export default function useDebounce(fn, delay = 300) {
  const [timer, setTimer] = useState(null)
  return useCallback((...args) => {
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => fn(...args), delay))
  }, [fn, delay, timer])
}
