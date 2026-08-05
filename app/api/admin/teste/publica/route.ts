import { createClient } from "@supabase/supabase-js";

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Lipsește variabila de mediu ${name}.`);
  return value;
}

function createClients() {
  const supabaseUrl = requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnvironmentVariable("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = requireEnvironmentVariable("SUPABASE_SECRET_KEY");

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return { authClient, adminClient };
}

async function requireAdministrator(request: Request) {
  const { authClient, adminClient } = createClients();
  const adminEmail = requireEnvironmentVariable("ADMIN_EMAIL").trim().toLowerCase();
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!accessToken) {
    return { errorResponse: Response.json({ error: "Trebuie să fii autentificat." }, { status: 401 }) };
  }

  const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !user) {
    return { errorResponse: Response.json({ error: "Sesiunea nu este validă." }, { status: 401 }) };
  }

  if (user.email?.trim().toLowerCase() !== adminEmail) {
    return {
      errorResponse: Response.json(
        { error: "Nu ai permisiunea să administrezi testele." },
        { status: 403 }
      ),
    };
  }

  return { adminClient };
}

export async function GET(request: Request) {
  try {
    const adminResult = await requireAdministrator(request);
    if (adminResult.errorResponse) return adminResult.errorResponse;

    const { adminClient } = adminResult;
    const { data: tests, error: testsError } = await adminClient
      .from("tests")
      .select(`
        id,
        title,
        time_per_question,
        is_active,
        created_at,
        questions ( id ),
        attempts ( id )
      `)
      .order("created_at", { ascending: false });

    if (testsError) throw new Error(testsError.message);

    return Response.json({
      tests: (tests ?? []).map((test) => ({
        id: test.id,
        title: test.title,
        timePerQuestion: test.time_per_question,
        isActive: test.is_active === true,
        createdAt: test.created_at,
        questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
        attemptCount: Array.isArray(test.attempts) ? test.attempts.length : 0,
      })),
    });
  } catch (error) {
    console.error("Eroare la încărcarea testelor:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Testele nu au putut fi încărcate." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminResult = await requireAdministrator(request);
    if (adminResult.errorResponse) return adminResult.errorResponse;

    const { adminClient } = adminResult;
    const body = (await request.json()) as { testId?: string };
    const testId = body.testId?.trim();

    if (!testId) {
      return Response.json({ error: "Lipsește testul selectat." }, { status: 400 });
    }

    const { data: selectedTest, error: selectedTestError } = await adminClient
      .from("tests")
      .select("id, title, is_active")
      .eq("id", testId)
      .maybeSingle();

    if (selectedTestError) throw new Error(selectedTestError.message);
    if (!selectedTest) {
      return Response.json({ error: "Testul selectat nu există." }, { status: 404 });
    }

    if (selectedTest.is_active === true) {
      return Response.json({ success: true, message: "Testul selectat este deja activ." });
    }

    const { count: questionCount, error: questionCountError } = await adminClient
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId);

    if (questionCountError) throw new Error(questionCountError.message);
    if ((questionCount ?? 0) === 0) {
      return Response.json(
        { error: "Testul nu poate fi publicat deoarece nu conține întrebări." },
        { status: 400 }
      );
    }

    const { error: deactivateError } = await adminClient
      .from("tests")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) throw new Error(deactivateError.message);

    const { error: activateError } = await adminClient
      .from("tests")
      .update({ is_active: true })
      .eq("id", testId);

    if (activateError) throw new Error(activateError.message);

    return Response.json({
      success: true,
      message: `„${selectedTest.title}” este acum testul activ.`,
    });
  } catch (error) {
    console.error("Eroare la publicarea testului:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Testul nu a putut fi publicat." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const adminResult =
      await requireAdministrator(request);

    if (adminResult.errorResponse) {
      return adminResult.errorResponse;
    }

    const { adminClient } = adminResult;

    const body = (await request.json()) as {
      testId?: string;
    };

    const testId = body.testId?.trim();

    if (!testId) {
      return Response.json(
        { error: "Lipsește testul selectat." },
        { status: 400 }
      );
    }

    const {
      data: selectedTest,
      error: selectedTestError,
    } = await adminClient
      .from("tests")
      .select("id, title, is_active")
      .eq("id", testId)
      .maybeSingle();

    if (selectedTestError) {
      throw new Error(
        selectedTestError.message
      );
    }

    if (!selectedTest) {
      return Response.json(
        { error: "Testul selectat nu există." },
        { status: 404 }
      );
    }

    if (selectedTest.is_active === true) {
      return Response.json(
        {
          error:
            "Testul activ nu poate fi șters. Publică mai întâi alt test.",
        },
        { status: 400 }
      );
    }

    const {
      count: attemptCount,
      error: attemptCountError,
    } = await adminClient
      .from("attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("test_id", testId);

    if (attemptCountError) {
      throw new Error(
        attemptCountError.message
      );
    }

    if ((attemptCount ?? 0) > 0) {
      return Response.json(
        {
          error:
            "Testul nu poate fi șters deoarece are deja rezultate salvate.",
        },
        { status: 400 }
      );
    }

    const { error: questionsDeleteError } =
      await adminClient
        .from("questions")
        .delete()
        .eq("test_id", testId);

    if (questionsDeleteError) {
      throw new Error(
        questionsDeleteError.message
      );
    }

    const { error: testDeleteError } =
      await adminClient
        .from("tests")
        .delete()
        .eq("id", testId);

    if (testDeleteError) {
      throw new Error(
        testDeleteError.message
      );
    }

    return Response.json({
      success: true,
      message: `„${selectedTest.title}” a fost șters.`,
    });
  } catch (error) {
    console.error(
      "Eroare la ștergerea testului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Testul nu a putut fi șters.",
      },
      { status: 500 }
    );
  }
}
