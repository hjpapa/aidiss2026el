"use client";

import { useMemo, useRef, useState } from "react";

import { PetAvatar } from "@/components/PetAvatar";
import { PET_BY_ID } from "@/data/pets";
import { TOPIC_BY_ID } from "@/data/topics";
import { AppApiError, createReview, submitReflection } from "@/lib/api-client";
import { collectEvidenceMessageIds } from "@/lib/readiness";
import type { FinalStance, LocalDebateSession, ReflectionDraft } from "@/types/debate";

interface ReflectionStepProps {
  session: LocalDebateSession;
  onChange: (session: LocalDebateSession) => Promise<void>;
  onBackToDebate: () => void;
  onNewDebate: () => void;
}

const EMPTY_DRAFT: ReflectionDraft = {
  stance: "conditional",
  myThinking: "",
  hardestCounterpoint: "",
  technicalUnderstanding: "",
};

const STANCES: Array<{ value: FinalStance; label: string; icon: string }> = [
  { value: "agree", label: "동의해요", icon: "👍" },
  { value: "conditional", label: "조건이 필요해요", icon: "🤔" },
  { value: "disagree", label: "동의하지 않아요", icon: "✋" },
];

const CONFIDENCE_LABEL = { low: "낮음", medium: "보통", high: "높음" } as const;

function ReflectionFields({
  value,
  onChange,
  idPrefix,
}: {
  value: ReflectionDraft;
  onChange: (value: ReflectionDraft) => void;
  idPrefix: string;
}) {
  return (
    <div className="reflection-fields">
      <fieldset className="final-stance-fieldset">
        <legend>지금 내 입장은 어디에 가까운가요?</legend>
        <div className="final-stance-options">
          {STANCES.map((item) => (
            <label key={item.value} className={value.stance === item.value ? "is-selected" : ""}>
              <input
                type="radio"
                name={`${idPrefix}-stance`}
                value={item.value}
                checked={value.stance === item.value}
                onChange={() => onChange({ ...value, stance: item.value })}
              />
              <span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="reflection-field" htmlFor={`${idPrefix}-thinking`}>
        <span><strong>내 생각과 까닭</strong><small>처음과 같아도, 달라져도 괜찮아요.</small></span>
        <textarea id={`${idPrefix}-thinking`} rows={4} maxLength={1200} value={value.myThinking} onChange={(event) => onChange({ ...value, myThinking: event.target.value })} placeholder="나는 …라고 생각한다. 왜냐하면 …" />
      </label>
      <label className="reflection-field" htmlFor={`${idPrefix}-counterpoint`}>
        <span><strong>가장 고민된 반대 의견</strong><small>상대 펫의 말 중 멈춰 생각한 점을 써요.</small></span>
        <textarea id={`${idPrefix}-counterpoint`} rows={3} maxLength={600} value={value.hardestCounterpoint} onChange={(event) => onChange({ ...value, hardestCounterpoint: event.target.value })} placeholder="…라는 의견을 듣고 고민했다." />
      </label>
      <label className="reflection-field" htmlFor={`${idPrefix}-technical`}>
        <span><strong>기술이 작동하는 방식</strong><small>데이터, 알고리즘, 결과를 연결해 봐요.</small></span>
        <textarea id={`${idPrefix}-technical`} rows={3} maxLength={600} value={value.technicalUnderstanding} onChange={(event) => onChange({ ...value, technicalUnderstanding: event.target.value })} placeholder="이 기술은 …을 입력받아 …해서 …을 만든다." />
      </label>
    </div>
  );
}

function draftComplete(draft: ReflectionDraft): boolean {
  return draft.myThinking.trim().length >= 12 && draft.hardestCounterpoint.trim().length >= 5 && draft.technicalUnderstanding.trim().length >= 5;
}

export function ReflectionStep({ session, onChange, onBackToDebate, onNewDebate }: ReflectionStepProps) {
  const [draft, setDraft] = useState<ReflectionDraft>(session.reflectionDraft ?? EMPTY_DRAFT);
  const [finalDraft, setFinalDraft] = useState<ReflectionDraft>(session.finalReflection ?? session.reflectionDraft ?? EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reviewRequestRef = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const finalRequestRef = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const topic = TOPIC_BY_ID[session.setup.topicId];
  const pet = PET_BY_ID[session.setup.learnerPetId];
  const debateMoves = useMemo(
    () =>
      session.messages.filter(
        (message) => message.kind === "move" && (message.role === "learner" || message.role === "opponent_pet"),
      ),
    [session.messages],
  );
  const reviewEvidenceMessages = useMemo(() => {
    const selected = collectEvidenceMessageIds(session.state);
    const byId = new Map(debateMoves.map((message) => [message.id, message]));
    for (const messageId of [...selected]) {
      const replyTo = byId.get(messageId)?.replyToMessageId;
      if (replyTo) selected.add(replyTo);
    }
    for (let index = debateMoves.length - 1; index >= 0 && selected.size < 30; index -= 1) {
      const message = debateMoves[index];
      selected.add(message.id);
      if (message.replyToMessageId && selected.size < 30) selected.add(message.replyToMessageId);
    }
    return debateMoves.filter((message) => selected.has(message.id));
  }, [debateMoves, session.state]);

  const requestReview = async () => {
    if (!draftComplete(draft) || busy) return;
    const fingerprint = JSON.stringify(draft);
    const requestId =
      reviewRequestRef.current?.fingerprint === fingerprint
        ? reviewRequestRef.current.requestId
        : crypto.randomUUID();
    reviewRequestRef.current = { fingerprint, requestId };
    setBusy(true);
    setError("");
    try {
      await onChange({ ...session, status: "reflecting", reflectionDraft: draft });
      const result = await createReview({
        sessionId: session.id,
        token: session.token,
        requestId,
        setup: session.setup,
        state: session.state,
        stateVersion: session.stateVersion,
        stateProof: session.stateProof,
        evidenceMessages: reviewEvidenceMessages,
        draft,
      });
      setFinalDraft(draft);
      await onChange({ ...session, status: "reflecting", reflectionDraft: draft, review: result.review, reviewId: result.reviewId, persistence: result.persistence });
      reviewRequestRef.current = null;
    } catch (cause) {
      setError(cause instanceof AppApiError ? cause.message : "AI 검토를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!session.review || !session.reflectionDraft || !draftComplete(finalDraft) || busy) return;
    const fingerprint = JSON.stringify(finalDraft);
    const requestId =
      finalRequestRef.current?.fingerprint === fingerprint
        ? finalRequestRef.current.requestId
        : crypto.randomUUID();
    finalRequestRef.current = { fingerprint, requestId };
    setBusy(true);
    setError("");
    try {
      const result = await submitReflection({
        sessionId: session.id,
        token: session.token,
        requestId,
        reviewId: session.reviewId,
        draft: session.reflectionDraft,
        final: finalDraft,
      });
      await onChange({ ...session, status: "completed", finalReflection: finalDraft, persistence: result.persistence });
      finalRequestRef.current = null;
    } catch (cause) {
      setError(cause instanceof AppApiError ? cause.message : "최종 성찰을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (session.status === "completed" && session.finalReflection) {
    return (
      <main className="reflection-page result-page">
        <section className="result-hero">
          <PetAvatar petId={pet.id} size="large" />
          <div><span className="eyebrow">토론을 마쳤어요</span><h1>{pet.shortName}와 찾은 나의 기술 관점</h1><p>{topic.title[session.setup.gradeBand]}</p></div>
        </section>
        <section className="final-reflection-card">
          <span className="final-stance-badge">{STANCES.find((item) => item.value === session.finalReflection!.stance)?.label}</span>
          <h2>내가 최종으로 정리한 생각</h2>
          <p>{session.finalReflection.myThinking}</p>
          <dl>
            <div><dt>가장 고민된 반론</dt><dd>{session.finalReflection.hardestCounterpoint}</dd></div>
            <div><dt>내가 이해한 기술 원리</dt><dd>{session.finalReflection.technicalUnderstanding}</dd></div>
          </dl>
        </section>
        <div className="result-actions"><button type="button" className="secondary-button" onClick={() => window.print()}>결과 인쇄하기</button><button type="button" className="primary-button" onClick={onNewDebate}>새 토론 시작하기</button></div>
      </main>
    );
  }

  if (session.review && session.reflectionDraft) {
    return (
      <main className="reflection-page">
        <header className="reflection-header"><span className="eyebrow">성찰 2단계</span><h1>AI의 검토를 참고해 내 말로 완성해요</h1><p>AI 해석은 정답이 아니에요. 맞지 않으면 따르지 않아도 됩니다.</p></header>
        <div className="review-layout">
          <section className="review-card review-card--said">
            <span className="review-label">학생이 실제로 말한 것</span>
            {session.review.learnerSaid.map((item, index) => <article key={`${index}-${item.title}`}><h2>{item.title}</h2><p>{item.explanation}</p><div className="evidence-chips">{item.evidence.map((evidence, evidenceIndex) => <blockquote key={`${evidenceIndex}-${evidence.messageId}`}>“{evidence.quote}”</blockquote>)}</div></article>)}
          </section>
          <section className="review-card review-card--inferred">
            <span className="review-label">AI가 해석한 것</span>
            {session.review.systemInferred.map((item, index) => <article key={index}><p>{item.interpretation}</p><small>AI 해석의 확실성: {CONFIDENCE_LABEL[item.confidence]}</small></article>)}
          </section>
          <section className="review-card review-card--next">
            <span className="review-label">더 생각해 볼 것</span>
            {session.review.systemRecommended.map((item, index) => <article key={index}><h2>{item.nextQuestion}</h2><p>{item.reason}</p></article>)}
          </section>
        </div>
        <section className="final-editor-card">
          <div className="section-heading-row"><div><span className="eyebrow">내 최종 성찰</span><h2>필요한 부분을 직접 고쳐 주세요</h2></div><PetAvatar petId={pet.id} size="small" /></div>
          <p className="ai-feedback"><strong>AI의 짧은 피드백</strong>{session.review.feedback}</p>
           <div className="sentence-starters">{session.review.sentenceStarters.map((text, index) => <span key={`${index}-${text}`}>{text}</span>)}</div>
          <ReflectionFields value={finalDraft} onChange={setFinalDraft} idPrefix="final" />
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <div className="reflection-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBackToDebate}>토론 더 하기</button><button type="button" className="primary-button" disabled={!draftComplete(finalDraft) || busy} onClick={() => void finish()}>{busy ? "저장하는 중…" : "내 말로 최종 확정하기"}</button></div>
        </section>
      </main>
    );
  }

  return (
    <main className="reflection-page">
      <header className="reflection-header"><span className="eyebrow">성찰 1단계</span><h1>AI의 말을 보기 전에 내 생각부터 적어요</h1><p>토론 전과 생각이 같아도, 달라져도 괜찮아요. 중요한 것은 이유예요.</p></header>
      <section className="draft-card">
        <div className="reflection-topic"><span aria-hidden="true">{topic.icon}</span><div><small>토론 주제</small><strong>{topic.title[session.setup.gradeBand]}</strong></div></div>
        <ReflectionFields value={draft} onChange={setDraft} idPrefix="draft" />
        {error ? <p className="error-message" role="alert">{error}</p> : null}
        <div className="reflection-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onBackToDebate}>토론 더 하기</button><button type="button" className="primary-button" disabled={!draftComplete(draft) || busy} onClick={() => void requestReview()}>{busy ? "근거를 살펴보는 중…" : "초안을 저장하고 AI 검토 보기"}</button></div>
      </section>
    </main>
  );
}
