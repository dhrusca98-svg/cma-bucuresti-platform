import { createClient } from "@supabase/supabase-js";

interface TestJoin {
  id: string;
  title: string;
  created_at: string;
}

interface AttemptRow {
  id: string;
  participant_id?: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  created_at: string;
  tests:
    | TestJoin
    | TestJoin[]
    | null;
  participants?:
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
  firstName: string;
  lastName: string;
  totalPoints: number;
  testsTaken: number;
  gradeSum: number;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Lipsește variabila de mediu ${name}.`
    );
  }

  return value;
}

function createClients() {
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

  const authClient = createClient(
    supabaseUrl,
    publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  const adminClient = createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  return {
    authClient,
    adminClient,
  };
}

function getTest(
  value: AttemptRow["tests"]
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getParticipant(
  value: AttemptRow["participants"]
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
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

export async function GET(request: Request) {
  try {
    const {
      authClient,
      adminClient,
    } = createClients();

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

    const {
      data: { user },
      error: userError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (userError || !user) {
      return Response.json(
        {
          error:
            "Sesiunea nu este validă.",
        },
        { status: 401 }
      );
    }

    const {
      data: participant,
      error: participantError,
    } = await adminClient
      .from("participants")
      .select(`
        id,
        first_name,
        last_name,
        email,
        active
      `)
      .eq(
        "auth_user_id",
        user.id
      )
      .maybeSingle();

    if (participantError) {
      throw new Error(
        participantError.message
      );
    }

    if (!participant) {
      return Response.json(
        {
          error:
            "Contul nu este asociat unui participant.",
        },
        { status: 404 }
      );
    }

    if (
      participant.active !== true
    ) {
      return Response.json(
        {
          error:
            "Contul participantului este inactiv.",
        },
        { status: 403 }
      );
    }

    const [
      attemptsResult,
      testsResult,
      rankingAttemptsResult,
    ] = await Promise.all([
      adminClient
        .from("attempts")
        .select(`
          id,
          score,
          total_questions,
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
          participant.id
        )
        .eq(
          "status",
          "completed"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        ),

      adminClient
        .from("tests")
        .select("id", {
          count: "exact",
          head: true,
        }),

      adminClient
        .from("attempts")
        .select(`
          participant_id,
          score,
          total_questions,
          created_at,
          participants (
            first_name,
            last_name,
            active
          )
        `)
        .eq(
          "status",
          "completed"
        ),
    ]);

    if (
      attemptsResult.error
    ) {
      throw new Error(
        attemptsResult.error.message
      );
    }

    if (testsResult.error) {
      throw new Error(
        testsResult.error.message
      );
    }

    if (
      rankingAttemptsResult.error
    ) {
      throw new Error(
        rankingAttemptsResult.error.message
      );
    }

    const attempts =
      (attemptsResult.data ??
        []) as AttemptRow[];

    const rankingAttempts =
      (rankingAttemptsResult.data ??
        []) as AttemptRow[];

    const grades =
      attempts.map(
        (attempt) =>
          calculateGrade(
            attempt.score,
            attempt.total_questions
          )
      );

    const totalPoints =
      attempts.reduce(
        (sum, attempt) =>
          sum + attempt.score,
        0
      );

    const maximumPoints =
      attempts.reduce(
        (sum, attempt) =>
          sum +
          attempt.total_questions,
        0
      );

    const averageGrade =
      grades.length > 0
        ? grades.reduce(
            (sum, grade) =>
              sum + grade,
            0
          ) / grades.length
        : 0;

    const publishedTests =
      testsResult.count ?? 0;

    const participationPercentage =
      publishedTests > 0
        ? (attempts.length /
            publishedTests) *
          100
        : 0;

    const history =
      attempts.map(
        (attempt) => {
          const test =
            getTest(
              attempt.tests
            );

          return {
            attemptId:
              attempt.id,

            testId:
              test?.id ?? "",

            title:
              test?.title ??
              "Test fără titlu",

            score:
              attempt.score,

            totalQuestions:
              attempt.total_questions,

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
     * Construim clasamentul intern,
     * doar pentru calculul poziției.
     * Nu îl trimitem către arbitru.
     */
    const rankingMap = new Map<
      string,
      RankingAccumulator
    >();

    for (const attempt of rankingAttempts) {
      const rankingParticipant =
        getParticipant(
          attempt.participants
        );

      if (
        !rankingParticipant ||
        rankingParticipant.active !== true ||
        !attempt.participant_id
      ) {
        continue;
      }

      const grade = calculateGrade(
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

        existing.testsTaken += 1;

        existing.gradeSum += grade;

        continue;
      }

      rankingMap.set(
        attempt.participant_id,
        {
          participantId:
            attempt.participant_id,

          firstName:
            rankingParticipant.first_name,

          lastName:
            rankingParticipant.last_name,

          totalPoints:
            attempt.score,

          testsTaken: 1,

          gradeSum: grade,
        }
      );
    }

    const ranking = Array.from(
      rankingMap.values()
    )
      .map(
        (rankingParticipant) => ({
          participantId:
            rankingParticipant.participantId,

          fullName:
            `${rankingParticipant.lastName} ${rankingParticipant.firstName}`.trim(),

          totalPoints:
            rankingParticipant.totalPoints,

          testsTaken:
            rankingParticipant.testsTaken,

          averageGrade:
            rankingParticipant.testsTaken >
            0
              ? rankingParticipant.gradeSum /
                rankingParticipant.testsTaken
              : 0,
        })
      )
      .sort((first, second) => {
        if (
          second.totalPoints !==
          first.totalPoints
        ) {
          return (
            second.totalPoints -
            first.totalPoints
          );
        }

        if (
          second.averageGrade !==
          first.averageGrade
        ) {
          return (
            second.averageGrade -
            first.averageGrade
          );
        }

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
      });

    const rankingIndex =
      ranking.findIndex(
        (rankingParticipant) =>
          rankingParticipant.participantId ===
          participant.id
      );

    const rankingPosition =
      rankingIndex >= 0
        ? rankingIndex + 1
        : null;

    const totalRankedParticipants =
      ranking.length;

    return Response.json({
      participant: {
        id:
          participant.id,

        firstName:
          participant.first_name,

        lastName:
          participant.last_name,

        fullName:
          `${participant.last_name} ${participant.first_name}`.trim(),

        email:
          participant.email ??
          user.email ??
          "",
      },

      stats: {
        testsTaken:
          attempts.length,

        publishedTests,

        totalPoints,

        maximumPoints,

        averageGrade,

        participationPercentage,

        rankingPosition,

        totalRankedParticipants,
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