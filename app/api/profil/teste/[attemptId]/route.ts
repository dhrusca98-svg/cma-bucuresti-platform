import { createClient } from "@supabase/supabase-js";

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

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      attemptId: string;
    }>;
  }
) {
  try {
    const { attemptId } = await params;

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
      .select("id, active")
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
        { status: 403 }
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

    /*
     * Verificarea de ownership se face în query:
     * tentativa trebuie să aparțină participantului
     * asociat utilizatorului autentificat.
     */
    const {
      data: attempt,
      error: attemptError,
    } = await adminClient
      .from("attempts")
      .select(`
        id,
        participant_id,
        test_id,
        score,
        total_questions,
        percentage,
        duration_seconds,
        status,
        created_at,
        tests (
          id,
          title,
          created_at,
          is_active,
          available_until
        )
      `)
      .eq("id", attemptId)
      .eq(
        "participant_id",
        participant.id
      )
      .maybeSingle();

    if (attemptError) {
      throw new Error(
        attemptError.message
      );
    }

    if (!attempt) {
      return Response.json(
        {
          error:
            "Rezultatul nu există sau nu îți aparține.",
        },
        { status: 404 }
      );
    }

    if (
      attempt.status !==
      "completed"
    ) {
      return Response.json(
        {
          error:
            "Acest test nu a fost finalizat.",
        },
        { status: 400 }
      );
    }

    const test =
      firstRelated(
        attempt.tests
      );

    if (!test) {
      return Response.json(
        {
          error:
            "Testul asociat rezultatului nu a fost găsit.",
        },
        { status: 404 }
      );
    }

    /*
     * SECURITY:
     * correct_answer NU este citit din DB înainte
     * să stabilim că testul nu mai este disponibil.
     */
    const deadline =
      test.available_until
        ? new Date(
            test.available_until
          ).getTime()
        : null;

    const testIsClosed =
      test.is_active !== true ||
      deadline === null ||
      !Number.isFinite(deadline) ||
      deadline <= Date.now();

    if (!testIsClosed) {
      return Response.json(
        {
          error:
            "Răspunsurile corecte vor fi disponibile după închiderea testului.",
          reviewAvailable: false,
        },
        { status: 403 }
      );
    }

    const [
      questionsResult,
      answersResult,
    ] = await Promise.all([
      adminClient
        .from("questions")
        .select(`
          id,
          order_number,
          question,
          answer_a,
          answer_b,
          answer_c,
          answer_d,
          correct_answer
        `)
        .eq(
          "test_id",
          attempt.test_id
        )
        .order(
          "order_number",
          { ascending: true }
        ),

      adminClient
        .from("answers")
        .select(`
          question_id,
          selected_answer
        `)
        .eq(
          "attempt_id",
          attempt.id
        ),
    ]);

    if (questionsResult.error) {
      throw new Error(
        questionsResult.error.message
      );
    }

    if (answersResult.error) {
      throw new Error(
        answersResult.error.message
      );
    }

    const answerMap =
      new Map<
        string,
        number | null
      >();

    for (
      const answer of
        answersResult.data ?? []
    ) {
      answerMap.set(
        answer.question_id,
        answer.selected_answer ===
          null
          ? null
          : Number(
              answer.selected_answer
            )
      );
    }

    const questions =
      (
        questionsResult.data ??
        []
      ).map((question) => {
        const selectedAnswer =
          answerMap.has(question.id)
            ? answerMap.get(
                question.id
              ) ?? null
            : null;

        const correctAnswer =
          Number(
            question.correct_answer
          );

        return {
          questionId:
            question.id,

          orderNumber:
            question.order_number,

          question:
            question.question,

          answers: [
            question.answer_a,
            question.answer_b,
            question.answer_c,
            question.answer_d,
          ],

          selectedAnswer,
          correctAnswer,

          answered:
            selectedAnswer !== null,

          isCorrect:
            selectedAnswer !==
              null &&
            selectedAnswer ===
              correctAnswer,
        };
      });

    return Response.json({
      reviewAvailable: true,

      attempt: {
        id: attempt.id,

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
      },

      test: {
        id: test.id,
        title: test.title,
        createdAt:
          test.created_at,
        availableUntil:
          test.available_until,
      },

      questions,
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea istoricului testului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Testul nu a putut fi încărcat.",
      },
      { status: 500 }
    );
  }
}
