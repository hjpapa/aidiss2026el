import { READINESS_CRITERIA } from "@/data/readiness";
import type { DebateState, GradeBand } from "@/types/debate";

interface ThinkingFootprintsProps {
  state: DebateState;
  gradeBand: GradeBand;
  onEvidenceClick?: (messageId: string) => void;
  onUseStarter?: (starter: string) => void;
}

export function ThinkingFootprints({
  state,
  gradeBand,
  onEvidenceClick,
  onUseStarter,
}: ThinkingFootprintsProps) {
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
      <p className="footprints-intro">
        정답을 맞히는 미션이 아니에요. 한 가지 문제를 여러 방향에서 보는 생각 지도예요.
      </p>
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
              <span className="footprint-state">{status?.completed ? "찾았어요" : "살펴보기"}</span>
              {evidence && onEvidenceClick ? (
                <button
                  type="button"
                  className="evidence-link"
                  onClick={() => onEvidenceClick(evidence.messageId)}
                >
                  <span className="sr-only">{definition.shortLabel} 근거인 </span>
                  내 말 보기
                </button>
              ) : null}
              <details className="footprint-help">
                <summary>어떻게 말하면 될까?</summary>
                <p>{definition.help[gradeBand]}</p>
                <blockquote>{definition.starter[gradeBand]}</blockquote>
                {onUseStarter ? (
                  <button
                    type="button"
                    onClick={() => onUseStarter(definition.starter[gradeBand])}
                  >
                    이 시작말 써 보기
                  </button>
                ) : null}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
