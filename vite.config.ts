import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { apiPlugin } from "./server/apiPlugin";

// [INTEGRATE] 배포 시: 이 플러그인의 라우트는 Cloudflare Worker(또는 Pages Functions)로 이전.
// 클라이언트 코드(src/api/client.ts)는 변경 없이 그대로 사용 가능.
export default defineConfig(({ mode }) => {
  // .env의 모든 변수(prefix 무관)를 process.env에 로드 — 서버 플러그인이 키를 읽기 위해 필요
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  return {
    plugins: [react(), apiPlugin()],
    server: {
      port: 5173,
    },
  };
});
