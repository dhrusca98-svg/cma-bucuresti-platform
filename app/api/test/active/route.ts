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

export async function GET(
  request: Request
) {
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

    const nowIso =
      new Date().toISOString();

    /*
     * Luăm cel mai recent test activ
     * și încă disponibil.
     */
    const {
      data: test,
      error: testError,
    } =
      await adminClient
        .from("tests")
        .select(`
          id,
          title,
          duration_minutes,
          available_until,
          created_at
        `)
        .eq(
          "is_active",
          true
        )
        .gt(
          "available_until",
          nowIso
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (testError) {
      throw new Error(
        testError.message
      );
    }

    if (!test) {
      return Response.json(
        {
          error:
            "Nu există momentan niciun test disponibil.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Luăm întrebările separat.
     * IMPORTANT:
     * NU selectăm correct_answer.
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
          answer_d
        `)
        .eq(
          "test_id",
          test.id
        )
        .order(
          "order_number",
          {
            ascending:
              true,
          }
        );

    if (
      questionsError
    ) {
      throw new Error(
        questionsError.message
      );
    }

    if (
      !questions ||
      questions.length ===
        0
    ) {
      return Response.json(
        {
          error:
            "Testul activ nu conține întrebări.",
        },
        {
          status: 400,
        }
      );
    }

    const formattedQuestions =
      questions.map(
        (
          questionItem
        ) => ({
          id:
            questionItem.id,

          orderNumber:
            questionItem.order_number,

          question:
            questionItem.question,

          answers: [
            questionItem.answer_a,
            questionItem.answer_b,
            questionItem.answer_c,
            questionItem.answer_d,
          ],
        })
      );

    return Response.json({
      test: {
        id:
          test.id,

        title:
          test.title,

        durationMinutes:
          Number(
            test.duration_minutes ??
              30
          ),

        availableUntil:
          test.available_until,

        createdAt:
          test.created_at,

        questions:
          formattedQuestions,
      },
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea testului activ:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Testul activ nu a putut fi încărcat.",
      },
      {
        status: 500,
      }
    );
  }
}