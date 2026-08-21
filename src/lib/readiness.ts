import { READINESS_IDS, type DebateMessage, type DebateState, type EvidenceRef } from "@/types/debate";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

export function isValidEvidence(evidence: EvidenceRef, messages: DebateMessage[]): boolean {
  const message = messages.find(
    (candidate) => candidate.id === evidence.messageId && candidate.role === "learner" && candidate.kind === "move",
  );
  if (!message) return false;
  const quote = normalize(evidence.quote);
  return quote.length > 0 && normalize(message.content).includes(quote);
}

export function sanitizeDebateState(
  previous: DebateState,
  proposed: DebateState,
  messages: DebateMessage[],
  currentLearnerMessageId: string,
): DebateState {
  const readiness = READINESS_IDS.map((id) => {
    const before = previous.readiness.find((item) => item.id === id);
    const next = proposed.readiness.find((item) => item.id === id);
    const validNewEvidence = (next?.evidence ?? [])
      .filter((evidence) => {
        if (evidence.messageId !== currentLearnerMessageId) return false;
        if (!isValidEvidence(evidence, messages)) return false;
        if (id !== "counterargument_response") return true;
        const learner = messages.find((message) => message.id === evidence.messageId);
        return Boolean(
          learner?.replyToMessageId &&
            messages.some(
              (message) =>
                message.id === learner.replyToMessageId &&
                message.role === "opponent_pet" &&
                message.kind === "move",
            ),
        );
      })
      .slice(0, 2);

    if (before?.completed) {
      return {
        id,
        completed: true,
        evidence: [...before.evidence, ...validNewEvidence]
          .filter(
            (item, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.messageId === item.messageId && normalize(candidate.quote) === normalize(item.quote),
              ) === index,
          )
          .slice(0, 2),
      };
    }

    return {
      id,
      completed: Boolean(next?.completed && validNewEvidence.length > 0),
      evidence: next?.completed ? validNewEvidence : [],
    };
  });

  return {
    summary: proposed.summary.slice(0, 1500),
    keyClaims: proposed.keyClaims.slice(0, 6),
    technicalIdeas: proposed.technicalIdeas.slice(0, 6),
    benefits: proposed.benefits.slice(0, 4),
    risks: proposed.risks.slice(0, 4),
    stakeholderViews: proposed.stakeholderViews.slice(0, 4),
    currentPosition: proposed.currentPosition.slice(0, 240),
    readiness,
  };
}

export function isReflectionReady(state: DebateState): boolean {
  return READINESS_IDS.every((id) => state.readiness.some((item) => item.id === id && item.completed));
}

export function hasVerifiedReadiness(state: DebateState, messages: DebateMessage[]): boolean {
  return READINESS_IDS.every((id) => {
    const criterion = state.readiness.find((item) => item.id === id);
    return Boolean(
      criterion?.completed &&
        criterion.evidence.length > 0 &&
        criterion.evidence.every((evidence) => isValidEvidence(evidence, messages)),
    );
  });
}

export function collectEvidenceMessageIds(state: DebateState): Set<string> {
  return new Set(state.readiness.flatMap((item) => item.evidence.map((evidence) => evidence.messageId)));
}
