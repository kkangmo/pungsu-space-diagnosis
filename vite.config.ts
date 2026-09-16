import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiPlugin } from "./server/apiPlugin";

// [INTEGRATE] 배포 시: 이 플러그인의 라우트는 Cloudflare Worker(또는 Pages Functions)로 이전.
// 클라이언트 코드(src/api/client.ts)는 변경 없이 그대로 사용 가능.
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5173,
  },
});
