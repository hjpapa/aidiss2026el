"use client";

import { useState } from "react";

import { PetAvatar } from "@/components/PetAvatar";
import { THEORY_NOTE, THEORY_SOURCES } from "@/data/ethics-framework";
import { PETS, PET_BY_ID } from "@/data/pets";
import { TOPICS, TOPIC_BY_ID } from "@/data/topics";
import type { GradeBand, InitialStance, PetId, SessionSetup, TopicId } from "@/types/debate";

interface SetupStepProps {
  gradeBand: GradeBand;
  learnerPetId: PetId;
  onStart: (setup: SessionSetup) => Promise<void>;
  onRetake: () => void;
}

export function SetupStep({ gradeBand, learnerPetId, onStart, onRetake }: SetupStepProps) {
  const [topicId, setTopicId] = useState<TopicId | null>(null);
  const [stance, setStance] = useState<InitialStance | null>(null);
  const [opponentPetId, setOpponentPetId] = useState<PetId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const learnerPet = PET_BY_ID[learnerPetId];
  const topic = topicId ? TOPIC_BY_ID[topicId] : null;

  const start = async () => {
    if (!topicId || !stance || !opponentPetId) return;
    setBusy(true);
    setError("");
    try {
      await onStart({ gradeBand, learnerPetId, opponentPetId, topicId, initialStance: stance });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "토론을 시작하지 못했어요.");
      setBusy(false);
    }
  };

  return (
    <div className="setup-stack">
      <section className="pet-result-card" aria-labelledby="pet-result-title">
        <div className="pet-result-visual">
          <span className="sparkle sparkle--one">✦</span>
          <PetAvatar petId={learnerPetId} size="large" />
          <span className="sparkle sparkle--two">✧</span>
        </div>
        <div>
          <span className="eyebrow">오늘의 생각 친구</span>
          <h1 id="pet-result-title">{learnerPet.name}와 한 팀이에요</h1>
          <div className="pet-role-badges">
            <span>{learnerPet.roleName[gradeBand]}</span>
            <span>{learnerPet.principleName[gradeBand]} 렌즈</span>
          </div>
          <p className="lead">{learnerPet.intro[gradeBand]}</p>
          <div className="pet-traits">
            <p><strong>잘 보는 것</strong>{learnerPet.strength[gradeBand]}</p>
            <p><strong>함께 살필 것</strong>{learnerPet.watchOut[gradeBand]}</p>
          </div>
          <p className="guiding-question"><strong>이 펫의 첫 질문</strong>{learnerPet.guidingQuestion[gradeBand]}</p>
          <details className="theory-note">
            <summary>이 유형은 어떻게 만들었나요?</summary>
            <p>{THEORY_NOTE.detail}</p>
            <small>성격이나 능력을 재는 검사가 아니라, 오늘 먼저 고른 생각 관점이에요.</small>
            <ul>
              {THEORY_SOURCES.map((source) => <li key={source.title}><strong>{source.title}</strong> — {source.use}</li>)}
            </ul>
          </details>
          <button type="button" className="text-button" onClick={onRetake}>유형 다시 알아보기</button>
        </div>
      </section>

      <section className="step-card" aria-labelledby="topic-title">
        <span className="step-number">1</span>
        <span className="eyebrow">토론 주제</span>
        <h2 id="topic-title">어떤 기술 문제를 이야기할까요?</h2>
        <fieldset className="topic-grid">
          <legend className="sr-only">토론 주제 선택</legend>
          {TOPICS.map((item) => (
            <label
              key={item.id}
              className={`topic-card ${topicId === item.id ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="topic"
                value={item.id}
                checked={topicId === item.id}
                onChange={() => {
                  setTopicId(item.id);
                  setStance(null);
                }}
              />
              <span className="topic-icon" aria-hidden="true">{item.icon}</span>
              <span className="topic-category">{item.category === "ai" ? "AI" : "디지털 기술"}</span>
              <strong>{item.title[gradeBand]}</strong>
              <small>{item.shortDescription[gradeBand]}</small>
              <span className="value-conflict">{item.valueConflict[gradeBand]}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {topic ? (
        <section className="step-card" aria-labelledby="stance-title">
          <span className="step-number">2</span>
          <span className="eyebrow">처음 입장</span>
          <h2 id="stance-title">지금은 어느 쪽에 더 가까운가요?</h2>
          <div className="selected-dilemma">
            <p>{topic.scenario[gradeBand]}</p>
            <strong>{topic.valueConflict[gradeBand]}</strong>
          </div>
          <p className="helper-text">두 선택 모두 소중한 이유가 있어요. 토론 뒤에 생각이 바뀌어도 괜찮아요.</p>
          <fieldset className="stance-options">
            <legend className="sr-only">처음 입장을 선택하세요</legend>
            {(["a", "b"] as InitialStance[]).map((value) => (
              <label key={value} className={stance === value ? "is-selected" : ""}>
                <input type="radio" name="initial-stance" value={value} checked={stance === value} onChange={() => setStance(value)} />
                <span className="stance-letter">{value.toUpperCase()}</span>
                <strong>{value === "a" ? topic.stanceA[gradeBand] : topic.stanceB[gradeBand]}</strong>
              </label>
            ))}
          </fieldset>
        </section>
      ) : null}

      {topic && stance ? (
        <section className="step-card" aria-labelledby="opponent-title">
          <span className="step-number">3</span>
          <span className="eyebrow">상대 펫</span>
          <h2 id="opponent-title">다른 관점으로 질문할 펫을 골라요</h2>
          <fieldset className="opponent-grid">
            <legend className="sr-only">상대 펫 선택</legend>
            {PETS.filter((pet) => pet.id !== learnerPetId).map((pet) => (
              <label
                key={pet.id}
                className={`opponent-card ${opponentPetId === pet.id ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="opponent-pet"
                  value={pet.id}
                  checked={opponentPetId === pet.id}
                  onChange={() => setOpponentPetId(pet.id)}
                />
                <PetAvatar petId={pet.id} size="medium" />
                <span><strong>{pet.name}</strong><small>{pet.roleName[gradeBand]} · {pet.lens}</small></span>
              </label>
            ))}
          </fieldset>
          {error ? <p className="error-message" role="alert">{error}</p> : null}
          <button type="button" className="primary-button start-button" disabled={!opponentPetId || busy} onClick={start}>
            {busy ? "토론장을 준비하는 중…" : "펫 토론 시작하기"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
