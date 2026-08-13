"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

interface AdminTest {
  id: string;
  title: string;
  timePerQuestion: number;
  isActive: boolean;
  availableUntil: string | null;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
}

const AVAILABILITY_OPTIONS = [
  1,
  2,
  3,
  5,
  7,
];

export default function AdminTestsPage() {
  const [tests, setTests] =
    useState<AdminTest[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    publishingId,
    setPublishingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    availabilityDays,
    setAvailabilityDays,
  ] =
    useState<
      Record<string, number>
    >({});

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadTests =
    useCallback(
      async () => {
        setIsLoading(true);
        setError("");

        try {
          const {
            data: { session },
            error:
              sessionError,
          } =
            await supabase.auth.getSession();

          if (
            sessionError ||
            !session?.access_token
          ) {
            throw new Error(
              "Trebuie să fii autentificat ca administrator."
            );
          }

          const response =
            await fetch(
              "/api/admin/teste/publica",
              {
                method: "GET",

                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },

                cache:
                  "no-store",
              }
            );

          const result =
            (await response.json()) as {
              tests?: AdminTest[];
              error?: string;
            };

          if (
            !response.ok ||
            result.error
          ) {
            throw new Error(
              result.error ||
                "Testele nu au putut fi încărcate."
            );
          }

          const loadedTests =
            result.tests ?? [];

          setTests(
            loadedTests
          );

          setAvailabilityDays(
            (current) => {
              const next = {
                ...current,
              };

              for (
                const test of
                loadedTests
              ) {
                if (
                  !next[
                    test.id
                  ]
                ) {
                  next[
                    test.id
                  ] = 3;
                }
              }

              return next;
            }
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "Testele nu au putut fi încărcate."
          );
        } finally {
          setIsLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const filteredTests =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      if (
        !normalizedSearch
      ) {
        return tests;
      }

      return tests.filter(
        (test) =>
          test.title
            .toLowerCase()
            .includes(
              normalizedSearch
            )
      );
    }, [search, tests]);

  async function handlePublish(
    test: AdminTest
  ) {
    const days =
      availabilityDays[
        test.id
      ] ?? 3;

    const confirmed =
      window.confirm(
        `Publici testul „${test.title}” pentru ${days} ${
          days === 1
            ? "zi"
            : "zile"
        }?\n\nTestul activ în acest moment va fi dezactivat.`
      );

    if (!confirmed) {
      return;
    }

    setPublishingId(
      test.id
    );

    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response =
        await fetch(
          "/api/admin/teste/publica",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization: `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                testId:
                  test.id,

                availabilityDays:
                  days,
              }),
          }
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        result.error
      ) {
        throw new Error(
          result.error ||
            "Testul nu a putut fi publicat."
        );
      }

      setSuccess(
        result.message ||
          "Testul a fost publicat."
      );

      await loadTests();
    } catch (
      publishError
    ) {
      setError(
        publishError instanceof
        Error
          ? publishError.message
          : "Testul nu a putut fi publicat."
      );
    } finally {
      setPublishingId(
        null
      );
    }
  }

  async function handleDelete(
    test: AdminTest
  ) {
    if (
      test.isActive
    ) {
      const confirmedActive =
        window.confirm(
          `ATENȚIE: „${test.title}” este testul activ.\n\nDacă îl ștergi, platforma nu va mai avea niciun test activ până când publici altul.\n\nContinui?`
        );

      if (
        !confirmedActive
      ) {
        return;
      }
    }

    const confirmed =
      window.confirm(
        `Ești sigur că vrei să ștergi testul „${test.title}”?\n\nSe vor șterge definitiv testul, întrebările, rezultatele și răspunsurile asociate.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(
      test.id
    );

    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response =
        await fetch(
          "/api/admin/teste/publica",
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",

              Authorization: `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                testId:
                  test.id,
              }),
          }
        );

      const result =
        (await response.json()) as {
          success?: boolean;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        result.error
      ) {
        throw new Error(
          result.error ||
            "Testul nu a putut fi șters."
        );
      }

      setSuccess(
        result.message ||
          "Testul a fost șters."
      );

      await loadTests();
    } catch (
      deleteError
    ) {
      setError(
        deleteError instanceof
        Error
          ? deleteError.message
          : "Testul nu a putut fi șters."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Teste
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Vezi toate testele
              create și stabilește
              perioada în care
              fiecare test este
              disponibil.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Înapoi la
              administrare
            </Link>

            <Link
              href="/admin/teste/nou"
              className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Creează test nou
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">
              Caută test
            </span>

            <input
              type="search"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Scrie titlul testului..."
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
            />
          </label>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </div>
        )}

        {isLoading ? (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">
              Se încarcă
              testele...
            </p>
          </section>
        ) : filteredTests.length ===
          0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <h2 className="text-xl font-bold text-gray-900">
              Nu am găsit
              teste
            </h2>

            <p className="mt-2 text-gray-600">
              Creează un test
              nou sau modifică
              textul căutat.
            </p>
          </section>
        ) : (
          <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold text-gray-900">
                Toate testele
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {
                  filteredTests.length
                }{" "}
                {filteredTests.length ===
                1
                  ? "test afișat"
                  : "teste afișate"}
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredTests.map(
                (test) => {
                  const expired =
                    Boolean(
                      test.availableUntil
                    ) &&
                    new Date(
                      test.availableUntil!
                    ).getTime() <=
                      Date.now();

                  return (
                    <article
                      key={
                        test.id
                      }
                      className="flex flex-col gap-5 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">
                            {
                              test.title
                            }
                          </h3>

                          {test.isActive &&
                          !expired ? (
                            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              Activ
                            </span>
                          ) : test.isActive &&
                            expired ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Expirat
                            </span>
                          ) : (
                            <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              Inactiv
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                          <span>
                            {
                              test.questionCount
                            }{" "}
                            {test.questionCount ===
                            1
                              ? "întrebare"
                              : "întrebări"}
                          </span>

                          <span>
                            {
                              test.timePerQuestion
                            }{" "}
                            secunde /
                            întrebare
                          </span>

                          <span>
                            {
                              test.attemptCount
                            }{" "}
                            {test.attemptCount ===
                            1
                              ? "rezultat"
                              : "rezultate"}
                          </span>

                          <span>
                            Creat la{" "}
                            {new Date(
                              test.createdAt
                            ).toLocaleDateString(
                              "ro-RO"
                            )}
                          </span>

                          {test.availableUntil && (
                            <span className="font-medium text-gray-800">
                              {expired
                                ? "Expirat la "
                                : "Disponibil până la "}

                              {new Date(
                                test.availableUntil
                              ).toLocaleString(
                                "ro-RO"
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {test.isActive &&
                        !expired ? (
                          <>
                            <Link
                              href="/test"
                              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                            >
                              Previzualizează
                            </Link>

                            <span className="inline-flex items-center rounded-xl bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-700">
                              Test activ
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  test
                                )
                              }
                              disabled={
                                deletingId !==
                                  null ||
                                publishingId !==
                                  null
                              }
                              className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                            >
                              {deletingId ===
                              test.id
                                ? "Se șterge..."
                                : "Șterge"}
                            </button>
                          </>
                        ) : (
                          <>
                            <select
                              value={
                                availabilityDays[
                                  test
                                    .id
                                ] ??
                                3
                              }
                              onChange={(
                                event
                              ) =>
                                setAvailabilityDays(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    [test.id]:
                                      Number(
                                        event
                                          .target
                                          .value
                                      ),
                                  })
                                )
                              }
                              disabled={
                                publishingId !==
                                  null ||
                                deletingId !==
                                  null
                              }
                              className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                            >
                              {AVAILABILITY_OPTIONS.map(
                                (
                                  days
                                ) => (
                                  <option
                                    key={
                                      days
                                    }
                                    value={
                                      days
                                    }
                                  >
                                    {
                                      days
                                    }{" "}
                                    {days ===
                                    1
                                      ? "zi"
                                      : "zile"}
                                  </option>
                                )
                              )}
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                handlePublish(
                                  test
                                )
                              }
                              disabled={
                                publishingId !==
                                  null ||
                                deletingId !==
                                  null
                              }
                              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                              {publishingId ===
                              test.id
                                ? "Se publică..."
                                : expired
                                  ? "Republică"
                                  : "Publică"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  test
                                )
                              }
                              disabled={
                                deletingId !==
                                  null ||
                                publishingId !==
                                  null
                              }
                              className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                            >
                              {deletingId ===
                              test.id
                                ? "Se șterge..."
                                : "Șterge"}
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}