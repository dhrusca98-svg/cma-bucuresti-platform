import { createClient } from "@supabase/supabase-js";

interface ParticipantInput {
  firstName: string;
  lastName: string;
  email: string;
}

interface ExistingParticipant {
  first_name: string;
  last_name: string;
  email: string | null;
  active: boolean | null;
}

const BATCH_SIZE = 500;

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
  }

  return value;
}

function normalizeParticipant(
  participant: ParticipantInput
): ParticipantInput {
  return {
    firstName: participant.firstName.trim(),
    lastName: participant.lastName.trim(),
    email: participant.email.trim().toLowerCase(),
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function runInBatches<T>(
  values: T[],
  action: (batch: T[]) => Promise<void>
) {
  for (
    let index = 0;
    index < values.length;
    index += BATCH_SIZE
  ) {
    await action(values.slice(index, index + BATCH_SIZE));
  }
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
            "Nu ai permisiunea să sincronizezi participanții.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      participants?: ParticipantInput[];
    };

    if (
      !Array.isArray(body.participants) ||
      body.participants.length === 0
    ) {
      return Response.json(
        { error: "Lista participanților este goală." },
        { status: 400 }
      );
    }

    if (body.participants.length > 3000) {
      return Response.json(
        {
          error:
            "Fișierul conține prea mulți participanți.",
        },
        { status: 400 }
      );
    }

    const participants = body.participants.map(
      normalizeParticipant
    );

    const seenEmails = new Set<string>();

    for (const participant of participants) {
      if (
        !participant.firstName ||
        !participant.lastName ||
        !participant.email
      ) {
        return Response.json(
          {
            error:
              "Fiecare participant trebuie să aibă nume, prenume și email.",
          },
          { status: 400 }
        );
      }

      if (!isValidEmail(participant.email)) {
        return Response.json(
          {
            error: `Adresa ${participant.email} nu este validă.`,
          },
          { status: 400 }
        );
      }

      if (seenEmails.has(participant.email)) {
        return Response.json(
          {
            error: `Adresa ${participant.email} apare de mai multe ori în Excel.`,
          },
          { status: 400 }
        );
      }

      seenEmails.add(participant.email);
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
      data: existingData,
      error: existingError,
    } = await adminClient
      .from("participants")
      .select(
        "first_name, last_name, email, active"
      );

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingParticipants =
      (existingData ?? []) as ExistingParticipant[];

    const existingByEmail = new Map(
      existingParticipants
        .filter(
          (
            participant
          ): participant is ExistingParticipant & {
            email: string;
          } => Boolean(participant.email)
        )
        .map((participant) => [
          participant.email.toLowerCase(),
          participant,
        ])
    );

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const participant of participants) {
      const existing = existingByEmail.get(
        participant.email
      );

      if (!existing) {
        created += 1;
        continue;
      }

      const changed =
        existing.first_name !== participant.firstName ||
        existing.last_name !== participant.lastName ||
        existing.active !== true;

      if (changed) {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    const importedEmails = new Set(
      participants.map((participant) => participant.email)
    );

    const emailsToDeactivate = existingParticipants
      .filter(
        (participant) =>
          participant.email &&
          participant.active === true &&
          !importedEmails.has(
            participant.email.toLowerCase()
          )
      )
      .map((participant) =>
        participant.email!.toLowerCase()
      );

    const syncTime = new Date().toISOString();

    const rowsToUpsert = participants.map(
      (participant) => ({
        first_name: participant.firstName,
        last_name: participant.lastName,
        email: participant.email,
        active: true,
        last_sync: syncTime,
      })
    );

    await runInBatches(
      rowsToUpsert,
      async (batch) => {
        const { error } = await adminClient
          .from("participants")
          .upsert(batch, {
            onConflict: "email",
          });

        if (error) {
          throw new Error(error.message);
        }
      }
    );

    await runInBatches(
      emailsToDeactivate,
      async (batch) => {
        const { error } = await adminClient
          .from("participants")
          .update({ active: false })
          .in("email", batch);

        if (error) {
          throw new Error(error.message);
        }
      }
    );

    return Response.json({
      success: true,
      total: participants.length,
      created,
      updated,
      unchanged,
      deactivated: emailsToDeactivate.length,
    });
  } catch (error) {
    console.error(
      "Eroare la sincronizarea participanților:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sincronizarea a eșuat.",
      },
      { status: 500 }
    );
  }
}