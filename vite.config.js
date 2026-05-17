import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app_icon.png', 'mallard_duck.png', 'white_duck.png', 'rubber_duck.png', 'tree_obstacle.png', 'lake_background.png'],
      manifest: {
        name: 'Flappy Duck',
        short_name: 'FlappyDuck',
        description: 'A flappy bird clone featuring ducks!',
        theme_color: '#4cb7ff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'app_icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'app_icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
