"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface RankingItem {
  rank: number;
  participantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  totalPoints: number;
  maximumPoints: number;
  testsTaken: number;
  publishedTests: number;
  participationPercentage: number;
  averageGrade: number;
  latestAttemptAt: string;
}

interface RankingResponse {
  ranking: RankingItem[];

  stats: {
    publishedTests: number;
    activeParticipants: number;
    participantsWithResults: number;
    totalAttempts: number;
    generalAverageGrade: number;
  };
}

export default function RankingPage() {
  const router = useRouter();

  const [data, setData] =
    useState<RankingResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadRanking() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          router.replace(
            "/login?next=/clasament"
          );

          return;
        }

        const response = await fetch(
          "/api/clasament",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as
            | RankingResponse
            | { error: string };

        if (
          !response.ok ||
          "error" in result
        ) {
          if (response.status === 401) {
            router.replace(
              "/login?next=/clasament"
            );

            return;
          }

          if (response.status === 403) {
            throw new Error(
              "Clasamentul general este disponibil doar administratorului."
            );
          }

          throw new Error(
            "error" in result
              ? result.error
              : "Clasamentul nu a putut fi încărcat."
          );
        }

        setData(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Clasamentul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadRanking();
  }, [router]);

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
          {isLoading ? (
            <div className="rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <p className="text-gray-600">
                Se încarcă clasamentul...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h1 className="text-xl font-bold text-red-800">
                Clasamentul nu este disponibil
              </h1>

              <p className="mt-2 text-red-700">
                {error}
              </p>

              <Link
                href="/"
                className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white transition hover:bg-black"
              >
                Înapoi la homepage
              </Link>
            </div>
          ) : data ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
                    Administrare
                  </p>

                  <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                    Clasament general
                  </h1>

                  <p className="mt-2 max-w-2xl text-gray-300">
                    Clasamentul cumulat al
                    arbitrilor pentru toate
                    testele publicate.
                  </p>
                </div>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/40 px-5 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
                >
                  Administrare
                </Link>
              </div>

              <section className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Teste publicate"
                  value={
                    data.stats
                      .publishedTests
                  }
                />

                <StatCard
                  label="Arbitri activi"
                  value={
                    data.stats
                      .activeParticipants
                  }
                />

                <StatCard
                  label="Cu rezultate"
                  value={
                    data.stats
                      .participantsWithResults
                  }
                />

                <StatCard
                  label="Media generală"
                  value={formatGrade(
                    data.stats
                      .generalAverageGrade
                  )}
                />
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-bold text-gray-900">
                    Clasament general
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Ordinea este stabilită
                    după punctele totale
                    acumulate.
                  </p>
                </div>

                {data.ranking.length === 0 ? (
                  <div className="p-10 text-center">
                    <h3 className="text-lg font-bold text-gray-900">
                      Nu există încă rezultate
                    </h3>

                    <p className="mt-2 text-gray-600">
                      Clasamentul va fi
                      generat după primele
                      teste susținute.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* DESKTOP */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[900px] text-left">
                        <thead className="bg-gray-50 text-sm text-gray-500">
                          <tr>
                            <th className="px-5 py-4 text-center font-semibold">
                              Loc
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Arbitru
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Puncte
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Teste
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Media
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Participare
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {data.ranking.map(
                            (participant) => (
                              <tr
                                key={
                                  participant.participantId
                                }
                                className="transition hover:bg-gray-50"
                              >
                                <td className="px-5 py-4 text-center">
                                  <RankBadge
                                    rank={
                                      participant.rank
                                    }
                                  />
                                </td>

                                <td className="px-5 py-4">
                                  <Link
                                    href={`/clasament/${participant.participantId}`}
                                    className="font-bold text-gray-900 transition hover:text-green-700"
                                  >
                                    {
                                      participant.fullName
                                    }
                                  </Link>
                                </td>

                                <td className="px-5 py-4 text-center font-bold text-green-700">
                                  {
                                    participant.totalPoints
                                  }
                                  /
                                  {
                                    participant.maximumPoints
                                  }
                                </td>

                                <td className="px-5 py-4 text-center font-semibold text-gray-900">
                                  {
                                    participant.testsTaken
                                  }
                                  /
                                  {
                                    participant.publishedTests
                                  }
                                </td>

                                <td className="px-5 py-4 text-center font-semibold text-gray-900">
                                  {formatGrade(
                                    participant.averageGrade
                                  )}
                                </td>

                                <td className="px-5 py-4 text-center text-gray-700">
                                  {Math.round(
                                    participant.participationPercentage
                                  )}
                                  %
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* MOBILE */}
                    <div className="divide-y divide-gray-200 md:hidden">
                      {data.ranking.map(
                        (participant) => (
                          <article
                            key={
                              participant.participantId
                            }
                            className="p-5"
                          >
                            <div className="flex items-center gap-4">
                              <RankBadge
                                rank={
                                  participant.rank
                                }
                              />

                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/clasament/${participant.participantId}`}
                                  className="font-bold text-gray-900 transition hover:text-green-700"
                                >
                                  {
                                    participant.fullName
                                  }
                                </Link>

                                <p className="mt-1 text-sm text-gray-500">
                                  {
                                    participant.testsTaken
                                  }
                                  /
                                  {
                                    participant.publishedTests
                                  }{" "}
                                  teste
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-3">
                              <MiniStat
                                label="Puncte"
                                value={`${participant.totalPoints}/${participant.maximumPoints}`}
                              />

                              <MiniStat
                                label="Media"
                                value={formatGrade(
                                  participant.averageGrade
                                )}
                              />

                              <MiniStat
                                label="Participare"
                                value={`${Math.round(
                                  participant.participationPercentage
                                )}%`}
                              />
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  </>
                )}
              </section>

              <div className="mt-8 flex justify-center">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
                >
                  Înapoi la administrare
                </Link>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
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

interface MiniStatProps {
  label: string;
  value: string;
}

function MiniStat({
  label,
  value,
}: MiniStatProps) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function RankBadge({
  rank,
}: {
  rank: number;
}) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-yellow-100 px-3 font-bold text-yellow-800">
        1
      </span>
    );
  }

  if (rank === 2) {
    return (
      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-gray-200 px-3 font-bold text-gray-700">
        2
      </span>
    );
  }

  if (rank === 3) {
    return (
      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-orange-100 px-3 font-bold text-orange-800">
        3
      </span>
    );
  }

  return (
    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-gray-100 px-3 font-bold text-gray-700">
      {rank}
    </span>
  );
}

function formatGrade(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}