"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HomeBrand } from "@/components/HomeBrand";
import { PetAvatar } from "@/components/PetAvatar";
import { ThinkingFootprints } from "@/components/ThinkingFootprints";
import { getConceptDefinition } from "@/data/glossary";
import { PET_BY_ID } from "@/data/pets";
import { TOPIC_BY_ID } from "@/data/topics";
import { AppApiError, sendChat } from "@/lib/api-client";
import { isReflectionReady } from "@/lib/readiness";
import type { DebateMessage, LocalDebateSession } from "@/types/debate";

interface DebateArenaProps {
  session: LocalDebateSession;
  onChange: (session: LocalDebateSession) => Promise<void>;
  onHome: () => void;
  onReflect: () => void;
  onDelete: () => void;
}

const STARTERS = ["내 생각은 … 왜냐하면 …", "이 기술은 …해서 결과를 만들어요.", "좋은 점은 …지만 걱정되는 점은 …예요."];

function ChatBubble({ message, session }: { message: DebateMessage; session: LocalDebateSession }) {
  const isLearner = message.role === "learner";
  const isOpponent = message.role === "opponent_pet";
  const isAlly = message.role === "ally_pet";
  const petId = isOpponent ? session.setup.opponentPetId : isAlly ? session.setup.learnerPetId : null;
  if (message.role === "system") {
    return (
      <li id={`message-${message.id}`} tabIndex={-1} className={`system-message system-message--${message.kind}`}>
        <span aria-hidden="true">{message.kind === "safety" ? "🛟" : "ℹ️"}</span>{message.content}
      </li>
    );
  }
  return (
    <li id={`message-${message.id}`} tabIndex={-1} className={`chat-row ${isLearner ? "chat-row--learner" : "chat-row--pet"}`}>
      {!isLearner && petId ? <PetAvatar petId={petId} size="small" /> : null}
      <div className={`chat-bubble ${isLearner ? "chat-bubble--learner" : isAlly ? "chat-bubble--ally" : "chat-bubble--opponent"}`}>
        <span className="message-author">
          {isLearner ? "나" : isAlly ? `${PET_BY_ID[petId!].shortName}의 힌트` : `${PET_BY_ID[petId!].name} · AI 토론 펫`}
        </span>
        <p>{message.content}</p>
        {message.kind !== "move" ? <small className="message-kind">토론 근거에 포함되지 않는 안내</small> : null}
      </div>
    </li>
  );
}

export function DebateArena({ session, onChange, onHome, onReflect, onDelete }: DebateArenaProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingLearner, setPendingLearner] = useState<DebateMessage | null>(null);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const stickToBottomRef = useRef(true);
  const pendingRequestRef = useRef<{ content: string; requestId: string } | null>(null);
  const topic = TOPIC_BY_ID[session.setup.topicId];
  const learnerPet = PET_BY_ID[session.setup.learnerPetId];
  const opponentPet = PET_BY_ID[session.setup.opponentPetId];
  const ready = isReflectionReady(session.state);
  const allVisibleMessages = useMemo(
    () => session.messages.filter((message) => message.role !== "ally_pet"),
    [session.messages],
  );
  const visibleMessages = useMemo(
    () => allVisibleMessages.slice(-visibleCount),
    [allVisibleMessages, visibleCount],
  );
  const latestHint = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      if (session.messages[index].role === "ally_pet") return session.messages[index];
    }
    return undefined;
  }, [session.messages]);
  const latestOpponent = useMemo(() => {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      if (session.messages[index].role === "opponent_pet") return session.messages[index];
    }
    return undefined;
  }, [session.messages]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element) return;
    if (stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
      setShowLatestButton(false);
    } else {
      setShowLatestButton(true);
    }
  }, [allVisibleMessages.length, pendingLearner]);

  const submit = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const pending = pendingRequestRef.current;
    const requestId = pending?.content === content ? pending.requestId : crypto.randomUUID();
    pendingRequestRef.current = { content, requestId };
    const optimisticMessage: DebateMessage = {
      id: `pending-${requestId}`,
      requestId,
      role: "learner",
      kind: "move",
      content,
      createdAt: new Date().toISOString(),
    };
    stickToBottomRef.current = true;
    setPendingLearner(optimisticMessage);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const result = await sendChat({
        sessionId: session.id,
        token: session.token,
        requestId,
        message: content,
        setup: session.setup,
        state: session.state,
        stateVersion: session.stateVersion,
        stateProof: session.stateProof,
        recentMessages: session.messages.slice(-16),
      });
      const additions = [
        result.acceptedLearnerMessage,
        result.opponentMessage,
        ...(result.allyHint ? [result.allyHint] : []),
      ];
      const next: LocalDebateSession = {
        ...session,
        status: isReflectionReady(result.state) ? "ready" : "active",
        state: result.state,
        stateVersion: result.stateVersion,
        stateProof: result.stateProof,
        messages: [...session.messages, ...additions],
        persistence: result.persistence,
        reflectionDraft: undefined,
        review: undefined,
        reviewId: undefined,
        finalReflection: undefined,
      };
      setPendingLearner(null);
      await onChange(next);
      pendingRequestRef.current = null;
    } catch (cause) {
      setPendingLearner(null);
      setInput((currentValue) => currentValue || content);
      setError(cause instanceof AppApiError ? cause.message : "메시지를 보내지 못했어요. 입력은 그대로 남아 있어요.");
    } finally {
      setBusy(false);
    }
  };

  const jumpToEvidence = (messageId: string) => {
    stickToBottomRef.current = false;
    setVisibleCount(allVisibleMessages.length);
    requestAnimationFrame(() => {
      const target = document.getElementById(`message-${messageId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  };

  const showLatest = () => {
    stickToBottomRef.current = true;
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setShowLatestButton(false);
  };

  return (
    <div className="debate-page">
      <header className="arena-header">
        <HomeBrand onHome={onHome} className="arena-brand" />
        <div className="arena-topic"><span>{topic.icon}</span><strong>{topic.title[session.setup.gradeBand]}</strong></div>
        <button type="button" className="quiet-button danger-text" disabled={busy} onClick={onDelete}>기록 삭제</button>
      </header>

      <section className="pet-stage" aria-label="토론 참가자">
        <div className="pet-team pet-team--mine">
          <PetAvatar petId={learnerPet.id} size="medium" />
          <div><span>나의 생각 친구</span><strong>{learnerPet.name}</strong><small>{learnerPet.lens}</small></div>
        </div>
        <div className="versus-badge" aria-hidden="true">생각을<br />주고받기</div>
        <div className="pet-team pet-team--opponent">
          <div><span>다른 관점의 AI 펫</span><strong>{opponentPet.name}</strong><small>{opponentPet.lens}</small></div>
          <PetAvatar petId={opponentPet.id} size="medium" />
        </div>
      </section>

      <div className="debate-layout">
        <main className="conversation-card">
          <div className="conversation-toolbar">
            <div>
              <span className="eyebrow">오늘의 윤리 딜레마</span>
              <h1>두 가지 소중한 것 사이에서 생각해요</h1>
            </div>
            <span className={`persistence-pill persistence-pill--${session.persistence}`}>
              {session.persistence === "stored" ? "서버에도 안전하게 저장 중" : "이 기기에 임시 저장 중"}
            </span>
          </div>
          <section className="dilemma-brief" aria-label="토론할 윤리 딜레마">
            <p>{topic.scenario[session.setup.gradeBand]}</p>
            <strong>{topic.valueConflict[session.setup.gradeBand]}</strong>
          </section>
          <ol
            className="chat-transcript"
            aria-label="토론 대화"
            ref={transcriptRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
              stickToBottomRef.current = nearBottom;
              if (nearBottom) setShowLatestButton(false);
            }}
          >
            {visibleCount < allVisibleMessages.length ? (
              <li className="history-loader"><button type="button" onClick={() => setVisibleCount((count) => count + 100)}>이전 대화 더 보기</button></li>
            ) : null}
            {visibleMessages.map((message) => <ChatBubble key={message.id} message={message} session={session} />)}
            {pendingLearner ? (
              <ChatBubble key={pendingLearner.id} message={pendingLearner} session={session} />
            ) : null}
            {busy ? (
              <li className="thinking-row" aria-live="polite">
                <PetAvatar petId={opponentPet.id} size="small" />
                <span className="thinking-dots"><i /><i /><i /></span>
                <span>{opponentPet.shortName}가 네 말을 곰곰이 생각 중이에요</span>
              </li>
            ) : null}
          </ol>
          <p className="sr-only" aria-live="polite">{latestOpponent ? `${opponentPet.shortName}의 새 답변: ${latestOpponent.content}` : ""}</p>
          {showLatestButton ? <button type="button" className="latest-message-button" onClick={showLatest}>새 답변 보기 ↓</button> : null}

          <div className="starter-row" aria-label="문장 시작 도움">
            {STARTERS.map((starter) => (
              <button key={starter} type="button" onClick={() => setInput((current) => current || starter)}>{starter}</button>
            ))}
          </div>
          <div className="composer">
            <label htmlFor="debate-input" className="sr-only">내 생각 입력</label>
            <textarea
              id="debate-input"
              value={input}
              maxLength={800}
              rows={3}
              placeholder="내 입장과 이유를 말해 보세요. 이름이나 학교 이름은 쓰지 않아요."
              onChange={(event) => {
                setInput(event.target.value);
                if (pendingRequestRef.current?.content !== event.target.value.trim()) pendingRequestRef.current = null;
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              aria-describedby={error ? "composer-error" : "composer-help"}
            />
            <div className="composer-footer">
              <small id="composer-help">Ctrl/⌘ + Enter로도 보낼 수 있어요 · {input.length}/800</small>
              <button type="button" className="send-button" disabled={!input.trim() || busy} onClick={() => void submit()}>
                {busy ? "보내는 중…" : "말하기"}<span aria-hidden="true">➤</span>
              </button>
            </div>
          </div>
          {error ? <p id="composer-error" className="error-message" role="alert">{error}</p> : null}
        </main>

        <aside className="thinking-sidebar">
          <ThinkingFootprints
            state={session.state}
            gradeBand={session.setup.gradeBand}
            onEvidenceClick={jumpToEvidence}
            onUseStarter={(starter) => {
              setInput((currentValue) => currentValue || starter);
              document.getElementById("debate-input")?.focus();
            }}
          />
          <section className="hint-card" aria-labelledby="hint-title">
            <div className="hint-pet"><PetAvatar petId={learnerPet.id} size="small" /><span><small>우리 팀 힌트</small><strong id="hint-title">{learnerPet.shortName}가 살짝 알려줘요</strong></span></div>
            <p>{latestHint?.content ?? topic.technicalCore[session.setup.gradeBand]}</p>
            <small>힌트는 내 발언이나 발자국으로 계산되지 않아요.</small>
          </section>
          <section className="concept-card">
            <span className="eyebrow">기술 낱말</span>
            <p className="concept-intro">낯선 낱말을 누르면 쉬운 뜻을 볼 수 있어요.</p>
            <div className="concept-chips">
              {topic.concepts.map((concept) => (
                <details key={concept} className="concept-chip">
                  <summary>{concept}<span aria-hidden="true">?</span></summary>
                  <p>{getConceptDefinition(concept, session.setup.gradeBand)}</p>
                </details>
              ))}
            </div>
          </section>
          <section className={`reflection-gate ${ready ? "is-ready" : ""}`} aria-live="polite">
            {ready ? (
              <>
                <span className="gate-icon" aria-hidden="true">🌟</span>
                <h2>다섯 발자국을 모두 찾았어요!</h2>
                <p>더 이야기해도 좋고, 지금 내 생각을 돌아봐도 좋아요.</p>
                <button type="button" className="primary-button" onClick={onReflect}>성찰하러 가기</button>
                <small>입력창은 계속 열려 있어요.</small>
              </>
            ) : (
              <>
                <span className="gate-icon" aria-hidden="true">🐾</span>
                <h2>횟수 제한은 없어요</h2>
                <p>남은 생각 발자국을 찾을 때까지 천천히 대화해요.</p>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
