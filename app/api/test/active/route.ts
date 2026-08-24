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

    const adminEmail =
      requireEnvironmentVariable(
        "ADMIN_EMAIL"
      )
        .trim()
        .toLowerCase();

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

    const isAdmin =
      user.email
        ?.trim()
        .toLowerCase() ===
      adminEmail;

    /*
     * Pentru utilizatorii obișnuiți verificăm
     * că acel cont este asociat unui participant
     * activ. Administratorul poate folosi în
     * continuare modul Preview.
     */
    if (!isAdmin) {
      const {
        data: participant,
        error:
          participantError,
      } =
        await adminClient
          .from("participants")
          .select(
            "id, active"
          )
          .eq(
            "auth_user_id",
            user.id
          )
          .maybeSingle();

      if (
        participantError
      ) {
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
          {
            status: 403,
          }
        );
      }

      if (
        participant.active !==
        true
      ) {
        return Response.json(
          {
            error:
              "Contul participantului este inactiv.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const nowIso =
      new Date().toISOString();

    /*
     * IMPORTANT:
     * Această rută returnează DOAR metadatele
     * testului. Nu returnează întrebările.
     *
     * Întrebările sunt trimise de server numai
     * după POST /api/test/submit cu action=start.
     * Pentru participant, în acel moment există
     * deja attempt-ul și timerul server-side a pornit.
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