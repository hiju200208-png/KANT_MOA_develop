"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getKantBotReply, type ChatMessage } from "./kantBotReply";

const GREETING = "안녕하세요! 칸트봇이에요. 찾으시는 굿즈나 배송·교환 같은 궁금한 점을 편하게 물어봐 주세요!";
const SUGGESTIONS = ["배송은 얼마나 걸려요?", "응원봉 추천해줘", "교환·환불은 어떻게 해요?"];

function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 2.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5Z" />
      <path d="M19 14.5c.2 1.9 1.1 2.8 3 3-1.9.2-2.8 1.1-3 3-.2-1.9-1.1-2.8-3-3 1.9-.2 2.8-1.1 3-3Z" opacity=".7" />
    </svg>
  );
}

// 화면 오른쪽 아래 떠 있는 칸트봇. 버튼을 누르면 대화창이 열린다 (페이지를 가리지 않는 비모달 창)
export function KantBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 0, role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || waiting) return;
    const userMessage: ChatMessage = { id: nextId.current++, role: "user", text: message };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setWaiting(true);
    try {
      const reply = await getKantBotReply(message, history);
      setMessages((current) => [...current, { id: nextId.current++, role: "bot", text: reply }]);
    } catch {
      setMessages((current) => [...current, { id: nextId.current++, role: "bot", text: "잠시 문제가 생겼어요. 다시 한 번 말씀해 주세요." }]);
    } finally {
      setWaiting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  const onlyGreeting = messages.length === 1;

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="칸트봇"
          onKeyDown={(event) => event.key === "Escape" && close()}
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[45] flex h-[min(70dvh,560px)] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgb(17_18_20/0.35)] md:inset-x-auto md:right-6 md:bottom-24 md:w-[380px]"
        >
          <header className="flex items-center gap-3 bg-[linear-gradient(135deg,var(--brand-strong),#8a70df)] px-5 py-4 text-white">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20">
              <SparkleIcon className="size-5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-white">칸트봇</h2>
              <p className="text-xs text-white/80">KANT MOA 쇼핑 도우미 · 무엇이든 물어보세요</p>
            </div>
            <button type="button" onClick={close} aria-label="칸트봇 닫기" className="grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                    message.role === "user" ? "rounded-br-md bg-foreground text-white" : "rounded-bl-md bg-white text-foreground shadow-sm"
                  }`}
                >
                  <span className="sr-only">{message.role === "user" ? "나: " : "칸트봇: "}</span>
                  {message.text}
                </p>
              </div>
            ))}
            {waiting && (
              <div className="flex justify-start" aria-label="칸트봇이 답변을 작성하는 중">
                <span className="flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-4 shadow-sm">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="size-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              </div>
            )}
            {onlyGreeting && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-violet-300 hover:text-violet-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line bg-white p-3">
            <label htmlFor="kantbot-input" className="sr-only">칸트봇에게 메시지 보내기</label>
            <input
              id="kantbot-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="예: SODA FM 인형 추천해줘"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-full bg-neutral-100 px-4 text-sm outline-none placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-violet-300"
            />
            <button
              type="submit"
              disabled={!input.trim() || waiting}
              className="h-11 shrink-0 rounded-full bg-[linear-gradient(135deg,var(--brand-strong),#8a70df)] px-5 text-sm font-bold text-white transition-opacity disabled:opacity-40"
            >
              전송
            </button>
          </form>
        </section>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? "칸트봇 닫기" : "칸트봇 열기"}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[45] flex h-14 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--brand-strong),#8a70df)] px-5 font-bold text-white shadow-[0_12px_30px_-8px_rgb(105_65_198/0.6)] transition-transform hover:-translate-y-0.5 md:right-6 md:bottom-6"
      >
        <SparkleIcon className="size-5 text-white" />
        <span className="hidden text-sm text-white sm:inline">{open ? "닫기" : "칸트봇"}</span>
      </button>
    </>
  );
}
