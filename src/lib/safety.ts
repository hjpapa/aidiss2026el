export interface SafetyCheck {
  safe: boolean;
  categories: string[];
  message?: string;
}

const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "전화번호", pattern: /(?:01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  { label: "전화번호", pattern: /(?:\+82[-.\s]?)?0?(?:2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  { label: "이메일", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "주민등록번호", pattern: /\d{6}[-\s]?[1-4]\d{6}/ },
  { label: "학교 이름", pattern: /[가-힣A-Za-z0-9]{2,15}(?:초등학교|중학교|고등학교)/ },
  { label: "학교 이름", pattern: /[가-힣A-Za-z0-9]{2,15}(?:초|중|고)\s*(?:다녀|학생|[1-6]\s*학년)/ },
  { label: "학년·반·번호", pattern: /[1-6]\s*학년\s*[1-9]\d?\s*반(?:\s*\d{1,2}\s*번)?/ },
  { label: "이름", pattern: /(?:내|제)\s*이름(?:은|이)?\s*[가-힣]{2,5}/ },
  { label: "이름", pattern: /저는?\s*[가-힣]{2,5}(?:입니다|예요|이에요)/ },
  {
    label: "다른 사람 이름",
    pattern:
      /(?:우리\s*반(?:\s*친구)?|같은\s*반(?:\s*친구)?|친구|학생|선생님)\s+(?!(?:모두|누구|각자|서로|권리|안전|생각|얼굴|정보|기회|입장|마음|피해|이유|이익)(?:은|는|이|가|에게|와|과|도|의))(?:(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍)[가-힣]{1,3})(?:은|는|이|가|에게|와|과|도|의)(?=[\s,.!?]|$)/,
  },
  {
    label: "다른 사람 이름",
    pattern: /(?:(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍)[가-힣]{1,3})(?:이라는|라는)\s+(?:친구|학생|선생님)/,
  },
  {
    label: "SNS·메신저 아이디",
    pattern: /(?:카톡|카카오톡|디스코드|인스타(?:그램)?|틱톡)\s*(?:아이디|id|계정)?\s*(?:은|는|:)?\s*[@A-Za-z0-9_.-]{3,30}/i,
  },
  { label: "상세 주소", pattern: /[가-힣A-Za-z0-9]{2,20}(?:로|길)\s?\d{1,4}(?:-\d{1,4})?/ },
];

function normalizeForSafety(content: string): string {
  return content.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function checkForPii(content: string): SafetyCheck {
  const normalized = normalizeForSafety(content);
  const categories = [
    ...new Set(PII_PATTERNS.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label)),
  ];
  return categories.length
    ? {
        safe: false,
        categories,
        message: `개인정보(${categories.join(", ")})로 보이는 내용은 보내지 않았어요. 그 부분을 빼고 다시 말해 주세요.`,
      }
    : { safe: true, categories: [] };
}

export function guidanceFor(content: string): string | null {
  const compact = normalizeForSafety(content).replace(/\s+/g, "").toLowerCase();
  if (/^(몰라|모르겠어|모르겠어요|글쎄|패스|싫어)[.!?~]*$/.test(compact)) {
    return "괜찮아! 내 펫의 힌트를 보고, ‘좋은 점은 …, 걱정되는 점은 …’처럼 한 가지만 골라 말해 보자.";
  }
  if (/(답.*대신.*써|정답.*말해|그냥.*작성|숙제.*해줘)/.test(compact)) {
    return "내가 완성 답을 대신 쓰지는 않을게. 네가 고른 입장을 한 문장으로 말하면, 상대 펫이 생각을 넓힐 질문을 해 줄게.";
  }
  if (compact.length < 3) {
    return "조금만 더 말해 줄래? ‘나는 …라고 생각해. 왜냐하면 …’으로 시작해도 좋아.";
  }
  return null;
}

export function safetyMessageFor(categories: string[], content: string): string {
  const normalized = normalizeForSafety(content);
  const immediateRisk =
    categories.some((category) => category.startsWith("self-harm")) ||
    /(죽고\s*싶|자해|스스로.*해치|죽이겠|당장.*때리|흉기)/.test(normalized);
  if (immediateRisk) {
    return "지금은 토론보다 네 안전이 먼저예요. 혼자 있지 말고 바로 가까운 선생님이나 보호자 곁으로 가서 이 내용을 보여 주세요. 지금 당장 위험하다면 112 또는 119에 도움을 요청해 주세요.";
  }
  return "이 내용은 AI 토론 펫이 혼자 다루기 어려워요. 네 잘못이 아니며, 토론을 멈추고 믿을 수 있는 선생님이나 보호자에게 지금 알려 주세요.";
}
