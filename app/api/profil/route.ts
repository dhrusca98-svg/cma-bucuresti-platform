import { createClient } from "@supabase/supabase-js";

interface TestJoin {
  id: string;
  title: string;
  created_at: string;
}

interface AttemptRow {
  id: string;
  score: number;
  total_questions: number;
  percentage: number | string | null;
  duration_seconds: number | null;
  created_at: string;
  tests:
    | TestJoin
    | TestJoin[]
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

export async function GET(request: Request) {
  try {
    const { authClient, adminClient } =
      createClients();

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
        { status: 401 }
      );
    }

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

    const {
      data: participant,
      error: participantError,
    } = await adminClient
      .from("participants")
      .select(
        `
          id,
          first_name,
          last_name,
          email,
          active
        `
      )
      .eq("auth_user_id", user.id)
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

    if (participant.active !== true) {
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
    ] = await Promise.all([
      adminClient
        .from("attempts")
        .select(
          `
            id,
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
          `
        )
        .eq(
          "participant_id",
          participant.id
        )
        .order("created_at", {
          ascending: false,
        }),
      adminClient
        .from("tests")
        .select("id", {
          count: "exact",
          head: true,
        }),
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

    const attempts =
      (attemptsResult.data ?? []) as AttemptRow[];

    const totalPoints = attempts.reduce(
      (sum, attempt) =>
        sum + attempt.score,
      0
    );

    const maximumPoints =
      attempts.reduce(
        (sum, attempt) =>
          sum + attempt.total_questions,
        0
      );

    const averagePercentage =
      attempts.length > 0
        ? attempts.reduce(
            (sum, attempt) =>
              sum +
              Number(
                attempt.percentage ?? 0
              ),
            0
          ) / attempts.length
        : 0;

    const publishedTests =
      testsResult.count ?? 0;

    const participationPercentage =
      publishedTests > 0
        ? (attempts.length /
            publishedTests) *
          100
        : 0;

    const history = attempts.map(
      (attempt) => {
        const test = getTest(
          attempt.tests
        );

        return {
          attemptId: attempt.id,
          testId: test?.id ?? "",
          title:
            test?.title ??
            "Test fără titlu",
          score: attempt.score,
          totalQuestions:
            attempt.total_questions,
          percentage: Number(
            attempt.percentage ?? 0
          ),
          durationSeconds:
            attempt.duration_seconds,
          completedAt:
            attempt.created_at,
        };
      }
    );

    return Response.json({
      participant: {
        id: participant.id,
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
        testsTaken: attempts.length,
        publishedTests,
        totalPoints,
        maximumPoints,
        averagePercentage,
        participationPercentage,
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