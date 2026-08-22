"use client";

import { useMemo, useState } from "react";

import { PET_BY_ID } from "@/data/pets";
import { TYPE_QUIZ, calculatePetResult } from "@/data/quiz";
import { PetAvatar } from "@/components/PetAvatar";
import type { GradeBand, PetId } from "@/types/debate";

interface TypeQuizProps {
  gradeBand: GradeBand;
  onComplete: (petId: PetId) => void;
  onBack: () => void;
}

export function TypeQuiz({ gradeBand, onComplete, onBack }: TypeQuizProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<PetId[]>([]);
  const [ties, setTies] = useState<PetId[]>([]);
  const question = TYPE_QUIZ[index];
  const progress = useMemo(() => Math.round(((index + 1) / TYPE_QUIZ.length) * 100), [index]);

  const choose = (petId: PetId) => {
    const next = [...answers, petId];
    if (index < TYPE_QUIZ.length - 1) {
      setAnswers(next);
      setIndex(index + 1);
      return;
    }
    const result = calculatePetResult(next);
    if (result.winner) onComplete(result.winner);
    else setTies(result.tied);
  };

  if (ties.length) {
    return (
      <section className="step-card quiz-card" aria-labelledby="tie-title">
        <span className="eyebrow">마지막 선택</span>
        <h1 id="tie-title">{ties.length}가지 관점이 똑같이 가까워요</h1>
        <p className="lead">성격 검사가 아니에요. 오늘 토론에서 먼저 써 보고 싶은 관점을 골라 주세요.</p>
        <div className="choice-grid choice-grid--pets">
          {ties.map((petId) => {
            const pet = PET_BY_ID[petId];
            return (
              <button key={petId} type="button" className="pet-choice" onClick={() => onComplete(petId)}>
                <PetAvatar petId={petId} size="large" />
                <strong>{pet.name}</strong>
                <span>{pet.lens}</span>
                <small>{pet.intro[gradeBand]}</small>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="step-card quiz-card" aria-labelledby="quiz-title">
      <div className="quiz-progress" aria-label={`${TYPE_QUIZ.length}문항 중 ${index + 1}번째`}>
        <span style={{ width: `${Math.max(progress, 8)}%` }} />
      </div>
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">오늘의 생각 친구 찾기 · {index + 1}/{TYPE_QUIZ.length}</span>
          <h1 id="quiz-title">{question.situation[gradeBand]}</h1>
        </div>
      </div>
      <fieldset className="quiz-options">
        <legend className="sr-only">더 먼저 떠오르는 생각을 고르세요</legend>
        {question.options.map((option) => {
          const pet = PET_BY_ID[option.petId];
          return (
            <button key={option.petId} type="button" className="quiz-option" onClick={() => choose(option.petId)}>
              <PetAvatar petId={option.petId} size="small" />
              <span>
                <small>{pet.shortName}의 생각</small>
                <strong>{option.text[gradeBand]}</strong>
              </span>
            </button>
          );
        })}
      </fieldset>
      <button type="button" className="text-button" onClick={onBack}>← 처음으로</button>
    </section>
  );
}
