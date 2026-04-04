import { useRef, useEffect, useCallback } from 'react'

export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 })

  const onMouseDown = useCallback((e: MouseEvent) => {
    const el = ref.current
    if (!el) return
    state.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
    el.style.cursor = 'grabbing'
    el.style.userSelect = 'none'
  }, [])

  const onMouseUp = useCallback(() => {
    const el = ref.current
    if (!el) return
    state.current.isDown = false
    el.style.cursor = 'grab'
    el.style.removeProperty('user-select')
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isDown) return
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - state.current.startX) * 1.5
    el.scrollLeft = state.current.scrollLeft - walk
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.cursor = 'grab'
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseUp)
    }
  }, [onMouseDown, onMouseUp, onMouseMove])

  return ref
}
