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

export async function GET(request: Request) {
  try {
    const supabaseUrl =
      requireEnvironmentVariable(
        "NEXT_PUBLIC_SUPABASE_URL"
      );

    const publishableKey =
      requireEnvironmentVariable(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      );

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
      return Response.json(
        {
          isAdmin: false,
          error: "Trebuie să fii autentificat.",
        },
        { status: 401 }
      );
    }

    const supabase = createClient(
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
      data: { user },
      error,
    } = await supabase.auth.getUser(
      accessToken
    );

    if (error || !user) {
      return Response.json(
        {
          isAdmin: false,
          error: "Sesiunea nu este validă.",
        },
        { status: 401 }
      );
    }

    const isAdmin =
      user.email?.trim().toLowerCase() ===
      adminEmail;

    if (!isAdmin) {
      return Response.json(
        {
          isAdmin: false,
          error:
            "Nu ai permisiunea să accesezi administrarea.",
        },
        { status: 403 }
      );
    }

    return Response.json({
      isAdmin: true,
    });
  } catch (error) {
    console.error(
      "Eroare verificare administrator:",
      error
    );

    return Response.json(
      {
        isAdmin: false,
        error:
          "Administratorul nu a putut fi verificat.",
      },
      { status: 500 }
    );
  }
}