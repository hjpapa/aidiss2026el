import { checkForPii } from "@/lib/safety";
import type {
  CommunityInsights,
  CommunityThought,
  PetId,
  TopicId,
} from "@/types/debate";

export const COMMUNITY_PERIOD_DAYS = 29;
export const MIN_RATIO_SESSIONS = 10;
export const MIN_SHARED_THOUGHTS = 5;

export const COMMUNITY_PET_IDS: PetId[] = ["lumi", "toto", "pori", "momo", "hari", "duri"];

export interface CommunityThoughtCandidate {
  petId: PetId;
  topicId: TopicId;
  myThinking: unknown;
}

interface PrivateThoughtCandidate extends CommunityThought {
  petId: PetId;
}

function ratioPercentages(counts: Record<PetId, number>): CommunityInsights["petRatios"] {
  const total = COMMUNITY_PET_IDS.reduce((sum, petId) => sum + Math.max(0, counts[petId]), 0);
  if (total === 0) return [];

  const parts = COMMUNITY_PET_IDS.map((petId) => {
    const raw = (Math.max(0, counts[petId]) / total) * 100;
    return { petId, percent: Math.floor(raw), remainder: raw - Math.floor(raw) };
  });
  const left = 100 - parts.reduce((sum, item) => sum + item.percent, 0);
  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || COMMUNITY_PET_IDS.indexOf(a.petId) - COMMUNITY_PET_IDS.indexOf(b.petId),
  );
  for (let index = 0; index < left; index += 1) {
    byRemainder[index % byRemainder.length].percent += 1;
  }
  return COMMUNITY_PET_IDS.map((petId) => {
    const item = parts.find((part) => part.petId === petId)!;
    return { petId, percent: item.percent };
  });
}

function thoughtScore(text: string): number {
  let score = Math.min(text.length, 260);
  if (/(왜냐하면|때문|따라서|그래서)/.test(text)) score += 60;
  if (/(하지만|다만|반면|조건)/.test(text)) score += 60;
  if (/(친구|학생|선생님|사람|모두|누구)/.test(text)) score += 40;
  if (/(책임|권리|공평|확인|보호|선택|규칙)/.test(text)) score += 40;
  return score;
}

function excerpt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= 280 ? normalized : `${normalized.slice(0, 277).trimEnd()}…`;
}

function selectDiverseThoughts(candidates: PrivateThoughtCandidate[]): CommunityThought[] {
  const ranked = [...candidates].sort((a, b) => thoughtScore(b.text) - thoughtScore(a.text));
  const selected: PrivateThoughtCandidate[] = [];
  const seenTopics = new Set<TopicId>();
  const seenPets = new Set<PetId>();
  const seenText = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= 6) break;
    if (seenText.has(candidate.text)) continue;
    if (seenTopics.has(candidate.topicId) && seenPets.has(candidate.petId)) continue;
    selected.push(candidate);
    seenTopics.add(candidate.topicId);
    seenPets.add(candidate.petId);
    seenText.add(candidate.text);
  }
  for (const candidate of ranked) {
    if (selected.length >= 6) break;
    if (seenText.has(candidate.text)) continue;
    selected.push(candidate);
    seenText.add(candidate.text);
  }
  return selected.map(({ topicId, text }) => ({ topicId, text }));
}

export function buildCommunityInsights(
  counts: Record<PetId, number>,
  candidates: CommunityThoughtCandidate[],
): CommunityInsights {
  const total = COMMUNITY_PET_IDS.reduce((sum, petId) => sum + Math.max(0, counts[petId]), 0);
  if (total < MIN_RATIO_SESSIONS) {
    return {
      status: "collecting",
      thoughtStatus: "collecting",
      periodDays: COMMUNITY_PERIOD_DAYS,
      petRatios: [],
      thoughts: [],
    };
  }

  const safeThoughts = candidates.flatMap<PrivateThoughtCandidate>((candidate) => {
    if (typeof candidate.myThinking !== "string") return [];
    if (!checkForPii(candidate.myThinking).safe) return [];
    const text = excerpt(candidate.myThinking);
    if (text.length < 24) return [];
    return [{
      petId: candidate.petId,
      topicId: candidate.topicId,
      text,
    }];
  });
  const uniqueSafeThoughts = safeThoughts.filter(
    (candidate, index, all) =>
      all.findIndex((item) => item.text === candidate.text) === index,
  );
  const thoughtStatus =
    uniqueSafeThoughts.length >= MIN_SHARED_THOUGHTS ? "ready" : "collecting";

  return {
    status: "ready",
    thoughtStatus,
    periodDays: COMMUNITY_PERIOD_DAYS,
    petRatios: ratioPercentages(counts),
    thoughts: thoughtStatus === "ready" ? selectDiverseThoughts(uniqueSafeThoughts) : [],
  };
}

export function localOnlyCommunityInsights(): CommunityInsights {
  return {
    status: "local_only",
    thoughtStatus: "collecting",
    periodDays: COMMUNITY_PERIOD_DAYS,
    petRatios: [],
    thoughts: [],
  };
}
