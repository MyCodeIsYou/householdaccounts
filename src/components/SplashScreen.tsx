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

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black transition-opacity ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_DURATION}ms` }}
    >
      <img
        src={`${import.meta.env.BASE_URL}household.png`}
        alt="가계부"
        className="w-full h-full object-cover"
      />
    </div>
  )
}
