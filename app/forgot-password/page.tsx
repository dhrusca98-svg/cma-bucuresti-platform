"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    const possibleError = error as {
      message?: unknown;
      error_description?: unknown;
      error?: unknown;
      code?: unknown;
      status?: unknown;
    };

    if (
      typeof possibleError.message ===
        "string" &&
      possibleError.message.trim()
    ) {
      return possibleError.message;
    }

    if (
      typeof possibleError.error_description ===
        "string" &&
      possibleError.error_description.trim()
    ) {
      return possibleError.error_description;
    }

    if (
      typeof possibleError.error ===
        "string" &&
      possibleError.error.trim()
    ) {
      return possibleError.error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Emailul nu a putut fi trimis.";
    }
  }

  if (typeof error === "string") {
    return error;
  }

  return "Emailul nu a putut fi trimis.";
}

function translateError(message: string) {
  const normalized =
    message.toLowerCase();

  if (
    normalized.includes(
      "rate limit"
    ) ||
    normalized.includes(
      "email rate limit exceeded"
    )
  ) {
    return "Ai solicitat prea multe emailuri într-un interval scurt. Așteaptă puțin și încearcă din nou.";
  }

  if (
    normalized.includes("smtp") ||
    normalized.includes(
      "error sending recovery email"
    ) ||
    normalized.includes(
      "failed to send"
    )
  ) {
    return `Emailul nu a putut fi trimis. Detalii: ${message}`;
  }

  return message;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [isSending, setIsSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);
    setIsSending(true);

    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      const redirectTo =
        `${window.location.origin}/setare-parola`;

      console.log(
        "Trimitere resetare parolă:",
        {
          email: normalizedEmail,
          redirectTo,
        }
      );

      const {
        data,
        error: resetError,
      } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          {
            redirectTo,
          }
        );

      console.log(
        "Răspuns resetare parolă:",
        {
          data,
          resetError,
        }
      );

      if (resetError) {
        console.error(
          "Eroare Supabase reset password:",
          resetError
        );

        const message =
          getErrorMessage(
            resetError
          );

        throw new Error(
          translateError(message)
        );
      }

      setSuccess(true);
    } catch (sendError) {
      console.error(
        "Eroare la trimiterea emailului:",
        sendError
      );

      const message =
        getErrorMessage(
          sendError
        );

      setError(
        translateError(message)
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07100b] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
            CMA București
          </p>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Resetare parolă
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Introdu adresa de email a
            contului tău. Vei primi un link
            pentru alegerea unei parole noi.
          </p>
        </div>

        {success ? (
          <div className="mt-8">
            <div className="rounded-xl border border-green-700 bg-green-900/20 p-5 text-center">
              <p className="font-semibold text-green-300">
                Verifică emailul.
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                Dacă există un cont asociat
                acestei adrese, vei primi
                instrucțiunile pentru
                resetarea parolei.
              </p>
            </div>

            <Link
              href="/login"
              className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Înapoi la autentificare
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Email
              </label>

              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-700 bg-red-900/20 px-4 py-3 text-sm leading-6 text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending
                ? "Se trimite..."
                : "Trimite linkul de resetare"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-sm text-gray-500 transition hover:text-gray-300"
          >
            ← Înapoi la autentificare
          </Link>
        </div>
      </div>
    </main>
  );
}