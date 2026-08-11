"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase/client";

interface ActiveTest {
  id: string;
  title: string;
  timePerQuestion: number;
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
  created_at: string;
  questions: SupabaseQuestion[];
}

export default function Home() {
  const [activeTest, setActiveTest] =
    useState<ActiveTest | null>(null);

  const [existingAttempt, setExistingAttempt] =
    useState<ExistingAttempt | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadActiveTest() {
      setIsLoading(true);
      setLoadError("");
      setExistingAttempt(null);

      try {
        const { data, error } = await supabase
          .from("tests")
          .select(`
            id,
            title,
            time_per_question,
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
          .eq("is_active", true)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setActiveTest(null);
          return;
        }

        const databaseTest = data as SupabaseTest;

        const orderedQuestions = [
          ...(databaseTest.questions ?? []),
        ].sort(
          (firstQuestion, secondQuestion) =>
            firstQuestion.order_number -
            secondQuestion.order_number
        );

        const formattedTest: ActiveTest = {
          id: databaseTest.id,
          title: databaseTest.title,
          timePerQuestion:
            databaseTest.time_per_question,
          updatedAt: databaseTest.created_at,
          questions: orderedQuestions.map(
            (question) => ({
              id: question.id,
              question: question.question,
              answers: [
                question.answer_a,
                question.answer_b,
                question.answer_c,
                question.answer_d,
              ],
              correctAnswer:
                question.correct_answer,
              explanation:
                question.explanation ?? "",
              law: question.law ?? undefined,
            })
          ),
        };

        setActiveTest(formattedTest);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          return;
        }

        const response = await fetch(
          `/api/test/submit?testId=${formattedTest.id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.status === 403) {
          return;
        }

        const result = (await response.json()) as {
          attempted?: boolean;
          attempt?: ExistingAttempt;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Rezultatul nu a putut fi verificat."
          );
        }

        if (result.attempted && result.attempt) {
          setExistingAttempt(result.attempt);
        }
      } catch (error) {
        console.error(
          "Eroare la încărcarea testului:",
          error
        );

        setActiveTest(null);
        setLoadError(
          "Testul activ nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadActiveTest();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadActiveTest();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const totalQuestions =
    activeTest?.questions.length ?? 0;

  const timePerQuestion =
    activeTest?.timePerQuestion ?? 0;

  const estimatedMinutes =
    activeTest !== null
      ? Math.ceil(
          (totalQuestions * timePerQuestion) / 60
        )
      : 0;

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
            <section className="max-w-3xl text-center lg:text-left">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-400">
                Platformă oficială de testare
              </p>

              <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Comisia Municipală

                <span className="block text-green-500">
                  a Arbitrilor București
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg lg:mx-0">
                Testare teoretică pentru arbitri.
              </p>
            </section>

            <section className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
              <div className="rounded-3xl border border-white/15 bg-black/45 p-6 shadow-2xl backdrop-blur-md sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-green-400">
                  Test activ
                </p>

                {isLoading ? (
                  <p className="mt-6 text-gray-300">
                    Se încarcă testul...
                  </p>
                ) : loadError ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      Eroare de conexiune
                    </h2>

                    <p className="mt-3 text-gray-300">
                      {loadError}
                    </p>
                  </>
                ) : activeTest ? (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                      {activeTest.title}
                    </h2>

                    {existingAttempt ? (
                      <>
                        <p className="mt-4 text-sm leading-6 text-gray-300">
                          Ai susținut deja acest test.
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                          <TestInfo
                            value={`${existingAttempt.score}/${existingAttempt.totalQuestions}`}
                            label="Scor"
                          />

                          <TestInfo
                            value={`${Math.round(existingAttempt.percentage)}%`}
                            label="Procent"
                          />
                        </div>

                        <Link
                          href="/test"
                          className="mt-8 flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-green-500"
                        >
                          Vezi rezultatul
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
                            value={`~${estimatedMinutes}`}
                            label="Minute"
                          />
                        </div>

                        <Link
                          href="/test"
                          className="mt-8 flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-green-500"
                        >
                          Începe testul
                        </Link>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-2xl font-bold text-white">
                      Niciun test publicat
                    </h2>

                    <p className="mt-3 text-gray-300">
                      Momentan nu există un test activ în
                      baza de date.
                    </p>

                    <Link
                      href="/admin/teste/nou"
                      className="mt-8 flex w-full items-center justify-center rounded-xl border border-green-500 px-6 py-4 font-bold text-green-400 transition hover:bg-green-500/10"
                    >
                      Creează un test
                    </Link>
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
    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center">
      <p className="text-xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-300">
        {label}
      </p>
    </div>
  );
}