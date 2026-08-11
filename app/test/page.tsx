"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import AnswerButton from "@/components/AnswerButton";
import ExplanationCard from "@/components/ExplanationCard";
import TestHeader from "@/components/TestHeader";
import TimerBar from "@/components/TimerBar";
import { supabase } from "@/lib/supabase/client";

interface TestQuestion {
  id: string;
  question: string;
  answers: string[];
  correctAnswer: number;
  explanation: string;
  law?: number;
}

interface ActiveTest {
  id?: string;
  title: string;
  timePerQuestion: number;
  updatedAt?: string;
  questions: TestQuestion[];
}

interface RecordedAnswer {
  questionId: string;
  selectedAnswer: number | null;
  isCorrect: boolean;
}

interface ExistingAttempt {
  score: number;
  totalQuestions: number;
  percentage: number;
  durationSeconds: number | null;
  createdAt: string;
}

const backgroundStyle = {
  backgroundImage: "url('/images/test-bg.jpg')",
};

export default function TestPage() {
  const router = useRouter();

  const [activeTest, setActiveTest] =
    useState<ActiveTest | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [existingAttempt, setExistingAttempt] =
    useState<ExistingAttempt | null>(null);

  const [isAdminPreview, setIsAdminPreview] =
    useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0);

  const [selectedAnswer, setSelectedAnswer] =
    useState<number | null>(null);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [isSavingResult, setIsSavingResult] = useState(false);

  const confirmedRef = useRef(false);
  const selectedAnswerRef = useRef<number | null>(null);
  const answersRef = useRef<RecordedAnswer[]>([]);
  const startedAtRef = useRef<number>(Date.now());
  const resultSavedRef = useRef(false);

  useEffect(() => {
    async function loadTest() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          router.replace("/login?next=/test");
          return;
        }

        const { data, error } = await supabase
          .from("tests")
          .select(`
            id,
            title,
            time_per_question,
            questions (
              id,
              order_number,
              question,
              answer_a,
              answer_b,
              answer_c,
              answer_d,
              correct_answer,
              explanation,
              law
            )
          `)
          .eq("is_active", true)
          .single();

        if (error || !data) {
          throw error ?? new Error("Nu există test activ.");
        }

        const formattedTest: ActiveTest = {
          id: data.id,
          title: data.title,
          timePerQuestion: data.time_per_question,
          questions: [...(data.questions ?? [])]
            .sort((a: any, b: any) => a.order_number - b.order_number)
            .map((q: any) => ({
              id: q.id,
              question: q.question,
              answers: [
                q.answer_a,
                q.answer_b,
                q.answer_c,
                q.answer_d,
              ],
              correctAnswer: q.correct_answer,
              explanation: q.explanation ?? "",
              law: q.law ?? undefined,
            })),
        };

        const statusResponse = await fetch(
          `/api/test/submit?testId=${formattedTest.id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const statusResult =
          (await statusResponse.json()) as {
            attempted?: boolean;
            isAdmin?: boolean;
            attempt?: ExistingAttempt;
            error?: string;
          };

        if (!statusResponse.ok) {
          throw new Error(
            statusResult.error ||
              "Situația testului nu a putut fi verificată."
          );
        }

        setActiveTest(formattedTest);
        setIsAdminPreview(
          statusResult.isAdmin === true
        );

        if (
          statusResult.attempted &&
          statusResult.attempt
        ) {
          setExistingAttempt(statusResult.attempt);
          return;
        }

        setTimeLeft(formattedTest.timePerQuestion);
        startedAtRef.current = Date.now();
      } catch (error) {
        console.error(
          "Eroare la încărcarea testului:",
          error
        );

        setLoadError(
          error instanceof Error
            ? error.message
            : "Testul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadTest();
  }, [router]);

  const question =
    activeTest?.questions[currentQuestionIndex];

  const isLastQuestion =
    activeTest !== null &&
    currentQuestionIndex ===
      activeTest.questions.length - 1;

  const isCorrect =
    question !== undefined &&
    selectedAnswer !== null &&
    selectedAnswer === question.correctAnswer;

  useEffect(() => {
    selectedAnswerRef.current = selectedAnswer;
  }, [selectedAnswer]);

  const confirmAnswer = useCallback(
    (answer: number | null) => {
      if (!question || confirmedRef.current) return;

      confirmedRef.current = true;
      setIsConfirmed(true);

      const answerIsCorrect =
        answer === question.correctAnswer;

      answersRef.current = [
        ...answersRef.current.filter(
          (recordedAnswer) =>
            recordedAnswer.questionId !== question.id
        ),
        {
          questionId: question.id,
          selectedAnswer: answer,
          isCorrect: answerIsCorrect,
        },
      ];

      if (answerIsCorrect) {
        setScore((previousScore) => previousScore + 1);
      }
    },
    [question]
  );

  const handleConfirm = useCallback(() => {
    if (selectedAnswer === null) return;

    confirmAnswer(selectedAnswer);
  }, [confirmAnswer, selectedAnswer]);

  const saveResult = useCallback(
    async (finalScore: number) => {
      if (
        !activeTest?.id ||
        resultSavedRef.current ||
        isAdminPreview
      ) {
        return;
      }

      resultSavedRef.current = true;
      setIsSavingResult(true);
      setSaveError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Sesiunea a expirat. Autentifică-te din nou."
          );
        }

        const durationSeconds = Math.max(
          1,
          Math.round(
            (Date.now() - startedAtRef.current) / 1000
          )
        );

        const response = await fetch(
          "/api/test/submit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              testId: activeTest.id,
              score: finalScore,
              totalQuestions:
                activeTest.questions.length,
              durationSeconds,
              answers: answersRef.current,
            }),
          }
        );

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Rezultatul nu a putut fi salvat."
          );
        }
      } catch (error) {
        resultSavedRef.current = false;

        setSaveError(
          error instanceof Error
            ? error.message
            : "Rezultatul nu a putut fi salvat."
        );
      } finally {
        setIsSavingResult(false);
      }
    },
    [activeTest, isAdminPreview]
  );

  const handleNextQuestion = useCallback(() => {
    if (!activeTest) return;

    if (isLastQuestion) {
      setIsFinished(true);
      void saveResult(score);
      return;
    }

    confirmedRef.current = false;
    selectedAnswerRef.current = null;

    setCurrentQuestionIndex(
      (previousIndex) => previousIndex + 1
    );

    setSelectedAnswer(null);
    setIsConfirmed(false);
    setTimeLeft(activeTest.timePerQuestion);
  }, [
    activeTest,
    isLastQuestion,
    saveResult,
    score,
  ]);

  useEffect(() => {
    if (
      !activeTest ||
      !question ||
      isConfirmed ||
      isFinished
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((previousTime) => {
        if (previousTime <= 1) {
          window.clearInterval(timer);

          confirmAnswer(selectedAnswerRef.current);

          return 0;
        }

        return previousTime - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    activeTest,
    confirmAnswer,
    currentQuestionIndex,
    isConfirmed,
    isFinished,
    question,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!question || isFinished) return;

      const pressedKey = event.key.toLowerCase();

      if (!isConfirmed) {
        const answerIndex = ["a", "b", "c", "d"].indexOf(
          pressedKey
        );

        if (
          answerIndex !== -1 &&
          answerIndex < question.answers.length
        ) {
          setSelectedAnswer(answerIndex);
          return;
        }

        if (
          event.key === "Enter" &&
          selectedAnswer !== null
        ) {
          event.preventDefault();
          handleConfirm();
        }

        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        handleNextQuestion();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleConfirm,
    handleNextQuestion,
    isConfirmed,
    isFinished,
    question,
    selectedAnswer,
  ]);

  if (isLoading) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4"
        style={backgroundStyle}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/95 px-8 py-6 shadow-2xl backdrop-blur-sm">
          <p className="font-medium text-gray-700">
            Se încarcă testul...
          </p>
        </div>
      </main>
    );
  }

  if (existingAttempt && activeTest) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4"
        style={backgroundStyle}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
            {activeTest.title}
          </p>

          <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            Ai susținut deja acest test
          </h1>

          <p className="mt-3 text-gray-600">
            Fiecare arbitru poate susține testul activ o singură dată.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-gray-100 p-5">
              <p className="text-3xl font-bold text-gray-900">
                {existingAttempt.score}/
                {existingAttempt.totalQuestions}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Scor
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 p-5">
              <p className="text-3xl font-bold text-green-700">
                {formatGrade(
                  calculateGrade(
                    existingAttempt.score,
                    existingAttempt.totalQuestions
                  )
                )}
              </p>

              <p className="mt-1 text-sm text-green-700">
                Notă
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Susținut la{" "}
            {new Date(
              existingAttempt.createdAt
            ).toLocaleString("ro-RO")}
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-7 w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
          >
            Înapoi la pagina principală
          </button>
        </div>
      </main>
    );
  }

  if (loadError || !activeTest || !question) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4"
        style={backgroundStyle}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Test indisponibil
          </h1>

          <p className="mt-3 text-gray-600">
            {loadError ||
              "Nu există momentan niciun test publicat."}
          </p>
        </div>
      </main>
    );
  }

  if (isFinished) {
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6 sm:py-16"
        style={backgroundStyle}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10">
          <GradeResultCard
            score={score}
            totalQuestions={
              activeTest.questions.length
            }
          />

          {isAdminPreview && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
              Aceasta a fost o previzualizare de administrator. Rezultatul nu a fost salvat.
            </p>
          )}

          {isSavingResult && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
              Se salvează rezultatul...
            </p>
          )}

          {saveError && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
              <p>{saveError}</p>

              <button
                type="button"
                onClick={() => {
                  void saveResult(score);
                }}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
              >
                Încearcă din nou
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-8 sm:px-6 sm:py-12 lg:py-16"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/20 bg-white/95 p-5 shadow-2xl backdrop-blur-sm sm:p-8">
        {isAdminPreview && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            Mod previzualizare administrator. Rezultatul nu va fi salvat.
          </div>
        )}

        <TestHeader
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={activeTest.questions.length}
          law={question.law}
        />

        <TimerBar
          timeLeft={timeLeft}
          totalTime={activeTest.timePerQuestion}
        />

        <section className="mt-8">
          <h2 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
            {question.question}
          </h2>
        </section>

        <div className="mt-8 space-y-4">
          {question.answers.map((answer, index) => (
            <AnswerButton
              key={`${question.id}-${index}`}
              answer={answer}
              index={index}
              selectedAnswer={selectedAnswer}
              correctAnswer={question.correctAnswer}
              isConfirmed={isConfirmed}
              onSelect={setSelectedAnswer}
            />
          ))}
        </div>

        {!isConfirmed ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedAnswer === null}
              className="w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300 sm:w-auto"
            >
              Confirmă răspunsul
            </button>

            <p className="mt-3 text-sm text-gray-500">
              Taste: A–D pentru selectare • Enter pentru confirmare
            </p>
          </div>
        ) : (
          <>
            <ExplanationCard
              isCorrect={isCorrect}
              correctAnswer={question.correctAnswer}
              explanation={question.explanation}
            />

            <button
              type="button"
              onClick={handleNextQuestion}
              className="mt-6 w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 sm:w-auto"
            >
              {isLastQuestion
                ? "Finalizează testul"
                : "Următoarea întrebare"}
            </button>

            <p className="mt-3 text-sm text-gray-500">
              Space • următoarea întrebare
            </p>
          </>
        )}
      </div>
    </main>
  );
}


function calculateGrade(
  score: number,
  totalQuestions: number
) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (score / totalQuestions) * 10;
}

function formatGrade(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface GradeResultCardProps {
  score: number;
  totalQuestions: number;
}

function GradeResultCard({
  score,
  totalQuestions,
}: GradeResultCardProps) {
  const grade = calculateGrade(
    score,
    totalQuestions
  );

  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
        Rezultat final
      </p>

      <h1 className="mt-3 text-3xl font-bold text-gray-900">
        Test finalizat
      </h1>

      <div className="mt-7 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gray-100 p-5">
          <p className="text-3xl font-bold text-gray-900">
            {score}/{totalQuestions}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Răspunsuri corecte
          </p>
        </div>

        <div className="rounded-2xl bg-green-50 p-5">
          <p className="text-3xl font-bold text-green-700">
            {formatGrade(grade)}
          </p>

          <p className="mt-1 text-sm text-green-700">
            Notă
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200"
      >
        Înapoi la pagina principală
      </Link>
    </div>
  );
}