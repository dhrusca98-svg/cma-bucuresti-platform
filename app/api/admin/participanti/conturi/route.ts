import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const CREATE_BATCH_SIZE = 25;

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
  }

  return value;
}

function generateTemporaryPassword() {
  return `${randomBytes(18).toString("base64url")}A1!`;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL"
    );

    const publishableKey = requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );

    const secretKey = requireEnvironmentVariable(
      "SUPABASE_SECRET_KEY"
    );

    const adminEmail = requireEnvironmentVariable(
      "ADMIN_EMAIL"
    )
      .trim()
      .toLowerCase();

    const authorization =
      request.headers.get("authorization") ?? "";

    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return Response.json(
        { error: "Trebuie să fii autentificat." },
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
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json(
        { error: "Sesiunea nu este validă." },
        { status: 401 }
      );
    }

    if (user.email?.toLowerCase() !== adminEmail) {
      return Response.json(
        {
          error:
            "Nu ai permisiunea să creezi conturile.",
        },
        { status: 403 }
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
      data: participants,
      error: participantsError,
    } = await adminClient
      .from("participants")
      .select(
        "id, first_name, last_name, email"
      )
      .eq("active", true)
      .is("auth_user_id", null)
      .not("email", "is", null)
      .order("created_at", {
        ascending: true,
      })
      .limit(CREATE_BATCH_SIZE);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    if (!participants || participants.length === 0) {
      return Response.json({
        success: true,
        created: 0,
        linkedExisting: 0,
        failed: 0,
        remaining: 0,
        errors: [],
      });
    }

    const {
      data: { users },
      error: listUsersError,
    } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listUsersError) {
      throw new Error(listUsersError.message);
    }

    const existingUsersByEmail = new Map(
      users
        .filter((existingUser) => existingUser.email)
        .map((existingUser) => [
          existingUser.email!.toLowerCase(),
          existingUser,
        ])
    );

    let created = 0;
    let linkedExisting = 0;
    let failed = 0;

    const errors: string[] = [];

    for (const participant of participants) {
      const email = String(
        participant.email ?? ""
      )
        .trim()
        .toLowerCase();

      if (!email) {
        failed += 1;
        errors.push(
          `${participant.first_name} ${participant.last_name}: lipsește emailul.`
        );
        continue;
      }

      try {
        let authUserId: string;

        const existingUser =
          existingUsersByEmail.get(email);

        if (existingUser) {
          authUserId = existingUser.id;
          linkedExisting += 1;
        } else {
          const temporaryPassword =
            generateTemporaryPassword();

          const {
            data: createdUserData,
            error: createUserError,
          } =
            await adminClient.auth.admin.createUser({
              email,
              password: temporaryPassword,
              email_confirm: true,
              user_metadata: {
                first_name:
                  participant.first_name,
                last_name:
                  participant.last_name,
              },
            });

          if (
            createUserError ||
            !createdUserData.user
          ) {
            throw new Error(
              createUserError?.message ||
                "Contul nu a putut fi creat."
            );
          }

          authUserId = createdUserData.user.id;
          created += 1;

          existingUsersByEmail.set(
            email,
            createdUserData.user
          );
        }

        const { error: updateError } =
          await adminClient
            .from("participants")
            .update({
              auth_user_id: authUserId,
            })
            .eq("id", participant.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } catch (error) {
        failed += 1;

        errors.push(
          `${participant.first_name} ${
            participant.last_name
          } (${email}): ${
            error instanceof Error
              ? error.message
              : "Eroare necunoscută."
          }`
        );
      }
    }

    const {
      count: remaining,
      error: countError,
    } = await adminClient
      .from("participants")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("active", true)
      .is("auth_user_id", null)
      .not("email", "is", null);

    if (countError) {
      throw new Error(countError.message);
    }

    return Response.json({
      success: true,
      created,
      linkedExisting,
      failed,
      remaining: remaining ?? 0,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error(
      "Eroare la crearea conturilor:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Crearea conturilor a eșuat.",
      },
      { status: 500 }
    );
  }
}