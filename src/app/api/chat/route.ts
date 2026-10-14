import { streamText } from "ai";
import { getAiModel } from "@/lib/ai-provider";
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

    const model = getAiModel();
    const systemPrompt = buildCustomerSystemPrompt(scenario);

    // AI SDK messages 포맷 변환
    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

    const result = streamText({
      model,
      system: systemPrompt,
      messages: formattedMessages,
      temperature: 0.85,
      maxOutputTokens: 150,
    });

    const sourcesHeader = Buffer.from(JSON.stringify(hits)).toString("base64");

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
