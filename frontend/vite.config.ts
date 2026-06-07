import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GCS static hosting needs relative asset paths (./assets/... not /assets/...)
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
});
