import { createClient } from "@supabase/supabase-js";

interface AttemptRow {
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
  percentageSum: number;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
  }

  return value;
}

function firstRelated<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      participantId: string;
    }>;
  }
) {
  try {
    const { participantId } = await params;

    const supabaseUrl = requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

    const secretKey = requireEnvironmentVariable(
      "SUPABASE_SECRET_KEY"
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

    const [
      participantResult,
      attemptsResult,
      testsResult,
      allAttemptsResult,
    ] = await Promise.all([
      adminClient
        .from("participants")
        .select(
          "id, first_name, last_name, email, active"
        )
        .eq("id", participantId)
        .maybeSingle(),
      adminClient
        .from("attempts")
        .select(`
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
        .eq("participant_id", participantId)
        .order("created_at", {
          ascending: false,
        }),
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
        `),
    ]);

    if (participantResult.error) {
      throw new Error(
        participantResult.error.message
      );
    }

    if (!participantResult.data) {
      return Response.json(
        { error: "Participantul nu există." },
        { status: 404 }
      );
    }

    if (attemptsResult.error) {
      throw new Error(
        attemptsResult.error.message
      );
    }

    if (testsResult.error) {
      throw new Error(testsResult.error.message);
    }

    if (allAttemptsResult.error) {
      throw new Error(
        allAttemptsResult.error.message
      );
    }

    const attempts = attemptsResult.data ?? [];
    const publishedTests = testsResult.count ?? 0;

    const totalPoints = attempts.reduce(
      (sum, attempt) => sum + attempt.score,
      0
    );

    const maximumPoints = attempts.reduce(
      (sum, attempt) =>
        sum + attempt.total_questions,
      0
    );

    const averagePercentage =
      attempts.length > 0
        ? attempts.reduce(
            (sum, attempt) =>
              sum +
              Number(attempt.percentage ?? 0),
            0
          ) / attempts.length
        : 0;

    const participationPercentage =
      publishedTests > 0
        ? (attempts.length / publishedTests) * 100
        : 0;

    const history = attempts.map((attempt) => {
      const test = firstRelated(attempt.tests);

      return {
        testId: test?.id ?? "",
        testTitle:
          test?.title ?? "Test fără titlu",
        score: attempt.score,
        totalQuestions:
          attempt.total_questions,
        percentage: Number(
          attempt.percentage ?? 0
        ),
        durationSeconds:
          attempt.duration_seconds,
        completedAt: attempt.created_at,
      };
    });

    const rankingMap = new Map<
      string,
      RankingAccumulator
    >();

    const allAttempts =
      (allAttemptsResult.data ??
        []) as AttemptRow[];

    for (const attempt of allAttempts) {
      const participant = firstRelated(
        attempt.participants
      );

      if (!participant) {
        continue;
      }

      const fullName =
        `${participant.last_name} ${participant.first_name}`.trim();

      const existing = rankingMap.get(
        attempt.participant_id
      );

      if (existing) {
        existing.totalPoints += attempt.score;
        existing.maximumPoints +=
          attempt.total_questions;
        existing.testsTaken += 1;
        existing.percentageSum += Number(
          attempt.percentage ?? 0
        );
      } else {
        rankingMap.set(attempt.participant_id, {
          participantId:
            attempt.participant_id,
          fullName,
          totalPoints: attempt.score,
          maximumPoints:
            attempt.total_questions,
          testsTaken: 1,
          percentageSum: Number(
            attempt.percentage ?? 0
          ),
        });
      }
    }

    const ranking = Array.from(
      rankingMap.values()
    )
      .map((entry) => ({
        ...entry,
        averagePercentage:
          entry.testsTaken > 0
            ? entry.percentageSum /
              entry.testsTaken
            : 0,
      }))
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
          second.averagePercentage !==
          first.averagePercentage
        ) {
          return (
            second.averagePercentage -
            first.averagePercentage
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

    const rankingPosition =
      ranking.findIndex(
        (entry) =>
          entry.participantId === participantId
      ) + 1;

    return Response.json({
      participant: {
        id: participantResult.data.id,
        firstName:
          participantResult.data.first_name,
        lastName:
          participantResult.data.last_name,
        fullName:
          `${participantResult.data.last_name} ${participantResult.data.first_name}`.trim(),
        email: participantResult.data.email,
        active:
          participantResult.data.active === true,
      },
      summary: {
        rankingPosition:
          rankingPosition > 0
            ? rankingPosition
            : null,
        rankedParticipants: ranking.length,
        totalPoints,
        maximumPoints,
        testsTaken: attempts.length,
        publishedTests,
        participationPercentage,
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