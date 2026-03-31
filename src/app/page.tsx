"use client";

import { useState, useEffect, useCallback } from "react";
import { blocks } from "@/data/blocks";
import type { Block, BlankQuestion } from "@/data/blocks";

type Mode = "key" | "full" | "blank" | "roleplay";

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

  // Blank mode state
  const [blankAnswers, setBlankAnswers] = useState<Record<string, string>>({});
  const [blankChecked, setBlankChecked] = useState(false);

  // Roleplay mode state
  const [roleplayInput, setRoleplayInput] = useState("");
  const [roleplayFeedback, setRoleplayFeedback] = useState<
    null | "success" | "retry"
  >(null);

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

  const resetBlanks = useCallback(() => {
    setBlankAnswers({});
    setBlankChecked(false);
  }, []);

  const handleBlockChange = useCallback(
    (idx: number) => {
      setActiveBlock(idx);
      setActiveMode("key");
      resetBlanks();
      setRoleplayInput("");
      setRoleplayFeedback(null);
    },
    [resetBlanks]
  );

  const handleModeChange = useCallback(
    (mode: Mode) => {
      setActiveMode(mode);
      resetBlanks();
      setRoleplayInput("");
      setRoleplayFeedback(null);
    },
    [resetBlanks]
  );

  const checkRoleplay = useCallback(() => {
    const keywords = block.keyLines.map((kl) => kl.text.substring(0, 8));
    const matched = keywords.filter((kw) =>
      roleplayInput.includes(kw.substring(0, 4))
    );
    setRoleplayFeedback(matched.length >= 1 ? "success" : "retry");
  }, [block.keyLines, roleplayInput]);

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 flex-shrink-0">
        <h1 className="text-lg font-bold text-center">JUST EE 전도폭발 암기</h1>
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
              블록 {i + 1}
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
            onReset={resetBlanks}
          />
        )}
        {activeMode === "roleplay" && (
          <RoleplayMode
            block={block}
            input={roleplayInput}
            setInput={setRoleplayInput}
            feedback={roleplayFeedback}
            onCheck={checkRoleplay}
            onReset={() => {
              setRoleplayInput("");
              setRoleplayFeedback(null);
            }}
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
            : "✓ 이 블록 완료"}
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
}: {
  block: Block;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  checked: boolean;
  onCheck: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        빈칸에 알맞은 단어를 입력하세요
      </p>
      {block.blanks.map((q, qi) => (
        <BlankQuestionCard
          key={qi}
          question={q}
          questionIndex={qi}
          answers={answers}
          setAnswers={setAnswers}
          checked={checked}
        />
      ))}
      <div className="flex gap-2">
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
            다시 풀기
          </button>
        )}
      </div>
    </div>
  );
}

function BlankQuestionCard({
  question,
  questionIndex,
  answers,
  setAnswers,
  checked,
}: {
  question: BlankQuestion;
  questionIndex: number;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  checked: boolean;
}) {
  const parts = question.text.split(/(\[[A-Z]\])/g);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-sm leading-loose flex flex-wrap items-center gap-y-1">
        {parts.map((part, i) => {
          const match = part.match(/^\[([A-Z])\]$/);
          if (!match) return <span key={i}>{part}</span>;

          const key = `${questionIndex}-${match[1]}`;
          const correctAnswer = question.answers[match[1]];
          const userAnswer = answers[key] || "";
          const isCorrect =
            checked && userAnswer.trim() === correctAnswer;
          const isWrong =
            checked && userAnswer.trim() !== correctAnswer;

          return (
            <span key={i} className="inline-flex items-center mx-0.5">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) =>
                  setAnswers({ ...answers, [key]: e.target.value })
                }
                disabled={checked}
                placeholder="___"
                className={`border-b-2 text-center text-sm py-0.5 outline-none bg-transparent transition-colors ${
                  !checked
                    ? "border-gray-300 focus:border-primary"
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
        })}
      </div>
    </div>
  );
}

function RoleplayMode({
  block,
  input,
  setInput,
  feedback,
  onCheck,
  onReset,
}: {
  block: Block;
  input: string;
  setInput: (s: string) => void;
  feedback: null | "success" | "retry";
  onCheck: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        대상자의 말에 전도자로서 응답해 보세요
      </p>

      {/* Example conversation */}
      {block.roleplay.map((rp, i) => (
        <div
          key={i}
          className={`rounded-xl p-3 ${
            rp.speaker === "대상자"
              ? "bg-gray-100 mr-8"
              : "bg-primary-light ml-8"
          }`}
        >
          <span
            className={`text-xs font-semibold ${
              rp.speaker === "대상자" ? "text-gray-500" : "text-primary"
            }`}
          >
            {rp.speaker}
          </span>
          <p className="text-sm mt-1 leading-relaxed text-gray-800">
            {rp.line}
          </p>
        </div>
      ))}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">직접 연습하기</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Practice prompt */}
      <div className="bg-gray-100 rounded-xl p-3 mr-8">
        <span className="text-xs font-semibold text-gray-500">대상자</span>
        <p className="text-sm mt-1 leading-relaxed text-gray-800">
          {block.roleplay[0]?.line}
        </p>
      </div>

      {/* User input */}
      <div className="ml-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="전도자로서 응답을 입력하세요..."
          rows={4}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-primary resize-none bg-white"
          disabled={feedback !== null}
        />
      </div>

      {/* Feedback */}
      {feedback === "success" && (
        <div className="bg-primary-light text-primary-text rounded-xl p-3 text-sm">
          잘하셨습니다! 핵심 내용이 포함되어 있습니다.
        </div>
      )}
      {feedback === "retry" && (
        <div className="bg-error text-error-text rounded-xl p-3 text-sm">
          핵심 키워드가 부족합니다. 핵심 문장을 다시 확인해 보세요.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {feedback === null ? (
          <button
            onClick={onCheck}
            disabled={!input.trim()}
            className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold active:bg-primary-dark disabled:opacity-40"
          >
            확인하기
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
          >
            다시 연습
          </button>
        )}
      </div>
    </div>
  );
}
