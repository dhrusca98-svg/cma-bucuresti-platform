"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import TimerBar from "@/components/TimerBar";
import { supabase } from "@/lib/supabase/client";

interface TestQuestion {
  id: string;
  question: string;
  answers: string[];
}

interface ActiveTestMeta {
  id: string;
  title: string;
  durationMinutes: number;
  availableUntil?: string;
  createdAt?: string;
}

interface ActiveTest extends ActiveTestMeta {
  questions: TestQuestion[];
}

interface RecordedAnswer {
  questionId: string;
  selectedAnswer: number | null;
  isCorrect?: boolean;
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
  status?:
    | "in_progress"
    | "completed"
    | "preview";
  expired?: boolean;
  attemptId?: string;
  startedAt?: string;
  durationSeconds?: number;
  timeLeft?: number;
  answeredCount?: number;
  questions?: TestQuestion[];
  answers?: RecordedAnswer[];
  attempt?: ExistingAttempt;
  completed?: boolean;
  error?: string;
}

const backgroundStyle = {
  backgroundImage:
    "url('/images/test-bg.jpg')",
};

export default function TestPage() {
  const router = useRouter();

  const [
    activeTest,
    setActiveTest,
  ] =
    useState<ActiveTest | null>(
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
    existingAttempt,
    setExistingAttempt,
  ] =
    useState<ExistingAttempt | null>(
      null
    );

  const [
    isAdminPreview,
    setIsAdminPreview,
  ] = useState(false);

  const [
    selectedAnswers,
    setSelectedAnswers,
  ] = useState<
    Record<string, number>
  >({});

  const [
    completedAnswers,
    setCompletedAnswers,
  ] = useState<
    RecordedAnswer[]
  >([]);

  const [
    previewCorrectness,
    setPreviewCorrectness,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    savingQuestions,
    setSavingQuestions,
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    savedQuestions,
    setSavedQuestions,
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    score,
    setScore,
  ] = useState(0);

  const [
    isFinished,
    setIsFinished,
  ] = useState(false);

  const [
    timeLeft,
    setTimeLeft,
  ] = useState(0);

  const [
    totalTime,
    setTotalTime,
  ] = useState(30 * 60);

  const [
    saveError,
    setSaveError,
  ] = useState("");

  const [
    isSavingResult,
    setIsSavingResult,
  ] = useState(false);

  const [
    expired,
    setExpired,
  ] = useState(false);

  /*
   * Timerul din browser NU compară ceasul local al dispozitivului
   * cu started_at de pe server. Ceasul telefonului/laptopului poate
   * fi înainte sau în urmă și ar putea închide testul prea devreme.
   *
   * Păstrăm doar timpul rămas calculat de server și îl decrementăm
   * local folosind performance.now(), care este monotonic și nu
   * depinde de ora setată pe dispozitiv.
   */
  const timerBaseTimeLeftRef =
    useRef(0);

  const timerBasePerformanceRef =
    useRef(0);

  const finishingRef =
    useRef(false);

  const selectedAnswersRef =
    useRef<
      Record<string, number>
    >({});

  const saveVersionRef =
    useRef<
      Record<string, number>
    >({});

  useEffect(() => {
    selectedAnswersRef.current =
      selectedAnswers;
  }, [selectedAnswers]);

  const answeredCount =
    useMemo(
      () =>
        Object.keys(
          selectedAnswers
        ).length,
      [selectedAnswers]
    );

  const applyProgress =
    useCallback(
      (
        test: ActiveTest,
        progress:
          ProgressResponse
      ) => {
        const durationSeconds =
          progress.durationSeconds ??
          test.durationMinutes *
            60;

        setTotalTime(
          durationSeconds
        );

        const savedAnswers =
          progress.answers ?? [];

        const answerMap:
          Record<
            string,
            number
          > = {};

        for (
          const answer of
            savedAnswers
        ) {
          if (
            typeof answer.selectedAnswer ===
            "number"
          ) {
            answerMap[
              answer.questionId
            ] =
              answer.selectedAnswer;
          }
        }

        setSelectedAnswers(
          answerMap
        );

        selectedAnswersRef.current =
          answerMap;

        setSavedQuestions(
          new Set(
            Object.keys(
              answerMap
            )
          )
        );

        if (
          progress.status ===
            "completed" &&
          progress.attempt
        ) {
          setCompletedAnswers(
            savedAnswers
          );

          setScore(
            progress.attempt.score
          );

          setExistingAttempt(
            progress.attempt
          );

          setExpired(
            progress.expired ===
              true
          );

          return;
        }

        const serverTimeLeft =
          Math.max(
            0,
            progress.timeLeft ??
              durationSeconds
          );

        timerBaseTimeLeftRef.current =
          serverTimeLeft;

        timerBasePerformanceRef.current =
          window.performance.now();

        setTimeLeft(
          serverTimeLeft
        );
      },
      []
    );

  useEffect(() => {
    async function loadTest() {
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
          router.replace(
            "/login?next=/test"
          );

          return;
        }

        /*
         * Testul și întrebările sunt încărcate
         * prin API-ul nostru server-side.
         *
         * Browserul NU mai citește direct
         * tabela questions din Supabase.
         *
         * API-ul NU returnează correct_answer.
         */
        const testResponse =
          await fetch(
            "/api/test/active",
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const testResult =
          (await testResponse.json()) as {
            test?: ActiveTestMeta;
            error?: string;
          };

        if (
          !testResponse.ok ||
          !testResult.test
        ) {
          throw new Error(
            testResult.error ||
              "Testul nu mai este disponibil sau perioada de susținere a expirat."
          );
        }

        const testMeta =
          testResult.test;

        /*
         * IMPORTANT:
         * /api/test/active nu trimite întrebările.
         * Verificăm mai întâi starea tentativei.
         */
        const statusResponse =
          await fetch(
            `/api/test/submit?testId=${testMeta.id}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
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

        /*
         * Test deja finalizat. În acest caz
         * serverul poate returna întrebările
         * doar pentru afișarea rezultatului.
         */
        if (
          statusResult.status ===
            "completed" &&
          statusResult.attempt
        ) {
          const completedTest:
            ActiveTest = {
            ...testMeta,
            questions:
              statusResult.questions ??
              [],
          };

          setActiveTest(
            completedTest
          );

          applyProgress(
            completedTest,
            statusResult
          );

          return;
        }

        /*
         * Acesta este momentul în care participantul
         * primește întrebările. Pentru participant,
         * serverul creează/recuperează attempt-ul și
         * timerul server-side este deja pornit înainte
         * ca răspunsul să ajungă în browser.
         */
        /*
         * Confirmarea este afișată aici, în pagina /test,
         * înainte de action: "start". Astfel apare indiferent
         * de linkul din care participantul ajunge la test, iar
         * simpla deschidere a paginii NU pornește cronometrul.
         *
         * Dacă tentativa este deja în desfășurare, nu mai cerem
         * confirmarea: participantul trebuie să poată reveni la
         * test fără să primească din nou mesajul de început.
         */
        if (
          statusResult.status !==
            "in_progress"
        ) {
          const durationLabel =
            testMeta.durationMinutes === 1
              ? "1 minut"
              : `${testMeta.durationMinutes} minute`;

          const confirmed =
            window.confirm(
              `Ești pe cale să începi testul „${testMeta.title}”.\n\nDurata testului: ${durationLabel}.\nCronometrul începe imediat după ce apeși OK.\n\nContinui?`
            );

          if (!confirmed) {
            router.push("/");
            return;
          }
        }

        const startResponse =
          await fetch(
            "/api/test/submit",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  action:
                    "start",

                  testId:
                    testMeta.id,
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

        const questions =
          startResult.questions ??
          [];

        if (
          startResult.status !==
            "completed" &&
          questions.length === 0
        ) {
          throw new Error(
            "Testul activ nu conține întrebări."
          );
        }

        const startedTest:
          ActiveTest = {
          ...testMeta,
          questions,
        };

        setActiveTest(
          startedTest
        );

        applyProgress(
          startedTest,
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
        setIsLoading(
          false
        );
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

        finishingRef.current =
          true;

        setIsSavingResult(
          true
        );

        setSaveError("");

        try {
          if (
            isAdminPreview
          ) {
            const previewAnswers =
              activeTest.questions
                .filter(
                  (question) =>
                    typeof selectedAnswersRef
                      .current[
                      question.id
                    ] ===
                    "number"
                )
                .map(
                  (question) => ({
                    questionId:
                      question.id,

                    selectedAnswer:
                      selectedAnswersRef
                        .current[
                        question.id
                      ],

                    isCorrect:
                      previewCorrectness[
                        question.id
                      ] ??
                      false,
                  })
                );

            setCompletedAnswers(
              previewAnswers
            );

            setScore(
              previewAnswers.filter(
                (answer) =>
                  answer.isCorrect ===
                  true
              ).length
            );

            setExpired(
              wasExpired
            );

            setIsFinished(
              true
            );

            return;
          }

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

          const finalAnswers =
            Object.entries(
              selectedAnswersRef.current
            ).map(
              ([
                questionId,
                selectedAnswer,
              ]) => ({
                questionId,
                selectedAnswer,
              })
            );

          const response =
            await fetch(
              "/api/test/submit",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                body:
                  JSON.stringify({
                    action:
                      wasExpired
                        ? "expire"
                        : "finish",

                    testId:
                      activeTest.id,

                    /*
                     * La submit manual sincronizăm
                     * încă o dată toate selecțiile.
                     * La expirare serverul decide dacă
                     * timpul mai permite actualizări.
                     */
                    answers:
                      finalAnswers,
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

          /*
           * Dacă browserul a ajuns la 00:00, nu presupunem că testul
           * a expirat. Serverul verifică timpul cu propriul ceas.
           * Dacă mai există timp, resynchronizăm countdown-ul și
           * păstrăm tentativa deschisă.
           */
          if (
            wasExpired &&
            result.status ===
              "in_progress"
          ) {
            const serverTimeLeft =
              Math.max(
                0,
                result.timeLeft ??
                  0
              );

            timerBaseTimeLeftRef.current =
              serverTimeLeft;

            timerBasePerformanceRef.current =
              window.performance.now();

            setTimeLeft(
              serverTimeLeft
            );

            setExpired(false);

            finishingRef.current =
              false;

            return;
          }

          if (
            result.answers
          ) {
            setCompletedAnswers(
              result.answers
            );
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
        previewCorrectness,
      ]
    );

  const saveAnswer =
    useCallback(
      async (
        questionId: string,
        selectedAnswer:
          number
      ) => {
        if (
          !activeTest ||
          isFinished ||
          existingAttempt
        ) {
          return;
        }

        const currentVersion =
          (saveVersionRef
            .current[
            questionId
          ] ?? 0) + 1;

        saveVersionRef.current[
          questionId
        ] =
          currentVersion;

        setSavingQuestions(
          (current) => {
            const next =
              new Set(
                current
              );

            next.add(
              questionId
            );

            return next;
          }
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

                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                body:
                  JSON.stringify({
                    action:
                      "answer",

                    testId:
                      activeTest.id,

                    questionId,

                    selectedAnswer,
                  }),
              }
            );

          const result =
            (await response.json()) as ProgressResponse & {
              answer?: RecordedAnswer;
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
              setCompletedAnswers(
                result.answers
              );
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
            isAdminPreview &&
            typeof result
              .answer
              ?.isCorrect ===
              "boolean"
          ) {
            setPreviewCorrectness(
              (current) => ({
                ...current,
                [questionId]:
                  result.answer!
                    .isCorrect!,
              })
            );
          }

          if (
            saveVersionRef
              .current[
              questionId
            ] ===
            currentVersion
          ) {
            setSavedQuestions(
              (current) => {
                const next =
                  new Set(
                    current
                  );

                next.add(
                  questionId
                );

                return next;
              }
            );
          }

          if (
            typeof result.timeLeft ===
            "number"
          ) {
            const serverTimeLeft =
              Math.max(
                0,
                result.timeLeft
              );

            timerBaseTimeLeftRef.current =
              serverTimeLeft;

            timerBasePerformanceRef.current =
              window.performance.now();

            setTimeLeft(
              serverTimeLeft
            );
          }
        } catch (error) {
          setSaveError(
            error instanceof Error
              ? error.message
              : "Răspunsul nu a putut fi salvat."
          );
        } finally {
          if (
            saveVersionRef
              .current[
              questionId
            ] ===
            currentVersion
          ) {
            setSavingQuestions(
              (current) => {
                const next =
                  new Set(
                    current
                  );

                next.delete(
                  questionId
                );

                return next;
              }
            );
          }
        }
      },
      [
        activeTest,
        existingAttempt,
        isAdminPreview,
        isFinished,
      ]
    );

  function handleSelectAnswer(
    questionId: string,
    answerIndex: number
  ) {
    if (
      isFinished ||
      existingAttempt
    ) {
      return;
    }

    setSelectedAnswers(
      (current) => {
        const next = {
          ...current,
          [questionId]:
            answerIndex,
        };

        selectedAnswersRef.current =
          next;

        return next;
      }
    );

    setSavedQuestions(
      (current) => {
        const next =
          new Set(
            current
          );

        next.delete(
          questionId
        );

        return next;
      }
    );

    void saveAnswer(
      questionId,
      answerIndex
    );
  }

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
          const elapsedSinceServerSync =
            Math.max(
              0,
              Math.floor(
                (window.performance.now() -
                  timerBasePerformanceRef.current) /
                  1000
              )
            );

          const remaining =
            Math.max(
              0,
              timerBaseTimeLeftRef.current -
                elapsedSinceServerSync
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

  function requestFinish() {
    const unanswered =
      activeTest
        ? activeTest.questions
            .length -
          Object.keys(
            selectedAnswersRef.current
          ).length
        : 0;

    const message =
      unanswered > 0
        ? `Mai ai ${unanswered} ${
            unanswered === 1
              ? "întrebare fără răspuns"
              : "întrebări fără răspuns"
          }. Sigur vrei să trimiți testul?`
        : "Sigur vrei să trimiți testul? După trimitere răspunsurile nu mai pot fi modificate.";

    if (
      window.confirm(
        message
      )
    ) {
      void finishTest(
        false
      );
    }
  }

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
            Se încarcă testul...
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
              {activeTest.title}
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
          </div>

          <WrongAnswersReview
            test={
              activeTest
            }
            recordedAnswers={
              completedAnswers
            }
          />

          <div className="mx-auto mt-6 max-w-xl">
            <button
              type="button"
              onClick={() =>
                router.push("/")
              }
              className="w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
            >
              Înapoi la pagina principală
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (
    loadError ||
    !activeTest
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
            Test indisponibil
          </h1>

          <p className="mt-3 text-gray-600">
            {loadError ||
              "Nu există momentan niciun test publicat."}
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
          >
            Înapoi la pagina principală
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
              completedAnswers
            }
          />

          {isAdminPreview && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-medium text-blue-700">
              Aceasta a fost o previzualizare de administrator. Rezultatul nu a fost salvat.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat px-4 py-8 sm:px-6 sm:py-12"
      style={
        backgroundStyle
      }
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="rounded-2xl border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur-md sm:p-6">
          {isAdminPreview && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
              Mod previzualizare administrator. Rezultatul nu va fi salvat.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
                CMA București
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                {activeTest.title}
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Răspunsuri completate:{" "}
                <strong className="text-gray-800">
                  {answeredCount}/
                  {activeTest.questions.length}
                </strong>
              </p>
            </div>

            <p className="text-sm text-gray-500">
              Poți modifica orice răspuns până la trimiterea finală.
            </p>
          </div>

          <div className="mt-4">
            <TimerBar
              timeLeft={
                timeLeft
              }
              totalTime={
                totalTime
              }
            />
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {activeTest.questions.map(
            (
              question,
              questionIndex
            ) => {
              const selected =
                selectedAnswers[
                  question.id
                ];

              const isSaving =
                savingQuestions.has(
                  question.id
                );

              const isSaved =
                savedQuestions.has(
                  question.id
                ) &&
                !isSaving;

              return (
                <section
                  key={
                    question.id
                  }
                  className="rounded-3xl border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur-sm sm:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
                      Întrebarea{" "}
                      {questionIndex +
                        1}
                    </p>

                    <p
                      className={`text-xs font-semibold ${
                        isSaving
                          ? "text-amber-600"
                          : isSaved
                            ? "text-green-600"
                            : "text-gray-400"
                      }`}
                    >
                      {isSaving
                        ? "Se salvează..."
                        : isSaved
                          ? "Salvat"
                          : "Fără răspuns"}
                    </p>
                  </div>

                  <h2 className="mt-3 text-xl font-bold leading-8 text-gray-900 sm:text-2xl">
                    {question.question}
                  </h2>

                  <div className="mt-6 space-y-3">
                    {question.answers.map(
                      (
                        answer,
                        answerIndex
                      ) => {
                        const isSelected =
                          selected ===
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
                          <button
                            key={`${question.id}-${answerIndex}`}
                            type="button"
                            onClick={() =>
                              handleSelectAnswer(
                                question.id,
                                answerIndex
                              )
                            }
                            className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition ${
                              isSelected
                                ? "border-green-600 bg-green-50 ring-2 ring-green-100"
                                : "border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50"
                            }`}
                          >
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                isSelected
                                  ? "bg-green-600 text-white"
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
                    )}
                  </div>
                </section>
              );
            }
          )}
        </div>

        {saveError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {saveError}
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                {answeredCount}/
                {activeTest.questions.length} întrebări completate
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Verifică răspunsurile înainte de trimitere. După submit nu mai pot fi modificate.
              </p>
            </div>

            <button
              type="button"
              onClick={
                requestFinish
              }
              disabled={
                isSavingResult
              }
              className="rounded-xl bg-green-600 px-7 py-4 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSavingResult
                ? "Se trimite..."
                : "Trimite testul"}
            </button>
          </div>
        </div>
      </div>
    </main>
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
          Au fost luate în calcul răspunsurile salvate până la expirarea timpului.
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
        className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700"
      >
        Înapoi la pagina principală
      </Link>
    </div>
  );
}

interface WrongAnswersReviewProps {
  test: ActiveTest;
  recordedAnswers:
    RecordedAnswer[];
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
          Întrebări răspunse greșit
        </h2>

        <p className="mt-3 text-gray-600">
          Nu ai răspuns greșit la nicio întrebare.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-3xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-600">
        Recapitulare
      </p>

      <h2 className="mt-2 text-2xl font-bold text-gray-900">
        Întrebări răspunse greșit
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-600">
        Este evidențiat doar răspunsul pe care l-ai ales. Răspunsul corect nu este afișat.
      </p>

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
                  {wrongQuestion.question}
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
                              {answer}
                            </p>

                            {isChosenWrongAnswer && (
                              <p className="mt-1 text-xs font-semibold text-red-600">
                                Răspunsul tău
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