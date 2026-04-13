import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isit.householdaccounts',
  appName: '우리집 가계부',
  webDir: 'dist',
  server: {
    // Supabase API만 허용 (프로젝트 전용 서브도메인)
    allowNavigation: ['ylrmmefmilpefdziahxu.supabase.co'],
  },
  android: {
    // 상태바 스타일
    backgroundColor: '#0f1117',
    // 릴리스 빌드에서 WebView 디버깅(Chrome DevTools) 비활성화
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#0f1117',
  },
};

export default config;
