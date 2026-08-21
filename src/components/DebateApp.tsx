"use client";

import { useEffect, useState } from "react";

import { DebateArena } from "@/components/DebateArena";
import { PetAvatar } from "@/components/PetAvatar";
import { ReflectionStep } from "@/components/ReflectionStep";
import { SetupStep } from "@/components/SetupStep";
import { TypeQuiz } from "@/components/TypeQuiz";
import { PETS, PET_BY_ID } from "@/data/pets";
import { TOPIC_BY_ID } from "@/data/topics";
import { createSession, removeServerSession } from "@/lib/api-client";
import { clearExpiredLocalSessions, deleteLocalSession, loadCurrentSession, saveLocalSession } from "@/lib/client-store";
import type { DebateMessage, GradeBand, LocalDebateSession, PetId, SessionSetup } from "@/types/debate";

type AppStep = "loading" | "welcome" | "quiz" | "setup" | "debate" | "reflection";

function newMessage(role: DebateMessage["role"], kind: DebateMessage["kind"], content: string): DebateMessage {
  return { id: crypto.randomUUID(), role, kind, content, createdAt: new Date().toISOString() };
}

export function DebateApp() {
  const [step, setStep] = useState<AppStep>("loading");
  const [gradeBand, setGradeBand] = useState<GradeBand | null>(null);
  const [learnerPetId, setLearnerPetId] = useState<PetId | null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [session, setSession] = useState<LocalDebateSession | null>(null);
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await clearExpiredLocalSessions();
        const saved = await loadCurrentSession();
        if (!active) return;
        if (saved?.stateProof) {
          setSession(saved);
          setGradeBand(saved.setup.gradeBand);
          setLearnerPetId(saved.setup.learnerPetId);
          setStep(saved.status === "reflecting" || saved.status === "completed" ? "reflection" : "debate");
        } else {
          if (saved) await deleteLocalSession(saved.id);
          setStep("welcome");
        }
      } catch {
        if (!active) return;
        setStorageWarning("이 브라우저에서는 기기 저장소를 사용할 수 없어요. 탭을 닫기 전에 토론을 마쳐 주세요.");
        setStep("welcome");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateSession = async (next: LocalDebateSession) => {
    setSession(next);
    try {
      await saveLocalSession(next);
    } catch {
      setStorageWarning("기기 저장에 실패했어요. 현재 화면에서는 계속할 수 있지만 새로고침하면 내용이 사라질 수 있어요.");
    }
  };

  const startSession = async (setup: SessionSetup) => {
    const result = await createSession(setup);
    const topic = TOPIC_BY_ID[setup.topicId];
    const opponent = PET_BY_ID[setup.opponentPetId];
    const opposingStance = setup.initialStance === "a" ? topic.stanceB[setup.gradeBand] : topic.stanceA[setup.gradeBand];
    const messages: DebateMessage[] = [
      newMessage(
        "system",
        "guidance",
        "이곳의 펫은 사람이나 실제 동물이 아닌 AI 토론 상대예요. 이름·학교·연락처는 쓰지 말고, 위험하거나 걱정되는 일은 선생님이나 보호자에게 알려 주세요.",
      ),
      newMessage(
        "opponent_pet",
        "guidance",
        `안녕! 나는 ${opponent.name}, 다른 관점에서 질문하는 AI 토론 펫이야. 나는 우선 ‘${opposingStance}’ 쪽에서 생각해 볼게. ${topic.opponentQuestions.technical_mechanism[setup.gradeBand]}`,
      ),
    ];
    const next: LocalDebateSession = {
      schemaVersion: 1,
      id: result.sessionId,
      token: result.token,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      status: "active",
      setup,
      state: result.state,
      stateVersion: result.stateVersion,
      stateProof: result.stateProof,
      messages,
      persistence: result.persistence,
      pendingSync: [],
    };
    await updateSession(next);
    setStep("debate");
  };

  const resetExperience = async (deleteRemote: boolean) => {
    let warning = "";
    if (session) {
      if (deleteRemote) {
        await removeServerSession(session.id, session.token).catch(() => {
          warning = "기기 기록은 지웠지만 서버 기록 삭제는 확인하지 못했어요. 서버 기록은 보존 기간 안에 자동 삭제됩니다.";
        });
      }
      await deleteLocalSession(session.id).catch(() => {
        warning = "브라우저 저장소의 기록 삭제를 확인하지 못했어요. 브라우저 사이트 데이터에서도 삭제해 주세요.";
      });
    }
    setSession(null);
    setGradeBand(null);
    setLearnerPetId(null);
    setNoticeAccepted(false);
    setStorageWarning(warning);
    setStep("welcome");
  };

  if (step === "loading") {
    return <main className="loading-screen" aria-live="polite"><span className="paw-loader">🐾</span><p>펫 친구들을 깨우는 중이에요…</p></main>;
  }

  if (step === "welcome") {
    return (
      <main className="welcome-page">
        <nav className="top-nav" aria-label="앱 정보">
          <a href="#home" className="brand-lockup"><span aria-hidden="true">🐾</span><strong>AI윤리 펫토론</strong></a>
          <a href="#safety">안전 약속</a>
        </nav>
        <section id="home" className="welcome-hero">
          <div className="hero-copy">
            <span className="hero-kicker">디지털 기술의 속을 들여다보는 대화</span>
            <h1>귀여운 펫과 함께<br /><em>내 생각의 이유</em>를 찾아봐요</h1>
            <p>내 관점과 닮은 펫을 만나고, AI와 디지털 기술이 어떻게 작동하는지 다른 입장의 펫과 천천히 토론해요.</p>
            <div className="hero-badges"><span>횟수 제한 없음</span><span>승패 없는 토론</span><span>마지막 내 말로 성찰</span></div>
          </div>
          <div className="hero-pets" aria-label="네 마리 토론 펫">
            {PETS.map((pet, index) => <div key={pet.id} className={`hero-pet hero-pet--${index + 1}`}><PetAvatar petId={pet.id} size="large" /><span>{pet.shortName}</span></div>)}
            <div className="hero-speech">“기술은 왜<br />그렇게 움직일까?”</div>
          </div>
        </section>

        <section className="onboarding-card" aria-labelledby="grade-title">
          <div className="onboarding-heading"><span className="step-number">1</span><div><span className="eyebrow">시작하기</span><h2 id="grade-title">내 학년을 골라 주세요</h2><p>설명하는 낱말과 질문 길이가 달라져요.</p></div></div>
          <fieldset className="grade-options">
            <legend className="sr-only">학년군 선택</legend>
            <label className={gradeBand === "g34" ? "is-selected" : ""}><input type="radio" name="grade" value="g34" checked={gradeBand === "g34"} onChange={() => setGradeBand("g34")} /><span aria-hidden="true">🌱</span><strong>초등 3–4학년</strong><small>짧고 쉬운 말로 대화해요</small></label>
            <label className={gradeBand === "g56" ? "is-selected" : ""}><input type="radio" name="grade" value="g56" checked={gradeBand === "g56"} onChange={() => setGradeBand("g56")} /><span aria-hidden="true">🌿</span><strong>초등 5–6학년</strong><small>기술 원리와 조건을 더 살펴봐요</small></label>
          </fieldset>
          <div id="safety" className="safety-notice">
            <span className="safety-icon" aria-hidden="true">🛡️</span>
            <div><strong>시작 전 안전 약속</strong><ul><li>이름, 학교, 학급, 전화번호, 주소는 쓰지 않아요.</li><li>대화는 익명으로 최대 30일 이내 저장된 뒤 삭제돼요.</li><li>AI 펫의 말도 틀릴 수 있으니 중요한 내용은 선생님과 확인해요.</li></ul></div>
          </div>
          {storageWarning ? <p className="error-message" role="status">{storageWarning}</p> : null}
          <label className="notice-check"><input type="checkbox" checked={noticeAccepted} onChange={(event) => setNoticeAccepted(event.target.checked)} /><span>선생님 또는 보호자와 안내를 읽고 안전 약속을 확인했어요.</span></label>
          <button type="button" className="primary-button welcome-start" disabled={!gradeBand || !noticeAccepted} onClick={() => setStep("quiz")}>내 생각 친구 찾기 <span aria-hidden="true">→</span></button>
        </section>

        <section className="how-it-works" aria-labelledby="how-title"><span className="eyebrow">오늘의 여정</span><h2 id="how-title">세 걸음이면 시작할 수 있어요</h2><ol><li><span>1</span><strong>관점 펫 찾기</strong><p>정답 없는 상황에서 먼저 드는 생각을 골라요.</p></li><li><span>2</span><strong>기술 문제 토론</strong><p>다른 관점의 AI 펫과 질문을 주고받아요.</p></li><li><span>3</span><strong>내 말로 성찰</strong><p>실제 발언을 돌아보고 최종 생각을 직접 써요.</p></li></ol></section>
      </main>
    );
  }

  if (step === "quiz" && gradeBand) {
    return <main className="focused-page"><TypeQuiz gradeBand={gradeBand} onComplete={(petId) => { setLearnerPetId(petId); setStep("setup"); }} onBack={() => setStep("welcome")} /></main>;
  }

  if (step === "setup" && gradeBand && learnerPetId) {
    return <main className="focused-page focused-page--wide"><SetupStep gradeBand={gradeBand} learnerPetId={learnerPetId} onStart={startSession} onRetake={() => { setLearnerPetId(null); setStep("quiz"); }} /></main>;
  }

  if (step === "debate" && session) {
    return <DebateArena session={session} onChange={updateSession} onReflect={() => { void updateSession({ ...session, status: "reflecting" }); setStep("reflection"); }} onDelete={() => { if (window.confirm("이 기기와 서버의 토론 기록을 모두 삭제할까요? 삭제하면 되돌릴 수 없어요.")) void resetExperience(true); }} />;
  }

  if (step === "reflection" && session) {
    return <ReflectionStep session={session} onChange={updateSession} onBackToDebate={() => { void updateSession({ ...session, status: "ready" }); setStep("debate"); }} onNewDebate={() => void resetExperience(true)} />;
  }

  return <main className="loading-screen"><p>진행 상태를 다시 불러오지 못했어요.</p><button className="primary-button" onClick={() => void resetExperience(false)}>처음으로</button></main>;
}
