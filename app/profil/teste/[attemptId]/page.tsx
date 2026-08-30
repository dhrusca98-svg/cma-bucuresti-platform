"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface ReviewQuestion {
  questionId: string;
  orderNumber: number;
  question: string;
  answers: string[];
  selectedAnswer: number | null;
  correctAnswer: number;
  answered: boolean;
  isCorrect: boolean;
}

interface ReviewResponse {
  reviewAvailable: true;
  attempt: {
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    grade: number;
    durationSeconds: number | null;
    completedAt: string;
  };
  test: {
    id: string;
    title: string;
    createdAt: string;
    availableUntil: string | null;
  };
  questions: ReviewQuestion[];
}

const ANSWER_LABELS = [
  "A",
  "B",
  "C",
  "D",
];

export default function TestHistoryPage() {
  const router = useRouter();
  const params = useParams<{
    attemptId: string;
  }>();

  const attemptId =
    params.attemptId;

  const [
    result,
    setResult,
  ] =
    useState<ReviewResponse | null>(
      null
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    async function loadResult() {
      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          router.replace(
            `/login?next=/profil/teste/${attemptId}`
          );

          return;
        }

        const response =
          await fetch(
            `/api/profil/teste/${attemptId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
              cache:
                "no-store",
            }
          );

        const data =
          (await response.json()) as
            | ReviewResponse
            | {
                error: string;
              };

        if (
          !response.ok ||
          "error" in data
        ) {
          throw new Error(
            "error" in data
              ? data.error
              : "Testul nu a putut fi încărcat."
          );
        }

        setResult(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Testul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (attemptId) {
      void loadResult();
    }
  }, [
    attemptId,
    router,
  ]);

  return (
    <div className="min-h-screen bg-[#07100b]">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/images/homepage-bg.jpg')",
        }}
      />

      <div className="fixed inset-0 bg-black/75" />
      <div className="fixed inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/50" />

      <div className="relative z-10">
        <Navbar />

        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm">
              <p className="text-gray-600">
                Se încarcă testul...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h1 className="text-xl font-bold text-red-800">
                Testul nu poate fi afișat
              </h1>

              <p className="mt-2 text-red-700">
                {error}
              </p>

              <Link
                href="/profil"
                className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white"
              >
                Înapoi la profil
              </Link>
            </div>
          ) : result ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
                    Rezultatele mele
                  </p>

                  <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                    {result.test.title}
                  </h1>

                  <p className="mt-2 text-gray-300">
                    Test finalizat la{" "}
                    {formatDateTime(
                      result.attempt.completedAt
                    )}
                  </p>
                </div>

                <Link
                  href="/profil"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"
                >
                  Înapoi la profil
                </Link>
              </div>

              <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Scor"
                  value={`${result.attempt.score}/${result.attempt.totalQuestions}`}
                />

                <StatCard
                  label="Notă"
                  value={formatGrade(
                    result.attempt.grade
                  )}
                />

                <StatCard
                  label="Procent"
                  value={`${Math.round(
                    result.attempt.percentage
                  )}%`}
                />

                <StatCard
                  label="Timp"
                  value={formatDuration(
                    result.attempt.durationSeconds
                  )}
                />
              </section>

              <div className="mt-8 space-y-5">
                {result.questions.map(
                  (question) => (
                    <QuestionCard
                      key={
                        question.questionId
                      }
                      question={
                        question
                      }
                    />
                  )
                )}
              </div>

              <div className="mt-8 flex justify-center">
                <Link
                  href="/profil"
                  className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                >
                  Înapoi la profil
                </Link>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
}: {
  question: ReviewQuestion;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white/95 shadow-sm ${
        question.isCorrect
          ? "border-green-200"
          : "border-red-200"
      }`}
    >
      <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Întrebarea{" "}
              {question.orderNumber}
            </p>

            <h2 className="mt-2 text-base font-bold leading-relaxed text-gray-900 sm:text-lg">
              {question.question}
            </h2>
          </div>

          <span
            className={`inline-flex shrink-0 self-start rounded-full px-3 py-1.5 text-xs font-bold ${
              question.isCorrect
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {question.isCorrect
              ? "Corect"
              : question.answered
                ? "Greșit"
                : "Fără răspuns"}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {question.answers.map(
          (
            answer,
            index
          ) => {
            const isSelected =
              question.selectedAnswer ===
              index;

            const isCorrect =
              question.correctAnswer ===
              index;

            let className =
              "border-gray-200 bg-white text-gray-800";

            if (isCorrect) {
              className =
                "border-green-300 bg-green-50 text-green-900";
            } else if (
              isSelected
            ) {
              className =
                "border-red-300 bg-red-50 text-red-900";
            }

            return (
              <div
                key={index}
                className={`rounded-xl border px-4 py-3 ${className}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                    {
                      ANSWER_LABELS[
                        index
                      ]
                    }
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="leading-relaxed">
                      {answer}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
                      {isSelected && (
                        <span>
                          Răspunsul tău
                        </span>
                      )}

                      {isCorrect && (
                        <span>
                          Răspuns corect
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        )}

        {!question.answered && (
          <p className="pt-1 text-sm font-semibold text-red-700">
            Nu ai selectat niciun răspuns la această întrebare.
          </p>
        )}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 p-5 shadow-sm">
      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  );
}

function formatGrade(
  value: number
) {
  return value.toLocaleString(
    "ro-RO",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatDuration(
  seconds: number | null
) {
  if (
    seconds === null ||
    !Number.isFinite(seconds)
  ) {
    return "—";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    Math.max(
      0,
      seconds % 60
    );

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ro-RO",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}
