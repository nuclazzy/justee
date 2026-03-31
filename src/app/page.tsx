"use client";

import { useState, useEffect, useCallback } from "react";
import { blocks } from "@/data/blocks";
import type { Block, KeyLine } from "@/data/blocks";

type Mode = "key" | "full" | "blank" | "roleplay";

const SKIP_WORDS = new Set([
  "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과",
  "도", "만", "까지", "부터", "에서", "으로", "그래서", "그런데",
  "그", "저", "것", "수", "때", "중", "더", "안", "못", "잘",
  "및", "또", "다", "한", "할", "합", "네", "예", "아", "오",
  "즉", "그리고", "하지만", "그러면", "그러나", "이와", "같이",
  "위하여", "때문에", "통해", "위해", "대한", "위해서",
]);

/** 핵심문장(keyLines)에서 중요 단어를 랜덤 빈칸으로 만드는 함수 (전문 표시용) */
type BlankWordInfo = { word: string; label: string; keyLineIdx: number };
type FullScriptBlankData = {
  blanks: BlankWordInfo[];
  answers: Record<string, string>;
  anchorsByKeyLine: string[][];
};

function generateFullScriptBlanks(keyLines: KeyLine[]): FullScriptBlankData {
  const blanks: BlankWordInfo[] = [];
  const answers: Record<string, string> = {};
  const anchorsByKeyLine: string[][] = [];
  let labelIdx = 0;
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (let ki = 0; ki < keyLines.length; ki++) {
    const text = keyLines[ki].text.replace(/\([^)]+\)/g, "").trim();
    const tokens = text.split(/\s+/);

    const significant = tokens
      .map((t) => t.replace(/["""''.,!?;:()【】]/g, ""))
      .filter((w) => w.length >= 3 && !SKIP_WORDS.has(w));
    // 매칭용 앵커 단어 (긴 순)
    anchorsByKeyLine.push(
      [...significant].sort((a, b) => b.length - a.length).slice(0, 6)
    );

    // 빈칸 후보
    const candidates = tokens
      .map((t) => t.replace(/["""''.,!?;:()【】]/g, ""))
      .filter((w) => w.length >= 2 && !SKIP_WORDS.has(w));
    const count = Math.min(candidates.length >= 3 ? 2 : 1, candidates.length);
    const selected = [...candidates]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    for (const word of selected) {
      const label = labels[labelIdx++];
      blanks.push({ word, label, keyLineIdx: ki });
      answers[label] = word;
    }
  }
  return { blanks, answers, anchorsByKeyLine };
}

const MODE_LABELS: Record<Mode, string> = {
  key: "핵심 문장",
  full: "전문 보기",
  blank: "빈칸 훈련",
  roleplay: "롤플레이",
};

export default function Home() {
  const [activeBlock, setActiveBlock] = useState(0);
  const [activeMode, setActiveMode] = useState<Mode>("key");
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Blank mode state
  const [blankAnswers, setBlankAnswers] = useState<Record<string, string>>({});
  const [blankChecked, setBlankChecked] = useState(false);
  const [blankSeed, setBlankSeed] = useState(0);

  // Roleplay mode state
  const [roleplayInput, setRoleplayInput] = useState("");
  const [roleplayFeedback, setRoleplayFeedback] = useState<
    null | "success" | "retry"
  >(null);
  const [roleplayStep, setRoleplayStep] = useState(0);
  const [roleplayHistory, setRoleplayHistory] = useState<
    { speaker: string; line: string }[]
  >([]);

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("justee-completed");
    if (saved) {
      setCompleted(JSON.parse(saved));
    } else {
      setCompleted(new Array(blocks.length).fill(false));
    }
  }, []);

  // Save progress
  useEffect(() => {
    if (completed.length > 0) {
      localStorage.setItem("justee-completed", JSON.stringify(completed));
    }
  }, [completed]);

  const block = blocks[activeBlock];
  const progress =
    completed.length > 0
      ? Math.round(
          (completed.filter(Boolean).length / blocks.length) * 100
        )
      : 0;

  const toggleComplete = useCallback(() => {
    setCompleted((prev) => {
      const next = [...prev];
      next[activeBlock] = !next[activeBlock];
      return next;
    });
  }, [activeBlock]);

  const resetAll = useCallback(() => {
    setCompleted(new Array(blocks.length).fill(false));
    localStorage.removeItem("justee-completed");
    setActiveBlock(0);
    setActiveMode("key");
    setBlankAnswers({});
    setBlankChecked(false);
    setRoleplayInput("");
    setRoleplayFeedback(null);
    setShowResetConfirm(false);
  }, []);

  const resetBlanks = useCallback((regenerate = false) => {
    setBlankAnswers({});
    setBlankChecked(false);
    if (regenerate) {
      setBlankSeed((s) => s + 1);
    }
  }, []);

  const resetRoleplay = useCallback(() => {
    setRoleplayInput("");
    setRoleplayFeedback(null);
    setRoleplayStep(0);
    setRoleplayHistory([]);
  }, []);

  const handleBlockChange = useCallback(
    (idx: number) => {
      setActiveBlock(idx);
      setActiveMode("key");
      resetBlanks();
      resetRoleplay();
    },
    [resetBlanks, resetRoleplay]
  );

  const handleModeChange = useCallback(
    (mode: Mode) => {
      setActiveMode(mode);
      resetBlanks();
      resetRoleplay();
    },
    [resetBlanks, resetRoleplay]
  );

  // 세그먼트 방식: context(미리보기) + key(사용자 입력) + response(대상자 응답)
  type RoleplaySegment = {
    context: { speaker: string; line: string }[];
    expected: string;
    response: string | null;
  };
  const roleplaySegments: RoleplaySegment[] = (() => {
    const segments: RoleplaySegment[] = [];
    const rp = block.roleplay;
    let context: { speaker: string; line: string }[] = [];

    for (let i = 0; i < rp.length; i++) {
      if (rp[i].speaker === "전도자" && rp[i].key) {
        const response = (i + 1 < rp.length && rp[i + 1].speaker === "대상자")
          ? rp[i + 1].line : null;
        segments.push({ context: [...context], expected: rp[i].line, response });
        context = [];
        if (response !== null) i++;
      } else {
        context.push({ speaker: rp[i].speaker, line: rp[i].line });
      }
    }
    // 남은 context가 있으면 마지막 세그먼트에 붙이거나 무시
    return segments;
  })();

  // backward compat alias for checkRoleplay
  const roleplayPairs = roleplaySegments;

  const checkRoleplay = useCallback(() => {
    const currentPair = roleplayPairs[roleplayStep];
    if (!currentPair) return;

    const SKIP = new Set([
      "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과",
      "도", "만", "까지", "부터", "에서", "으로", "그래서", "그런데",
      "그", "이", "저", "것", "수", "때", "중", "더", "안", "못", "잘",
      "전", "대", "및", "또", "다", "한", "할", "합", "네", "예", "아",
      "오", "즉", "그리고", "하지만", "그러면", "그러나",
    ]);

    // 괄호 안의 행동 지시를 제거한 후 문장 단위로 분리
    const textOnly = currentPair.expected.replace(/\([^)]+\)/g, "").trim();
    const sentences = textOnly
      .split(/[.,!?;]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const keywords: string[] = [];
    for (const sentence of sentences) {
      const words = sentence
        .replace(/["""''()【】]/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !SKIP.has(w));
      // 각 문장에서 가장 긴 단어(핵심어)를 최소 1개 선택
      if (words.length > 0) {
        const sorted = [...words].sort((a, b) => b.length - a.length);
        // 문장당 1~2개 핵심 단어 (단어가 3개 이상이면 2개)
        const pick = words.length >= 3 ? 2 : 1;
        keywords.push(...sorted.slice(0, pick));
      }
    }

    // 중복 제거
    const uniqueKeywords = [...new Set(keywords)];

    // 모든 핵심 단어가 입력에 포함되어야 함
    const matched = uniqueKeywords.filter((kw) => roleplayInput.includes(kw));
    const isSuccess = uniqueKeywords.length > 0 && matched.length === uniqueKeywords.length;
    setRoleplayFeedback(isSuccess ? "success" : "retry");
  }, [roleplayPairs, roleplayStep, roleplayInput]);

  const advanceRoleplay = useCallback(() => {
    const currentSeg = roleplaySegments[roleplayStep];
    if (!currentSeg) return;
    setRoleplayHistory((prev) => [
      ...prev,
      // 컨텍스트 라인을 미리보기로 히스토리에 추가
      ...(currentSeg.context.length > 0
        ? [{ speaker: "미리보기", line: currentSeg.context.map(c => `${c.speaker === "전도자" ? "전" : "대"}: ${c.line}`).join("\n") }]
        : []),
      { speaker: "전도자", line: roleplayInput },
      ...(currentSeg.response ? [{ speaker: "대상자", line: currentSeg.response }] : []),
    ]);
    setRoleplayStep((s) => s + 1);
    setRoleplayInput("");
    setRoleplayFeedback(null);
  }, [roleplaySegments, roleplayStep, roleplayInput]);

  // Auto-advance after success feedback
  useEffect(() => {
    if (roleplayFeedback === "success") {
      const timer = setTimeout(() => {
        advanceRoleplay();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [roleplayFeedback, advanceRoleplay]);

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <a
            href="https://suno.com/playlist/25809e27-6018-485a-92d2-915312af3f74"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
            title="암기 송"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            암기송
          </a>
          <h1 className="text-lg font-bold text-center">JUST EE 전도폭발 암기</h1>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            title="초기화"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-2 bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="bg-white h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/80 text-center mt-1">
          진행률 {progress}%
        </p>
      </header>

      {/* Reset confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-8">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">진행률 초기화</h3>
            <p className="text-sm text-gray-600 mb-5">
              모든 학습 진행률이 초기화됩니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold"
              >
                취소
              </button>
              <button
                onClick={resetAll}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold active:bg-red-600"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block tabs - horizontal scroll */}
      <nav className="flex-shrink-0 bg-white border-b border-gray-200 overflow-x-auto hide-scrollbar">
        <div className="flex min-w-max">
          {blocks.map((b, i) => (
            <button
              key={b.id}
              onClick={() => handleBlockChange(i)}
              className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeBlock === i
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-gray-500"
              }`}
            >
              {completed[i] && "✓ "}
              {b.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Block title */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">{block.title}</h2>
        <p className="text-sm text-gray-500">{block.desc}</p>
      </div>

      {/* Mode tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="grid grid-cols-4">
          {(Object.keys(MODE_LABELS) as Mode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`py-2.5 text-xs font-medium text-center transition-colors ${
                activeMode === mode
                  ? "text-primary border-b-2 border-primary bg-primary-light"
                  : "text-gray-500"
              }`}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Content area - scrollable */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {activeMode === "key" && <KeyMode block={block} />}
        {activeMode === "full" && <FullMode block={block} />}
        {activeMode === "blank" && (
          <BlankMode
            block={block}
            answers={blankAnswers}
            setAnswers={setBlankAnswers}
            checked={blankChecked}
            onCheck={() => setBlankChecked(true)}
            onReset={() => resetBlanks(true)}
            seed={blankSeed}
          />
        )}
        {activeMode === "roleplay" && (
          <RoleplayMode
            block={block}
            segments={roleplaySegments}
            step={roleplayStep}
            history={roleplayHistory}
            input={roleplayInput}
            setInput={setRoleplayInput}
            feedback={roleplayFeedback}
            onCheck={checkRoleplay}
            onAdvance={advanceRoleplay}
            onRetry={() => {
              setRoleplayInput("");
              setRoleplayFeedback(null);
            }}
            onReset={resetRoleplay}
            onShowFull={() => setActiveMode("full")}
          />
        )}
      </main>

      {/* Bottom action */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          onClick={toggleComplete}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            completed[activeBlock]
              ? "bg-gray-200 text-gray-600"
              : "bg-primary text-white active:bg-primary-dark"
          }`}
        >
          {completed[activeBlock]
            ? "✓ 완료됨 (탭하여 취소)"
            : "✓ 완료"}
        </button>
      </div>
    </div>
  );
}

/* ─── Mode Components ─── */

function KeyMode({ block }: { block: Block }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        소리 내어 3회 낭독해 보세요
      </p>
      {block.keyLines.map((kl, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
        >
          <span className="inline-block text-xs font-semibold text-primary bg-primary-light px-2 py-0.5 rounded-full mb-2">
            {kl.label}
          </span>
          <p className="text-sm leading-relaxed text-gray-800">{kl.text}</p>
        </div>
      ))}
    </div>
  );
}

function FullMode({ block }: { block: Block }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-3">
        전문 스크립트를 읽으며 흐름을 파악하세요
      </p>
      {block.fullScript.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-3" />;
        const isNarrator = trimmed.startsWith("전:");
        const isTarget = trimmed.startsWith("대:");
        return (
          <p
            key={i}
            className={`text-sm leading-relaxed mb-1 ${
              isNarrator
                ? "text-primary-dark font-medium"
                : isTarget
                ? "text-gray-400 italic"
                : "text-gray-700"
            }`}
          >
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

function BlankMode({
  block,
  answers,
  setAnswers,
  checked,
  onCheck,
  onReset,
  seed,
}: {
  block: Block;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  checked: boolean;
  onCheck: () => void;
  onReset: () => void;
  seed: number;
}) {
  const [blankData, setBlankData] = useState<FullScriptBlankData>({
    blanks: [],
    answers: {},
    anchorsByKeyLine: [],
  });

  // 각 fullScript 라인 → 매칭된 keyLine 인덱스 (1:1 매칭, 가장 높은 점수 우선)
  const [lineKeyLineMap, setLineKeyLineMap] = useState<Map<number, number>>(
    new Map()
  );

  useEffect(() => {
    const data = generateFullScriptBlanks(block.keyLines);
    setBlankData(data);

    // 각 keyLine에 대해 가장 잘 매칭되는 fullScript 라인을 1개만 선정
    const lines = block.fullScript.split("\n");
    const map = new Map<number, number>();
    const usedLines = new Set<number>();

    for (let ki = 0; ki < data.anchorsByKeyLine.length; ki++) {
      const anchors = data.anchorsByKeyLine[ki];
      if (anchors.length === 0) continue;

      let bestLine = -1;
      let bestScore = 0;
      for (let li = 0; li < lines.length; li++) {
        if (usedLines.has(li)) continue;
        const clean = lines[li].trim().replace(/^(전|대|훈\d?):\s*/, "").trim();
        if (clean.length < 10) continue;
        const score = anchors.filter((w) => clean.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestLine = li;
        }
      }
      // 최소 60% 앵커 매칭 필요
      if (bestLine >= 0 && bestScore >= Math.ceil(anchors.length * 0.6)) {
        map.set(bestLine, ki);
        usedLines.add(bestLine);
      }
    }
    setLineKeyLineMap(map);
  }, [block.keyLines, block.fullScript, seed]);

  // 라인 텍스트에서 빈칸 단어를 input으로 치환하여 렌더링
  const renderLineWithBlanks = (lineText: string, ki: number) => {
    const lineBlanks = blankData.blanks.filter((b) => b.keyLineIdx === ki);
    if (lineBlanks.length === 0) return <span>{lineText}</span>;

    // 빈칸 단어를 플레이스홀더로 교체
    let processed = lineText;
    const activeBlanks: BlankWordInfo[] = [];
    for (const blank of lineBlanks) {
      if (processed.includes(blank.word)) {
        processed = processed.replace(blank.word, `\x00${blank.label}\x00`);
        activeBlanks.push(blank);
      }
    }
    if (activeBlanks.length === 0) return <span>{lineText}</span>;

    const parts = processed.split("\x00");
    return parts.map((part, i) => {
      const blank = activeBlanks.find((b) => b.label === part);
      if (!blank) return <span key={i}>{part}</span>;

      const correctAnswer = blankData.answers[blank.label];
      const userAnswer = answers[blank.label] || "";
      const isCorrect = checked && userAnswer.trim() === correctAnswer;
      const isWrong = checked && userAnswer.trim() !== correctAnswer;

      return (
        <span key={i} className="inline-flex items-center mx-0.5">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) =>
              setAnswers({ ...answers, [blank.label]: e.target.value })
            }
            disabled={checked}
            placeholder={`(${blank.label})`}
            className={`border-b-2 text-center text-sm py-0.5 outline-none bg-transparent transition-colors ${
              !checked
                ? "border-primary focus:border-primary-dark"
                : isCorrect
                ? "border-green-500 text-green-700 font-semibold"
                : "border-red-400 text-red-600"
            }`}
            style={{
              width: `${correctAnswer.length * 18 + 20}px`,
              minWidth: "50px",
            }}
          />
          {isWrong && (
            <span className="text-xs text-red-500 ml-1">
              ({correctAnswer})
            </span>
          )}
        </span>
      );
    });
  };

  const lines = block.fullScript.split("\n");

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 mb-3">
        전문을 읽으며 핵심 문장의 빈칸을 채워 보세요. 빈칸은 매번 랜덤 배치됩니다.
      </p>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-1">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-3" />;

          const isNarrator = trimmed.startsWith("전:");
          const isTarget = trimmed.startsWith("대:");
          const ki = lineKeyLineMap.get(i) ?? null;
          const hasBlanks =
            ki !== null &&
            blankData.blanks.some((b) => b.keyLineIdx === ki);

          if (hasBlanks && ki !== null) {
            return (
              <div
                key={i}
                className="bg-primary-light rounded-lg px-2 py-1.5 -mx-1"
              >
                <p className="text-sm leading-loose text-primary-dark font-medium flex flex-wrap items-center">
                  {renderLineWithBlanks(trimmed, ki)}
                </p>
              </div>
            );
          }

          return (
            <p
              key={i}
              className={`text-sm leading-relaxed ${
                isNarrator
                  ? "text-primary-dark font-medium"
                  : isTarget
                  ? "text-gray-400 italic"
                  : "text-gray-700"
              }`}
            >
              {trimmed}
            </p>
          );
        })}
      </div>
      <div className="flex gap-2 pt-3">
        {!checked ? (
          <button
            onClick={onCheck}
            className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold active:bg-primary-dark"
          >
            정답 확인
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
          >
            새 문제 풀기
          </button>
        )}
      </div>
    </div>
  );
}

function RoleplayMode({
  block,
  segments,
  step,
  history,
  input,
  setInput,
  feedback,
  onCheck,
  onAdvance,
  onRetry,
  onReset,
  onShowFull,
}: {
  block: Block;
  segments: { context: { speaker: string; line: string }[]; expected: string; response: string | null }[];
  step: number;
  history: { speaker: string; line: string }[];
  input: string;
  setInput: (s: string) => void;
  feedback: null | "success" | "retry";
  onCheck: () => void;
  onAdvance: () => void;
  onRetry: () => void;
  onReset: () => void;
  onShowFull: () => void;
}) {
  const isComplete = step >= segments.length;
  const currentSegment = segments[step];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        핵심 문장을 말해 보세요 ({isComplete ? segments.length : step + 1}/{segments.length})
      </p>

      {/* Conversation history */}
      {history.map((entry, i) => (
        <div
          key={i}
          className={`rounded-xl p-3 ${
            entry.speaker === "대상자"
              ? "bg-gray-100 mr-8"
              : entry.speaker === "미리보기"
              ? "bg-gray-50 border border-gray-200 border-dashed"
              : "bg-primary-light ml-8"
          }`}
        >
          <span
            className={`text-xs font-semibold ${
              entry.speaker === "대상자" ? "text-gray-500"
              : entry.speaker === "미리보기" ? "text-gray-400"
              : "text-primary"
            }`}
          >
            {entry.speaker === "미리보기" ? "💬 대화 흐름" : entry.speaker}
          </span>
          <p className={`text-sm mt-1 leading-relaxed ${
            entry.speaker === "미리보기" ? "text-gray-500" : "text-gray-800"
          }`}>
            {entry.line}
          </p>
        </div>
      ))}

      {/* Completion state */}
      {isComplete && (
        <>
          <div className="bg-primary-light text-primary-text rounded-xl p-4 text-sm text-center">
            모든 핵심 문장을 완료했습니다!
          </div>
          <button
            onClick={onReset}
            className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
          >
            처음부터 다시 연습
          </button>
        </>
      )}

      {/* Current turn */}
      {!isComplete && currentSegment && (() => {
        // 컨텍스트(미리보기) 표시
        const contextLines = currentSegment.context;
        // 행동 지시 추출
        const actions: string[] = [];
        currentSegment.expected.replace(/\(([^)]+)\)/g, (_, action) => {
          actions.push(action);
          return "";
        });
        return (
        <>
          {/* Context preview */}
          {contextLines.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-3 space-y-1.5">
              <span className="text-xs font-semibold text-gray-400">💬 앞부분 대화 흐름</span>
              {contextLines.map((cl, i) => (
                <p key={i} className={`text-xs leading-relaxed ${
                  cl.speaker === "대상자" ? "text-gray-400 italic" : "text-gray-500"
                }`}>
                  <span className="font-medium">{cl.speaker === "전도자" ? "전:" : "대:"}</span> {cl.line}
                </p>
              ))}
            </div>
          )}

          {/* Action hints */}
          {actions.length > 0 && (
            <div className="ml-4 flex flex-wrap gap-1.5">
              {actions.map((action, i) => (
                <span key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  ({action})
                </span>
              ))}
            </div>
          )}

          {/* User input area */}
          <div className="ml-4">
            <div className="text-xs font-semibold text-primary mb-1">전도자 (내 차례) — 핵심 문장</div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="핵심 문장을 입력하세요..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-primary resize-none bg-white"
              disabled={feedback !== null}
            />
          </div>

          {/* Feedback */}
          {feedback === "success" && (
            <div className="bg-primary-light text-primary-text rounded-xl p-3 text-sm text-center">
              잘하셨습니다! {step + 1 < segments.length ? "다음으로 넘어갑니다..." : "완료합니다..."}
            </div>
          )}
          {feedback === "retry" && (
            <div className="bg-error text-error-text rounded-xl p-3 text-sm space-y-2">
              <p>핵심 키워드가 부족합니다. 아래 모범 답안을 참고해 보세요.</p>
              <div className="bg-white/50 rounded-lg p-2 text-xs leading-relaxed text-gray-700">
                {currentSegment.expected}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onRetry}
                  className="flex-1 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-semibold border border-gray-200"
                >
                  다시 시도
                </button>
                <button
                  onClick={onShowFull}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold active:bg-primary-dark"
                >
                  전문 보기
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {feedback === null && (
              <button
                onClick={onCheck}
                disabled={!input.trim()}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold active:bg-primary-dark disabled:opacity-40"
              >
                확인하기
              </button>
            )}
          </div>
        </>
        );
      })()}
    </div>
  );
}
