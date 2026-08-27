import { createClient } from "@supabase/supabase-js";

interface AttemptRow {
  participant_id: string;
  score: number;
  total_questions: number;
  created_at: string;
  participants:
    | {
        first_name: string;
        last_name: string;
        active: boolean | null;
        include_in_ranking: boolean | null;
      }
    | {
        first_name: string;
        last_name: string;
        active: boolean | null;
        include_in_ranking: boolean | null;
      }[]
    | null;
}

interface RankingAccumulator {
  participantId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  maximumPoints: number;
  testsTaken: number;
  gradeSum: number;
  latestAttemptAt: string;
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

function getParticipant(
  value: AttemptRow["participants"]
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

  return (score / totalQuestions) * 10;
}

export async function GET(request: Request) {
  try {
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

    const authorization =
      request.headers.get("authorization") ?? "";

    const accessToken =
      authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

    if (!accessToken) {
      return Response.json(
        {
          error:
            "Trebuie să fii autentificat.",
        },
        {
          status: 401,
        }
      );
    }

    const authClient =
      createClient(
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
        {
          status: 401,
        }
      );
    }

    if (
      user.email?.trim().toLowerCase() !==
      adminEmail
    ) {
      return Response.json(
        {
          error:
            "Nu ai permisiunea să vezi clasamentul general.",
        },
        {
          status: 403,
        }
      );
    }

    const adminClient =
      createClient(
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

    const [
      attemptsResult,
      testsResult,
      participantsResult,
    ] = await Promise.all([
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
            active,
            include_in_ranking
          )
        `)
        .eq("status", "completed"),

      adminClient
        .from("tests")
        .select("id", {
          count: "exact",
          head: true,
        }),

      adminClient
        .from("participants")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("active", true)
        .eq("include_in_ranking", true),
    ]);

    if (attemptsResult.error) {
      throw new Error(
        attemptsResult.error.message
      );
    }

    if (testsResult.error) {
      throw new Error(
        testsResult.error.message
      );
    }

    if (participantsResult.error) {
      throw new Error(
        participantsResult.error.message
      );
    }

    const attempts =
      (attemptsResult.data ?? []) as AttemptRow[];

    const rankingMap =
      new Map<
        string,
        RankingAccumulator
      >();

    let totalGrades = 0;

    let completedAttemptsFromRankedParticipants =
      0;

    for (const attempt of attempts) {
      const participant =
        getParticipant(
          attempt.participants
        );

      if (
        !participant ||
        participant.active !== true ||
        participant.include_in_ranking !== true
      ) {
        continue;
      }

      const grade =
        calculateGrade(
          attempt.score,
          attempt.total_questions
        );

      totalGrades += grade;

      completedAttemptsFromRankedParticipants +=
        1;

      const existing =
        rankingMap.get(
          attempt.participant_id
        );

      if (existing) {
        existing.totalPoints +=
          attempt.score;

        existing.maximumPoints +=
          attempt.total_questions;

        existing.testsTaken += 1;

        existing.gradeSum += grade;

        if (
          new Date(
            attempt.created_at
          ).getTime() >
          new Date(
            existing.latestAttemptAt
          ).getTime()
        ) {
          existing.latestAttemptAt =
            attempt.created_at;
        }

        continue;
      }

      rankingMap.set(
        attempt.participant_id,
        {
          participantId:
            attempt.participant_id,

          firstName:
            participant.first_name,

          lastName:
            participant.last_name,

          totalPoints:
            attempt.score,

          maximumPoints:
            attempt.total_questions,

          testsTaken: 1,

          gradeSum: grade,

          latestAttemptAt:
            attempt.created_at,
        }
      );
    }

    const ranking =
      Array.from(
        rankingMap.values()
      )
        .map(
          (participant) => ({
            participantId:
              participant.participantId,

            firstName:
              participant.firstName,

            lastName:
              participant.lastName,

            fullName:
              `${participant.lastName} ${participant.firstName}`.trim(),

            totalPoints:
              participant.totalPoints,

            maximumPoints:
              participant.maximumPoints,

            testsTaken:
              participant.testsTaken,

            publishedTests:
              testsResult.count ?? 0,

            participationPercentage:
              (testsResult.count ?? 0) > 0
                ? (participant.testsTaken /
                    (testsResult.count ?? 1)) *
                  100
                : 0,

            averageGrade:
              participant.testsTaken > 0
                ? participant.gradeSum /
                  participant.testsTaken
                : 0,

            latestAttemptAt:
              participant.latestAttemptAt,
          })
        )
        .sort(
          (first, second) => {
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
          }
        )
        .map(
          (participant, index) => ({
            rank: index + 1,
            ...participant,
          })
        );

    const generalAverageGrade =
      completedAttemptsFromRankedParticipants >
      0
        ? totalGrades /
          completedAttemptsFromRankedParticipants
        : 0;

    return Response.json({
      ranking,

      stats: {
        publishedTests:
          testsResult.count ?? 0,

        activeParticipants:
          participantsResult.count ?? 0,

        participantsWithResults:
          ranking.length,

        totalAttempts:
          completedAttemptsFromRankedParticipants,

        generalAverageGrade,
      },
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea clasamentului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Clasamentul nu a putut fi încărcat.",
      },
      {
        status: 500,
      }
    );
  }
}