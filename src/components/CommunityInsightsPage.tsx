"use client";

import { useEffect, useRef, useState } from "react";

import { HomeBrand } from "@/components/HomeBrand";
import { PetAvatar } from "@/components/PetAvatar";
import { PET_BY_ID } from "@/data/pets";
import { TOPIC_BY_ID } from "@/data/topics";
import { AppApiError, getCommunityInsights } from "@/lib/api-client";
import type { CommunityInsights, GradeBand } from "@/types/debate";

interface CommunityInsightsPageProps {
  sessionId: string;
  token: string;
  gradeBand: GradeBand;
  onHome: () => void;
  onBack: () => void;
}

export function CommunityInsightsPage({
  sessionId,
  token,
  gradeBand,
  onHome,
  onBack,
}: CommunityInsightsPageProps) {
  const [insights, setInsights] = useState<CommunityInsights | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    void getCommunityInsights(sessionId, token)
      .then((result) => {
        if (active) setInsights(result.insights);
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof AppApiError
            ? cause.message
            : "친구들의 생각을 불러오지 못했어요.",
        );
      });
    return () => {
      active = false;
    };
  }, [reloadKey, sessionId, token]);

  return (
    <main className="reflection-page community-page">
      <nav className="reflection-nav">
        <HomeBrand onHome={onHome} />
      </nav>
      <header className="community-header">
        <span className="eyebrow">함께 만든 생각 지도</span>
        <h1 ref={headingRef} tabIndex={-1}>우리 토론 모음에는 어떤 관점이 있을까요?</h1>
        <p>누가 무엇을 썼는지는 알 수 없고, 보관 중인 완료 토론을 모아 큰 흐름만 살펴봐요.</p>
      </header>

      {!insights && !error ? (
        <section className="community-status-card" aria-live="polite">
          <span className="paw-loader" aria-hidden="true">🐾</span>
          <h2>생각 지도를 만드는 중이에요</h2>
          <p>이름 없는 토론 결과를 안전하게 모으고 있어요.</p>
        </section>
      ) : null}

      {error ? (
        <section className="community-status-card" role="alert">
          <span aria-hidden="true">🧩</span>
          <h2>지금은 생각 지도를 불러오지 못했어요</h2>
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setInsights(null);
              setError("");
              setReloadKey((key) => key + 1);
            }}
          >
            다시 불러오기
          </button>
        </section>
      ) : null}

      {insights?.status === "local_only" ? (
        <section className="community-status-card">
          <span aria-hidden="true">🌱</span>
          <h2>이 토론은 이 기기에만 저장되었어요</h2>
          <p>서버 저장이 연결된 토론을 마치면 친구들의 익명 생각 지도를 볼 수 있어요.</p>
        </section>
      ) : null}

      {insights?.status === "collecting" ? (
        <section className="community-status-card">
          <span aria-hidden="true">🌱</span>
          <h2>아직 생각을 모으고 있어요</h2>
          <p>개인을 짐작할 수 없도록 완료된 토론이 더 모인 뒤 비율을 보여 줄게요.</p>
        </section>
      ) : null}

      {insights?.status === "ready" ? (
        <>
          <section className="community-section" aria-labelledby="pet-ratio-title">
            <div className="community-section-heading">
              <div>
                <span className="eyebrow">관점 펫 비율</span>
                <h2 id="pet-ratio-title">완료된 토론에는 어떤 관점 펫이 있었을까요?</h2>
              </div>
              <span className="community-period">최근 최대 {insights.periodDays}일</span>
            </div>
            <p className="community-explainer">
              유형 확인에서 나온 펫을 기준으로, 현재 보관 중인 완료 토론 수의 비율을 나타냈어요.
            </p>
            <ul className="pet-ratio-list">
              {insights.petRatios.map((ratio) => {
                const pet = PET_BY_ID[ratio.petId];
                return (
                  <li key={ratio.petId}>
                    <PetAvatar petId={ratio.petId} size="small" />
                    <div>
                      <span><strong>{pet.shortName}</strong><b>{ratio.percent}%</b></span>
                      <div
                        className="ratio-track"
                        role="progressbar"
                        aria-label={`${pet.shortName} 비율`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={ratio.percent}
                      >
                        <span style={{ width: `${ratio.percent}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="community-section" aria-labelledby="thought-title">
            <span className="eyebrow">인상적인 생각</span>
            <h2 id="thought-title">이런 이유와 조건도 있었어요</h2>
            {insights.thoughtStatus === "ready" ? (
              <ul className="community-thought-list">
                {insights.thoughts.map((thought, index) => (
                  <li key={`${thought.topicId}-${index}`}>
                    <blockquote>“{thought.text}”</blockquote>
                    <small>{TOPIC_BY_ID[thought.topicId].title[gradeBand]}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="community-collecting">
                <span aria-hidden="true">💭</span>
                <p>익명 소개에 따로 동의한 안전한 생각이 더 모이면 이곳에 보여 줄게요.</p>
              </div>
            )}
          </section>
        </>
      ) : null}

      <aside className="community-privacy-note">
        <strong>숫자를 읽을 때 기억해요</strong>
        <p>학생 수가 아니라 완료된 토론 수의 비율이에요. 한 사람이 여러 번 토론했을 수도 있어요. 이름·세션 번호는 보여 주지 않고, 글은 별도 동의를 받은 경우만 소개해요.</p>
      </aside>
      <div className="community-back">
        <button type="button" className="secondary-button" onClick={onBack}>내 토론 결과로 돌아가기</button>
      </div>
    </main>
  );
}
