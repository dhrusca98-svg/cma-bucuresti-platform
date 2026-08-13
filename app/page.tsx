"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase/client";

interface ActiveTest {
  id: string;
  title: string;
  timePerQuestion: number;
  availableUntil: string | null;
  updatedAt?: string;

  questions: {
    id: string;
    question: string;
    answers: string[];
    correctAnswer: number;
    explanation: string;
    law?: number;
  }[];
}

interface ExistingAttempt {
  score: number;
  totalQuestions: number;
  percentage: number;
  durationSeconds: number | null;
  createdAt: string;
}

interface SupabaseQuestion {
  id: string;
  order_number: number;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: number;
  explanation: string | null;
  law: number | null;
}

interface SupabaseTest {
  id: string;
  title: string;
  time_per_question: number;
  available_until: string | null;
  created_at: string;
  questions: SupabaseQuestion[];
}

export default function Home() {
  const [
    activeTest,
    setActiveTest,
  ] =
    useState<ActiveTest | null>(
      null
    );

  const [
    existingAttempt,
    setExistingAttempt,
  ] =
    useState<ExistingAttempt | null>(
      null
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    currentTime,
    setCurrentTime,
  ] = useState(
    Date.now()
  );

  /*
   * Actualizăm countdown-ul
   * la fiecare secundă.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setCurrentTime(
            Date.now()
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  useEffect(() => {
    async function loadActiveTest() {
      setIsLoading(true);
      setLoadError("");
      setExistingAttempt(
        null
      );

      try {
        const nowIso =
          new Date().toISOString();

        /*
         * Căutăm doar testul:
         * - marcat activ
         * - care încă nu a expirat
         */
        const {
          data,
          error,
        } = await supabase
          .from("tests")
          .select(`
            id,
            title,
            time_per_question,
            available_until,
            created_at,
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
          .eq(
            "is_active",
            true
          )
          .gt(
            "available_until",
            nowIso
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setActiveTest(
            null
          );

          return;
        }

        const databaseTest =
          data as SupabaseTest;

        const orderedQuestions =
          [
            ...(
              databaseTest.questions ??
              []
            ),
          ].sort(
            (
              firstQuestion,
              secondQuestion
            ) =>
              firstQuestion.order_number -
              secondQuestion.order_number
          );

        const formattedTest: ActiveTest =
          {
            id:
              databaseTest.id,

            title:
              databaseTest.title,

            timePerQuestion:
              databaseTest.time_per_question,

            availableUntil:
              databaseTest.available_until,

            updatedAt:
              databaseTest.created_at,

            questions:
              orderedQuestions.map(
                (
                  question
                ) => ({
                  id:
                    question.id,

                  question:
                    question.question,

                  answers: [
                    question.answer_a,
                    question.answer_b,
                    question.answer_c,
                    question.answer_d,
                  ],

                  correctAnswer:
                    question.correct_answer,

                  explanation:
                    question.explanation ??
                    "",

                  law:
                    question.law ??
                    undefined,
                })
              ),
          };

        setActiveTest(
          formattedTest
        );

        /*
         * Dacă utilizatorul este logat,
         * verificăm dacă a susținut deja
         * testul.
         */
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (
          !session?.access_token
        ) {
          return;
        }

        const response =
          await fetch(
            `/api/test/submit?testId=${formattedTest.id}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

        if (
          response.status ===
          403
        ) {
          return;
        }

        const result =
          (await response.json()) as {
            attempted?: boolean;
            attempt?: ExistingAttempt;
            error?: string;
          };

        if (
          !response.ok
        ) {
          throw new Error(
            result.error ||
              "Rezultatul nu a putut fi verificat."
          );
        }

        if (
          result.attempted &&
          result.attempt
        ) {
          setExistingAttempt(
            result.attempt
          );
        }
      } catch (error) {
        console.error(
          "Eroare la încărcarea testului:",
          error
        );

        setActiveTest(
          null
        );

        setLoadError(
          "Testul activ nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(
          false
        );
      }
    }

    loadActiveTest();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          loadActiveTest();
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const totalQuestions =
    activeTest?.questions
      .length ?? 0;

  const timePerQuestion =
    activeTest?.timePerQuestion ??
    0;

  const estimatedMinutes =
    activeTest !== null
      ? Math.ceil(
          (totalQuestions *
            timePerQuestion) /
            60
        )
      : 0;

  /*
   * Nota pe scala 1-10.
   *
   * Exemplu:
   * 6/20 = 3,00
   */
  const grade =
    existingAttempt &&
    existingAttempt.totalQuestions >
      0
      ? (existingAttempt.score /
          existingAttempt.totalQuestions) *
        10
      : 0;

  const remainingTime =
    activeTest
      ?.availableUntil
      ? getRemainingTime(
          activeTest.availableUntil,
          currentTime
        )
      : null;

  /*
   * Dacă countdown-ul ajunge
   * la zero în timp ce utilizatorul
   * stă pe homepage, îl tratăm
   * imediat ca expirat.
   */
  const testExpired =
    activeTest
      ?.availableUntil
      ? new Date(
          activeTest.availableUntil
        ).getTime() <=
        currentTime
      : false;

  return (
    <div className="min-h-screen bg-[#07100b]">
      <Navbar />

      <main
        className="relative flex min-h-[calc(100vh-64px)] items-center bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/homepage-bg.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            {/* LEFT */}
            <section className="max-w-3xl text-center lg:text-left">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-400">
                Platformă oficială
                de testare
              </p>

              <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Comisia
                Municipală

                <span className="block text-green-500">
                  a Arbitrilor
                  București
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg lg:mx-0">
                Testare teoretică
                pentru arbitri.
              </p>
            </section>

            {/* RIGHT CARD */}
            <section className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
              <div className="rounded-3xl border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-400">
                  Test activ
                </p>

                {isLoading ? (
                  <p className="mt-6 text-gray-300">
                    Se încarcă
                    testul...
                  </p>
                ) : loadError ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      Eroare de
                      conexiune
                    </h2>

                    <p className="mt-3 text-gray-300">
                      {loadError}
                    </p>
                  </>
                ) : activeTest &&
                  !testExpired ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                      {
                        activeTest.title
                      }
                    </h2>

                    {existingAttempt ? (
                      <>
                        <p className="mt-4 text-sm leading-6 text-gray-300">
                          Ai susținut
                          deja acest
                          test.
                        </p>

                        <div className="mt-6 grid grid-cols-3 gap-3">
                          <TestInfo
                            value={`${existingAttempt.score}/${existingAttempt.totalQuestions}`}
                            label="Scor"
                          />

                          <TestInfo
                            value={formatGrade(
                              grade
                            )}
                            label="Notă"
                          />

                          <TestInfo
                            value={
                              remainingTime ??
                              "—"
                            }
                            label="Se închide în"
                          />
                        </div>

                        {activeTest.availableUntil && (
                          <p className="mt-4 text-center text-xs text-gray-400">
                            Disponibil
                            până la{" "}
                            {formatDeadline(
                              activeTest.availableUntil
                            )}
                          </p>
                        )}

                        <Link
                          href="/test"
                          className="mt-8 flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-green-500"
                        >
                          Vezi
                          rezultatul
                        </Link>
                      </>
                    ) : (
                      <>
                        <div className="mt-7 grid grid-cols-3 gap-3">
                          <TestInfo
                            value={totalQuestions.toString()}
                            label="Întrebări"
                          />

                          <TestInfo
                            value={`${timePerQuestion}s`}
                            label="Per întrebare"
                          />

                          <TestInfo
                            value={
                              remainingTime ??
                              "—"
                            }
                            label="Se închide în"
                          />
                        </div>

                        <p className="mt-4 text-center text-xs text-gray-400">
                          Durată
                          estimată: ~
                          {
                            estimatedMinutes
                          }{" "}
                          minute
                        </p>

                        {activeTest.availableUntil && (
                          <p className="mt-2 text-center text-xs text-gray-400">
                            Disponibil
                            până la{" "}
                            {formatDeadline(
                              activeTest.availableUntil
                            )}
                          </p>
                        )}

                        <Link
                          href="/test"
                          className="mt-8 flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-green-500"
                        >
                          Începe
                          testul
                        </Link>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      Niciun test
                      disponibil
                    </h2>

                    <p className="mt-3 text-gray-300">
                      Momentan nu
                      există un test
                      disponibil
                      pentru
                      susținere.
                    </p>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

interface TestInfoProps {
  value: string;
  label: string;
}

function TestInfo({
  value,
  label,
}: TestInfoProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/10 px-2 py-4 text-center">
      <p className="break-words text-lg font-bold text-white sm:text-xl">
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-4 text-gray-300 sm:text-xs">
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
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  );
}

function formatDeadline(
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

function getRemainingTime(
  availableUntil: string,
  currentTime: number
) {
  const deadline =
    new Date(
      availableUntil
    ).getTime();

  const difference =
    deadline -
    currentTime;

  if (difference <= 0) {
    return "Expirat";
  }

  const totalMinutes =
    Math.floor(
      difference /
        (1000 * 60)
    );

  const days =
    Math.floor(
      totalMinutes /
        (60 * 24)
    );

  const hours =
    Math.floor(
      (totalMinutes %
        (60 * 24)) /
        60
    );

  const minutes =
    totalMinutes % 60;

  if (days > 0) {
    return `${days}z ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(
    minutes,
    1
  )}m`;
}