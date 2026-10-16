import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.badshah.orders',
  appName: 'Badshah Orders',
  webDir: 'public',
  server: {
    // If testing locally, set CAPACITOR_SERVER_URL='http://10.0.2.2:3000' (emulator) or your LAN IP
    // Defaults to the deployed production app
    url: process.env.CAPACITOR_SERVER_URL || 'https://biriyani-badshah.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#020617', // matching dark dashboard slate-950
  },
}

export default config
