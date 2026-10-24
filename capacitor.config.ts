import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.dailydose.reminders',
  appName: 'Daily Dose',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#356b56',
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
}

export default config
