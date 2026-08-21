export type GradeBand = "g34" | "g56";
export type PetId = "lumi" | "toto" | "pori" | "momo";
export type TopicId =
  | "ai-answer-trust"
  | "ai-opinion"
  | "ai-grading"
  | "face-synthesis"
  | "recommendation"
  | "face-attendance"
  | "location-tracking"
  | "paid-ai-fairness";
export type InitialStance = "a" | "b";
export type FinalStance = "agree" | "conditional" | "disagree";
export type SessionStatus = "active" | "ready" | "reflecting" | "completed";
export type MessageRole = "learner" | "opponent_pet" | "ally_pet" | "system";
export type MessageKind = "move" | "guidance" | "safety";
export type PersistenceStatus = "stored" | "local_only" | "disabled";

export type ReadinessId =
  | "technical_mechanism"
  | "benefit_and_risk"
  | "other_stakeholder"
  | "counterargument_response"
  | "stance_with_reason";

export type ByGrade<T = string> = Record<GradeBand, T>;

export interface PetProfile {
  id: PetId;
  name: string;
  shortName: string;
  lens: string;
  emoji: string;
  color: string;
  intro: ByGrade;
  strength: ByGrade;
  watchOut: ByGrade;
  debateStyle: ByGrade;
}

export interface QuizOption {
  petId: PetId;
  text: ByGrade;
}

export interface QuizQuestion {
  id: string;
  situation: ByGrade;
  options: [QuizOption, QuizOption];
}

export interface TopicQuestionSet {
  technical_mechanism: ByGrade;
  benefit_and_risk: ByGrade;
  other_stakeholder: ByGrade;
  counterargument_response: ByGrade;
  stance_with_reason: ByGrade;
}

export interface DebateTopic {
  id: TopicId;
  icon: string;
  category: "ai" | "digital";
  title: ByGrade;
  shortDescription: ByGrade;
  stanceA: ByGrade;
  stanceB: ByGrade;
  technicalCore: ByGrade;
  concepts: string[];
  benefits: ByGrade<string[]>;
  risks: ByGrade<string[]>;
  stakeholders: ByGrade<string[]>;
  opponentQuestions: TopicQuestionSet;
}

export interface EvidenceRef {
  messageId: string;
  quote: string;
}

export interface ReadinessStatus {
  id: ReadinessId;
  completed: boolean;
  evidence: EvidenceRef[];
}

export interface DebateState {
  summary: string;
  keyClaims: string[];
  technicalIdeas: string[];
  benefits: string[];
  risks: string[];
  stakeholderViews: string[];
  currentPosition: string;
  readiness: ReadinessStatus[];
}

export interface DebateMessage {
  id: string;
  requestId?: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
  replyToMessageId?: string;
}

export interface SessionSetup {
  gradeBand: GradeBand;
  learnerPetId: PetId;
  opponentPetId: PetId;
  topicId: TopicId;
  initialStance: InitialStance;
}

export interface ReflectionDraft {
  stance: FinalStance;
  myThinking: string;
  hardestCounterpoint: string;
  technicalUnderstanding: string;
}

export interface ReviewResult {
  learnerSaid: Array<{
    title: string;
    explanation: string;
    evidence: EvidenceRef[];
  }>;
  systemInferred: Array<{
    interpretation: string;
    confidence: "low" | "medium" | "high";
    basedOnMessageIds: string[];
  }>;
  systemRecommended: Array<{
    nextQuestion: string;
    reason: string;
  }>;
  feedback: string;
  sentenceStarters: string[];
}

export interface LocalDebateSession {
  schemaVersion: 1;
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
  setup: SessionSetup;
  state: DebateState;
  stateVersion: number;
  stateProof: string;
  messages: DebateMessage[];
  persistence: PersistenceStatus;
  reflectionDraft?: ReflectionDraft;
  review?: ReviewResult;
  reviewId?: string;
  finalReflection?: ReflectionDraft;
  pendingSync: PendingSyncRecord[];
}

export interface PendingSyncRecord {
  requestId: string;
  type: "message" | "generation" | "review" | "reflection";
  payload: Record<string, unknown>;
}

export interface ChatTurnResult {
  acceptedLearnerMessage: DebateMessage;
  opponentMessage: DebateMessage;
  allyHint?: DebateMessage;
  state: DebateState;
  stateVersion: number;
  stateProof: string;
  persistence: PersistenceStatus;
}

export const READINESS_IDS: ReadinessId[] = [
  "technical_mechanism",
  "benefit_and_risk",
  "other_stakeholder",
  "counterargument_response",
  "stance_with_reason",
];

export function createEmptyDebateState(): DebateState {
  return {
    summary: "",
    keyClaims: [],
    technicalIdeas: [],
    benefits: [],
    risks: [],
    stakeholderViews: [],
    currentPosition: "",
    readiness: READINESS_IDS.map((id) => ({ id, completed: false, evidence: [] })),
  };
}
