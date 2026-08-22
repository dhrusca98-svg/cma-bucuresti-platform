import { createClient } from "@supabase/supabase-js";

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
      attemptId: string;
    }>;
  }
) {
  try {
    const {
      attemptId,
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
     * 1. Verificăm tokenul trimis
     * de browser.
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
        {
          status: 401,
        }
      );
    }

    /*
     * 2. Client normal pentru
     * verificarea utilizatorului.
     */
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
        {
          status: 401,
        }
      );
    }

    /*
     * 3. Doar administratorul
     * poate vedea răspunsurile.
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
            "Nu ai permisiunea să vezi răspunsurile participanților.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * 4. Abia acum folosim
     * cheia secretă.
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

    /*
     * 5. Încărcăm attempt-ul.
     */
    const {
      data: attempt,
      error: attemptError,
    } =
      await adminClient
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
          participants (
            id,
            first_name,
            last_name,
            email
          ),
          tests (
            id,
            title,
            created_at
          )
        `)
        .eq(
          "id",
          attemptId
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
            "Rezultatul nu există.",
        },
        {
          status: 404,
        }
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
        {
          status: 400,
        }
      );
    }

    const participant =
      firstRelated(
        attempt.participants
      );

    const test =
      firstRelated(
        attempt.tests
      );

    if (!participant) {
      return Response.json(
        {
          error:
            "Participantul asociat rezultatului nu a fost găsit.",
        },
        {
          status: 404,
        }
      );
    }

    if (!test) {
      return Response.json(
        {
          error:
            "Testul asociat rezultatului nu a fost găsit.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 6. Încărcăm întrebările
     * testului.
     */
    const {
      data: questions,
      error: questionsError,
    } =
      await adminClient
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
          {
            ascending: true,
          }
        );

    if (questionsError) {
      throw new Error(
        questionsError.message
      );
    }

    /*
     * 7. Încărcăm răspunsurile
     * date de participant.
     *
     * Presupunem structura folosită
     * de test:
     * attempt_id
     * question_id
     * selected_answer
     */
    const {
      data: answers,
      error: answersError,
    } =
      await adminClient
        .from("answers")
        .select(`
          question_id,
          selected_answer
        `)
        .eq(
          "attempt_id",
          attemptId
        );

    if (answersError) {
      throw new Error(
        answersError.message
      );
    }

    const answerMap =
      new Map<
        string,
        number | null
      >();

    for (
      const answer of
        answers ?? []
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

    /*
     * 8. Combinăm întrebările cu
     * răspunsurile participantului.
     */
    const questionDetails =
      (questions ?? []).map(
        (
          question
        ) => {
          const selectedAnswer =
            answerMap.has(
              question.id
            )
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
              selectedAnswer !==
              null,

            isCorrect:
              selectedAnswer !==
                null &&
              selectedAnswer ===
                correctAnswer,
          };
        }
      );

    const grade =
      calculateGrade(
        attempt.score,
        attempt.total_questions
      );

    /*
     * 9. Returnăm doar informațiile
     * de care are nevoie pagina admin.
     */
    return Response.json({
      attempt: {
        id:
          attempt.id,

        score:
          attempt.score,

        totalQuestions:
          attempt.total_questions,

        percentage:
          Number(
            attempt.percentage ??
              0
          ),

        grade,

        durationSeconds:
          attempt.duration_seconds,

        completedAt:
          attempt.created_at,
      },

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
          "",
      },

      test: {
        id:
          test.id,

        title:
          test.title,

        createdAt:
          test.created_at,
      },

      questions:
        questionDetails,
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea răspunsurilor:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Răspunsurile nu au putut fi încărcate.",
      },
      {
        status: 500,
      }
    );
  }
}