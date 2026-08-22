"use client";

import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface AttemptDetailsResponse {
  attempt: {
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    grade: number;
    durationSeconds: number | null;
    completedAt: string;
  };

  participant: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
  };

  test: {
    id: string;
    title: string;
    createdAt: string;
  };

  questions: {
    questionId: string;
    orderNumber: number;
    question: string;
    answers: string[];
    selectedAnswer: number | null;
    correctAnswer: number;
    answered: boolean;
    isCorrect: boolean;
  }[];
}

export default function AttemptDetailsPage() {
  const router = useRouter();

  const params = useParams<{
    participantId: string;
    attemptId: string;
  }>();

  const [
    data,
    setData,
  ] =
    useState<
      AttemptDetailsResponse | null
    >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAttempt() {
      try {
        setIsLoading(true);
        setError("");

        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          router.replace(
            "/login"
          );

          return;
        }

        const response =
          await fetch(
            `/api/admin/rezultate/${params.attemptId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const result =
          (await response.json()) as
            | AttemptDetailsResponse
            | {
                error:
                  string;
              };

        if (
          !response.ok ||
          "error" in result
        ) {
          throw new Error(
            "error" in result
              ? result.error
              : "Rezultatul nu a putut fi încărcat."
          );
        }

        /*
         * Protecție suplimentară:
         * ruta din URL trebuie să corespundă
         * participantului rezultatului.
         */
        if (
          result.participant.id !==
          params.participantId
        ) {
          throw new Error(
            "Rezultatul nu aparține participantului selectat."
          );
        }

        if (mounted) {
          setData(result);
        }
      } catch (
        loadError
      ) {
        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Rezultatul nu a putut fi încărcat."
        );
      } finally {
        if (mounted) {
          setIsLoading(
            false
          );
        }
      }
    }

    void loadAttempt();

    return () => {
      mounted = false;
    };
  }, [
    params.attemptId,
    params.participantId,
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

      <div className="fixed inset-0 bg-black/70" />

      <div className="fixed inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/50" />

      <div className="relative z-10">
        <Navbar />

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href={`/clasament/${params.participantId}`}
            className="text-sm font-semibold text-green-300 transition hover:text-green-200"
          >
            ← Înapoi la profilul arbitrului
          </Link>

          {isLoading ? (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <p className="text-gray-600">
                Se încarcă rezultatul...
              </p>
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h1 className="text-xl font-bold text-red-800">
                Rezultat indisponibil
              </h1>

              <p className="mt-2 text-red-700">
                {error}
              </p>

              <Link
                href={`/clasament/${params.participantId}`}
                className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Înapoi la profil
              </Link>
            </div>
          ) : data ? (
            <>
              <section className="mt-6 rounded-3xl border border-white/15 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-600">
                      Rezultat arbitru
                    </p>

                    <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
                      {
                        data
                          .participant
                          .fullName
                      }
                    </h1>

                    <p className="mt-2 text-lg font-semibold text-gray-700">
                      {
                        data
                          .test
                          .title
                      }
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Finalizat la{" "}
                      {formatDateTime(
                        data
                          .attempt
                          .completedAt
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-4 text-center">
                    <p className="text-sm font-semibold text-green-700">
                      Nota
                    </p>

                    <p className="mt-1 text-3xl font-bold text-green-800">
                      {formatGrade(
                        data
                          .attempt
                          .grade
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Scor"
                  value={`${data.attempt.score}/${data.attempt.totalQuestions}`}
                />

                <StatCard
                  label="Procent"
                  value={`${Math.round(
                    data
                      .attempt
                      .percentage
                  )}%`}
                />

                <StatCard
                  label="Durată"
                  value={formatDuration(
                    data
                      .attempt
                      .durationSeconds
                  )}
                />

                <StatCard
                  label="Întrebări"
                  value={`${data.questions.length}`}
                />
              </section>

              <section className="mt-8">
                <div className="rounded-2xl border border-white/15 bg-white/95 px-5 py-5 shadow-sm backdrop-blur-sm sm:px-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Răspunsurile arbitrului
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Răspunsul selectat este marcat separat. Răspunsul corect este evidențiat cu verde.
                  </p>
                </div>

                <div className="mt-5 space-y-5">
                  {data.questions.map(
                    (
                      question
                    ) => (
                      <article
                        key={
                          question.questionId
                        }
                        className="rounded-3xl border border-white/15 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-7"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                              Întrebarea{" "}
                              {
                                question.orderNumber
                              }
                            </p>

                            <h3 className="mt-2 text-lg font-bold leading-7 text-gray-900 sm:text-xl">
                              {
                                question.question
                              }
                            </h3>
                          </div>

                          <QuestionStatus
                            answered={
                              question.answered
                            }
                            isCorrect={
                              question.isCorrect
                            }
                          />
                        </div>

                        <div className="mt-5 space-y-3">
                          {question.answers.map(
                            (
                              answer,
                              answerIndex
                            ) => {
                              const isSelected =
                                question.selectedAnswer ===
                                answerIndex;

                              const isCorrectAnswer =
                                question.correctAnswer ===
                                answerIndex;

                              const letter =
                                [
                                  "A",
                                  "B",
                                  "C",
                                  "D",
                                ][
                                  answerIndex
                                ] ??
                                "?";

                              return (
                                <div
                                  key={`${question.questionId}-${answerIndex}`}
                                  className={getAnswerClassName(
                                    isSelected,
                                    isCorrectAnswer
                                  )}
                                >
                                  <span
                                    className={getAnswerBadgeClassName(
                                      isSelected,
                                      isCorrectAnswer
                                    )}
                                  >
                                    {
                                      letter
                                    }
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900">
                                      {
                                        answer
                                      }
                                    </p>

                                    <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                                      {isSelected && (
                                        <span
                                          className={
                                            isCorrectAnswer
                                              ? "text-green-700"
                                              : "text-red-700"
                                          }
                                        >
                                          Răspunsul arbitrului
                                        </span>
                                      )}

                                      {isCorrectAnswer && (
                                        <span className="text-green-700">
                                          Răspuns corect
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>

                        {!question.answered && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                            Arbitrul nu a răspuns la această întrebare.
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              </section>

              <div className="mt-8 flex justify-center">
                <Link
                  href={`/clasament/${params.participantId}`}
                  className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                >
                  Înapoi la profilul arbitrului
                </Link>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  );
}

interface QuestionStatusProps {
  answered: boolean;
  isCorrect: boolean;
}

function QuestionStatus({
  answered,
  isCorrect,
}: QuestionStatusProps) {
  if (!answered) {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
        Fără răspuns
      </span>
    );
  }

  if (isCorrect) {
    return (
      <span className="inline-flex shrink-0 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">
        Corect
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
      Greșit
    </span>
  );
}

function getAnswerClassName(
  isSelected: boolean,
  isCorrectAnswer: boolean
) {
  if (
    isSelected &&
    isCorrectAnswer
  ) {
    return "flex items-start gap-4 rounded-2xl border-2 border-green-400 bg-green-50 px-4 py-4";
  }

  if (
    isSelected &&
    !isCorrectAnswer
  ) {
    return "flex items-start gap-4 rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-4";
  }

  if (isCorrectAnswer) {
    return "flex items-start gap-4 rounded-2xl border-2 border-green-300 bg-green-50 px-4 py-4";
  }

  return "flex items-start gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4";
}

function getAnswerBadgeClassName(
  isSelected: boolean,
  isCorrectAnswer: boolean
) {
  if (
    isSelected &&
    !isCorrectAnswer
  ) {
    return "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white";
  }

  if (isCorrectAnswer) {
    return "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white";
  }

  return "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-600";
}

function formatGrade(
  grade: number
) {
  if (
    !Number.isFinite(
      grade
    )
  ) {
    return "—";
  }

  return grade.toLocaleString(
    "ro-RO",
    {
      minimumFractionDigits:
        1,
      maximumFractionDigits:
        2,
    }
  );
}

function formatDuration(
  durationSeconds:
    | number
    | null
) {
  if (
    durationSeconds ===
      null ||
    durationSeconds < 0
  ) {
    return "—";
  }

  const minutes =
    Math.floor(
      durationSeconds /
        60
    );

  const seconds =
    durationSeconds %
    60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "ro-RO",
    {
      day:
        "2-digit",
      month:
        "2-digit",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  ).format(
    new Date(value)
  );
}