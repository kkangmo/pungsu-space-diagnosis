import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { geocodeAddress } from "../src/lib/geocode";
import { analyzeGeoLocation } from "../src/lib/analysis";
import { analyzePhotosWithVision } from "../src/lib/vision";
import { scorePhotoReport } from "../src/lib/photoScoring";
import type { GeoAnalyzeRequest } from "../src/types/shared";

// [INTEGRATE] 배포 시 이 파일 전체를 Cloudflare Worker 핸들러로 이전.
// 환경변수만 Worker Secret으로 옮기면 클라이언트 코드 변경 없이 동작.

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, code: string, message: string, status = 400): void {
  send(res, status, { error: { code, message } });
}

// Node IncomingMessage → Web Request (Node 18+ 내장 fetch/Request 사용, 의존성 추가 없음)
function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost:5173";
  const url = new URL(req.url ?? "/", `http://${host}`);
  return Promise.resolve(
    new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: req as unknown as ReadableStream,
      duplex: "half",
    } as RequestInit),
  );
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const request = await toWebRequest(req);
  return request.json();
}

async function readMultipart(req: IncomingMessage): Promise<FormData> {
  const request = await toWebRequest(req);
  return request.formData();
}

// 더 안정적인 바이너리 → base64
async function fileToBase64Safe(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function handleGeo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) as GeoAnalyzeRequest;
  const address = body?.address?.trim();
  const hasCoords = body?.coordinates && typeof body.coordinates.lat === "number";

  if (!address && !hasCoords) {
    sendError(res, "INVALID_ADDRESS", "주소를 입력하거나 지도에서 핀을 지정해 주세요.");
    return;
  }

  const kakaoKey = process.env.KAKAO_REST_KEY;
  let coordinates, displayAddress;

  if (address) {
    let geocoded;
    try {
      geocoded = await geocodeAddress(address, kakaoKey);
    } catch {
      sendError(
        res,
        "ADDRESS_NOT_FOUND",
        "주소를 찾을 수 없습니다. 지도에서 직접 핀을 지정해 주세요.",
        404,
      );
      return;
    }
    coordinates = geocoded.coordinates;
    displayAddress = geocoded.address;
  } else {
    coordinates = body!.coordinates!;
    displayAddress = `지도에서 지정한 위치 (${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)})`;
  }

  const result = await analyzeGeoLocation({
    coordinates,
    address: displayAddress,
    bearingCorrection: body.bearingCorrection,
  });
  send(res, 200, result);
}

async function handlePhoto(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const form = await readMultipart(req);
  const files = form.getAll("photos").filter((v): v is File => v instanceof File);
  const maxPhotos = 5;
  const maxBytes = 10 * 1024 * 1024;

  if (files.length === 0) {
    sendError(res, "NO_PHOTO", "사진을 1장 이상 업로드해 주세요.");
    return;
  }
  if (files.length > maxPhotos) {
    sendError(res, "TOO_MANY_PHOTOS", `사진은 최대 ${maxPhotos}장까지 업로드할 수 있어요.`);
    return;
  }
  const oversized = files.find((f) => f.size > maxBytes);
  if (oversized) {
    sendError(res, "PHOTO_TOO_LARGE", "사진 용량이 너무 큽니다. 10MB 이하로 올려주세요.");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendError(
      res,
      "VISION_NOT_CONFIGURED",
      "사진 분석 기능이 설정되어 있지 않습니다. 관리자에게 문의해 주세요.",
      503,
    );
    return;
  }

  const images = await Promise.all(
    files.map(async (f) => ({
      mimeType: f.type || "image/jpeg",
      base64: await fileToBase64Safe(f),
    })),
  );

  // 사진은 분석 후 즉시 폐기 — 참조를 여기서 끊음 (저장 금지)
  let report;
  try {
    report = await analyzePhotosWithVision(images, apiKey);
  } catch (e) {
    sendError(
      res,
      "VISION_FAILED",
      "사진을 분석하지 못했습니다. 사진을 다시 업로드해 주세요.",
      502,
    );
    return;
  } finally {
    images.length = 0; // 폐기
  }

  const result = scorePhotoReport(report);
  send(res, 200, result);
}

const ROUTES: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>> = {
  "/api/geo/analyze": handleGeo,
  "/api/photo/analyze": handlePhoto,
};

export function apiPlugin(): Plugin {
  return {
    name: "pungsu-api-routes",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();
        if (req.method !== "POST") return next();

        const route = ROUTES[req.url];
        if (!route) {
          sendError(res, "ROUTE_NOT_FOUND", "알 수 없는 요청입니다.", 404);
          return;
        }

        try {
          await route(req, res);
        } catch (e) {
          const message = e instanceof Error ? e.message : "서버 오류가 발생했습니다.";
          // [INTEGRATE] 배포 시 로깅 서비스 연동
          console.error(`[api] ${req.url} 실패:`, message);
          sendError(res, "INTERNAL_ERROR", message, 500);
        }
      });
    },
  };
}
