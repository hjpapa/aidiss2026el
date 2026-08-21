import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { TOPIC_BY_ID } from "@/data/topics";
import { buildChatPrompt, buildReviewPrompt } from "@/lib/prompts";
import { ChatModelOutputSchema, ReviewResultSchema, type ChatModelOutput } from "@/lib/schemas";
import type {
  DebateMessage,
  DebateState,
  ReflectionDraft,
  ReviewResult,
  SessionSetup,
} from "@/types/debate";

export interface GenerationMeta {
  responseId: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

function isMock(): boolean {
  return process.env.APP_MODE === "mock" || process.env.NODE_ENV === "test";
}

export async function moderateText(content: string): Promise<{ flagged: boolean; categories: string[] }> {
  if (isMock()) return { flagged: false, categories: [] };
  const result = await openai().moderations.create({ model: "omni-moderation-latest", input: content });
  const first = result.results[0];
  const categories = Object.entries(first?.categories ?? {})
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);
  return { flagged: Boolean(first?.flagged), categories };
}

function mockChatTurn(
  setup: SessionSetup,
  state: DebateState,
  messages: DebateMessage[],
): ChatModelOutput {
  const topic = TOPIC_BY_ID[setup.topicId];
  const learner = [...messages].reverse().find((message) => message.role === "learner" && message.kind === "move");
  const nextMissing = state.readiness.find((item) => !item.completed);
  const readiness = state.readiness.map((item) =>
    item.id === nextMissing?.id && learner
      ? {
          ...item,
          completed: true,
          evidence: [{ messageId: learner.id, quote: learner.content.slice(0, 100) }],
        }
      : item,
  );
  const nextAfter = readiness.find((item) => !item.completed)?.id ?? "stance_with_reason";

  return {
    opponentReply: `네 생각에서 중요한 이유를 하나 찾았어. 그런데 다른 입장에서는 이렇게 물을 수 있어. ${topic.opponentQuestions[nextAfter][setup.gradeBand]}`,
    allyHint: "기술이 무엇을 입력받아 어떤 결과를 만드는지 연결해서 말해 볼까?",
    state: {
      ...state,
      summary: `${state.summary} 학생은 ${learner?.content ?? "생각을 준비 중"}.`.trim().slice(0, 1500),
      keyClaims: learner ? [...state.keyClaims, learner.content.slice(0, 160)].slice(-6) : state.keyClaims,
      readiness,
    },
  };
}

export async function generateChatTurn(args: {
  setup: SessionSetup;
  state: DebateState;
  messages: DebateMessage[];
  safetyIdentifier: string;
}): Promise<{ result: ChatModelOutput; meta: GenerationMeta }> {
  const started = Date.now();
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  if (isMock()) {
    return {
      result: mockChatTurn(args.setup, args.state, args.messages),
      meta: { responseId: "mock", model: "mock", inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started },
    };
  }

  const prompt = buildChatPrompt(args.setup, args.state, args.messages);
  const response = await openai().responses.parse({
    model,
    instructions: prompt.instructions,
    input: prompt.input,
    reasoning: { effort: (process.env.OPENAI_CHAT_REASONING_EFFORT || "low") as "low" },
    text: { format: zodTextFormat(ChatModelOutputSchema, "pet_debate_turn") },
    max_output_tokens: 2200,
    store: false,
    safety_identifier: args.safetyIdentifier,
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no parsed debate turn.");
  return {
    result: response.output_parsed,
    meta: {
      responseId: response.id,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      latencyMs: Date.now() - started,
    },
  };
}

function mockReview(messages: DebateMessage[], draft: ReflectionDraft): ReviewResult {
  const learner = messages.filter((message) => message.role === "learner" && message.kind === "move");
  const evidence = learner.slice(0, 2).map((message) => ({
    messageId: message.id,
    quote: message.content.slice(0, 100),
  }));
  return {
    learnerSaid: [
      {
        title: "내 입장과 이유",
        explanation: "처음 입장을 유지하거나 조정하며 자신의 이유를 말했어요.",
        evidence: evidence.length ? evidence : [{ messageId: "none", quote: "근거를 확인해 주세요" }],
      },
    ],
    systemInferred: [
      {
        interpretation: "기술의 편리함과 위험을 함께 보려는 생각이 드러났다고 AI가 해석했어요.",
        confidence: "medium",
        basedOnMessageIds: learner.slice(0, 2).map((message) => message.id),
      },
    ],
    systemRecommended: [
      { nextQuestion: "내가 정한 조건을 실제로 누가 확인하면 좋을까?", reason: "책임을 맡을 사람까지 생각해 보기 위해서예요." },
    ],
    feedback: `초안에서 '${draft.myThinking.slice(0, 50)}'라는 중심 생각이 보여요. 반대 입장이 걱정하는 점도 한 문장 더 연결해 보세요.`,
    sentenceStarters: ["내가 중요하게 생각한 조건은 …", "반대 의견을 듣고 새로 생각한 점은 …"],
  };
}

export async function generateReview(args: {
  setup: SessionSetup;
  state: DebateState;
  messages: DebateMessage[];
  draft: ReflectionDraft;
  safetyIdentifier: string;
}): Promise<{ result: ReviewResult; meta: GenerationMeta }> {
  const started = Date.now();
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  if (isMock()) {
    return {
      result: mockReview(args.messages, args.draft),
      meta: { responseId: "mock-review", model: "mock", inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started },
    };
  }

  const prompt = buildReviewPrompt(args.setup, args.state, args.messages, args.draft);
  const response = await openai().responses.parse({
    model,
    instructions: prompt.instructions,
    input: prompt.input,
    reasoning: { effort: (process.env.OPENAI_REVIEW_REASONING_EFFORT || "medium") as "medium" },
    text: { format: zodTextFormat(ReviewResultSchema, "pet_debate_review") },
    max_output_tokens: 3000,
    store: false,
    safety_identifier: args.safetyIdentifier,
  });
  if (!response.output_parsed) throw new Error("OpenAI returned no parsed review.");
  return {
    result: response.output_parsed,
    meta: {
      responseId: response.id,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
      latencyMs: Date.now() - started,
    },
  };
}
