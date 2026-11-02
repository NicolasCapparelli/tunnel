import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  plugins: [react()],
  server: { port: 1427, strictPort: true },
  clearScreen: false,
});
