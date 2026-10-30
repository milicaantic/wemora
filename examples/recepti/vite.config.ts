import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Fixed port so testers and Playwright always find the original at the same URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
})
