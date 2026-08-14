import { createClient } from "@supabase/supabase-js";

interface AvailableTestRow {
  id: string;
  title: string;
  is_active: boolean | null;
  available_until: string | null;
  duration_minutes: number | null;
}

interface AttemptRow {
  id: string;
  participant_id: string;
  test_id: string;
  score: number;
  total_questions: number;
  percentage: number | string | null;
  duration_seconds: number | null;
  created_at: string;
  status: string;
  started_at: string | null;
}

interface AnswerRow {
  question_id: string;
  selected_answer: number | null;
  is_correct: boolean;
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

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return { authClient, adminClient };
}

async function getAuthenticatedContext(request: Request) {
  const { authClient, adminClient } = createClients();

  const adminEmail = requireEnvironmentVariable("ADMIN_EMAIL")
    .trim()
    .toLowerCase();

  const authorization =
    request.headers.get("authorization") ?? "";

  const accessToken = authorization.startsWith("Bearer ")
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
    user.email?.trim().toLowerCase() === adminEmail;

  if (isAdmin) {
    return {
      user,
      isAdmin: true,
      participant: null,
      adminClient,
    };
  }

  const { data: participant, error: participantError } =
    await adminClient
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
          error: "Contul participantului este inactiv.",
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

async function getTest(
  adminClient: any,
  testId: string
): Promise<AvailableTestRow | null> {
  const { data, error } = await adminClient
    .from("tests")
    .select(
      "id, title, is_active, available_until, duration_minutes"
    )
    .eq("id", testId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AvailableTestRow | null;
}

function testCanBeStarted(test: AvailableTestRow) {
  if (test.is_active !== true) {
    return "Testul nu mai este activ.";
  }

  if (!test.available_until) {
    return "Testul nu are o perioadă de disponibilitate validă.";
  }

  const deadline = new Date(test.available_until).getTime();

  if (!Number.isFinite(deadline) || deadline <= Date.now()) {
    return "Perioada de susținere a testului a expirat.";
  }

  return null;
}

function getDurationSeconds(test: AvailableTestRow) {
  const minutes = Number(test.duration_minutes ?? 30);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 30 * 60;
  }

  return Math.round(minutes * 60);
}

function getElapsedSeconds(attempt: AttemptRow) {
  const startedAt = attempt.started_at ?? attempt.created_at;
  const startedAtMs = new Date(startedAt).getTime();

  if (!Number.isFinite(startedAtMs)) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - startedAtMs) / 1000)
  );
}

async function getAttemptAnswers(
  adminClient: any,
  attemptId: string
) {
  const { data, error } = await adminClient
    .from("answers")
    .select("question_id, selected_answer, is_correct")
    .eq("attempt_id", attemptId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AnswerRow[];
}

async function finalizeAttempt(
  adminClient: any,
  attempt: AttemptRow,
  test: AvailableTestRow
) {
  const answers = await getAttemptAnswers(
    adminClient,
    attempt.id
  );

  const score = answers.filter(
    (answer) => answer.is_correct === true
  ).length;

  const totalQuestions = attempt.total_questions;
  const percentage =
    totalQuestions > 0
      ? (score / totalQuestions) * 100
      : 0;

  const durationLimit = getDurationSeconds(test);
  const elapsed = getElapsedSeconds(attempt);
  const durationSeconds = Math.min(
    Math.max(1, elapsed),
    durationLimit
  );

  const { error } = await adminClient
    .from("attempts")
    .update({
      score,
      percentage,
      duration_seconds: durationSeconds,
      status: "completed",
    })
    .eq("id", attempt.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    score,
    totalQuestions,
    percentage,
    durationSeconds,
    answers,
  };
}

async function getAttempt(
  adminClient: any,
  participantId: string,
  testId: string
) {
  const { data, error } = await adminClient
    .from("attempts")
    .select(`
      id,
      participant_id,
      test_id,
      score,
      total_questions,
      percentage,
      duration_seconds,
      created_at,
      status,
      started_at
    `)
    .eq("participant_id", participantId)
    .eq("test_id", testId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AttemptRow | null;
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

    const context = await getAuthenticatedContext(request);

    if (context.errorResponse) {
      return context.errorResponse;
    }

    const test = await getTest(context.adminClient, testId);

    if (!test) {
      return Response.json(
        { error: "Testul nu există." },
        { status: 404 }
      );
    }

    if (context.isAdmin) {
      return Response.json({
        attempted: false,
        isAdmin: true,
        durationSeconds: getDurationSeconds(test),
      });
    }

    const attempt = await getAttempt(
      context.adminClient,
      context.participant!.id,
      testId
    );

    if (!attempt) {
      return Response.json({
        attempted: false,
        isAdmin: false,
        durationSeconds: getDurationSeconds(test),
      });
    }

    if (attempt.status === "completed") {
      return Response.json({
        attempted: true,
        isAdmin: false,
        status: "completed",
        attempt: {
          score: attempt.score,
          totalQuestions: attempt.total_questions,
          percentage: Number(attempt.percentage ?? 0),
          durationSeconds: attempt.duration_seconds,
          createdAt: attempt.created_at,
          startedAt: attempt.started_at ?? attempt.created_at,
        },
      });
    }

    const durationSeconds = getDurationSeconds(test);
    const elapsedSeconds = getElapsedSeconds(attempt);

    if (elapsedSeconds >= durationSeconds) {
      const finalResult = await finalizeAttempt(
        context.adminClient,
        attempt,
        test
      );

      return Response.json({
        attempted: true,
        isAdmin: false,
        status: "completed",
        expired: true,
        attempt: {
          score: finalResult.score,
          totalQuestions: finalResult.totalQuestions,
          percentage: finalResult.percentage,
          durationSeconds: finalResult.durationSeconds,
          createdAt: attempt.created_at,
          startedAt: attempt.started_at ?? attempt.created_at,
        },
      });
    }

    const answers = await getAttemptAnswers(
      context.adminClient,
      attempt.id
    );

    return Response.json({
      attempted: true,
      isAdmin: false,
      status: "in_progress",
      attemptId: attempt.id,
      startedAt: attempt.started_at ?? attempt.created_at,
      durationSeconds,
      timeLeft: Math.max(
        0,
        durationSeconds - elapsedSeconds
      ),
      score: answers.filter(
        (answer) => answer.is_correct === true
      ).length,
      answers: answers.map((answer) => ({
        questionId: answer.question_id,
        selectedAnswer: answer.selected_answer,
        isCorrect: answer.is_correct,
      })),
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
      action?: "start" | "answer" | "finish";
      testId?: string;
      questionId?: string;
      selectedAnswer?: number;
    };

    if (!body.testId || !body.action) {
      return Response.json(
        { error: "Datele testului nu sunt valide." },
        { status: 400 }
      );
    }

    const context = await getAuthenticatedContext(request);

    if (context.errorResponse) {
      return context.errorResponse;
    }

    const test = await getTest(
      context.adminClient,
      body.testId
    );

    if (!test) {
      return Response.json(
        { error: "Testul nu există." },
        { status: 404 }
      );
    }

    if (context.isAdmin) {
      if (body.action === "start") {
        return Response.json({
          success: true,
          isAdmin: true,
          status: "preview",
          durationSeconds: getDurationSeconds(test),
          timeLeft: getDurationSeconds(test),
          answers: [],
          score: 0,
        });
      }

      return Response.json({
        success: true,
        isAdmin: true,
      });
    }

    const participantId = context.participant!.id;

    if (body.action === "start") {
      let attempt = await getAttempt(
        context.adminClient,
        participantId,
        body.testId
      );

      if (!attempt) {
        const startError = testCanBeStarted(test);

        if (startError) {
          return Response.json(
            { error: startError },
            { status: 403 }
          );
        }

        const {
          count: questionCount,
          error: questionCountError,
        } = await context.adminClient
          .from("questions")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("test_id", body.testId);

        if (questionCountError) {
          throw new Error(questionCountError.message);
        }

        if ((questionCount ?? 0) <= 0) {
          return Response.json(
            { error: "Testul nu conține întrebări." },
            { status: 400 }
          );
        }

        const now = new Date().toISOString();

        const { data, error } = await context.adminClient
          .from("attempts")
          .insert({
            participant_id: participantId,
            test_id: body.testId,
            score: 0,
            total_questions: questionCount ?? 0,
            percentage: 0,
            duration_seconds: 0,
            status: "in_progress",
            started_at: now,
          })
          .select(`
            id,
            participant_id,
            test_id,
            score,
            total_questions,
            percentage,
            duration_seconds,
            created_at,
            status,
            started_at
          `)
          .single();

        if (error || !data) {
          if (error?.code === "23505") {
            attempt = await getAttempt(
              context.adminClient,
              participantId,
              body.testId
            );
          } else {
            throw new Error(
              error?.message ||
                "Testarea nu a putut fi începută."
            );
          }
        } else {
          attempt = data as AttemptRow;
        }
      }

      if (!attempt) {
        throw new Error(
          "Testarea nu a putut fi încărcată."
        );
      }

      if (attempt.status === "completed") {
        return Response.json(
          {
            error: "Ai susținut deja acest test.",
            completed: true,
          },
          { status: 409 }
        );
      }

      const durationSeconds = getDurationSeconds(test);
      const elapsedSeconds = getElapsedSeconds(attempt);

      if (elapsedSeconds >= durationSeconds) {
        const finalResult = await finalizeAttempt(
          context.adminClient,
          attempt,
          test
        );

        return Response.json({
          success: true,
          status: "completed",
          expired: true,
          attempt: {
            score: finalResult.score,
            totalQuestions: finalResult.totalQuestions,
            percentage: finalResult.percentage,
            durationSeconds: finalResult.durationSeconds,
            createdAt: attempt.created_at,
            startedAt:
              attempt.started_at ?? attempt.created_at,
          },
        });
      }

      const answers = await getAttemptAnswers(
        context.adminClient,
        attempt.id
      );

      return Response.json({
        success: true,
        status: "in_progress",
        attemptId: attempt.id,
        startedAt: attempt.started_at ?? attempt.created_at,
        durationSeconds,
        timeLeft: Math.max(
          0,
          durationSeconds - elapsedSeconds
        ),
        score: answers.filter(
          (answer) => answer.is_correct === true
        ).length,
        answers: answers.map((answer) => ({
          questionId: answer.question_id,
          selectedAnswer: answer.selected_answer,
          isCorrect: answer.is_correct,
        })),
      });
    }

    const attempt = await getAttempt(
      context.adminClient,
      participantId,
      body.testId
    );

    if (!attempt) {
      return Response.json(
        {
          error:
            "Testarea nu a fost începută. Reîncarcă pagina.",
        },
        { status: 409 }
      );
    }

    if (attempt.status === "completed") {
      return Response.json(
        {
          error: "Ai susținut deja acest test.",
          completed: true,
        },
        { status: 409 }
      );
    }

    const durationSeconds = getDurationSeconds(test);
    const elapsedSeconds = getElapsedSeconds(attempt);

    if (elapsedSeconds >= durationSeconds) {
      const finalResult = await finalizeAttempt(
        context.adminClient,
        attempt,
        test
      );

      return Response.json({
        success: true,
        status: "completed",
        expired: true,
        attempt: {
          score: finalResult.score,
          totalQuestions: finalResult.totalQuestions,
          percentage: finalResult.percentage,
          durationSeconds: finalResult.durationSeconds,
          createdAt: attempt.created_at,
          startedAt:
            attempt.started_at ?? attempt.created_at,
        },
      });
    }

    if (body.action === "answer") {
      if (
        !body.questionId ||
        !Number.isInteger(body.selectedAnswer) ||
        body.selectedAnswer! < 0 ||
        body.selectedAnswer! > 3
      ) {
        return Response.json(
          { error: "Răspunsul selectat nu este valid." },
          { status: 400 }
        );
      }

      const { data: question, error: questionError } =
        await context.adminClient
          .from("questions")
          .select("id, correct_answer")
          .eq("id", body.questionId)
          .eq("test_id", body.testId)
          .maybeSingle();

      if (questionError) {
        throw new Error(questionError.message);
      }

      if (!question) {
        return Response.json(
          { error: "Întrebarea nu aparține acestui test." },
          { status: 400 }
        );
      }

      const { data: existingAnswer, error: existingAnswerError } =
        await context.adminClient
          .from("answers")
          .select("question_id, selected_answer, is_correct")
          .eq("attempt_id", attempt.id)
          .eq("question_id", body.questionId)
          .maybeSingle();

      if (existingAnswerError) {
        throw new Error(existingAnswerError.message);
      }

      if (existingAnswer) {
        return Response.json({
          success: true,
          alreadyAnswered: true,
          answer: {
            questionId: existingAnswer.question_id,
            selectedAnswer: existingAnswer.selected_answer,
            isCorrect: existingAnswer.is_correct,
          },
          timeLeft: Math.max(
            0,
            durationSeconds - getElapsedSeconds(attempt)
          ),
        });
      }

      const isCorrect =
        body.selectedAnswer === question.correct_answer;

      const { error: answerError } =
        await context.adminClient.from("answers").insert({
          attempt_id: attempt.id,
          question_id: body.questionId,
          selected_answer: body.selectedAnswer,
          is_correct: isCorrect,
        });

      if (answerError) {
        throw new Error(answerError.message);
      }

      const answers = await getAttemptAnswers(
        context.adminClient,
        attempt.id
      );

      const score = answers.filter(
        (answer) => answer.is_correct === true
      ).length;

      const percentage =
        attempt.total_questions > 0
          ? (score / attempt.total_questions) * 100
          : 0;

      const { error: attemptUpdateError } =
        await context.adminClient
          .from("attempts")
          .update({
            score,
            percentage,
            duration_seconds: Math.min(
              getElapsedSeconds(attempt),
              durationSeconds
            ),
          })
          .eq("id", attempt.id);

      if (attemptUpdateError) {
        throw new Error(attemptUpdateError.message);
      }

      return Response.json({
        success: true,
        answer: {
          questionId: body.questionId,
          selectedAnswer: body.selectedAnswer,
          isCorrect,
        },
        score,
        timeLeft: Math.max(
          0,
          durationSeconds - getElapsedSeconds(attempt)
        ),
      });
    }

    if (body.action === "finish") {
      const finalResult = await finalizeAttempt(
        context.adminClient,
        attempt,
        test
      );

      return Response.json({
        success: true,
        status: "completed",
        attempt: {
          score: finalResult.score,
          totalQuestions: finalResult.totalQuestions,
          percentage: finalResult.percentage,
          durationSeconds: finalResult.durationSeconds,
          createdAt: attempt.created_at,
          startedAt:
            attempt.started_at ?? attempt.created_at,
        },
      });
    }

    return Response.json(
      { error: "Acțiunea solicitată nu este validă." },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Eroare la procesarea testării:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Testarea nu a putut fi procesată.",
      },
      { status: 500 }
    );
  }
}