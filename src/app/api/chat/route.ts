import { streamText } from "ai";
import { getGroqModel, getGeminiModel, getAiModel } from "@/lib/ai-provider";
import { searchChunks } from "@/lib/search";
import { buildCustomerSystemPrompt } from "@/lib/prompt";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, scenario, useRag = true } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "메시지가 비어 있습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const lastMessage = messages[messages.length - 1];
    const agentReply = lastMessage.content;

    // 상담원용 CS 매뉴얼 RAG 검색 (고객의 최초 문제 + 상담원 답변 결합 검색)
    const searchQuery = `${scenario?.title || ""} ${scenario?.situationSummary || ""} ${agentReply}`.trim();
    const hits = useRag ? searchChunks(searchQuery, 3) : [];
    const sourcesHeader = Buffer.from(JSON.stringify(hits)).toString("base64");

    const systemPrompt = buildCustomerSystemPrompt(scenario);

    // AI SDK messages 포맷 변환
    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

    const groqModel = getGroqModel();
    const geminiModel = getGeminiModel();

    // 1차 시도: Groq (초고속 스트리밍)
    if (groqModel) {
      try {
        const groqResult = streamText({
          model: groqModel,
          system: systemPrompt,
          messages: formattedMessages,
          temperature: 0.85,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          maxOutputTokens: 150,
        });

        // 스트림 개시 및 첫 청크 확인 (429/인증/한도 에러 감지)
        const reader = groqResult.textStream.getReader();
        const firstChunk = await reader.read();

        if (!firstChunk.done) {
          // Groq 정상 동작 -> 첫 청크 보존한 무중단 스트림 생성
          const combinedStream = new ReadableStream({
            async start(controller) {
              controller.enqueue(new TextEncoder().encode(firstChunk.value));
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  controller.enqueue(new TextEncoder().encode(value));
                }
                controller.close();
              } catch (streamErr) {
                controller.error(streamErr);
              }
            },
          });

          return new Response(combinedStream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "x-rag-sources": sourcesHeader,
              "x-ai-provider": "groq",
            },
          });
        }
      } catch (groqError: any) {
        console.warn(
          "[Dual-LLM Fallback] Groq 한도 초과 또는 오류 발생 -> Google Gemini로 즉시 자동 전환:",
          groqError.message || groqError
        );
      }
    }

    // 2차 시도 (Fallback): Gemini
    if (geminiModel) {
      console.log("[Dual-LLM Fallback] Google Gemini 엔진으로 응답을 스트리밍합니다.");
      const geminiResult = streamText({
        model: geminiModel,
        system: systemPrompt,
        messages: formattedMessages,
        temperature: 0.85,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        maxOutputTokens: 150,
      });

      const response = geminiResult.toTextStreamResponse();
      response.headers.set("x-rag-sources", sourcesHeader);
      response.headers.set("x-ai-provider", "gemini-fallback");
      return response;
    }

    // 둘 다 없을 경우 마지막 기본 모델 시도
    const defaultModel = getAiModel();
    const result = streamText({
      model: defaultModel,
      system: systemPrompt,
      messages: formattedMessages,
      temperature: 0.85,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      maxOutputTokens: 150,
    });

    const response = result.toTextStreamResponse();
    response.headers.set("x-rag-sources", sourcesHeader);
    return response;
  } catch (error: any) {
    console.error("Coupang CS Chat API 오류:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "고객 응답 생성 중 오류가 발생했습니다.",
        hint: !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY
          ? ".env.local 파일에 GEMINI_API_KEY 또는 GROQ_API_KEY를 입력하세요."
          : undefined
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
