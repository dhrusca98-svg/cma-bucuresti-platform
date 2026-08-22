import { createClient } from "@supabase/supabase-js";

interface CreateQuestionInput {
  question?: string;
  answers?: string[];
  correctAnswer?: number;
}

interface CreateTestBody {
  title?: string;
  durationMinutes?: number;
  questions?: CreateQuestionInput[];
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

async function requireAdministrator(
  request: Request
) {
  const {
    authClient,
    adminClient,
  } = createClients();

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
    return {
      errorResponse: Response.json(
        {
          error:
            "Trebuie să fii autentificat.",
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(
    accessToken
  );

  if (userError || !user) {
    return {
      errorResponse: Response.json(
        {
          error:
            "Sesiunea nu este validă.",
        },
        { status: 401 }
      ),
    };
  }

  if (
    user.email
      ?.trim()
      .toLowerCase() !==
    adminEmail
  ) {
    return {
      errorResponse: Response.json(
        {
          error:
            "Nu ai permisiunea să creezi teste.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    adminClient,
  };
}

function validateBody(
  body: CreateTestBody
) {
  if (!body.title?.trim()) {
    return "Completează titlul testului.";
  }

  if (
    !Number.isInteger(
      body.durationMinutes
    ) ||
    Number(
      body.durationMinutes
    ) < 1 ||
    Number(
      body.durationMinutes
    ) > 180
  ) {
    return "Durata testului trebuie să fie între 1 și 180 de minute.";
  }

  if (
    !Array.isArray(
      body.questions
    ) ||
    body.questions.length === 0
  ) {
    return "Testul trebuie să conțină cel puțin o întrebare.";
  }

  for (
    let index = 0;
    index < body.questions.length;
    index++
  ) {
    const question =
      body.questions[index];

    const questionNumber =
      index + 1;

    if (
      !question.question?.trim()
    ) {
      return `Întrebarea ${questionNumber} nu are text.`;
    }

    if (
      !Array.isArray(
        question.answers
      ) ||
      question.answers.length !== 4 ||
      question.answers.some(
        (answer) =>
          typeof answer !== "string" ||
          !answer.trim()
      )
    ) {
      return `Întrebarea ${questionNumber} trebuie să aibă exact patru variante de răspuns.`;
    }

    if (
      !Number.isInteger(
        question.correctAnswer
      ) ||
      Number(
        question.correctAnswer
      ) < 0 ||
      Number(
        question.correctAnswer
      ) > 3
    ) {
      return `Răspunsul corect pentru întrebarea ${questionNumber} nu este valid.`;
    }
  }

  return null;
}

export async function POST(
  request: Request
) {
  let createdTestId:
    | string
    | null = null;

  try {
    const adminResult =
      await requireAdministrator(
        request
      );

    if (
      adminResult.errorResponse
    ) {
      return adminResult.errorResponse;
    }

    const {
      adminClient,
    } = adminResult;

    const body =
      (await request.json()) as CreateTestBody;

    const validationError =
      validateBody(body);

    if (validationError) {
      return Response.json(
        {
          error:
            validationError,
        },
        { status: 400 }
      );
    }

    createdTestId =
      crypto.randomUUID();

    const questionCount =
      body.questions!.length;

    /*
     * Păstrăm time_per_question pentru compatibilitate
     * cu structura existentă, dar testarea folosește
     * duration_minutes ca limită globală.
     */
    const legacyTimePerQuestion =
      Math.max(
        10,
        Math.round(
          (body.durationMinutes! * 60) /
            questionCount
        )
      );

    const {
      error: testError,
    } = await adminClient
      .from("tests")
      .insert({
        id:
          createdTestId,

        title:
          body.title!.trim(),

        time_per_question:
          legacyTimePerQuestion,

        duration_minutes:
          body.durationMinutes!,

        is_active:
          false,

        available_until:
          null,
      });

    if (testError) {
      throw new Error(
        testError.message
      );
    }

    const questionRows =
      body.questions!.map(
        (
          question,
          index
        ) => ({
          test_id:
            createdTestId,

          order_number:
            index + 1,

          question:
            question.question!.trim(),

          answer_a:
            question.answers![0].trim(),

          answer_b:
            question.answers![1].trim(),

          answer_c:
            question.answers![2].trim(),

          answer_d:
            question.answers![3].trim(),

          correct_answer:
            question.correctAnswer!,

          /*
           * Coloanele pot rămâne momentan în DB.
           * Nu le mai folosim în aplicație.
           */
          explanation:
            null,

          law:
            null,
        })
      );

    const {
      error:
        questionsError,
    } = await adminClient
      .from("questions")
      .insert(
        questionRows
      );

    if (
      questionsError
    ) {
      throw new Error(
        questionsError.message
      );
    }

    return Response.json({
      success: true,

      testId:
        createdTestId,

      message:
        `„${body.title!.trim()}” a fost salvat. Îl poți publica din lista de teste.`,
    });
  } catch (error) {
    console.error(
      "Eroare la salvarea testului:",
      error
    );

    try {
      if (
        createdTestId
      ) {
        const {
          adminClient,
        } =
          createClients();

        await adminClient
          .from("questions")
          .delete()
          .eq(
            "test_id",
            createdTestId
          );

        await adminClient
          .from("tests")
          .delete()
          .eq(
            "id",
            createdTestId
          );
      }
    } catch (
      rollbackError
    ) {
      console.error(
        "Eroare la revenirea modificărilor:",
        rollbackError
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Testul nu a putut fi salvat.",
      },
      { status: 500 }
    );
  }
}