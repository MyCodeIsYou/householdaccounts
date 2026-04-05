import { useEffect, useState } from 'react'

const SPLASH_DURATION = 1200 // 이미지 표시 시간 (ms)
const FADE_DURATION = 1000   // 페이드아웃 지속 시간 (ms)

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), SPLASH_DURATION)
    const doneTimer = setTimeout(() => onFinish(), SPLASH_DURATION + FADE_DURATION)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  const imgUrl = `${import.meta.env.BASE_URL}household.png`

  return (
    <div
      className={`fixed inset-0 z-[9999] transition-opacity ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_DURATION}ms` }}
    >
      {/* PC: 블러된 이미지를 배경으로 깔고, 원본은 contain으로 중앙 정렬 */}
      <div
        className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-60"
        style={{ backgroundImage: `url(${imgUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />

      {/* 모바일: object-cover로 꽉 채움 */}
      <img
        src={imgUrl}
        alt="가계부"
        className="md:hidden relative w-full h-full object-cover"
      />

      {/* PC: object-contain으로 전체 표시 */}
      <img
        src={imgUrl}
        alt="가계부"
        className="hidden md:block relative w-full h-full object-contain"
      />
    </div>
  )
}
