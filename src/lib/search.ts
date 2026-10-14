import fs from "node:fs";
import path from "node:path";
import { Chunk, SearchHit } from "./types";

export const WEAK_THRESHOLD = 0.55;

let cachedChunks: Chunk[] | null = null;

export function loadChunks(): Chunk[] {
  if (cachedChunks) return cachedChunks;
  try {
    const filePath = path.join(process.cwd(), "data", "chunks.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedChunks = JSON.parse(raw) as Chunk[];
      return cachedChunks;
    }
  } catch (err) {
    console.error("chunks.json 로드 실패:", err);
  }
  return [];
}

/**
 * 한국어 텍스트에서 검색용 토큰을 추출합니다.
 */
function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  const stopwords = new Set([
    "어떻게", "무엇인가", "알려줘", "알려주세요", "하는가", "있는가",
    "대해", "위해", "통해", "경우", "관한", "대한", "우리", "지금",
    "얼마나", "어떤", "있는", "하는", "입니다", "합니다"
  ]);

  const filtered = words.filter(w => !stopwords.has(w));
  // 바이그램 추가
  const bigrams: string[] = [];
  for (let i = 0; i < filtered.length - 1; i++) {
    bigrams.push(`${filtered[i]}_${filtered[i + 1]}`);
  }

  return [...filtered, ...bigrams];
}

/**
 * 키워드 및 의미 매칭 기반 유사도 검색 (Vercel Serverless 호환)
 */
export function searchChunks(query: string, k = 3): SearchHit[] {
  const chunks = loadChunks();
  if (chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return chunks.slice(0, k).map(c => ({ ...c, score: 0.5 }));
  }

  const scored: SearchHit[] = chunks.map(chunk => {
    const sectionTokens = tokenize(chunk.section);
    const textTokens = tokenize(chunk.text);

    let matchCount = 0;
    let sectionBonus = 0;

    for (const qToken of queryTokens) {
      // 본문 포함 여부
      if (textTokens.includes(qToken)) {
        matchCount += 1.0;
      } else if (chunk.text.includes(qToken)) {
        matchCount += 0.5;
      }

      // 제목(섹션) 일치 시 추가 가중치
      if (sectionTokens.includes(qToken)) {
        sectionBonus += 1.5;
      } else if (chunk.section.includes(qToken)) {
        sectionBonus += 0.8;
      }
    }

    // 기본 점수 계산 (0 ~ 1 정규화)
    const rawScore = (matchCount + sectionBonus) / (queryTokens.length * 1.5);
    // Sigmoid 유사 변환으로 자연스러운 0.3 ~ 0.9 대역 생성
    const normalizedScore = Math.min(0.95, Math.max(0.35, 0.4 + rawScore * 0.45));

    return {
      ...chunk,
      score: Number(normalizedScore.toFixed(3))
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
