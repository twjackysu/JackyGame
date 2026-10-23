import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.twjackysu.jackygame',
  appName: '星燼回響',
  webDir: 'dist',
  backgroundColor: '#0b0f1e',
  android: {
    backgroundColor: '#0b0f1e',
  },
  ios: {
    backgroundColor: '#0b0f1e',
    contentInset: 'never',
  },
};

export default config;
