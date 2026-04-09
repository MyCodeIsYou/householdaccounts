import { useCallback, useRef } from 'react'

const DRAG_THRESHOLD = 5 // px — 이 이상 움직여야 드래그로 인정

/**
 * 가로 드래그 스크롤 훅 (callback ref 방식).
 *
 * 왜 callback ref인가:
 *   useRef + useEffect([]) 조합은 컴포넌트 첫 마운트 때 ref가 null이면 (예: 로딩 중
 *   조기 return) 핸들러를 못 붙이고 끝난다. 이후 진짜 DOM이 마운트돼도 effect는
 *   재실행되지 않아 영구적으로 비활성화됨. callback ref는 DOM이 붙고/떨어질 때마다
 *   React가 호출하므로 이 문제가 없다.
 *
 * 동작:
 *   - mousedown: 컨테이너에서 받음
 *   - mousemove/mouseup: window에서 받음 → 마우스가 컨테이너 밖으로 나가도 끊기지 않음
 *   - 5px 이상 움직였으면 직후 click을 capture 단계에서 차단해 자식 onClick 오발 방지
 *   - input/textarea/select/button/a 위에서는 드래그 시작 안 함
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const cleanupRef = useRef<(() => void) | null>(null)

  return useCallback((el: T | null) => {
    // 이전 element에 붙은 핸들러 정리
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (!el) return

    let isDown = false
    let startX = 0
    let startScrollLeft = 0
    let didDrag = false

    el.style.cursor = 'grab'

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // 좌클릭만
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [role="button"], a')) return

      isDown = true
      didDrag = false
      startX = e.clientX
      startScrollLeft = el.scrollLeft
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return
      const dx = e.clientX - startX
      if (Math.abs(dx) > DRAG_THRESHOLD) didDrag = true
      el.scrollLeft = startScrollLeft - dx
      e.preventDefault()
    }

    const onMouseUp = () => {
      if (!isDown) return
      isDown = false
      el.style.cursor = 'grab'
      el.style.removeProperty('user-select')
    }

    const onClickCapture = (e: MouseEvent) => {
      if (didDrag) {
        e.stopPropagation()
        e.preventDefault()
        didDrag = false
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('click', onClickCapture, true)

    cleanupRef.current = () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])
}
