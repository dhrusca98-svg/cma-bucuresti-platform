"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import TestHeader from "@/components/TestHeader";
import TimerBar from "@/components/TimerBar";
import { supabase } from "@/lib/supabase/client";

interface TestQuestion {
  id: string;
  question: string;
  answers: string[];
  law?: number;
}

interface ActiveTest {
  id: string;
  title: string;
  durationMinutes: number;
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
  startedAt?: string;
}

interface ProgressResponse {
  success?: boolean;
  attempted?: boolean;
  isAdmin?: boolean;
  status?: "in_progress" | "completed" | "preview";
  expired?: boolean;
  attemptId?: string;
  startedAt?: string;
  durationSeconds?: number;
  timeLeft?: number;
  score?: number;
  answers?: RecordedAnswer[];
  attempt?: ExistingAttempt;
  completed?: boolean;
  error?: string;
}

const backgroundStyle = {
  backgroundImage: "url('/images/test-bg.jpg')",
};

export default function TestPage() {
  const router = useRouter();

  const [activeTest, setActiveTest] =
    useState<ActiveTest | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [existingAttempt, setExistingAttempt] =
    useState<ExistingAttempt | null>(null);

  const [isAdminPreview, setIsAdminPreview] =
    useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] =
    useState(0);

  const [selectedAnswer, setSelectedAnswer] =
    useState<number | null>(null);

  const [isConfirmed, setIsConfirmed] =
    useState(false);

  const [score, setScore] =
    useState(0);

  const [isFinished, setIsFinished] =
    useState(false);

  const [timeLeft, setTimeLeft] =
    useState(0);

  const [totalTime, setTotalTime] =
    useState(30 * 60);

  const [saveError, setSaveError] =
    useState("");

  const [isSavingAnswer, setIsSavingAnswer] =
    useState(false);

  const [isSavingResult, setIsSavingResult] =
    useState(false);

  const [expired, setExpired] =
    useState(false);

  const answersRef =
    useRef<RecordedAnswer[]>([]);

  const startedAtRef =
    useRef<number>(Date.now());

  const finishingRef =
    useRef(false);

  const question =
    activeTest?.questions[
      currentQuestionIndex
    ];

  const isLastQuestion =
    activeTest !== null &&
    currentQuestionIndex ===
      activeTest.questions.length - 1;

  const applyProgress = useCallback(
    (
      test: ActiveTest,
      progress: ProgressResponse
    ) => {
      const durationSeconds =
        progress.durationSeconds ??
        test.durationMinutes * 60;

      setTotalTime(durationSeconds);

      const savedAnswers =
        progress.answers ?? [];

      answersRef.current =
        savedAnswers;

      if (
        progress.status ===
          "completed" &&
        progress.attempt
      ) {
        setScore(
          progress.attempt.score
        );

        setExistingAttempt(
          progress.attempt
        );

        setExpired(
          progress.expired === true
        );

        return;
      }

      setScore(
        progress.score ??
          savedAnswers.filter(
            (answer) =>
              answer.isCorrect
          ).length
      );

      if (progress.startedAt) {
        startedAtRef.current =
          new Date(
            progress.startedAt
          ).getTime();
      } else {
        startedAtRef.current =
          Date.now();
      }

      setTimeLeft(
        progress.timeLeft ??
          durationSeconds
      );

      if (
        savedAnswers.length === 0
      ) {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsConfirmed(false);
        return;
      }

      const answeredIndexes =
        savedAnswers
          .map((answer) =>
            test.questions.findIndex(
              (questionItem) =>
                questionItem.id ===
                answer.questionId
            )
          )
          .filter(
            (index) => index >= 0
          );

      const lastAnsweredIndex =
        answeredIndexes.length > 0
          ? Math.max(
              ...answeredIndexes
            )
          : 0;

      const savedAnswer =
        savedAnswers.find(
          (answer) =>
            answer.questionId ===
            test.questions[
              lastAnsweredIndex
            ]?.id
        );

      setCurrentQuestionIndex(
        lastAnsweredIndex
      );

      setSelectedAnswer(
        savedAnswer?.selectedAnswer ??
          null
      );

      setIsConfirmed(
        Boolean(savedAnswer)
      );
    },
    []
  );

  useEffect(() => {
    async function loadTest() {
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
            "/login?next=/test"
          );
          return;
        }

        const nowIso =
          new Date().toISOString();

        /*
         * Nu mai încărcăm răspunsul corect
         * sau explicația în browser.
         */
        const {
          data,
          error,
        } = await supabase
          .from("tests")
          .select(`
            id,
            title,
            duration_minutes,
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
          throw new Error(
            "Testul nu mai este disponibil sau perioada de susținere a expirat."
          );
        }

        const formattedTest: ActiveTest =
          {
            id: data.id,

            title:
              data.title,

            durationMinutes:
              Number(
                data.duration_minutes ??
                  30
              ),

            questions: [
              ...(data.questions ??
                []),
            ]
              .sort(
                (
                  firstQuestion: any,
                  secondQuestion: any
                ) =>
                  firstQuestion.order_number -
                  secondQuestion.order_number
              )
              .map(
                (
                  questionItem: any
                ) => ({
                  id:
                    questionItem.id,

                  question:
                    questionItem.question,

                  answers: [
                    questionItem.answer_a,
                    questionItem.answer_b,
                    questionItem.answer_c,
                    questionItem.answer_d,
                  ],

                  law:
                    questionItem.law ??
                    undefined,
                })
              ),
          };

        if (
          formattedTest.questions
            .length === 0
        ) {
          throw new Error(
            "Testul activ nu conține întrebări."
          );
        }

        setActiveTest(
          formattedTest
        );

        const statusResponse =
          await fetch(
            `/api/test/submit?testId=${formattedTest.id}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const statusResult =
          (await statusResponse.json()) as ProgressResponse;

        if (
          !statusResponse.ok
        ) {
          throw new Error(
            statusResult.error ||
              "Situația testului nu a putut fi verificată."
          );
        }

        setIsAdminPreview(
          statusResult.isAdmin ===
            true
        );

        if (
          statusResult.status ===
            "completed" &&
          statusResult.attempt
        ) {
          applyProgress(
            formattedTest,
            statusResult
          );
          return;
        }

        const startResponse =
          await fetch(
            "/api/test/submit",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization: `Bearer ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  action:
                    "start",

                  testId:
                    formattedTest.id,
                }),
            }
          );

        const startResult =
          (await startResponse.json()) as ProgressResponse;

        if (
          !startResponse.ok &&
          !startResult.completed
        ) {
          throw new Error(
            startResult.error ||
              "Testarea nu a putut fi începută."
          );
        }

        applyProgress(
          formattedTest,
          startResult
        );
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

    void loadTest();
  }, [
    applyProgress,
    router,
  ]);

  const finishTest =
    useCallback(
      async (
        wasExpired = false
      ) => {
        if (
          !activeTest ||
          finishingRef.current
        ) {
          return;
        }

        if (
          isAdminPreview
        ) {
          finishingRef.current =
            true;

          setExpired(
            wasExpired
          );

          setIsFinished(
            true
          );

          return;
        }

        finishingRef.current =
          true;

        setIsSavingResult(
          true
        );

        setSaveError("");

        try {
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
            throw new Error(
              "Sesiunea a expirat. Autentifică-te din nou."
            );
          }

          const response =
            await fetch(
              "/api/test/submit",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization: `Bearer ${session.access_token}`,
                },

                body:
                  JSON.stringify({
                    action:
                      "finish",

                    testId:
                      activeTest.id,
                  }),
              }
            );

          const result =
            (await response.json()) as ProgressResponse;

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Rezultatul nu a putut fi salvat."
            );
          }

          if (
            result.answers
          ) {
            answersRef.current =
              result.answers;
          }

          if (
            result.attempt
          ) {
            setScore(
              result.attempt.score
            );
          }

          setExpired(
            wasExpired ||
              result.expired ===
                true
          );

          setIsFinished(
            true
          );
        } catch (error) {
          finishingRef.current =
            false;

          setSaveError(
            error instanceof Error
              ? error.message
              : "Rezultatul nu a putut fi salvat."
          );
        } finally {
          setIsSavingResult(
            false
          );
        }
      },
      [
        activeTest,
        isAdminPreview,
      ]
    );

  const handleConfirm =
    useCallback(
      async () => {
        if (
          !activeTest ||
          !question ||
          selectedAnswer ===
            null ||
          isConfirmed ||
          isSavingAnswer ||
          isFinished
        ) {
          return;
        }

        setIsSavingAnswer(
          true
        );

        setSaveError("");

        try {
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
            throw new Error(
              "Sesiunea a expirat. Autentifică-te din nou."
            );
          }

          const response =
            await fetch(
              "/api/test/submit",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization: `Bearer ${session.access_token}`,
                },

                body:
                  JSON.stringify({
                    action:
                      "answer",

                    testId:
                      activeTest.id,

                    questionId:
                      question.id,

                    selectedAnswer,
                  }),
              }
            );

          const result =
            (await response.json()) as ProgressResponse & {
              answer?: RecordedAnswer;
              alreadyAnswered?: boolean;
            };

          if (!response.ok) {
            throw new Error(
              result.error ||
                "Răspunsul nu a putut fi salvat."
            );
          }

          if (
            result.status ===
              "completed" &&
            result.attempt
          ) {
            if (
              result.answers
            ) {
              answersRef.current =
                result.answers;
            }

            setScore(
              result.attempt.score
            );

            setExpired(
              result.expired ===
                true
            );

            setIsFinished(
              true
            );

            return;
          }

          if (
            !result.answer
          ) {
            throw new Error(
              "Răspunsul nu a putut fi confirmat."
            );
          }

          answersRef.current = [
            ...answersRef.current.filter(
              (answer) =>
                answer.questionId !==
                question.id
            ),

            result.answer,
          ];

          setSelectedAnswer(
            result.answer
              .selectedAnswer
          );

          /*
           * Important:
           * marcăm doar că răspunsul
           * a fost confirmat.
           *
           * Nu arătăm dacă este
           * corect sau greșit.
           */
          setIsConfirmed(
            true
          );

          if (
            typeof result.score ===
            "number"
          ) {
            setScore(
              result.score
            );
          } else {
            setScore(
              answersRef.current.filter(
                (answer) =>
                  answer.isCorrect
              ).length
            );
          }

          if (
            typeof result.timeLeft ===
            "number"
          ) {
            setTimeLeft(
              result.timeLeft
            );
          }
        } catch (error) {
          setSaveError(
            error instanceof Error
              ? error.message
              : "Răspunsul nu a putut fi salvat."
          );
        } finally {
          setIsSavingAnswer(
            false
          );
        }
      },
      [
        activeTest,
        isConfirmed,
        isFinished,
        isSavingAnswer,
        question,
        selectedAnswer,
      ]
    );

  const handleNextQuestion =
    useCallback(() => {
      if (
        !activeTest ||
        !question
      ) {
        return;
      }

      if (
        isLastQuestion
      ) {
        void finishTest(
          false
        );
        return;
      }

      const nextIndex =
        currentQuestionIndex +
        1;

      const nextQuestion =
        activeTest.questions[
          nextIndex
        ];

      const savedAnswer =
        answersRef.current.find(
          (answer) =>
            answer.questionId ===
            nextQuestion.id
        );

      setCurrentQuestionIndex(
        nextIndex
      );

      setSelectedAnswer(
        savedAnswer?.selectedAnswer ??
          null
      );

      setIsConfirmed(
        Boolean(savedAnswer)
      );

      setSaveError("");
    }, [
      activeTest,
      currentQuestionIndex,
      finishTest,
      isLastQuestion,
      question,
    ]);

  useEffect(() => {
    if (
      !activeTest ||
      isFinished ||
      existingAttempt
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          const elapsedSeconds =
            Math.max(
              0,
              Math.floor(
                (Date.now() -
                  startedAtRef.current) /
                  1000
              )
            );

          const remaining =
            Math.max(
              0,
              totalTime -
                elapsedSeconds
            );

          setTimeLeft(
            remaining
          );

          if (
            remaining <= 0
          ) {
            window.clearInterval(
              timer
            );

            void finishTest(
              true
            );
          }
        },
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    activeTest,
    existingAttempt,
    finishTest,
    isFinished,
    totalTime,
  ]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        !question ||
        isFinished ||
        isSavingAnswer
      ) {
        return;
      }

      const pressedKey =
        event.key.toLowerCase();

      if (
        !isConfirmed
      ) {
        const answerIndex =
          [
            "a",
            "b",
            "c",
            "d",
          ].indexOf(
            pressedKey
          );

        if (
          answerIndex !== -1 &&
          answerIndex <
            question.answers.length
        ) {
          setSelectedAnswer(
            answerIndex
          );
          return;
        }

        if (
          event.key ===
            "Enter" &&
          selectedAnswer !==
            null
        ) {
          event.preventDefault();

          void handleConfirm();
        }

        return;
      }

      if (
        event.code ===
        "Space"
      ) {
        event.preventDefault();

        handleNextQuestion();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    handleConfirm,
    handleNextQuestion,
    isConfirmed,
    isFinished,
    isSavingAnswer,
    question,
    selectedAnswer,
  ]);

  if (isLoading) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4"
        style={
          backgroundStyle
        }
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 rounded-2xl border border-white/20 bg-white/95 px-8 py-6 shadow-2xl backdrop-blur-sm">
          <p className="font-medium text-gray-700">
            Se încarcă
            testul...
          </p>
        </div>
      </main>
    );
  }

  if (
    existingAttempt &&
    activeTest
  ) {
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6 sm:py-16"
        style={
          backgroundStyle
        }
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10">
          <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              {
                activeTest.title
              }
            </p>

            <h1 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              {expired
                ? "Timpul testului a expirat"
                : "Ai susținut deja acest test"}
            </h1>

            <p className="mt-3 text-gray-600">
              {expired
                ? "Testul a fost închis automat. Rezultatul include răspunsurile salvate până la expirarea timpului."
                : "Fiecare arbitru poate avea o singură tentativă pentru acest test."}
            </p>

            <ScoreCards
              score={
                existingAttempt.score
              }
              totalQuestions={
                existingAttempt.totalQuestions
              }
            />

            <p className="mt-6 text-sm text-gray-500">
              Început la{" "}
              {new Date(
                existingAttempt.startedAt ??
                  existingAttempt.createdAt
              ).toLocaleString(
                "ro-RO"
              )}
            </p>
          </div>

          <WrongAnswersReview
            test={
              activeTest
            }
            recordedAnswers={
              answersRef.current
            }
          />

          <div className="mx-auto mt-6 max-w-xl">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/"
                )
              }
              className="w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
            >
              Înapoi la
              pagina
              principală
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (
    loadError ||
    !activeTest ||
    !question
  ) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4"
        style={
          backgroundStyle
        }
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Test
            indisponibil
          </h1>

          <p className="mt-3 text-gray-600">
            {loadError ||
              "Nu există momentan niciun test publicat."}
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
          >
            Înapoi la
            pagina
            principală
          </Link>
        </div>
      </main>
    );
  }

  if (isFinished) {
    return (
      <main
        className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-10 sm:px-6 sm:py-16"
        style={
          backgroundStyle
        }
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10">
          <GradeResultCard
            score={score}
            totalQuestions={
              activeTest.questions
                .length
            }
            expired={
              expired
            }
          />

          <WrongAnswersReview
            test={
              activeTest
            }
            recordedAnswers={
              answersRef.current
            }
          />

          {isAdminPreview && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
              Aceasta a fost o
              previzualizare de
              administrator.
              Rezultatul nu a
              fost salvat.
            </p>
          )}

          {isSavingResult && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
              Se salvează
              rezultatul...
            </p>
          )}

          {saveError && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
              <p>
                {saveError}
              </p>

              <button
                type="button"
                onClick={() => {
                  finishingRef.current =
                    false;

                  void finishTest(
                    expired
                  );
                }}
                className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition hover:bg-red-700"
              >
                Încearcă din
                nou
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
      style={
        backgroundStyle
      }
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-4xl rounded-3xl border border-white/20 bg-white/95 p-5 shadow-2xl backdrop-blur-sm sm:p-8">
        {isAdminPreview && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            Mod
            previzualizare
            administrator.
            Rezultatul nu va
            fi salvat.
          </div>
        )}

        <TestHeader
          currentQuestion={
            currentQuestionIndex +
            1
          }
          totalQuestions={
            activeTest.questions
              .length
          }
          law={
            question.law
          }
        />

        <TimerBar
          timeLeft={
            timeLeft
          }
          totalTime={
            totalTime
          }
        />

        <p className="mt-3 text-sm font-medium text-gray-500">
          Timpul este pentru
          întregul test și
          continuă să curgă
          dacă reîncarci pagina
          sau ieși temporar din
          test.
        </p>

        <section className="mt-8">
          <h2 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
            {
              question.question
            }
          </h2>
        </section>

        <div className="mt-8 space-y-4">
          {question.answers.map(
            (
              answer,
              index
            ) => (
              <QuestionAnswerButton
                key={`${question.id}-${index}`}
                answer={
                  answer
                }
                index={
                  index
                }
                selectedAnswer={
                  selectedAnswer
                }
                locked={
                  isConfirmed ||
                  isSavingAnswer
                }
                onSelect={
                  setSelectedAnswer
                }
              />
            )
          )}
        </div>

        {!isConfirmed ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => {
                void handleConfirm();
              }}
              disabled={
                selectedAnswer ===
                  null ||
                isSavingAnswer
              }
              className="w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300 sm:w-auto"
            >
              {isSavingAnswer
                ? "Se salvează..."
                : "Confirmă răspunsul"}
            </button>

            <p className="mt-3 text-sm text-gray-500">
              Taste: A–D
              pentru selectare
              • Enter pentru
              confirmare
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
              Răspunsul a fost
              înregistrat și nu
              mai poate fi
              modificat.
            </div>

            <button
              type="button"
              onClick={
                handleNextQuestion
              }
              disabled={
                isSavingResult
              }
              className="mt-6 w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
            >
              {isLastQuestion
                ? isSavingResult
                  ? "Se finalizează..."
                  : "Finalizează testul"
                : "Următoarea întrebare"}
            </button>

            <p className="mt-3 text-sm text-gray-500">
              Space • următoarea
              întrebare
            </p>
          </div>
        )}

        {saveError && (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {saveError}
          </p>
        )}
      </div>
    </main>
  );
}

interface QuestionAnswerButtonProps {
  answer: string;
  index: number;
  selectedAnswer: number | null;
  locked: boolean;
  onSelect: (
    index: number
  ) => void;
}

function QuestionAnswerButton({
  answer,
  index,
  selectedAnswer,
  locked,
  onSelect,
}: QuestionAnswerButtonProps) {
  const isSelected =
    selectedAnswer === index;

  const letter =
    ["A", "B", "C", "D"][
      index
    ] ?? "?";

  return (
    <button
      type="button"
      disabled={
        locked
      }
      onClick={() =>
        onSelect(index)
      }
      className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition ${
        isSelected
          ? "border-gray-800 bg-gray-100"
          : "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50"
      } ${
        locked
          ? "cursor-default"
          : ""
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isSelected
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-700"
        }`}
      >
        {letter}
      </span>

      <span className="pt-1 font-medium text-gray-800">
        {answer}
      </span>
    </button>
  );
}

function calculateGrade(
  score: number,
  totalQuestions: number
) {
  if (
    totalQuestions <= 0
  ) {
    return 0;
  }

  return (
    (score /
      totalQuestions) *
    10
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

interface ScoreCardsProps {
  score: number;
  totalQuestions: number;
}

function ScoreCards({
  score,
  totalQuestions,
}: ScoreCardsProps) {
  const grade =
    calculateGrade(
      score,
      totalQuestions
    );

  return (
    <div className="mt-7 grid grid-cols-2 gap-4">
      <div className="rounded-2xl bg-gray-100 p-5">
        <p className="text-3xl font-bold text-gray-900">
          {score}/
          {totalQuestions}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          Răspunsuri corecte
        </p>
      </div>

      <div className="rounded-2xl bg-green-50 p-5">
        <p className="text-3xl font-bold text-green-700">
          {formatGrade(
            grade
          )}
        </p>

        <p className="mt-1 text-sm text-green-700">
          Notă
        </p>
      </div>
    </div>
  );
}

interface GradeResultCardProps {
  score: number;
  totalQuestions: number;
  expired: boolean;
}

function GradeResultCard({
  score,
  totalQuestions,
  expired,
}: GradeResultCardProps) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
        Rezultat final
      </p>

      <h1 className="mt-3 text-3xl font-bold text-gray-900">
        {expired
          ? "Timpul a expirat"
          : "Test finalizat"}
      </h1>

      {expired && (
        <p className="mt-3 text-gray-600">
          Au fost luate în
          calcul răspunsurile
          salvate până la
          expirarea timpului.
        </p>
      )}

      <ScoreCards
        score={
          score
        }
        totalQuestions={
          totalQuestions
        }
      />

      <Link
        href="/"
        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200"
      >
        Înapoi la pagina
        principală
      </Link>
    </div>
  );
}

interface WrongAnswersReviewProps {
  test: ActiveTest;
  recordedAnswers: RecordedAnswer[];
}

function WrongAnswersReview({
  test,
  recordedAnswers,
}: WrongAnswersReviewProps) {
  const wrongAnswers =
    recordedAnswers.filter(
      (answer) =>
        answer.isCorrect ===
          false &&
        answer.selectedAnswer !==
          null
    );

  if (
    wrongAnswers.length === 0
  ) {
    return (
      <section className="mx-auto mt-6 w-full max-w-3xl rounded-3xl border border-white/20 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-8">
        <h2 className="text-xl font-bold text-gray-900">
          Întrebări
          răspunse greșit
        </h2>

        <p className="mt-3 text-gray-600">
          Nu ai răspuns greșit
          la nicio întrebare.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-3xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-600">
          Recapitulare
        </p>

        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          Întrebări
          răspunse greșit
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-600">
          Este evidențiat
          doar răspunsul pe
          care l-ai ales.
          Răspunsul corect nu
          este afișat.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {wrongAnswers.map(
          (
            recordedAnswer,
            wrongIndex
          ) => {
            const questionIndex =
              test.questions.findIndex(
                (
                  questionItem
                ) =>
                  questionItem.id ===
                  recordedAnswer.questionId
              );

            const wrongQuestion =
              test.questions[
                questionIndex
              ];

            if (
              !wrongQuestion
            ) {
              return null;
            }

            return (
              <article
                key={
                  recordedAnswer.questionId
                }
                className="rounded-2xl border border-gray-200 bg-white p-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                  Întrebarea{" "}
                  {questionIndex >=
                  0
                    ? questionIndex +
                      1
                    : wrongIndex +
                      1}
                </p>

                <h3 className="mt-2 text-lg font-bold leading-7 text-gray-900">
                  {
                    wrongQuestion.question
                  }
                </h3>

                <div className="mt-5 space-y-3">
                  {wrongQuestion.answers.map(
                    (
                      answer,
                      answerIndex
                    ) => {
                      const isChosenWrongAnswer =
                        recordedAnswer.selectedAnswer ===
                        answerIndex;

                      const letter =
                        [
                          "A",
                          "B",
                          "C",
                          "D",
                        ][
                          answerIndex
                        ] ?? "?";

                      return (
                        <div
                          key={`${recordedAnswer.questionId}-${answerIndex}`}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                            isChosenWrongAnswer
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              isChosenWrongAnswer
                                ? "bg-red-600 text-white"
                                : "bg-white text-gray-600"
                            }`}
                          >
                            {isChosenWrongAnswer
                              ? "✕"
                              : letter}
                          </span>

                          <div className="pt-1">
                            <p
                              className={`font-medium ${
                                isChosenWrongAnswer
                                  ? "text-red-700"
                                  : "text-gray-700"
                              }`}
                            >
                              {!isChosenWrongAnswer &&
                                `${letter}. `}
                              {
                                answer
                              }
                            </p>

                            {isChosenWrongAnswer && (
                              <p className="mt-1 text-xs font-semibold text-red-600">
                                Răspunsul
                                tău
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}