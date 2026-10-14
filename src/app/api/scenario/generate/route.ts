import { generateText } from "ai";
import { getAiModel } from "@/lib/ai-provider";
import { loadChunks } from "@/lib/search";
import { Scenario, SCENARIOS } from "@/lib/scenarios";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const chunks = loadChunks();
    if (!chunks || chunks.length === 0) {
      return NextResponse.json(SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]);
    }

    // RAG 지식베이스에서 무작위 청크 1개 선택 (규정 기반 고객 상황 생성)
    const randomChunk = chunks[Math.floor(Math.random() * chunks.length)];

    const model = getAiModel();

    const systemPrompt = `
당신은 쿠팡 고객탄식센터 시뮬레이터의 '고객 인입 시나리오 생성기'입니다.
제공된 쿠팡 CS 공식 매뉴얼(SOP)을 바탕으로, 지금 막 고객센터 1:1 채팅창으로 인입된 실제 한국인 쿠팡 고객의 문제 상황과 첫 발화 메시지를 무작위로 생성하세요.

[랜덤 생성 핵심 지침]
1. 고객명: 매번 성별과 연령대를 고려하여 다양한 실제 한국인 이름(예: 박서연, 정태양, 최유나, 강동훈, 윤지민, 임도현 등)으로 무작위 생성하세요.
2. 상품명: 쿠팡에서 실제 판매되는 극히 구체적인 현실 상품(예: 신선식품, 전자기기, 유아용품, 반려동물 간식, 생필품, 의류 등)으로 매번 다르게 무작위 생성하세요.
3. 첫 탄식 메시지: 실제 겪은 사람만 낼 수 있는 리얼한 말투(답답함, 당황스러움, 억울함, ㅠㅠ, 하소연 등)로 1~3문장 작성하세요.
4. 반드시 아래 JSON 형식으로만 응답하고, 마크다운 코드블록이나 불필요한 부가 설명은 일절 포함하지 마세요.

형식:
{
  "category": "로켓배송",
  "title": "구체적인 탄식 상황 한 줄 제목",
  "customerName": "무작위 한국인 이름",
  "isWowMember": true,
  "orderNumber": "20261014-랜덤숫자7자리",
  "productName": "실제 구체적인 브랜드 및 상품명",
  "orderDate": "어제 저녁 or 오늘 새벽",
  "initialMessage": "고객의 생생한 첫 탄식 메시지",
  "situationSummary": "상황 요약",
  "recommendedResolution": "상담원 표준 처리 권장안",
  "suggestedFirstReplies": [
    "추천 답변 1",
    "추천 답변 2",
    "추천 답변 3"
  ]
}
`.trim();

    const userPrompt = `
[선택된 쿠팡 CS 처리 규정 (RAG 청크)]
규정 ID: ${randomChunk.id}
규정 분야: ${randomChunk.section}
규정 내용:
${randomChunk.text}

위 규정 관련 문제로 지금 막 탄식하며 고객센터에 들어온 무작위 고객의 시나리오 1건을 위 JSON 양식으로 생성하세요. 고객 이름과 상품명, 상황은 완전히 새롭고 기발하게 랜덤으로 작성하세요.
`.trim();

    // 1.0보다 높은 1.25의 높은 Temperature로 예측 불가능하고 풍부한 랜덤성 부여
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 1.25,
    });

    const cleanedText = result.text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedText);

    const generatedScenario: Scenario = {
      id: `gen-${Date.now()}-${randomChunk.id}`,
      category: parsed.category || "로켓배송",
      title: parsed.title || randomChunk.section,
      customerName: parsed.customerName || "김쿠팡",
      isWowMember: parsed.isWowMember ?? true,
      orderNumber: parsed.orderNumber || `20261014-${Math.floor(1000000 + Math.random() * 9000000)}`,
      productName: parsed.productName || "로켓배송 주문 상품",
      orderDate: parsed.orderDate || "최근 주문",
      initialMessage: parsed.initialMessage || "안녕하세요, 주문한 상품에 문제가 있어서 문의드립니다.",
      situationSummary: parsed.situationSummary || randomChunk.section,
      recommendedResolution: parsed.recommendedResolution || randomChunk.text.slice(0, 100),
      suggestedFirstReplies: Array.isArray(parsed.suggestedFirstReplies) && parsed.suggestedFirstReplies.length > 0
        ? parsed.suggestedFirstReplies
        : [
            "안녕하세요 고객님, 쿠팡 고객탄식센터 상담원입니다. 불편을 드려 죄송합니다.",
            "주문번호 확인 후 신속하게 처리 도와드리겠습니다.",
            "즉시 확인하여 재배송 또는 환불 접수를 진행해 드리겠습니다."
          ]
    };

    return NextResponse.json(generatedScenario);
  } catch (error: any) {
    console.error("RAG 기반 시나리오 생성 오류 (Fallback 적용):", error);
    const fallback = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    return NextResponse.json(fallback);
  }
}
