import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.opq.storystation',
  appName: 'Story Station',
  webDir: 'dist',
  android: {
    // Content is bundled in the APK; https keeps the WebView origin secure so
    // getUserMedia, IndexedDB and notifications all behave like a real site.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0d0b16',
      showSpinner: false,
      androidSplashResourceName: 'splash',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_moon',
      iconColor: '#ffc86b',
    },
  },
};

export default config;
