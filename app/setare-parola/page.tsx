"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [isReady, setIsReady] =
    useState(false);

  const [isChecking, setIsChecking] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  useEffect(() => {
    let mounted = true;
    let timeoutId:
      | ReturnType<typeof setTimeout>
      | null = null;

    function showError(
      message: string
    ) {
      if (!mounted) {
        return;
      }

      setError(message);
      setIsChecking(false);
      setIsReady(false);
    }

    async function initialize() {
      try {
        /*
         * 1. Verificăm dacă Supabase ne-a
         * redirecționat cu o eroare.
         */
        const currentUrl =
          new URL(
            window.location.href
          );

        const errorDescription =
          currentUrl.searchParams.get(
            "error_description"
          );

        const errorCode =
          currentUrl.searchParams.get(
            "error_code"
          );

        if (errorDescription) {
          showError(
            decodeURIComponent(
              errorDescription.replace(
                /\+/g,
                " "
              )
            )
          );
          return;
        }

        /*
         * Uneori eroarea poate fi în hash.
         */
        const hashParams =
          new URLSearchParams(
            window.location.hash.replace(
              /^#/,
              ""
            )
          );

        const hashErrorDescription =
          hashParams.get(
            "error_description"
          );

        if (
          hashErrorDescription
        ) {
          showError(
            decodeURIComponent(
              hashErrorDescription.replace(
                /\+/g,
                " "
              )
            )
          );
          return;
        }

        /*
         * 2. PKCE flow.
         *
         * Dacă URL-ul conține ?code=...
         * schimbăm explicit codul pentru sesiune.
         */
        const code =
          currentUrl.searchParams.get(
            "code"
          );

        if (code) {
          const {
            data,
            error:
              exchangeError,
          } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (exchangeError) {
            showError(
              "Linkul de activare sau resetare nu mai este valid. Solicită un link nou."
            );
            return;
          }

          if (
            data.session &&
            mounted
          ) {
            /*
             * Curățăm ?code= din adresă ca
             * refresh-ul să nu încerce din nou
             * să folosească același cod.
             */
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );

            setIsReady(true);
            setIsChecking(false);
            return;
          }
        }

        /*
         * 3. Implicit flow.
         *
         * Dacă avem tokenurile în hash,
         * setăm explicit sesiunea.
         */
        const accessToken =
          hashParams.get(
            "access_token"
          );

        const refreshToken =
          hashParams.get(
            "refresh_token"
          );

        if (
          accessToken &&
          refreshToken
        ) {
          const {
            data,
            error:
              sessionError,
          } =
            await supabase.auth.setSession({
              access_token:
                accessToken,
              refresh_token:
                refreshToken,
            });

          if (sessionError) {
            showError(
              "Linkul de activare sau resetare nu mai este valid. Solicită un link nou."
            );
            return;
          }

          if (
            data.session &&
            mounted
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );

            setIsReady(true);
            setIsChecking(false);
            return;
          }
        }

        /*
         * 4. Supabase poate să fi procesat
         * deja automat URL-ul.
         */
        const {
          data: {
            session,
          },
          error:
            sessionReadError,
        } =
          await supabase.auth.getSession();

        if (sessionReadError) {
          showError(
            "Sesiunea nu a putut fi verificată. Solicită un link nou."
          );
          return;
        }

        if (
          session &&
          mounted
        ) {
          setIsReady(true);
          setIsChecking(false);
          return;
        }

        /*
         * Nu afișăm imediat eroarea pentru că
         * onAuthStateChange poate veni puțin
         * mai târziu pe unele browsere.
         */
      } catch (initializeError) {
        console.error(
          "Eroare la verificarea linkului:",
          initializeError
        );

        showError(
          "Linkul de activare sau resetare nu a putut fi verificat."
        );
      }
    }

    /*
     * Listener-ul recomandat de Supabase
     * pentru PASSWORD_RECOVERY.
     */
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) {
            return;
          }

          if (
            event ===
              "PASSWORD_RECOVERY" ||
            event ===
              "SIGNED_IN" ||
            event ===
              "INITIAL_SESSION"
          ) {
            if (session) {
              setIsReady(true);
              setIsChecking(false);
              setError("");
            }
          }
        }
      );

    void initialize();

    /*
     * Nu mai permitem ecranului să rămână
     * blocat la infinit.
     */
    timeoutId =
      setTimeout(() => {
        if (
          mounted &&
          !isReady
        ) {
          setIsChecking(false);

          setError(
            (currentError) =>
              currentError ||
              "Linkul de activare sau resetare pare expirat sau invalid. Solicită un link nou."
          );
        }
      }, 8000);

    return () => {
      mounted = false;

      subscription.unsubscribe();

      if (timeoutId) {
        clearTimeout(
          timeoutId
        );
      }
    };
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (
      password.length < 8
    ) {
      setError(
        "Parola trebuie să conțină minimum 8 caractere."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Parolele introduse nu coincid."
      );
      return;
    }

    setIsSaving(true);

    try {
      /*
       * Verificăm încă o dată sesiunea
       * înainte de update.
       */
      const {
        data: {
          session,
        },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session
      ) {
        throw new Error(
          "Sesiunea a expirat. Solicită un link nou."
        );
      }

      const {
        error:
          updateError,
      } =
        await supabase.auth.updateUser({
          password,

          data: {
            account_activated:
              true,

            account_activated_at:
              new Date().toISOString(),
          },
        });

      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Parola nu a putut fi salvată."
      );
    } finally {
      setIsSaving(false);
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
            Setează parola
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-400">
            Alege parola pe care o vei
            folosi pentru autentificarea
            în platforma de testare.
          </p>
        </div>

        {success ? (
          <div className="mt-8">
            <div className="rounded-xl border border-green-700 bg-green-900/20 p-5 text-center">
              <p className="font-semibold text-green-300">
                Parola a fost setată cu succes.
              </p>

              <p className="mt-2 text-sm text-gray-300">
                Contul tău este activ și
                pregătit pentru utilizare.
              </p>
            </div>

            <Link
              href="/"
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Intră în platformă
            </Link>
          </div>
        ) : isChecking ? (
          <div className="mt-8 rounded-xl border border-amber-700 bg-amber-900/20 p-5 text-center">
            <p className="text-sm text-amber-200">
              Se verifică linkul de
              activare sau resetare...
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Verificarea durează doar
              câteva secunde.
            </p>
          </div>
        ) : !isReady ? (
          <div className="mt-8">
            <div className="rounded-xl border border-red-700 bg-red-900/20 p-5 text-center">
              <p className="font-semibold text-red-300">
                Linkul nu poate fi folosit
              </p>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                {error ||
                  "Linkul de activare sau resetare este expirat sau invalid."}
              </p>
            </div>

            <Link
              href="/resetare-parola"
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Solicită un link nou
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Parolă nouă
              </label>

              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Confirmă parola
              </label>

              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
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
              disabled={isSaving}
              className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? "Se salvează..."
                : "Salvează parola"}
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