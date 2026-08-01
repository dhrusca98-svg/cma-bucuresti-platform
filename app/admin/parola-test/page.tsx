"use client";

import Link from "next/link";
import { useState } from "react";

import { supabase } from "@/lib/supabase/client";

export default function TestPasswordPage() {
  const [email, setEmail] = useState(
    "gunacristi66@gmail.com"
  );

  const [password, setPassword] =
    useState("Test1234!");

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response = await fetch(
        "/api/admin/utilizatori/parola",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const result = (await response.json()) as {
        error?: string;
        success?: boolean;
      };

      if (!response.ok || result.error) {
        throw new Error(
          result.error ||
            "Parola nu a putut fi setată."
        );
      }

      setSuccess(
        "Parola temporară a fost setată. Poți testa acum autentificarea în Incognito."
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Parola nu a putut fi setată."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Parolă pentru contul de test
            </h1>

            <p className="mt-2 text-gray-600">
              Funcție temporară pentru testarea
              platformei înainte de lansare.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Înapoi
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Email cont test
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Parolă temporară
            </label>

            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
            />
          </div>

          {error && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 w-full rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSaving
              ? "Se setează..."
              : "Setează parola temporară"}
          </button>
        </form>
      </div>
    </main>
  );
}