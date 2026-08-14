import { createClient } from "@supabase/supabase-js";

interface AttemptRow {
  id: string;
  participant_id: string;
  score: number;
  total_questions: number;
  duration_seconds: number | null;
  created_at: string;
  participants:
    | {
        first_name: string;
        last_name: string;
        email: string | null;
      }
    | {
        first_name: string;
        last_name: string;
        email: string | null;
      }[]
    | null;
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
      request.headers.get("authorization") ??
      "";

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
        { status: 401 }
      );
    }

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

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(
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

    if (
      user.email?.toLowerCase() !==
      adminEmail
    ) {
      return Response.json(
        {
          error:
            "Nu ai permisiunea să vezi rezultatele.",
        },
        { status: 403 }
      );
    }

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

    const {
      data: activeTest,
      error: activeTestError,
    } = await adminClient
      .from("tests")
      .select(
        "id, title, time_per_question, created_at"
      )
      .eq("is_active", true)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (activeTestError) {
      throw new Error(
        activeTestError.message
      );
    }

    if (!activeTest) {
      return Response.json({
        activeTest: null,
        stats: null,
        results: [],
        missingParticipants: [],
        gradeDistribution: [],
      });
    }

    const [
      participantsResult,
      attemptsResult,
      questionsResult,
    ] = await Promise.all([
      adminClient
        .from("participants")
        .select(
          "id, first_name, last_name, email"
        )
        .eq("active", true)
        .order("last_name", {
          ascending: true,
        })
        .order("first_name", {
          ascending: true,
        }),
      adminClient
        .from("attempts")
        .select(`
          id,
          participant_id,
          score,
          total_questions,
          duration_seconds,
          created_at,
          participants (
            first_name,
            last_name,
            email
          )
        `)
        .eq(
          "test_id",
          activeTest.id
        )
        .eq(
          "status",
          "completed"
        )
        .order("score", {
          ascending: false,
        })
        .order("created_at", {
          ascending: true,
        }),
      adminClient
        .from("questions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "test_id",
          activeTest.id
        ),
    ]);

    if (
      participantsResult.error
    ) {
      throw new Error(
        participantsResult.error.message
      );
    }

    if (attemptsResult.error) {
      throw new Error(
        attemptsResult.error.message
      );
    }

    if (questionsResult.error) {
      throw new Error(
        questionsResult.error.message
      );
    }

    const activeParticipants =
      participantsResult.data ?? [];

    const attempts =
      (attemptsResult.data ??
        []) as AttemptRow[];

    const results = attempts.map(
      (attempt, index) => {
        const participant =
          firstRelated(
            attempt.participants
          );

        return {
          rank: index + 1,
          attemptId:
            attempt.id,
          participantId:
            attempt.participant_id,
          fullName: participant
            ? `${participant.last_name} ${participant.first_name}`.trim()
            : "Participant necunoscut",
          email:
            participant?.email ?? "",
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

    const participantIdsWithAttempt =
      new Set(
        attempts.map(
          (attempt) =>
            attempt.participant_id
        )
      );

    const missingParticipants =
      activeParticipants
        .filter(
          (participant) =>
            !participantIdsWithAttempt.has(
              participant.id
            )
        )
        .map(
          (participant) => ({
            participantId:
              participant.id,
            fullName:
              `${participant.last_name} ${participant.first_name}`.trim(),
            email:
              participant.email ?? "",
          })
        );

    const grades = attempts.map(
      (attempt) =>
        calculateGrade(
          attempt.score,
          attempt.total_questions
        )
    );

    const averageGrade =
      grades.length > 0
        ? grades.reduce(
            (sum, grade) =>
              sum + grade,
            0
          ) / grades.length
        : 0;

    const maximumGrade =
      grades.length > 0
        ? Math.max(...grades)
        : null;

    const minimumGrade =
      grades.length > 0
        ? Math.min(...grades)
        : null;

    const distributionMap =
      new Map<number, number>();

    for (const grade of grades) {
      distributionMap.set(
        grade,
        (distributionMap.get(
          grade
        ) ?? 0) + 1
      );
    }

    const questionCount =
      questionsResult.count ?? 0;

    const possibleGrades =
      Array.from(
        {
          length:
            questionCount + 1,
        },
        (_, score) =>
          calculateGrade(
            questionCount - score,
            questionCount
          )
      );

    const gradeDistribution =
      possibleGrades.map(
        (grade) => ({
          grade,
          count:
            distributionMap.get(
              grade
            ) ?? 0,
        })
      );

    const completedCount =
      attempts.length;

    const activeCount =
      activeParticipants.length;

    return Response.json({
      activeTest: {
        id: activeTest.id,
        title:
          activeTest.title,
        timePerQuestion:
          activeTest.time_per_question,
        createdAt:
          activeTest.created_at,
        questionCount,
      },
      stats: {
        activeParticipants:
          activeCount,
        completed:
          completedCount,
        missing:
          Math.max(
            activeCount -
              completedCount,
            0
          ),
        participationPercentage:
          activeCount > 0
            ? (completedCount /
                activeCount) *
              100
            : 0,
        averageGrade,
        maximumGrade,
        minimumGrade,
      },
      results,
      missingParticipants,
      gradeDistribution,
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea dashboard-ului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Dashboard-ul nu a putut fi încărcat.",
      },
      { status: 500 }
    );
  }
}