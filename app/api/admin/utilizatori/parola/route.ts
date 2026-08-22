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

export async function POST(request: Request) {
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
      data: {
        user: currentUser,
      },
      error: currentUserError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (
      currentUserError ||
      !currentUser
    ) {
      return Response.json(
        {
          error:
            "Sesiunea nu este validă.",
        },
        { status: 401 }
      );
    }

    if (
      currentUser.email
        ?.trim()
        .toLowerCase() !==
      adminEmail
    ) {
      return Response.json(
        {
          error:
            "Nu ai permisiunea să modifici parole.",
        },
        { status: 403 }
      );
    }

    const body =
      (await request.json()) as {
        email?: string;
        password?: string;
      };

    const email =
      body.email
        ?.trim()
        .toLowerCase() ?? "";

    const password =
      body.password ?? "";

    if (!email) {
      return Response.json(
        {
          error:
            "Introdu adresa de email.",
        },
        { status: 400 }
      );
    }

    if (
      password.length < 8
    ) {
      return Response.json(
        {
          error:
            "Parola temporară trebuie să aibă cel puțin 8 caractere.",
        },
        { status: 400 }
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
      data: { users },
      error: listUsersError,
    } =
      await adminClient.auth.admin.listUsers(
        {
          page: 1,
          perPage: 1000,
        }
      );

    if (
      listUsersError
    ) {
      throw new Error(
        listUsersError.message
      );
    }

    const targetUser =
      users.find(
        (user) =>
          user.email
            ?.trim()
            .toLowerCase() ===
          email
      );

    if (!targetUser) {
      return Response.json(
        {
          error:
            "Nu există niciun cont Auth cu această adresă.",
        },
        { status: 404 }
      );
    }

    const {
      error:
        updatePasswordError,
    } =
      await adminClient.auth.admin.updateUserById(
        targetUser.id,
        {
          password,
          email_confirm: true,
        }
      );

    if (
      updatePasswordError
    ) {
      throw new Error(
        updatePasswordError.message
      );
    }

    const {
      error:
        participantUpdateError,
    } =
      await adminClient
        .from("participants")
        .update({
          active: true,
        })
        .eq(
          "auth_user_id",
          targetUser.id
        );

    if (
      participantUpdateError
    ) {
      throw new Error(
        participantUpdateError.message
      );
    }

    return Response.json({
      success: true,
      email,
    });
  } catch (error) {
    console.error(
      "Eroare la setarea parolei temporare:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Parola nu a putut fi setată.",
      },
      { status: 500 }
    );
  }
}