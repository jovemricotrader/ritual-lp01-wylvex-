import{defineConfig}from'vite'
import react from'@vitejs/plugin-react'
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vendor: ["react","react-dom"] }
      }
    }
  },plugins:[react()],base:'/',build:{outDir:'dist'}})
