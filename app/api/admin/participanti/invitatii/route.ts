import { createClient } from "@supabase/supabase-js";

type SendMode =
  | "activation"
  | "reset";

interface AuthUserLite {
  id: string;
  email: string | undefined;
  lastSignInAt: string | undefined;
  userMetadata: Record<
    string,
    unknown
  >;
}

function requireEnvironmentVariable(
  name: string
) {
  const value =
    process.env[name];

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

  const authClient =
    createClient(
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

  const adminClient =
    createClient(
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
    supabaseUrl,
    publishableKey,
  };
}

type AppClients =
  ReturnType<
    typeof createClients
  >;

type AdminCheckResult =
  | {
      ok: false;
      response: Response;
    }
  | {
      ok: true;
      adminClient:
        AppClients["adminClient"];
      supabaseUrl: string;
      publishableKey: string;
    };

async function requireAdministrator(
  request: Request
): Promise<AdminCheckResult> {
  const {
    authClient,
    adminClient,
    supabaseUrl,
    publishableKey,
  } = createClients();

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
    return {
      ok: false,

      response:
        Response.json(
          {
            error:
              "Trebuie să fii autentificat.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  const {
    data: { user },
    error: userError,
  } =
    await authClient.auth.getUser(
      accessToken
    );

  if (
    userError ||
    !user
  ) {
    return {
      ok: false,

      response:
        Response.json(
          {
            error:
              "Sesiunea nu este validă.",
          },
          {
            status: 401,
          }
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
      ok: false,

      response:
        Response.json(
          {
            error:
              "Nu ai permisiunea să administrezi participanții.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  return {
    ok: true,
    adminClient,
    supabaseUrl,
    publishableKey,
  };
}

async function getAllAuthUsers(
  adminClient:
    AppClients["adminClient"]
) {
  const users:
    AuthUserLite[] = [];

  let page = 1;

  while (true) {
    const {
      data,
      error,
    } =
      await adminClient.auth.admin.listUsers(
        {
          page,
          perPage: 1000,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    for (
      const user of
      data.users
    ) {
      users.push({
        id: user.id,

        email:
          user.email,

        lastSignInAt:
          user.last_sign_in_at,

        userMetadata:
          (user.user_metadata ??
            {}) as Record<
            string,
            unknown
          >,
      });
    }

    if (
      data.users.length <
      1000
    ) {
      break;
    }

    page += 1;
  }

  return users;
}

function isAccountActivated(
  user:
    | AuthUserLite
    | undefined
) {
  return (
    user?.userMetadata
      ?.account_activated ===
    true
  );
}

/*
 * GET
 * Încarcă participanții și
 * starea conturilor lor.
 */
export async function GET(
  request: Request
) {
  try {
    const adminResult =
      await requireAdministrator(
        request
      );

    if (!adminResult.ok) {
      return adminResult.response;
    }

    const {
      adminClient,
    } = adminResult;

    const {
      data: participants,
      error:
        participantsError,
    } =
      await adminClient
        .from("participants")
        .select(`
          id,
          first_name,
          last_name,
          email,
          auth_user_id,
          activation_email_sent_at,
          activation_email_sent_count,
          include_in_ranking
        `)
        .eq(
          "active",
          true
        )
        .order(
          "last_name",
          {
            ascending: true,
          }
        )
        .order(
          "first_name",
          {
            ascending: true,
          }
        );

    if (
      participantsError
    ) {
      throw new Error(
        participantsError.message
      );
    }

    const authUsers =
      await getAllAuthUsers(
        adminClient
      );

    const authUsersById =
      new Map(
        authUsers.map(
          (user) => [
            user.id,
            user,
          ]
        )
      );

    const users =
      (participants ?? []).map(
        (participant) => {
          const authUser =
            participant.auth_user_id
              ? authUsersById.get(
                  participant.auth_user_id
                )
              : undefined;

          const hasAccount =
            Boolean(
              authUser
            );

          return {
            participantId:
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

            hasAccount,

            activated:
              hasAccount &&
              isAccountActivated(
                authUser
              ),

            lastSignInAt:
              authUser
                ?.lastSignInAt ??
              null,

            activationEmailSentAt:
              participant.activation_email_sent_at ??
              null,

            activationEmailSentCount:
              Number(
                participant.activation_email_sent_count ??
                  0
              ),

            includeInRanking:
              participant.include_in_ranking !==
              false,
          };
        }
      );

    return Response.json({
      users,

      stats: {
        total:
          users.length,

        withAccount:
          users.filter(
            (user) =>
              user.hasAccount
          ).length,

        activated:
          users.filter(
            (user) =>
              user.activated
          ).length,

        notActivated:
          users.filter(
            (user) =>
              user.hasAccount &&
              !user.activated
          ).length,

        withoutAccount:
          users.filter(
            (user) =>
              !user.hasAccount
          ).length,

        activationEmailSent:
          users.filter(
            (user) =>
              user.activationEmailSentCount >
              0
          ).length,

        activationEmailNotSent:
          users.filter(
            (user) =>
              user.hasAccount &&
              !user.activated &&
              user.activationEmailSentCount ===
                0
          ).length,

        includedInRanking:
          users.filter(
            (user) =>
              user.includeInRanking
          ).length,

        excludedFromRanking:
          users.filter(
            (user) =>
              !user.includeInRanking
          ).length,
      },
    });
  } catch (error) {
    console.error(
      "Eroare la încărcarea conturilor:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Conturile nu au putut fi încărcate.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * PATCH
 * Include sau exclude un
 * participant din clasament.
 */
export async function PATCH(
  request: Request
) {
  try {
    const adminResult =
      await requireAdministrator(
        request
      );

    if (!adminResult.ok) {
      return adminResult.response;
    }

    const {
      adminClient,
    } = adminResult;

    const body =
      (await request.json()) as {
        participantId?: string;
        includeInRanking?: boolean;
      };

    const participantId =
      String(
        body.participantId ??
          ""
      ).trim();

    if (!participantId) {
      return Response.json(
        {
          error:
            "Lipsește participantul.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body.includeInRanking !==
      "boolean"
    ) {
      return Response.json(
        {
          error:
            "Valoarea pentru clasament nu este validă.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: participant,
      error:
        updateError,
    } =
      await adminClient
        .from("participants")
        .update({
          include_in_ranking:
            body.includeInRanking,
        })
        .eq(
          "id",
          participantId
        )
        .eq(
          "active",
          true
        )
        .select(`
          id,
          include_in_ranking
        `)
        .maybeSingle();

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    if (!participant) {
      return Response.json(
        {
          error:
            "Participantul nu a fost găsit.",
        },
        {
          status: 404,
        }
      );
    }

    return Response.json({
      success: true,

      participantId:
        participant.id,

      includeInRanking:
        participant.include_in_ranking ===
        true,
    });
  } catch (error) {
    console.error(
      "Eroare la actualizarea clasamentului:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Participantul nu a putut fi actualizat.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * POST
 * Trimite email de activare
 * sau resetare parolă.
 */
export async function POST(
  request: Request
) {
  try {
    const adminResult =
      await requireAdministrator(
        request
      );

    if (!adminResult.ok) {
      return adminResult.response;
    }

    const {
      adminClient,
      supabaseUrl,
      publishableKey,
    } = adminResult;

    const body =
      (await request.json()) as {
        mode?: SendMode;
        participantIds?: string[];
        allUnactivated?: boolean;
      };

    const mode:
      SendMode =
      body.mode ===
      "reset"
        ? "reset"
        : "activation";

    const selectedIds =
      Array.isArray(
        body.participantIds
      )
        ? body.participantIds
            .map(
              (value) =>
                String(
                  value
                ).trim()
            )
            .filter(
              Boolean
            )
        : [];

    if (
      body.allUnactivated !==
        true &&
      selectedIds.length ===
        0
    ) {
      return Response.json(
        {
          error:
            "Nu ai selectat niciun participant.",
        },
        {
          status: 400,
        }
      );
    }

    let query =
      adminClient
        .from("participants")
        .select(`
          id,
          first_name,
          last_name,
          email,
          auth_user_id,
          activation_email_sent_at,
          activation_email_sent_count
        `)
        .eq(
          "active",
          true
        )
        .not(
          "auth_user_id",
          "is",
          null
        )
        .not(
          "email",
          "is",
          null
        );

    if (
      body.allUnactivated !==
      true
    ) {
      query =
        query.in(
          "id",
          selectedIds
        );
    }

    const {
      data: participants,
      error:
        participantsError,
    } = await query;

    if (
      participantsError
    ) {
      throw new Error(
        participantsError.message
      );
    }

    const authUsers =
      await getAllAuthUsers(
        adminClient
      );

    const authUsersById =
      new Map(
        authUsers.map(
          (user) => [
            user.id,
            user,
          ]
        )
      );

    const recipients: {
      participantId: string;
      fullName: string;
      email: string;
      activationEmailSentCount: number;
    }[] = [];

    let skipped = 0;

    for (
      const participant of
      participants ?? []
    ) {
      const authUser =
        participant.auth_user_id
          ? authUsersById.get(
              participant.auth_user_id
            )
          : undefined;

      const email =
        String(
          participant.email ??
            ""
        )
          .trim()
          .toLowerCase();

      if (
        !authUser ||
        !email
      ) {
        skipped += 1;
        continue;
      }

      if (
        mode ===
          "activation" &&
        isAccountActivated(
          authUser
        )
      ) {
        skipped += 1;
        continue;
      }

      if (
        mode ===
          "activation" &&
        body.allUnactivated ===
          true &&
        Number(
          participant.activation_email_sent_count ??
            0
        ) > 0
      ) {
        skipped += 1;
        continue;
      }

      recipients.push({
        participantId:
          participant.id,

        fullName:
          `${participant.last_name} ${participant.first_name}`.trim(),

        email,

        activationEmailSentCount:
          Number(
            participant.activation_email_sent_count ??
              0
          ),
      });
    }

    if (
      recipients.length ===
      0
    ) {
      return Response.json({
        success: true,
        sent: 0,
        failed: 0,
        skipped,
        errors: [],

        message:
          mode ===
          "activation"
            ? "Nu există conturi neactivate eligibile."
            : "Nu există conturi eligibile pentru resetare.",
      });
    }

    const mailClient =
      createClient(
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

    const appUrl =
      requireEnvironmentVariable(
        "APP_URL"
      ).replace(
        /\/+$/,
        ""
      );

    const redirectTo =
      `${appUrl}/setare-parola`;

    let sent = 0;
    let failed = 0;

    const errors:
      string[] = [];

    for (
      const recipient of
      recipients
    ) {
      const {
        error:
          sendError,
      } =
        await mailClient.auth.resetPasswordForEmail(
          recipient.email,
          {
            redirectTo,
          }
        );

      if (sendError) {
        failed += 1;

        errors.push(
          `${recipient.fullName} (${recipient.email}): ${sendError.message}`
        );

        continue;
      }

      sent += 1;

      if (
        mode ===
        "activation"
      ) {
        const {
          error:
            updateTrackingError,
        } =
          await adminClient
            .from(
              "participants"
            )
            .update({
              activation_email_sent_at:
                new Date().toISOString(),

              activation_email_sent_count:
                recipient.activationEmailSentCount +
                1,
            })
            .eq(
              "id",
              recipient.participantId
            );

        if (
          updateTrackingError
        ) {
          errors.push(
            `${recipient.fullName} (${recipient.email}): email trimis, dar evidența activării nu a putut fi actualizată (${updateTrackingError.message}).`
          );
        }
      }
    }

    return Response.json({
      success: true,
      sent,
      failed,
      skipped,

      errors:
        errors.slice(
          0,
          20
        ),

      message:
        mode ===
        "activation"
          ? `Emailuri de activare trimise: ${sent}.`
          : `Emailuri de resetare trimise: ${sent}.`,
    });
  } catch (error) {
    console.error(
      "Eroare la trimiterea emailurilor:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Emailurile nu au putut fi trimise.",
      },
      {
        status: 500,
      }
    );
  }
}