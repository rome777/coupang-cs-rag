"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Headphones,
  User,
  Sparkles,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  Square,
  Sparkle,
  UserCheck,
  Shuffle,
  ShieldAlert,
  Moon,
  Sun
} from "lucide-react";
import { SCENARIOS, Scenario } from "@/lib/scenarios";
import { SearchHit } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  sources?: SearchHit[];
}

export default function CoupangCsPage() {
  // 기본값: 다크 모드
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  // 현재 진행 중인 고객 문의 시나리오
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useRag, setUseRag] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [showSopModal, setShowSopModal] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  // 마운트 시 OS/브라우저 테마 기본 감지 및 실시간 변경 연동
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const savedTheme = localStorage.getItem("theme");

    // 저장된 설정이 있으면 우선 적용, 없으면 시스템(OS/브라우저) 테마 따름
    const initialDark = savedTheme !== null ? savedTheme === "dark" : mediaQuery.matches;
    setIsDarkMode(initialDark);

    if (initialDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // 사용자가 직접 토글하지 않은 상태라면, OS 테마 변경 시 자동 반영
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const userTheme = localStorage.getItem("theme");
      if (!userTheme) {
        setIsDarkMode(e.matches);
        if (e.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem("theme", nextDark ? "dark" : "light");
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // 시나리오 시작 및 고객 첫 메시지 세팅
  const startScenario = (scenario: Scenario) => {
    setCurrentScenario(scenario);
    const initialCustomerMessage: Message = {
      id: "initial-customer-msg-" + Date.now(),
      role: "assistant", // 챗봇이 고객 역할
      content: scenario.initialMessage,
      timestamp: formatCurrentTime()
    };
    setMessages([initialCustomerMessage]);
    setInput("");
    setError(null);
    setShowScenarioModal(false);
  };

  // 새 무작위 고객 즉시 배정 (0초 딜레이)
  const handleNextRandomCustomer = () => {
    const available = SCENARIOS.filter(s => s.id !== currentScenario.id);
    const random = available[Math.floor(Math.random() * available.length)] || SCENARIOS[0];
    startScenario(random);
  };

  // 첫 마운트 시 대기 없이 무작위 고객 즉시 배정
  useEffect(() => {
    const randomInitial = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    startScenario(randomInitial);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleSourceExpand = (id: string) => {
    setExpandedSources(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // 상담원(사용자) 답변 전송
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    const agentMessage: Message = {
      id: "agent-" + Date.now(),
      role: "user", // 사용자가 상담원 역할
      content: input.trim(),
      timestamp: formatCurrentTime()
    };

    const newMessages = [...messages, agentMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const customerReplyId = "customer-" + (Date.now() + 1);
    setMessages(prev => [
      ...prev,
      { id: customerReplyId, role: "assistant", content: "", timestamp: formatCurrentTime() }
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          scenario: currentScenario,
          useRag
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `서버 응답 오류 (${res.status})`);
      }

      // x-rag-sources 헤더에서 상담원 참고용 CS 매뉴얼 디코딩
      let sources: SearchHit[] = [];
      const sourcesHeader = res.headers.get("x-rag-sources");
      if (sourcesHeader) {
        try {
          const binary = atob(sourcesHeader);
          const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
          sources = JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
          console.error("출처 헤더 파싱 실패:", e);
        }
      }

      if (!res.body) throw new Error("응답 본문이 비어 있습니다.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        setMessages(prev =>
          prev.map(msg =>
            msg.id === customerReplyId
              ? { ...msg, content: fullText, sources }
              : msg
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("스트리밍 중단됨");
      } else {
        setError(err.message || "고객 응답을 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F4F6F9] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* 상단 통합 헤더: 고객탄식센터 CS 포털 */}
      <header className="bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 md:px-5 py-3 flex items-center justify-between shadow-2xs z-20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl tracking-tight text-[#E52528]">
              coupang
            </span>
            <span className="text-slate-300 dark:text-slate-600 font-light">|</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-[#0074E9]" />
              고객탄식센터 CS 포털
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#0074E9] dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md">
              상담원 모드
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-2.5">
          {/* Light / Dark Mode 토글 버튼 */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">라이트</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">다크</span>
              </>
            )}
          </button>

          {/* RAG 토글 */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <Sparkles className={`w-3.5 h-3.5 ${useRag ? "text-[#0074E9] dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
            <span className="font-medium text-slate-600 dark:text-slate-300">CS 매뉴얼 추천</span>
            <button
              type="button"
              onClick={() => setUseRag(!useRag)}
              className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                useRag ? "bg-[#0074E9]" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  useRag ? "translate-x-3.5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* SOP 안내 버튼 */}
          <button
            onClick={() => setShowSopModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0074E9] dark:text-blue-400" />
            <span className="hidden sm:inline">상담 매뉴얼 (SOP)</span>
            <span className="sm:hidden">매뉴얼</span>
          </button>

          {/* 새 고객 배정 (랜덤) - 즉시 0초 배정 */}
          <button
            onClick={handleNextRandomCustomer}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0074E9] hover:bg-blue-600 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="새로운 고객과 상품을 즉시 랜덤으로 배정받습니다"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새 고객 배정 (랜덤)</span>
            <span className="sm:hidden">새 고객</span>
          </button>

          {/* 시나리오 목록 선택 버튼 */}
          <button
            onClick={() => setShowScenarioModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="기존 시나리오 목록에서 선택"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">시나리오 목록</span>
          </button>
        </div>
      </header>

      {/* 현재 인입 고객 정보 서브바 */}
      <div className="bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 px-4 md:px-5 py-2.5 text-xs shadow-2xs z-10 transition-colors">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {currentScenario.customerName} 고객님
              </span>
              {currentScenario.isWowMember && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded">
                  ★ 와우회원
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">주문번호:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {currentScenario.orderNumber}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">상품:</span>
              <span className="text-slate-800 dark:text-slate-200 truncate max-w-xs font-medium">
                {currentScenario.productName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {currentScenario.category}
            </span>
            <button
              onClick={() => setShowCustomerDetails(!showCustomerDetails)}
              className="text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 flex items-center gap-0.5 text-[11px] cursor-pointer"
            >
              <span>{showCustomerDetails ? "상황 숨기기" : "상황 보기"}</span>
              {showCustomerDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 상황 요약 및 권장 처리 방안 접이식 패널 */}
        {showCustomerDetails && (
          <div className="max-w-5xl mx-auto mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-lg p-2 text-amber-900 dark:text-amber-200">
              <span className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1 mb-0.5">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                고객 문제 상황 요약 (탄식 인입 사유):
              </span>
              <p className="leading-snug">{currentScenario.situationSummary}</p>
            </div>
            <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 rounded-lg p-2 text-blue-900 dark:text-blue-200">
              <span className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1 mb-0.5">
                <CheckCircle2 className="w-3 h-3 text-[#0074E9] dark:text-blue-400" />
                상담원 표준 처리 권장안 (SOP):
              </span>
              <p className="leading-snug">{currentScenario.recommendedResolution}</p>
            </div>
          </div>
        )}
      </div>

      {/* 메인 채팅 스크롤 영역 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl w-full mx-auto space-y-5">
        {/* 상담 시작 안내 배너 */}
        <div className="text-center my-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/80 px-3.5 py-1 rounded-full border border-transparent dark:border-slate-700/60">
            고객탄식센터 1:1 상담 세션 연결됨 · 사용자는 상담원이며 챗봇은 고객입니다
          </span>
        </div>

        {messages.map((message) => {
          const isAgent = message.role === "user"; // 사용자가 상담원!
          const sources = message.sources;

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isAgent ? "justify-end" : "justify-start"}`}
            >
              {/* 고객(봇) 아바타 */}
              {!isAgent && (
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-2xs mt-1">
                  <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
              )}

              <div className="max-w-[82%] space-y-2">
                {/* 발화자 이름 표시: 고객일 때만 표시 */}
                {!isAgent && (
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 justify-start">
                    <span>{currentScenario.customerName} 고객님</span>
                    {message.timestamp && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                        {message.timestamp}
                      </span>
                    )}
                  </div>
                )}
                {isAgent && message.timestamp && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 flex justify-end pr-1">
                    <span>{message.timestamp}</span>
                  </div>
                )}

                {/* 말풍선 (고객의 경우 여러 개 연속 발화 시 개별 버블로 분리 렌더링) */}
                {isAgent ? (
                  <div className="p-3.5 md:p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-2xs bg-[#0074E9] text-white rounded-tr-xs">
                    {message.content}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {message.content ? (
                      message.content
                        .split(/\n\s*\n/)
                        .filter(Boolean)
                        .map((chunk, idx) => (
                          <div
                            key={idx}
                            className="p-3 md:p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-2xs bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs"
                          >
                            {chunk.trim()}
                          </div>
                        ))
                    ) : (
                      <div className="p-3.5 md:p-4 rounded-2xl text-sm leading-relaxed shadow-2xs bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs">
                        <span className="text-slate-400 dark:text-slate-400 italic flex items-center gap-1.5 text-xs">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0074E9] dark:text-blue-400" />
                          고객님이 답변을 작성 중입니다...
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 챗봇(고객) 답변 시 하단에 뜨는 "상담원 참고용 CS 처리 지침 (RAG)" */}
                {!isAgent && sources && sources.length > 0 && (
                  <div className="bg-white/90 dark:bg-[#1E293B]/90 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3 text-xs space-y-2 shadow-2xs">
                    <div
                      className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none"
                      onClick={() => toggleSourceExpand(message.id)}
                    >
                      <span className="flex items-center gap-1.5 text-[#0074E9] dark:text-blue-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        상담원 가이드: 관련 CS 매뉴얼 ({sources.length}건 추천됨)
                      </span>
                      {expandedSources[message.id] ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      )}
                    </div>

                    {/* 추천 매뉴얼 카드 펼침 */}
                    {expandedSources[message.id] && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        {sources.map((s) => (
                          <div
                            key={s.id}
                            className="bg-slate-50 dark:bg-[#0F172A] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                [{s.id}] {s.section}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950 text-[#0074E9] dark:text-blue-400 font-mono font-semibold">
                                적합도: {(s.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {s.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 사용자 프로필 사진 (라벨 텍스트 없음) */}
              {isAgent && (
                <div className="w-8 h-8 rounded-full bg-[#0074E9] text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                  <Headphones className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* 고객 입력 인디케이터 (상담원이 고객 말을 끊을 수 없음) */}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs py-1 pl-11">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0074E9] dark:text-blue-400" />
            <span className="italic">{currentScenario.customerName} 고객님이 답변을 입력하고 있습니다...</span>
          </div>
        )}

        {/* 에러 발생 안내 */}
        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-start gap-2 shadow-2xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">응답 생성 오류</p>
              <p className="mt-0.5">{error}</p>
              <p className="mt-1 text-[11px] text-red-500 dark:text-red-400 font-mono">
                .env.local 파일의 GEMINI_API_KEY 상태를 확인하세요.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 하단 입력 및 추천 답변 패널 */}
      <footer className="bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800 p-3 md:p-4 shadow-lg z-20 transition-colors">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* 상담원 빠른 답변 템플릿 칩 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="shrink-0 font-semibold text-slate-400 dark:text-slate-500 text-[11px] flex items-center gap-1 mr-1">
              <Sparkle className="w-3 h-3 text-[#0074E9] dark:text-blue-400" /> 추천 답변:
            </span>
            {currentScenario.suggestedFirstReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInput(reply)}
                className="shrink-0 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-[#0074E9] dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 rounded-lg text-xs transition-colors cursor-pointer"
              >
                {reply.slice(0, 32)}...
              </button>
            ))}
          </div>

          {/* 입력창 폼 */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="고객님께 전송할 상담원 답변을 입력하세요... (Enter 또는 전송 버튼)"
              className="flex-1 bg-slate-50 dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#0074E9] focus:bg-white dark:focus:bg-[#0F172A] transition-all shadow-2xs"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-[#0074E9] hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
            >
              <span>전송</span>
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1">
            <span>💡 챗봇(고객)은 당신의 응대 태도와 처리 규정에 맞춰 사실적으로 반응합니다.</span>
            <span className="hidden sm:inline">Coupang CS 탄식 시뮬레이터 v2.5</span>
          </div>
        </div>
      </footer>

      {/* 시나리오 목록 선택 모달 */}
      {showScenarioModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0074E9] dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  대표 고객 탄식 시나리오 목록
                </h3>
              </div>
              <button
                onClick={() => setShowScenarioModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              특정 상황을 직접 선택하여 상담 훈련을 진행할 수 있습니다.
            </p>

            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
              {SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => startScenario(sc)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    currentScenario.id === sc.id
                      ? "border-[#0074E9] bg-blue-50/50 dark:bg-blue-950/40 shadow-xs ring-1 ring-[#0074E9]"
                      : "border-slate-200 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {sc.category}
                      </span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {sc.title}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      고객: {sc.customerName} {sc.isWowMember && "★"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-white/70 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700 italic">
                    &quot;{sc.initialMessage}&quot;
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                    <span>주문 상품: {sc.productName}</span>
                    <span className="text-[#0074E9] dark:text-blue-400 font-medium flex items-center gap-1">
                      이 고객과 상담 시작 →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                onClick={handleNextRandomCustomer}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0074E9] hover:bg-blue-600 rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                다른 고객 랜덤 배정 (0초 딜레이)
              </button>
              <button
                onClick={() => setShowScenarioModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쿠팡 CS 매뉴얼(SOP) 모달 */}
      {showSopModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0074E9] dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  쿠팡 고객탄식센터 업무 매뉴얼 (SOP)
                </h3>
              </div>
              <button
                onClick={() => setShowSopModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3.5 text-xs text-slate-600 dark:text-slate-300 pr-1">
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-[#0074E9] dark:text-blue-400" />
                  쿠팡 상담원 표준 응대 5단계 화법
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 pl-1 leading-relaxed">
                  <li><strong>첫인사:</strong> 고객을 위한 최고의 서비스를 약속드리는 쿠팡 상담원 OOO입니다.</li>
                  <li><strong>공감 및 사과:</strong> 고객의 탄식과 불편 상황에 진심으로 공감하고 정중히 사과.</li>
                  <li><strong>정보 확인:</strong> 주문번호, 수취인명, 배송지 주소 신속 확인.</li>
                  <li><strong>대안 제시:</strong> 즉시 재배송 또는 전액 환불 중 고객 선택권 우선 제공.</li>
                  <li><strong>끝인사:</strong> 추가 문의 사항 확인 및 따뜻한 마무리 인사.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">[CP-001] 로켓배송 미배송 / 오배송 처리</h4>
                <p className="leading-relaxed">
                  배송완료 사진 대조 후 분실/오배송 판단 시 즉시 '무상 재배송' 또는 '즉시 환불' 접수. 고객 불편에 대한 사과와 함께 필요 시 쿠팡캐시 1,000~2,000원 적립.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">[CP-002] 로켓프레시 신선식품 파손·변질</h4>
                <p className="leading-relaxed">
                  위생상 실물 회수 생략(고객 자체 폐기 안내). 고객 진술 신뢰를 바탕으로 100% 즉시 환불 또는 재배송 원스톱 처리.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">[CP-003] 반품 회수 지연 대응</h4>
                <p className="leading-relaxed">
                  문 앞 내놓은 반품 물품 회수 2일 이상 지연 시, 전담 기사 긴급 재배차 및 입고 전 '선환불 승인'으로 분실 불안 해소.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">[CP-004] 로켓와우 멤버십 해지 및 환불</h4>
                <p className="leading-relaxed">
                  당월 혜택(무료배송, 반품, 쿠팡플레이) 미이용 시 즉시 전액 환불(7,890원). 1회 이상 이용 시 당월 유지 후 다음 결제일 자동 해지 안내.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-100">[CP-005] 프레시백 수거 및 보증금 정책</h4>
                <p className="leading-relaxed">
                  프레시백 단독 수거 신청 가능. 60일 내 미반납 시 개당 8,000원 보증금 부과되며, 추후 반납 완료 시 전액 환급.
                </p>
              </div>

              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-1">
                <h4 className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  [CP-011] 폭언/악성 민원 상담원 보호 수칙
                </h4>
                <p className="leading-relaxed text-rose-800 dark:text-rose-300">
                  심한 욕설/비하 발언 시: 1차 주의 경고 → 2차 최종 경고 → 3차 통화/채팅 직권 종료 및 팀장 이관.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
