import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cash.discrete.wallet',
  appName: 'Discrete Wallet',
  webDir: 'src',
  android: {
    allowMixedContent: true,
    backgroundColor: '#0d1115'
  },
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0d1115'
    }
  }
};

export default config;
