// 모듈 B 종단 검증: 테스트 사진 3장을 /api/photo/analyze에 업로드
const fs = require("node:fs");
const path = require("node:path");

const PHOTOS = path.resolve(__dirname, "test-photos");
const URL = process.env.TARGET ?? "http://localhost:5173/api/photo/analyze";

async function upload(files, label) {
  const form = new FormData();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(PHOTOS, f));
    form.append("photos", new Blob([buf], { type: "image/png" }), f);
  }
  console.log(`\n=== ${label} (${files.length}장) ===`);
  const t0 = Date.now();
  const res = await fetch(URL, { method: "POST", body: form });
  const ms = Date.now() - t0;
  const json = await res.json();
  console.log(`HTTP ${res.status} · ${ms}ms`);
  if (!res.ok) {
    console.log(JSON.stringify(json, null, 2).slice(0, 600));
    return null;
  }
  console.log(`totalScore: ${json.totalScore}`);
  for (const it of json.items) {
    console.log(`  [${it.grade}] ${it.label} (${it.score})`);
    console.log(`    관찰: ${it.observation}`);
    console.log(`    해석: ${it.interpretation.slice(0, 90)}${it.interpretation.length > 90 ? "…" : ""}`);
  }
  console.log(`suggestions: ${json.suggestions.length}개`);
  for (const s of json.suggestions) console.log(`  - ${s.slice(0, 100)}`);
  return json;
}

(async () => {
  try {
    const r1 = await upload(["test-house-square.png"], "테스트 1 · 정방형 단독주택+마당 (양호 예상)");
    const r2 = await upload(["test-house-mainroad.png"], "테스트 2 · 대로변 다세대주택 (주의 예상)");
    const r3 = await upload(["test-house-deadend.png"], "테스트 3 · ㄱ자+막다른길 (주의 예상)");
    const r4 = await upload(["test-house-square.png", "test-house-mainroad.png", "test-house-deadend.png"], "테스트 4 · 3장 동시 (병합 검증)");

    const all = [r1, r2, r3, r4].filter(Boolean);
    console.log(`\n=== 요약 ===`);
    console.log(`성공: ${all.length}/4`);
    const scores = all.map((r) => r.totalScore);
    console.log(`점수 분포: ${scores.join(", ")}`);
    const uninterp = all.filter((r) => r.items.some((i) => i.key === "vision.uninterpretable"));
    console.log(`uninterpretable 응답: ${uninterp.length}개`);
  } catch (e) {
    console.error("FATAL:", e.message);
    process.exit(1);
  }
})();
