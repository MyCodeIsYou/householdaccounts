import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isit.householdaccounts',
  appName: '우리집 가계부',
  webDir: 'dist',
  server: {
    // 앱 내부에서 외부 URL 접근 허용 (Supabase API 등)
    allowNavigation: ['*.supabase.co'],
  },
  android: {
    // 상태바 스타일
    backgroundColor: '#0f1117',
  },
  ios: {
    backgroundColor: '#0f1117',
  },
};

export default config;
