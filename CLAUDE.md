# rag-web (쿠팡 고객탄식센터 CS 콘솔 - 상담원 모의 응대 RAG 시스템) — 프로젝트 메모리 & 설계 계약

## 1. 제품 개요
- **목적**: 쿠팡 고객센터(CS) 신입 및 현직 상담원을 위한 모의 응대 시뮬레이터 RAG 시스템.
- **역할 정의**:
  - **사용자**: 쿠팡 고객센터 상담원 (Agent)
  - **챗봇(AI)**: 쿠팡 서비스를 이용 중인 고객 (Customer)
- **상호작용 흐름**:
  - 상담 시작 시 **챗봇(고객)이 먼저 문의/불만 메시지를 1회 전송**.
  - 사용자가 상담원으로서 공감, 확인, 해결책 등 표준 화법으로 답변 전송.
  - 챗봇(고객)은 상담원의 응대 태도와 처리 규정에 맞춰 사실적인 고객 페르소나로 반응.
  - 상담원 화면에는 RAG를 통해 관련 쿠팡 CS 업무 매뉴얼(SOP)이 실시간 추천 제공됨.
- **배포 타겟**: Vercel Serverless 원클릭 배포 최적화.

## 2. 기술 스택
- **프레임워크**: Next.js 16+ (App Router, TypeScript)
- **AI 프레임워크**: Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/react`)
- **LLM 프로바이더**:
  - Google Gemini API (`gemini-1.5-flash`)
  - Groq API (`llama-3.3-70b-versatile`)
  - 환경변수(`.env.local`)에 둘 중 하나의 키만 있어도 자동 인식 및 이중 지원.
- **스타일링**: Tailwind CSS v4, Lucide React (아이콘)
- **RAG 지식베이스**: 쿠팡 고객센터 표준 매뉴얼 청크 (`data/chunks.json`, CP-001 ~ CP-012).

## 3. 핵심 작업 및 커밋 규칙 (반드시 준수)
- ⚠️ **작은 단위의 작업에서는 절대로 임의로 git commit 또는 git push를 하지 않는다.**
- 기능 구현, 리팩토링 등 **큰 단위의 작업이 모두 마무리되고 빌드 검증(`npm run build`)까지 완료되었을 때**,
  커밋할 변경 사항들을 정리하여 **사용자에게 먼저 커밋 여부를 물어보고 승인을 얻은 후에만** 커밋과 푸시를 진행한다.

## 4. 디렉토리 구조 및 역할
- `src/app/page.tsx`: 쿠팡 CS 상담원 콘솔 UI, 고객 첫 메시지 자동 수신, 상담원 빠른 답변 칩, CS 매뉴얼(RAG) 패널, 시나리오 선택 모달.
- `src/app/api/chat/route.ts`: Vercel AI SDK 스트리밍 엔드포인트 (고객 페르소나 응답 생성 및 CS 매뉴얼 RAG 검색 헤더 주입).
- `src/lib/scenarios.ts`: 로켓배송, 로켓프레시, 반품/환불, 와우멤버십, 프레시백, 오배송 등 6대 고객 시나리오 정의.
- `src/lib/prompt.ts`: 쿠팡 고객 페르소나 시스템 프롬프트 (`buildCustomerSystemPrompt`).
- `src/lib/search.ts`: Vercel 호환 초고속 CS 규정 검색 엔진 (`searchChunks`).
- `data/chunks.json`: 쿠팡 CS 공식 처리 기준 12개 청크 (CP-001 ~ CP-012).
- `docs/coupang_cs_sop.md`: 쿠팡 상담원 표준 응대 프로세스 5단계 및 세부 매뉴얼.
