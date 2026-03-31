import type { BlankQuestion } from "@/data/blocks";

// 조사/어미 등 빈칸으로 만들면 안 되는 짧은 단어
const SKIP_WORDS = new Set([
  "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과",
  "도", "만", "까지", "부터", "에서", "으로", "라고", "이라",
  "그", "이", "저", "것", "수", "때", "중", "더", "안", "못", "잘",
  "전:", "대:", "전", "대", "및", "또", "다", "한", "할", "합",
  "네", "예", "아", "오", "즉",
]);

/**
 * fullScript에서 전도자(전:) 대사 중 의미 있는 문장을 추출하고,
 * 핵심 단어를 랜덤으로 빈칸 처리하여 문제를 생성합니다.
 */
export function generateBlanksFromScript(
  fullScript: string,
  count: number = 4
): BlankQuestion[] {
  // 전도자 대사만 추출
  const lines = fullScript
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("전:"))
    .map((l) => l.replace(/^전:\s*/, ""));

  // 너무 짧거나 질문형("~니까?", "~세요?")인 문장은 제외, 의미 있는 선언문만
  const candidates = lines.filter((l) => {
    const clean = l.replace(/["""'']/g, "");
    return clean.length >= 15 && !clean.endsWith("?");
  });

  // 셔플
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map((sentence) => createBlankQuestion(sentence));
}

function createBlankQuestion(sentence: string): BlankQuestion {
  // 따옴표 안의 성경 구절과 일반 텍스트를 모두 포함
  // 단어 분리: 공백 기준으로 토큰화
  const tokens = sentence.split(/\s+/);

  // 빈칸 후보: 2글자 이상이고 SKIP_WORDS에 없는 단어
  const blankCandidates: number[] = [];
  tokens.forEach((token, idx) => {
    // 순수 한글만 추출 (조사 제거 시도)
    const core = extractCore(token);
    if (core.length >= 2 && !SKIP_WORDS.has(core) && !SKIP_WORDS.has(token)) {
      blankCandidates.push(idx);
    }
  });

  // 랜덤으로 1~2개 선택
  const blankCount = Math.min(
    blankCandidates.length >= 3 ? 2 : 1,
    blankCandidates.length
  );
  const selectedIndices = [...blankCandidates]
    .sort(() => Math.random() - 0.5)
    .slice(0, blankCount)
    .sort((a, b) => a - b);

  const answers: Record<string, string> = {};
  const labels = ["A", "B", "C"];

  const resultTokens = tokens.map((token, idx) => {
    const labelIdx = selectedIndices.indexOf(idx);
    if (labelIdx === -1) return token;

    const core = extractCore(token);
    const suffix = token.slice(core.length);
    const label = labels[labelIdx];
    answers[label] = core;

    return `[${label}]${suffix}`;
  });

  return {
    text: resultTokens.join(" "),
    answers,
  };
}

/**
 * 단어에서 핵심 어근을 추출 (뒤쪽 조사/어미 제거)
 * 예: "선물입니다" → "선물", "하나님의" → "하나님"
 */
function extractCore(word: string): string {
  // 따옴표, 마침표 등 구두점 제거
  const cleaned = word.replace(/^["""''(【]+/, "").replace(/["""''.,!);】]+$/, "");

  // 흔한 어미/조사 패턴 제거 (긴 것부터 매칭)
  const suffixes = [
    "입니다", "습니다", "됩니다", "겠습니까", "십니다",
    "으로써", "에서는", "이라고", "에게는", "으시고",
    "으로", "에서", "이며", "처럼", "이요", "이니",
    "에게", "께서", "부터", "까지", "라고", "하여",
    "으매", "이라", "하신", "하고", "이신", "으신",
    "에는",
    "은", "는", "이", "가", "을", "를", "의", "에",
    "로", "와", "과", "도", "만", "서", "며",
  ];

  for (const suffix of suffixes) {
    if (cleaned.endsWith(suffix) && cleaned.length > suffix.length + 1) {
      return cleaned.slice(0, -suffix.length);
    }
  }

  return cleaned;
}
