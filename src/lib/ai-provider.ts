import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

export function getAiModel(): LanguageModel {
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  ).trim();

  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  const preferredProvider = (process.env.DEFAULT_PROVIDER || "groq").toLowerCase();

  // 1. Groq 우선 선택 (초고속 0.19초 응답: qwen/qwen3.8-27b)
  if ((preferredProvider === "groq" || !geminiKey) && groqKey) {
    const groq = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
    });
    return groq("qwen/qwen3.8-27b");
  }

  // 2. Google Gemini 선택 시 초경량 고속 모델 (gemini-3.1-flash-lite)
  if (geminiKey) {
    const google = createGoogleGenerativeAI({
      apiKey: geminiKey,
    });
    return google("gemini-3.1-flash-lite");
  }

  // 3. 둘 다 없는 경우 명확한 에러 발생
  throw new Error(
    "API 키가 설정되지 않았습니다. .env.local 파일에 GROQ_API_KEY 또는 GEMINI_API_KEY를 입력해 주세요."
  );
}
