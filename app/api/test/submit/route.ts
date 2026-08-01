import { createClient } from "@supabase/supabase-js";

interface SubmittedAnswer {
  questionId: string;
  selectedAnswer: number | null;
  isCorrect: boolean;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
  }

  return value;
}

function createClients() {
  const supabaseUrl = requireEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_URL"
  );

  const publishableKey = requireEnvironmentVariable(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  );

  const secretKey = requireEnvironmentVariable(
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

async function getAuthenticatedContext(
  request: Request
) {
  const { authClient, adminClient } =
    createClients();

  const adminEmail = requireEnvironmentVariable(
    "ADMIN_EMAIL"
  )
    .trim()
    .toLowerCase();

  const authorization =
    request.headers.get("authorization") ?? "";

  const accessToken = authorization.startsWith(
    "Bearer "
  )
    ? authorization.slice(7)
    : "";

  if (!accessToken) {
    return {
      errorResponse: Response.json(
        { error: "Trebuie să fii autentificat." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      errorResponse: Response.json(
        { error: "Sesiunea nu este validă." },
        { status: 401 }
      ),
    };
  }

  const isAdmin =
    user.email?.toLowerCase() === adminEmail;

  if (isAdmin) {
    return {
      user,
      isAdmin: true,
      participant: null,
      adminClient,
    };
  }

  const {
    data: participant,
    error: participantError,
  } = await adminClient
    .from("participants")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (participantError) {
    throw new Error(participantError.message);
  }

  if (!participant) {
    return {
      errorResponse: Response.json(
        {
          error:
            "Contul nu este asociat unui participant.",
        },
        { status: 403 }
      ),
    };
  }

  if (participant.active !== true) {
    return {
      errorResponse: Response.json(
        {
          error:
            "Contul participantului este inactiv.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    isAdmin: false,
    participant,
    adminClient,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const testId = url.searchParams.get("testId");

    if (!testId) {
      return Response.json(
        { error: "Lipsește testul verificat." },
        { status: 400 }
      );
    }

    const context =
      await getAuthenticatedContext(request);

    if (context.errorResponse) {
      return context.errorResponse;
    }

    if (context.isAdmin) {
      return Response.json({
        attempted: false,
        isAdmin: true,
      });
    }

    const {
      participant,
      adminClient,
    } = context;

    const {
      data: attempt,
      error: attemptError,
    } = await adminClient
      .from("attempts")
      .select(`
        score,
        total_questions,
        percentage,
        duration_seconds,
        created_at
      `)
      .eq("participant_id", participant!.id)
      .eq("test_id", testId)
      .maybeSingle();

    if (attemptError) {
      throw new Error(attemptError.message);
    }

    if (!attempt) {
      return Response.json({
        attempted: false,
        isAdmin: false,
      });
    }

    return Response.json({
      attempted: true,
      isAdmin: false,
      attempt: {
        score: attempt.score,
        totalQuestions:
          attempt.total_questions,
        percentage: Number(
          attempt.percentage ?? 0
        ),
        durationSeconds:
          attempt.duration_seconds,
        createdAt: attempt.created_at,
      },
    });
  } catch (error) {
    console.error(
      "Eroare la verificarea încercării:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Încercarea nu a putut fi verificată.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      testId?: string;
      score?: number;
      totalQuestions?: number;
      durationSeconds?: number;
      answers?: SubmittedAnswer[];
    };

    if (
      !body.testId ||
      !Number.isInteger(body.score) ||
      !Number.isInteger(body.totalQuestions) ||
      !Number.isInteger(body.durationSeconds) ||
      !Array.isArray(body.answers)
    ) {
      return Response.json(
        {
          error:
            "Datele rezultatului nu sunt valide.",
        },
        { status: 400 }
      );
    }

    if (
      body.score! < 0 ||
      body.totalQuestions! <= 0 ||
      body.score! > body.totalQuestions! ||
      body.durationSeconds! <= 0
    ) {
      return Response.json(
        {
          error:
            "Scorul sau durata nu sunt valide.",
        },
        { status: 400 }
      );
    }

    const context =
      await getAuthenticatedContext(request);

    if (context.errorResponse) {
      return context.errorResponse;
    }

    if (context.isAdmin) {
      return Response.json(
        {
          error:
            "Rezultatele administratorului nu se salvează.",
        },
        { status: 403 }
      );
    }

    const {
      participant,
      adminClient,
    } = context;

    const {
      data: existingAttempt,
      error: existingAttemptError,
    } = await adminClient
      .from("attempts")
      .select("id")
      .eq("participant_id", participant!.id)
      .eq("test_id", body.testId)
      .maybeSingle();

    if (existingAttemptError) {
      throw new Error(
        existingAttemptError.message
      );
    }

    if (existingAttempt) {
      return Response.json(
        {
          error:
            "Ai susținut deja acest test.",
        },
        { status: 409 }
      );
    }

    const percentage =
      (body.score! / body.totalQuestions!) * 100;

    const {
      data: attempt,
      error: attemptError,
    } = await adminClient
      .from("attempts")
      .insert({
        participant_id: participant!.id,
        test_id: body.testId,
        score: body.score,
        total_questions:
          body.totalQuestions,
        percentage,
        duration_seconds:
          body.durationSeconds,
      })
      .select("id")
      .single();

    if (attemptError || !attempt) {
      if (attemptError?.code === "23505") {
        return Response.json(
          {
            error:
              "Ai susținut deja acest test.",
          },
          { status: 409 }
        );
      }

      throw new Error(
        attemptError?.message ||
          "Încercarea nu a putut fi salvată."
      );
    }

    const answerRows = body.answers.map(
      (answer) => ({
        attempt_id: attempt.id,
        question_id: answer.questionId,
        selected_answer:
          answer.selectedAnswer,
        is_correct: answer.isCorrect,
      })
    );

    const { error: answersError } =
      await adminClient
        .from("answers")
        .insert(answerRows);

    if (answersError) {
      await adminClient
        .from("attempts")
        .delete()
        .eq("id", attempt.id);

      throw new Error(answersError.message);
    }

    return Response.json({
      success: true,
      attemptId: attempt.id,
    });
  } catch (error) {
    console.error(
      "Eroare la salvarea rezultatului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Rezultatul nu a putut fi salvat.",
      },
      { status: 500 }
    );
  }
}