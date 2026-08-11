"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import * as XLSX from "xlsx";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface DashboardResponse {
  activeTest: {
    id: string;
    title: string;
    timePerQuestion: number;
    createdAt: string;
    questionCount: number;
  } | null;

  stats: {
    activeParticipants: number;
    completed: number;
    missing: number;
    participationPercentage: number;
    averageGrade: number;
    maximumGrade: number | null;
    minimumGrade: number | null;
  } | null;

  results: {
    rank: number;
    attemptId: string;
    participantId: string;
    fullName: string;
    email: string;
    score: number;
    totalQuestions: number;
    grade: number;
    durationSeconds: number | null;
    completedAt: string;
  }[];

  missingParticipants: {
    participantId: string;
    fullName: string;
    email: string;
  }[];

  gradeDistribution: {
    grade: number;
    count: number;
  }[];
}

export default function AdminResultsPage() {
  const [data, setData] =
    useState<DashboardResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchMissing, setSearchMissing] =
    useState("");

  useEffect(() => {
    async function loadDashboard() {
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
          "/api/admin/rezultate",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as
            | DashboardResponse
            | { error: string };

        if (
          !response.ok ||
          "error" in result
        ) {
          throw new Error(
            "error" in result
              ? result.error
              : "Dashboard-ul nu a putut fi încărcat."
          );
        }

        setData(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Dashboard-ul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const filteredMissing = useMemo(() => {
    const query = searchMissing
      .trim()
      .toLowerCase();

    if (!query || !data) {
      return (
        data?.missingParticipants ?? []
      );
    }

    return data.missingParticipants.filter(
      (participant) =>
        participant.fullName
          .toLowerCase()
          .includes(query) ||
        participant.email
          .toLowerCase()
          .includes(query)
    );
  }, [data, searchMissing]);

  function handleExportResults() {
    if (!data?.activeTest) {
      return;
    }

    const rows = data.results.map(
      (result) => ({
        Loc: result.rank,
        Nume: result.fullName,
        Email: result.email,
        Scor: result.score,
        Total: result.totalQuestions,
        Nota: formatGrade(
          result.grade
        ),
        Durata: formatDuration(
          result.durationSeconds
        ),
        Data: new Date(
          result.completedAt
        ).toLocaleString("ro-RO"),
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(rows);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Rezultate"
    );

    const safeTitle =
      data.activeTest.title.replace(
        /[^a-zA-Z0-9ăâîșțĂÂÎȘȚ -]/g,
        ""
      );

    XLSX.writeFile(
      workbook,
      `Rezultate ${safeTitle}.xlsx`
    );
  }

  return (
    <div className="min-h-screen bg-[#07100b]">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('/images/homepage-bg.jpg')",
        }}
      />

      <div className="fixed inset-0 bg-black/70" />

      <div className="fixed inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/50" />

      <div className="relative z-10">
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
                Administrare
              </p>

              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                Rezultate test activ
              </h1>

              <p className="mt-3 max-w-2xl text-gray-300">
                Participare, rezultate și lista
                arbitrilor care nu au susținut
                testul.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/40 px-5 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
            >
              Înapoi la administrare
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-10 rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <p className="text-gray-600">
                Se încarcă rezultatele...
              </p>
            </div>
          ) : error ? (
            <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h2 className="text-xl font-bold text-red-800">
                Dashboard indisponibil
              </h2>

              <p className="mt-2 text-red-700">
                {error}
              </p>
            </div>
          ) : data?.activeTest &&
            data.stats ? (
            <>
              <section className="mt-10 rounded-3xl border border-white/15 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
                  Test activ
                </p>

                <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
                  {data.activeTest.title}
                </h2>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                  <span>
                    {
                      data.activeTest
                        .questionCount
                    }{" "}
                    întrebări
                  </span>

                  <span>
                    {
                      data.activeTest
                        .timePerQuestion
                    }{" "}
                    secunde / întrebare
                  </span>

                  <span>
                    Publicat:{" "}
                    {new Date(
                      data.activeTest.createdAt
                    ).toLocaleDateString(
                      "ro-RO"
                    )}
                  </span>
                </div>
              </section>

              <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
                <StatCard
                  label="Participanți activi"
                  value={
                    data.stats
                      .activeParticipants
                  }
                />

                <StatCard
                  label="Au susținut"
                  value={
                    data.stats.completed
                  }
                />

                <StatCard
                  label="Nu au susținut"
                  value={
                    data.stats.missing
                  }
                />

                <StatCard
                  label="Participare"
                  value={`${Math.round(
                    data.stats
                      .participationPercentage
                  )}%`}
                />

                <StatCard
                  label="Media notelor"
                  value={formatGrade(
                    data.stats.averageGrade
                  )}
                />

                <StatCard
                  label="Nota maximă"
                  value={
                    data.stats
                      .maximumGrade === null
                      ? "—"
                      : formatGrade(
                          data.stats
                            .maximumGrade
                        )
                  }
                />

                <StatCard
                  label="Nota minimă"
                  value={
                    data.stats
                      .minimumGrade === null
                      ? "—"
                      : formatGrade(
                          data.stats
                            .minimumGrade
                        )
                  }
                />
              </section>

              <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_0.8fr]">
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Rezultate
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        {
                          data.results
                            .length
                        }{" "}
                        rezultate salvate
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleExportResults
                      }
                      disabled={
                        data.results
                          .length === 0
                      }
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      Export rezultate
                    </button>
                  </div>

                  {data.results.length ===
                  0 ? (
                    <div className="p-10 text-center text-gray-600">
                      Nu există încă rezultate.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left">
                        <thead className="bg-gray-50 text-sm text-gray-500">
                          <tr>
                            <th className="px-5 py-4 font-semibold sm:px-6">
                              Loc
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Arbitru
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Scor
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Notă
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Durată
                            </th>

                            <th className="px-5 py-4 text-right font-semibold sm:px-6">
                              Data
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {data.results.map(
                            (result) => (
                              <tr
                                key={
                                  result.attemptId
                                }
                                className="transition hover:bg-gray-50"
                              >
                                <td className="px-5 py-4 sm:px-6">
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                                    {
                                      result.rank
                                    }
                                  </span>
                                </td>

                                <td className="px-5 py-4">
                                  <Link
                                    href={`/clasament/${result.participantId}`}
                                    className="font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                                  >
                                    {
                                      result.fullName
                                    }
                                  </Link>

                                  <p className="mt-1 text-xs text-gray-500">
                                    {
                                      result.email
                                    }
                                  </p>
                                </td>

                                <td className="px-5 py-4 text-center font-bold text-gray-900">
                                  {
                                    result.score
                                  }
                                  /
                                  {
                                    result.totalQuestions
                                  }
                                </td>

                                <td className="px-5 py-4 text-center font-semibold text-green-700">
                                  {formatGrade(
                                    result.grade
                                  )}
                                </td>

                                <td className="px-5 py-4 text-center text-gray-600">
                                  {formatDuration(
                                    result.durationSeconds
                                  )}
                                </td>

                                <td className="px-5 py-4 text-right text-gray-600 sm:px-6">
                                  {new Date(
                                    result.completedAt
                                  ).toLocaleString(
                                    "ro-RO"
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                  <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                    <h2 className="text-xl font-bold text-gray-900">
                      Nu au susținut
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      {
                        data
                          .missingParticipants
                          .length
                      }{" "}
                      participanți
                    </p>

                    <input
                      type="search"
                      value={searchMissing}
                      onChange={(event) =>
                        setSearchMissing(
                          event.target.value
                        )
                      }
                      placeholder="Caută nume sau email..."
                      className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    />
                  </div>

                  <div className="max-h-[650px] overflow-y-auto">
                    {filteredMissing.length ===
                    0 ? (
                      <div className="p-8 text-center text-gray-600">
                        Nu există rezultate
                        pentru căutarea curentă.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredMissing.map(
                          (participant) => (
                            <li
                              key={
                                participant.participantId
                              }
                              className="px-5 py-4 sm:px-6"
                            >
                              <p className="font-semibold text-gray-900">
                                {
                                  participant.fullName
                                }
                              </p>

                              <p className="mt-1 text-sm text-gray-500">
                                {
                                  participant.email
                                }
                              </p>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Distribuția notelor
                  </h2>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 xl:grid-cols-6">
                  {data.gradeDistribution.map(
                    (item) => (
                      <div
                        key={item.grade}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <p className="text-lg font-bold text-gray-900">
                          Nota{" "}
                          {formatGrade(
                            item.grade
                          )}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {item.count}{" "}
                          {item.count === 1
                            ? "participant"
                            : "participanți"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="mt-10 rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <h2 className="text-xl font-bold text-gray-900">
                Nu există un test activ
              </h2>

              <p className="mt-2 text-gray-600">
                Publică un test pentru a
                vedea rezultatele.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function formatGrade(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  );
}

function formatDuration(
  durationSeconds: number | null
) {
  if (
    durationSeconds === null ||
    durationSeconds < 0
  ) {
    return "—";
  }

  const minutes = Math.floor(
    durationSeconds / 60
  );

  const seconds =
    durationSeconds % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}