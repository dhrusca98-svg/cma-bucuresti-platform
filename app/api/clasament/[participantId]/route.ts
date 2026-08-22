import { createClient } from "@supabase/supabase-js";

interface AttemptRow {
  id: string;
  participant_id: string;
  score: number;
  total_questions: number;
  percentage: number | string | null;
  duration_seconds: number | null;
  created_at: string;

  tests:
    | {
        id: string;
        title: string;
        created_at: string;
      }
    | {
        id: string;
        title: string;
        created_at: string;
      }[]
    | null;

  participants:
    | {
        first_name: string;
        last_name: string;
        active: boolean | null;
      }
    | {
        first_name: string;
        last_name: string;
        active: boolean | null;
      }[]
    | null;
}

interface RankingAccumulator {
  participantId: string;
  fullName: string;
  totalPoints: number;
  maximumPoints: number;
  testsTaken: number;
  gradeSum: number;
}

function requireEnvironmentVariable(
  name: string
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Lipsește variabila de mediu ${name}.`
    );
  }

  return value;
}

function firstRelated<T>(
  value: T | T[] | null
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function calculateGrade(
  score: number,
  totalQuestions: number
) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (
    (score / totalQuestions) *
    10
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      participantId: string;
    }>;
  }
) {
  try {
    const {
      participantId,
    } = await params;

    const supabaseUrl =
      requireEnvironmentVariable(
        "NEXT_PUBLIC_SUPABASE_URL"
      );

    const publishableKey =
      requireEnvironmentVariable(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      );

    const secretKey =
      requireEnvironmentVariable(
        "SUPABASE_SECRET_KEY"
      );

    const adminEmail =
      requireEnvironmentVariable(
        "ADMIN_EMAIL"
      )
        .trim()
        .toLowerCase();

    /*
     * Verificăm cine face request-ul.
     */
    const authorization =
      request.headers.get(
        "authorization"
      ) ?? "";

    const accessToken =
      authorization.startsWith(
        "Bearer "
      )
        ? authorization.slice(7)
        : "";

    if (!accessToken) {
      return Response.json(
        {
          error:
            "Trebuie să fii autentificat.",
        },
        { status: 401 }
      );
    }

    const authClient =
      createClient(
        supabaseUrl,
        publishableKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,

            detectSessionInUrl:
              false,
          },
        }
      );

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !user
    ) {
      return Response.json(
        {
          error:
            "Sesiunea nu este validă.",
        },
        { status: 401 }
      );
    }

    /*
     * Profilurile altor arbitri
     * sunt accesibile doar adminului.
     */
    if (
      user.email
        ?.trim()
        .toLowerCase() !==
      adminEmail
    ) {
      return Response.json(
        {
          error:
            "Nu ai permisiunea să accesezi profilul acestui participant.",
        },
        { status: 403 }
      );
    }

    /*
     * Abia după verificarea adminului
     * folosim cheia secretă Supabase.
     */
    const adminClient =
      createClient(
        supabaseUrl,
        secretKey,
        {
          auth: {
            autoRefreshToken:
              false,

            persistSession:
              false,

            detectSessionInUrl:
              false,
          },
        }
      );

    const [
      participantResult,
      attemptsResult,
      testsResult,
      allAttemptsResult,
    ] =
      await Promise.all([
        adminClient
          .from(
            "participants"
          )
          .select(
            "id, first_name, last_name, email, active"
          )
          .eq(
            "id",
            participantId
          )
          .maybeSingle(),

        /*
         * Istoricul participantului.
         * Luăm doar testele finalizate.
         */
        adminClient
          .from(
            "attempts"
          )
          .select(`
            id,
            participant_id,
            score,
            total_questions,
            percentage,
            duration_seconds,
            created_at,
            tests (
              id,
              title,
              created_at
            )
          `)
          .eq(
            "participant_id",
            participantId
          )
          .eq(
            "status",
            "completed"
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          ),

        adminClient
          .from("tests")
          .select(
            "id",
            {
              count:
                "exact",
              head: true,
            }
          ),

        /*
         * Rezultatele tuturor,
         * doar pentru calcularea
         * clasamentului.
         */
        adminClient
          .from(
            "attempts"
          )
          .select(`
            id,
            participant_id,
            score,
            total_questions,
            percentage,
            duration_seconds,
            created_at,
            participants (
              first_name,
              last_name,
              active
            ),
            tests (
              id,
              title,
              created_at
            )
          `)
          .eq(
            "status",
            "completed"
          ),
      ]);

    if (
      participantResult.error
    ) {
      throw new Error(
        participantResult
          .error.message
      );
    }

    if (
      !participantResult.data
    ) {
      return Response.json(
        {
          error:
            "Participantul nu există.",
        },
        { status: 404 }
      );
    }

    if (
      attemptsResult.error
    ) {
      throw new Error(
        attemptsResult
          .error.message
      );
    }

    if (
      testsResult.error
    ) {
      throw new Error(
        testsResult
          .error.message
      );
    }

    if (
      allAttemptsResult.error
    ) {
      throw new Error(
        allAttemptsResult
          .error.message
      );
    }

    const attempts =
      (attemptsResult.data ??
        []) as AttemptRow[];

    const publishedTests =
      testsResult.count ?? 0;

    const totalPoints =
      attempts.reduce(
        (
          sum,
          attempt
        ) =>
          sum +
          attempt.score,
        0
      );

    const maximumPoints =
      attempts.reduce(
        (
          sum,
          attempt
        ) =>
          sum +
          attempt.total_questions,
        0
      );

    /*
     * Media notelor.
     *
     * Ex:
     * 6/20 = 3.00
     * 8/20 = 4.00
     * media = 3.50
     */
    const grades =
      attempts.map(
        (attempt) =>
          calculateGrade(
            attempt.score,
            attempt.total_questions
          )
      );

    const averageGrade =
      grades.length > 0
        ? grades.reduce(
            (
              sum,
              grade
            ) =>
              sum +
              grade,
            0
          ) /
          grades.length
        : 0;

    /*
     * Îl păstrăm momentan și pe acesta
     * pentru compatibilitate cu pagina
     * veche până o înlocuim.
     */
    const averagePercentage =
      attempts.length > 0
        ? attempts.reduce(
            (
              sum,
              attempt
            ) =>
              sum +
              Number(
                attempt.percentage ??
                  0
              ),
            0
          ) /
          attempts.length
        : 0;

    const participationPercentage =
      publishedTests > 0
        ? (attempts.length /
            publishedTests) *
          100
        : 0;

    /*
     * Istoricul testelor.
     *
     * attemptId va fi folosit
     * pentru pagina de detaliu.
     */
    const history =
      attempts.map(
        (attempt) => {
          const test =
            firstRelated(
              attempt.tests
            );

          return {
            attemptId:
              attempt.id,

            testId:
              test?.id ??
              "",

            testTitle:
              test?.title ??
              "Test fără titlu",

            score:
              attempt.score,

            totalQuestions:
              attempt.total_questions,

            percentage:
              Number(
                attempt.percentage ??
                  0
              ),

            grade:
              calculateGrade(
                attempt.score,
                attempt.total_questions
              ),

            durationSeconds:
              attempt.duration_seconds,

            completedAt:
              attempt.created_at,
          };
        }
      );

    /*
     * Construim clasamentul.
     */
    const rankingMap =
      new Map<
        string,
        RankingAccumulator
      >();

    const allAttempts =
      (allAttemptsResult.data ??
        []) as AttemptRow[];

    for (
      const attempt of
        allAttempts
    ) {
      const participant =
        firstRelated(
          attempt.participants
        );

      /*
       * Nu includem participanții
       * inexistenți sau inactivi.
       */
      if (
        !participant ||
        participant.active !==
          true
      ) {
        continue;
      }

      const fullName =
        `${participant.last_name} ${participant.first_name}`.trim();

      const grade =
        calculateGrade(
          attempt.score,
          attempt.total_questions
        );

      const existing =
        rankingMap.get(
          attempt.participant_id
        );

      if (existing) {
        existing.totalPoints +=
          attempt.score;

        existing.maximumPoints +=
          attempt.total_questions;

        existing.testsTaken +=
          1;

        existing.gradeSum +=
          grade;

        continue;
      }

      rankingMap.set(
        attempt.participant_id,
        {
          participantId:
            attempt.participant_id,

          fullName,

          totalPoints:
            attempt.score,

          maximumPoints:
            attempt.total_questions,

          testsTaken:
            1,

          gradeSum:
            grade,
        }
      );
    }

    const ranking =
      Array.from(
        rankingMap.values()
      )
        .map(
          (entry) => ({
            ...entry,

            averageGrade:
              entry.testsTaken >
              0
                ? entry.gradeSum /
                  entry.testsTaken
                : 0,
          })
        )
        .sort(
          (
            first,
            second
          ) => {
            /*
             * Criteriul principal:
             * punctele totale.
             */
            if (
              second.totalPoints !==
              first.totalPoints
            ) {
              return (
                second.totalPoints -
                first.totalPoints
              );
            }

            /*
             * Departajare:
             * media notelor.
             */
            if (
              second.averageGrade !==
              first.averageGrade
            ) {
              return (
                second.averageGrade -
                first.averageGrade
              );
            }

            /*
             * Apoi numărul
             * testelor susținute.
             */
            if (
              second.testsTaken !==
              first.testsTaken
            ) {
              return (
                second.testsTaken -
                first.testsTaken
              );
            }

            return first.fullName.localeCompare(
              second.fullName,
              "ro"
            );
          }
        );

    const rankingIndex =
      ranking.findIndex(
        (entry) =>
          entry.participantId ===
          participantId
      );

    const rankingPosition =
      rankingIndex >= 0
        ? rankingIndex + 1
        : null;

    return Response.json({
      participant: {
        id:
          participantResult
            .data.id,

        firstName:
          participantResult
            .data.first_name,

        lastName:
          participantResult
            .data.last_name,

        fullName:
          `${participantResult.data.last_name} ${participantResult.data.first_name}`.trim(),

        email:
          participantResult
            .data.email,

        active:
          participantResult
            .data.active ===
          true,
      },

      summary: {
        rankingPosition,

        rankedParticipants:
          ranking.length,

        totalPoints,

        maximumPoints,

        testsTaken:
          attempts.length,

        publishedTests,

        participationPercentage,

        /*
         * Noul câmp pe care
         * îl vom afișa în card.
         */
        averageGrade,

        /*
         * Temporar, pentru compatibilitate.
         * Îl putem elimina ulterior.
         */
        averagePercentage,
      },

      history,
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea profilului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Profilul nu a putut fi încărcat.",
      },
      { status: 500 }
    );
  }
}