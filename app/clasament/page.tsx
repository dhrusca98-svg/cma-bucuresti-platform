"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";

interface RankingEntry {
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
  averagePercentage: number;
  latestAttemptAt: string;
}

interface RankingStats {
  publishedTests: number;
  activeParticipants: number;
  participantsWithResults: number;
  totalAttempts: number;
  generalAverage: number;
}

interface RankingResponse {
  ranking: RankingEntry[];
  stats: RankingStats;
}

export default function RankingPage() {
  const [data, setData] =
    useState<RankingResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRanking() {
      try {
        const response = await fetch(
          "/api/clasament",
          {
            cache: "no-store",
          }
        );

        const result = (await response.json()) as
          | RankingResponse
          | { error: string };

        if (!response.ok || "error" in result) {
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
  }, []);

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
              Competiția sezonului
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Clasament general
            </h1>

            <p className="mt-3 max-w-2xl text-gray-300">
              Punctele obținute la toate testele
              publicate se adună pe parcursul
              sezonului.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/40 px-5 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
          >
            Înapoi la homepage
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/95 backdrop-blur-sm p-10 text-center shadow-sm">
            <p className="text-gray-600">
              Se încarcă clasamentul...
            </p>
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <h2 className="text-xl font-bold text-red-800">
              Clasamentul nu este disponibil
            </h2>

            <p className="mt-2 text-red-700">
              {error}
            </p>
          </div>
        ) : data ? (
          <>
            <section className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Teste publicate"
                value={data.stats.publishedTests}
              />

              <StatCard
                label="Participanți activi"
                value={
                  data.stats.activeParticipants
                }
              />

              <StatCard
                label="Au obținut puncte"
                value={
                  data.stats
                    .participantsWithResults
                }
              />

              <StatCard
                label="Media generală"
                value={`${Math.round(
                  data.stats.generalAverage
                )}%`}
              />
            </section>

            {data.ranking.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-white/95 backdrop-blur-sm p-10 text-center">
                <h2 className="text-xl font-bold text-gray-900">
                  Nu există încă rezultate
                </h2>

                <p className="mt-2 text-gray-600">
                  Clasamentul va apărea după
                  susținerea primelor teste.
                </p>
              </div>
            ) : (
              <>
                <section className="mt-8 grid gap-4 md:grid-cols-3">
                  {data.ranking
                    .slice(0, 3)
                    .map((entry) => (
                      <PodiumCard
                        key={entry.participantId}
                        entry={entry}
                      />
                    ))}
                </section>

                <section className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/95 backdrop-blur-sm shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                    <h2 className="text-lg font-bold text-gray-900">
                      Clasament complet
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left">
                      <thead className="bg-gray-50 text-sm text-gray-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold sm:px-6">
                            Loc
                          </th>
                          <th className="px-5 py-4 font-semibold">
                            Arbitru
                          </th>
                          <th className="px-5 py-4 text-center font-semibold">
                            Puncte
                          </th>
                          <th className="px-5 py-4 text-center font-semibold">
                            Maximum
                          </th>
                          <th className="px-5 py-4 text-center font-semibold">
                            Teste
                          </th>
                          <th className="px-5 py-4 text-center font-semibold">
                            Participare
                          </th>
                          <th className="px-5 py-4 text-center font-semibold">
                            Medie
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {data.ranking.map(
                          (entry) => (
                            <tr
                              key={
                                entry.participantId
                              }
                              className="transition hover:bg-gray-50"
                            >
                              <td className="px-5 py-4 sm:px-6">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                                  {entry.rank}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <Link
                                  href={`/clasament/${entry.participantId}`}
                                  className="font-semibold text-gray-900 transition hover:text-green-700 hover:underline"
                                >
                                  {entry.fullName}
                                </Link>
                              </td>

                              <td className="px-5 py-4 text-center text-lg font-bold text-green-700">
                                {entry.totalPoints}
                              </td>

                              <td className="px-5 py-4 text-center text-gray-700">
                                {
                                  entry.maximumPoints
                                }
                              </td>

                              <td className="px-5 py-4 text-center text-gray-700">
                                {entry.testsTaken}
                              </td>

                              <td className="px-5 py-4 text-center text-gray-700">
                                <span className="font-semibold text-gray-900">
                                  {entry.testsTaken}/
                                  {entry.publishedTests}
                                </span>

                                <span className="ml-2 text-sm text-gray-500">
                                  (
                                  {Math.round(
                                    entry.participationPercentage
                                  )}
                                  %)
                                </span>
                              </td>

                              <td className="px-5 py-4 text-center font-semibold text-gray-900">
                                {Math.round(
                                  entry.averagePercentage
                                )}
                                %
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        ) : null}
      </main>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
}

function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 backdrop-blur-sm p-5 shadow-sm">
      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {label}
      </p>
    </div>
  );
}

interface PodiumCardProps {
  entry: RankingEntry;
}

function PodiumCard({
  entry,
}: PodiumCardProps) {
  const positionLabel =
    entry.rank === 1
      ? "Locul 1"
      : entry.rank === 2
        ? "Locul 2"
        : "Locul 3";

  return (
    <article className="rounded-2xl border border-white/15 bg-white/95 backdrop-blur-sm p-6 text-center shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-green-700">
        {positionLabel}
      </p>

      <Link
        href={`/clasament/${entry.participantId}`}
        className="mt-3 block text-xl font-bold text-gray-900 transition hover:text-green-700 hover:underline"
      >
        {entry.fullName}
      </Link>

      <p className="mt-5 text-4xl font-bold text-green-700">
        {entry.totalPoints}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        puncte din {entry.maximumPoints}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-600">
        <span>
          {entry.testsTaken}{" "}
          {entry.testsTaken === 1
            ? "test"
            : "teste"}
        </span>

        <span>
          {Math.round(
            entry.participationPercentage
          )}
          % participare
        </span>

        <span>
          {Math.round(
            entry.averagePercentage
          )}
          % medie
        </span>
      </div>
    </article>
  );
}