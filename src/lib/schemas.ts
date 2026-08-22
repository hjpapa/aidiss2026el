import { z } from "zod";

export const GradeBandSchema = z.enum(["g34", "g56"]);
export const PetIdSchema = z.enum(["lumi", "toto", "pori", "momo", "hari", "duri"]);
export const TopicIdSchema = z.enum([
  "ai-answer-trust",
  "ai-opinion",
  "ai-grading",
  "face-synthesis",
  "recommendation",
  "face-attendance",
  "location-tracking",
  "paid-ai-fairness",
]);
export const InitialStanceSchema = z.enum(["a", "b"]);
export const FinalStanceSchema = z.enum(["agree", "conditional", "disagree"]);
export const ReadinessIdSchema = z.enum([
  "technical_mechanism",
  "benefit_and_risk",
  "other_stakeholder",
  "counterargument_response",
  "stance_with_reason",
]);

export const SetupSchema = z
  .object({
    gradeBand: GradeBandSchema,
    learnerPetId: PetIdSchema,
    opponentPetId: PetIdSchema,
    topicId: TopicIdSchema,
    initialStance: InitialStanceSchema,
  })
  .refine((value) => value.learnerPetId !== value.opponentPetId, {
    message: "자기 펫과 상대 펫은 달라야 합니다.",
    path: ["opponentPetId"],
  });

export const EvidenceSchema = z.object({
  messageId: z.string().min(1).max(80),
  quote: z.string().min(1).max(100),
});

export const ReadinessStatusSchema = z.object({
  id: ReadinessIdSchema,
  completed: z.boolean(),
  evidence: z.array(EvidenceSchema).max(2),
});

export const DebateStateSchema = z.object({
  summary: z.string().max(1500),
  keyClaims: z.array(z.string().max(180)).max(6),
  technicalIdeas: z.array(z.string().max(180)).max(6),
  benefits: z.array(z.string().max(160)).max(4),
  risks: z.array(z.string().max(160)).max(4),
  stakeholderViews: z.array(z.string().max(180)).max(4),
  currentPosition: z.string().max(240),
  readiness: z.array(ReadinessStatusSchema).length(5),
});

export const MessageSchema = z.object({
  id: z.string().min(1).max(80),
  requestId: z.string().uuid().optional(),
  role: z.enum(["learner", "opponent_pet", "ally_pet", "system"]),
  kind: z.enum(["move", "guidance", "safety"]),
  content: z.string().min(1).max(8000),
  createdAt: z.string().datetime(),
  replyToMessageId: z.string().min(1).max(80).optional(),
});

export const SessionRequestSchema = z.object({
  setup: SetupSchema,
});

export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(32).max(1200),
  requestId: z.string().uuid(),
  message: z.string().trim().min(1).max(800),
  setup: SetupSchema,
  state: DebateStateSchema,
  stateVersion: z.number().int().min(0),
  stateProof: z.string().min(32).max(1200),
  recentMessages: z.array(MessageSchema).max(16),
});

export const ChatModelOutputSchema = z.object({
  opponentReply: z.string().min(1).max(700),
  allyHint: z.string().max(240),
  state: DebateStateSchema,
});

export const ReflectionDraftSchema = z.object({
  stance: FinalStanceSchema,
  myThinking: z.string().trim().min(12).max(1200),
  hardestCounterpoint: z.string().trim().min(5).max(600),
  technicalUnderstanding: z.string().trim().min(5).max(600),
});

export const ReviewResultSchema = z.object({
  learnerSaid: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        explanation: z.string().min(1).max(400),
        evidence: z.array(EvidenceSchema).min(1).max(3),
      }),
    )
    .min(1)
    .max(5),
  systemInferred: z
    .array(
      z.object({
        interpretation: z.string().min(1).max(400),
        confidence: z.enum(["low", "medium", "high"]),
        basedOnMessageIds: z.array(z.string().min(1).max(80)).min(1).max(5),
      }),
    )
    .max(4),
  systemRecommended: z
    .array(
      z.object({
        nextQuestion: z.string().min(1).max(240),
        reason: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(3),
  feedback: z.string().min(1).max(700),
  sentenceStarters: z.array(z.string().min(1).max(140)).max(3),
});

export const ReviewRequestSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(32).max(1200),
  requestId: z.string().uuid(),
  setup: SetupSchema,
  state: DebateStateSchema,
  stateVersion: z.number().int().min(0),
  stateProof: z.string().min(32).max(1200),
  evidenceMessages: z.array(MessageSchema).min(1).max(30),
  draft: ReflectionDraftSchema,
});

export const ReflectionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(32).max(1200),
  requestId: z.string().uuid(),
  reviewId: z.string().uuid().optional(),
  draft: ReflectionDraftSchema,
  final: ReflectionDraftSchema,
});

export type ChatModelOutput = z.infer<typeof ChatModelOutputSchema>;
