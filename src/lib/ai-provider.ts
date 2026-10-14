import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

export function getGroqModel(): LanguageModel | null {
  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  if (!groqKey) return null;
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: groqKey,
  });
  return groq("qwen/qwen3.8-27b");
}

export function getGeminiModel(): LanguageModel | null {
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  ).trim();
  if (!geminiKey) return null;
  const google = createGoogleGenerativeAI({
    apiKey: geminiKey,
  });
  return google("gemini-3.1-flash-lite");
}

export function getAiModel(preferred?: "groq" | "gemini"): LanguageModel {
  if (preferred === "gemini") {
    const gemini = getGeminiModel();
    if (gemini) return gemini;
  }

  const groq = getGroqModel();
  if (groq && preferred !== "gemini") return groq;

  const gemini = getGeminiModel();
  if (gemini) return gemini;

  throw new Error(
    "API 키가 설정되지 않았습니다. .env.local 파일에 GROQ_API_KEY 또는 GEMINI_API_KEY를 입력해 주세요."
  );
}
