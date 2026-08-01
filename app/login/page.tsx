"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  useState,
} from "react";

import { signIn } from "@/lib/supabase/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath =
    searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState("");

  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { error: loginError } =
      await signIn(
        email.trim().toLowerCase(),
        password
      );

    if (loginError) {
      setError(
        "Emailul sau parola sunt incorecte."
      );
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07100b] px-5">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            Autentificare
          </h1>

          <p className="mt-2 text-gray-400">
            Platforma oficială de testare a
            arbitrilor
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Email
            </label>

            <input
              autoFocus
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Parolă
            </label>

            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading
              ? "Se autentifică..."
              : "Autentificare"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-green-400 transition hover:text-green-300"
          >
            Ai uitat parola?
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm text-gray-300">
            Conturile sunt create de
            administratorul platformei.
          </p>

          <p className="mt-2 text-xs text-gray-500">
            Dacă întâmpini probleme,
            contactează Comisia Municipală a
            Arbitrilor București.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 transition hover:text-gray-300"
          >
            ← Înapoi la pagina principală
          </Link>
        </div>
      </div>
    </main>
  );
}

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07100b] px-5">
      <div className="rounded-2xl border border-white/10 bg-black/60 px-8 py-6 text-gray-300 shadow-2xl">
        Se încarcă...
      </div>
    </main>
  );
}