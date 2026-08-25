import {
  ANALYSIS_LEVEL_LABEL,
  ETHICS_PRINCIPLE_BY_ID,
  ETHICS_PRINCIPLES,
  ETHICS_SENSITIVITY,
  THEORY_NOTE,
  THEORY_SOURCES,
} from "@/data/ethics-framework";
import type { GradeBand, ReviewResult } from "@/types/debate";

interface EthicsAnalysisPanelProps {
  analysis: ReviewResult["ethicsAnalysis"];
  gradeBand: GradeBand;
}

export function EthicsAnalysisPanel({ analysis, gradeBand }: EthicsAnalysisPanelProps) {
  const primary = ETHICS_PRINCIPLE_BY_ID[analysis.primaryPrinciple];

  return (
    <section className="ethics-analysis-card" aria-labelledby="ethics-analysis-title">
      <header className="analysis-heading">
        <div>
          <span className="eyebrow">이번 대화의 윤리 렌즈 분석</span>
          <h2 id="ethics-analysis-title">내가 실제로 한 말에서 찾았어요</h2>
        </div>
        <span className="analysis-not-score">점수·승패 아님</span>
      </header>
      <div className="primary-lens-card">
        <span aria-hidden="true">{primary.icon}</span>
        <div>
          <small>이번 대화에서 가장 자주 비춘 가치</small>
          <strong>{primary.name[gradeBand]}</strong>
          <p>{analysis.summary}</p>
        </div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-heading">
          <h3>세 가지 가치 렌즈</h3>
          <p>AI를 볼 때 무엇을 소중히 말했는지 살펴봐요.</p>
        </div>
        <div className="analysis-signal-grid analysis-signal-grid--three">
          {ETHICS_PRINCIPLES.map((definition) => {
            const signal = analysis.principleSignals.find((item) => item.id === definition.id);
            if (!signal) return null;
            return (
              <article key={definition.id} className={`analysis-signal analysis-signal--${signal.level}`}>
                <span className="analysis-icon" aria-hidden="true">{definition.icon}</span>
                <strong>{definition.name[gradeBand]}</strong>
                <span className="analysis-level">{ANALYSIS_LEVEL_LABEL[signal.level]}</span>
                <p>{signal.explanation}</p>
                {signal.evidence.map((evidence) => (
                  <blockquote key={`${definition.id}-${evidence.messageId}`}>“{evidence.quote}”</blockquote>
                ))}
              </article>
            );
          })}
        </div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-heading">
          <h3>네 걸음 생각 과정</h3>
          <p>문제를 알아차린 뒤 행동을 정하기까지의 과정을 살펴봐요.</p>
        </div>
        <div className="analysis-signal-grid analysis-signal-grid--four">
          {ETHICS_SENSITIVITY.map((definition) => {
            const signal = analysis.sensitivitySignals.find((item) => item.id === definition.id);
            if (!signal) return null;
            return (
              <article key={definition.id} className={`analysis-signal analysis-signal--${signal.level}`}>
                <span className="analysis-icon" aria-hidden="true">{definition.icon}</span>
                <strong>{definition.name[gradeBand]}</strong>
                <span className="analysis-level">{ANALYSIS_LEVEL_LABEL[signal.level]}</span>
                <p>{signal.explanation}</p>
                {signal.evidence.map((evidence) => (
                  <blockquote key={`${definition.id}-${evidence.messageId}`}>“{evidence.quote}”</blockquote>
                ))}
              </article>
            );
          })}
        </div>
      </div>

      <details className="analysis-method">
        <summary>분석 기준은 어디에서 왔나요?</summary>
        <p>{THEORY_NOTE.detail}</p>
        <p>이 결과는 검사 점수나 고정된 유형이 아니라 이번 토론에서 확인된 말만 보여 줘요.</p>
        <ul>
          {THEORY_SOURCES.map((source) => <li key={source.title}><strong>{source.title}</strong> — {source.use}</li>)}
        </ul>
      </details>
    </section>
  );
}
