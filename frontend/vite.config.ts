import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// npm run dev / preview 时默认用 Chrome 打开页面。
// Vite 只通过 BROWSER 环境变量选择浏览器（server.open 的字符串值表示 URL 路径，不是浏览器名），
// 这里写入默认值；如需临时改用其它浏览器，在命令行设置 BROWSER 覆盖即可。
process.env.BROWSER ||= 'chrome'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 6662,
    open: true,
    proxy: {
      // 后端 context-path 为 /api，代理时不重写
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
