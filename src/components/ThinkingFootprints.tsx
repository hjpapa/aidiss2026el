import { READINESS_CRITERIA } from "@/data/readiness";
import type { DebateState, GradeBand } from "@/types/debate";

interface ThinkingFootprintsProps {
  state: DebateState;
  gradeBand: GradeBand;
  onEvidenceClick?: (messageId: string) => void;
}

export function ThinkingFootprints({ state, gradeBand, onEvidenceClick }: ThinkingFootprintsProps) {
  const completed = state.readiness.filter((item) => item.completed).length;
  return (
    <section className="footprints-card" aria-labelledby="footprints-title">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">생각 발자국</span>
          <h2 id="footprints-title">다섯 방향으로 살펴봐요</h2>
        </div>
        <span className="progress-count" aria-label={`다섯 항목 중 ${completed}개 완료`}>
          {completed}/5
        </span>
      </div>
      <ul className="footprint-list">
        {READINESS_CRITERIA.map((definition) => {
          const status = state.readiness.find((item) => item.id === definition.id);
          const evidence = status?.evidence[0];
          return (
            <li key={definition.id} className={status?.completed ? "is-complete" : ""}>
              <span className="footprint-icon" aria-hidden="true">
                {status?.completed ? "🐾" : definition.icon}
              </span>
              <span className="footprint-copy">
                <strong>{definition.shortLabel}</strong>
                <small>{definition.label[gradeBand]}</small>
              </span>
              <span className="footprint-state">{status?.completed ? "완료" : "아직"}</span>
              {evidence && onEvidenceClick ? (
                <button type="button" className="evidence-link" onClick={() => onEvidenceClick(evidence.messageId)}>
                  <span className="sr-only">{definition.shortLabel} 근거인 </span>내 말 보기
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
