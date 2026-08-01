import { createClient } from "@supabase/supabase-js";

interface AttemptRow {
  participant_id: string;
  score: number;
  total_questions: number;
  percentage: number | string | null;
  created_at: string;
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
  firstName: string;
  lastName: string;
  totalPoints: number;
  maximumPoints: number;
  testsTaken: number;
  percentageSum: number;
  latestAttemptAt: string;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
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

export async function GET() {
  try {
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
          percentage,
          created_at,
          participants (
            first_name,
            last_name,
            active
          )
        `),
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
        .eq("active", true),
    ]);

    if (attemptsResult.error) {
      throw new Error(attemptsResult.error.message);
    }

    if (testsResult.error) {
      throw new Error(testsResult.error.message);
    }

    if (participantsResult.error) {
      throw new Error(
        participantsResult.error.message
      );
    }

    const attempts =
      (attemptsResult.data ?? []) as AttemptRow[];

    const rankingMap = new Map<
      string,
      RankingAccumulator
    >();

    let totalPointsAwarded = 0;
    let totalPossiblePoints = 0;

    for (const attempt of attempts) {
      const participant = getParticipant(
        attempt.participants
      );

      if (!participant) {
        continue;
      }

      const percentage = Number(
        attempt.percentage ?? 0
      );

      const existing = rankingMap.get(
        attempt.participant_id
      );

      totalPointsAwarded += attempt.score;
      totalPossiblePoints +=
        attempt.total_questions;

      if (existing) {
        existing.totalPoints += attempt.score;
        existing.maximumPoints +=
          attempt.total_questions;
        existing.testsTaken += 1;
        existing.percentageSum += percentage;

        if (
          new Date(attempt.created_at).getTime() >
          new Date(
            existing.latestAttemptAt
          ).getTime()
        ) {
          existing.latestAttemptAt =
            attempt.created_at;
        }

        continue;
      }

      rankingMap.set(attempt.participant_id, {
        participantId: attempt.participant_id,
        firstName: participant.first_name,
        lastName: participant.last_name,
        totalPoints: attempt.score,
        maximumPoints: attempt.total_questions,
        testsTaken: 1,
        percentageSum: percentage,
        latestAttemptAt: attempt.created_at,
      });
    }

    const ranking = Array.from(
      rankingMap.values()
    )
      .map((participant) => ({
        participantId: participant.participantId,
        firstName: participant.firstName,
        lastName: participant.lastName,
        fullName:
          `${participant.lastName} ${participant.firstName}`.trim(),
        totalPoints: participant.totalPoints,
        maximumPoints:
          participant.maximumPoints,
        testsTaken: participant.testsTaken,
        publishedTests: testsResult.count ?? 0,
        participationPercentage:
          (testsResult.count ?? 0) > 0
            ? (participant.testsTaken /
                (testsResult.count ?? 1)) *
              100
            : 0,
        averagePercentage:
          participant.testsTaken > 0
            ? participant.percentageSum /
              participant.testsTaken
            : 0,
        latestAttemptAt:
          participant.latestAttemptAt,
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
      })
      .map((participant, index) => ({
        rank: index + 1,
        ...participant,
      }));

    const generalAverage =
      totalPossiblePoints > 0
        ? (totalPointsAwarded /
            totalPossiblePoints) *
          100
        : 0;

    return Response.json({
      ranking,
      stats: {
        publishedTests: testsResult.count ?? 0,
        activeParticipants:
          participantsResult.count ?? 0,
        participantsWithResults:
          ranking.length,
        totalAttempts: attempts.length,
        generalAverage,
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
      { status: 500 }
    );
  }
}