"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface ProfileResponse {
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string | null;
    active: boolean;
  };

  summary: {
    rankingPosition: number | null;
    rankedParticipants: number;
    totalPoints: number;
    maximumPoints: number;
    testsTaken: number;
    publishedTests: number;
    participationPercentage: number;
    averageGrade: number;
    averagePercentage: number;
  };

  history: {
    attemptId: string;
    testId: string;
    testTitle: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    grade: number;
    durationSeconds: number | null;
    completedAt: string;
  }[];
}

export default function ParticipantProfilePage() {
  const params = useParams<{
    participantId: string;
  }>();

  const [data, setData] =
    useState<ProfileResponse | null>(
      null
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError("");

        /*
         * Luăm sesiunea curentă pentru
         * a trimite access token-ul
         * către API-ul protejat.
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
            "Trebuie să fii autentificat pentru a accesa acest profil."
          );
        }

        const response =
          await fetch(
            `/api/clasament/${params.participantId}`,
            {
              cache:
                "no-store",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          (await response.json()) as
            | ProfileResponse
            | {
                error:
                  string;
              };

        if (
          !response.ok ||
          "error" in result
        ) {
          throw new Error(
            "error" in result
              ? result.error
              : "Profilul nu a putut fi încărcat."
          );
        }

        if (mounted) {
          setData(result);
        }
      } catch (
        loadError
      ) {
        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Profilul nu a putut fi încărcat."
        );
      } finally {
        if (mounted) {
          setIsLoading(
            false
          );
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [
    params.participantId,
  ]);

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

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            href="/clasament"
            className="text-sm font-semibold text-green-300 transition hover:text-green-200"
          >
            ← Înapoi la clasament
          </Link>

          {isLoading ? (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <p className="text-gray-600">
                Se încarcă profilul...
              </p>
            </div>
          ) : error ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h1 className="text-xl font-bold text-red-800">
                Profil indisponibil
              </h1>

              <p className="mt-2 text-red-700">
                {error}
              </p>

              <Link
                href="/clasament"
                className="mt-5 inline-flex rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Înapoi la clasament
              </Link>
            </div>
          ) : data ? (
            <>
              <section className="mt-6 rounded-3xl border border-white/15 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-600">
                      Profil arbitru
                    </p>

                    <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
                      {
                        data
                          .participant
                          .fullName
                      }
                    </h1>

                    <p className="mt-2 text-gray-600">
                      {data
                        .participant
                        .active
                        ? "Participant activ"
                        : "Participant inactiv"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-200 bg-green-50 px-6 py-4 text-center">
                    <p className="text-sm font-semibold text-green-700">
                      Loc în clasament
                    </p>

                    <p className="mt-1 text-3xl font-bold text-green-800">
                      {data
                        .summary
                        .rankingPosition
                        ? `#${data.summary.rankingPosition}`
                        : "—"}
                    </p>

                    <p className="mt-1 text-xs text-green-700">
                      din{" "}
                      {
                        data
                          .summary
                          .rankedParticipants
                      }
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Puncte"
                  value={`${data.summary.totalPoints}/${data.summary.maximumPoints}`}
                />

                <StatCard
                  label="Teste susținute"
                  value={`${data.summary.testsTaken}/${data.summary.publishedTests}`}
                />

                <StatCard
                  label="Participare"
                  value={`${Math.round(
                    data
                      .summary
                      .participationPercentage
                  )}%`}
                />

                <StatCard
                  label="Media notelor"
                  value={formatGrade(
                    data
                      .summary
                      .averageGrade
                  )}
                />
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Istoric teste
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Toate rezultatele
                    obținute în sezonul
                    curent. Apasă pe un
                    test pentru a vedea
                    răspunsurile.
                  </p>
                </div>

                {data.history
                  .length ===
                0 ? (
                  <div className="p-10 text-center text-gray-600">
                    Nu există încă
                    rezultate.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left">
                      <thead className="bg-gray-50 text-sm text-gray-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold sm:px-6">
                            Test
                          </th>

                          <th className="px-5 py-4 text-center font-semibold">
                            Scor
                          </th>

                          <th className="px-5 py-4 text-center font-semibold">
                            Notă
                          </th>

                          <th className="px-5 py-4 text-center font-semibold">
                            Procent
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
                        {data.history.map(
                          (
                            attempt
                          ) => (
                            <tr
                              key={
                                attempt.attemptId
                              }
                              className="transition hover:bg-gray-50"
                            >
                              <td className="px-5 py-4 sm:px-6">
                                <Link
                                  href={`/admin/participanti/${data.participant.id}/rezultate/${attempt.attemptId}`}
                                  className="group inline-flex items-center gap-2 font-semibold text-gray-900 transition hover:text-green-700"
                                >
                                  <span>
                                    {
                                      attempt.testTitle
                                    }
                                  </span>

                                  <span
                                    aria-hidden="true"
                                    className="text-green-600 transition-transform group-hover:translate-x-1"
                                  >
                                    →
                                  </span>
                                </Link>
                              </td>

                              <td className="px-5 py-4 text-center font-bold text-gray-900">
                                {
                                  attempt.score
                                }
                                /
                                {
                                  attempt.totalQuestions
                                }
                              </td>

                              <td className="px-5 py-4 text-center">
                                <span className="inline-flex min-w-12 justify-center rounded-lg bg-green-50 px-2.5 py-1 font-bold text-green-700">
                                  {formatGrade(
                                    attempt.grade
                                  )}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-center font-semibold text-gray-700">
                                {Math.round(
                                  attempt.percentage
                                )}
                                %
                              </td>

                              <td className="px-5 py-4 text-center text-gray-600">
                                {formatDuration(
                                  attempt.durationSeconds
                                )}
                              </td>

                              <td className="px-5 py-4 text-right text-gray-600 sm:px-6">
                                {new Date(
                                  attempt.completedAt
                                ).toLocaleDateString(
                                  "ro-RO",
                                  {
                                    day:
                                      "2-digit",
                                    month:
                                      "2-digit",
                                    year:
                                      "numeric",
                                  }
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
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
  durationSeconds:
    | number
    | null
) {
  if (
    durationSeconds ===
      null ||
    durationSeconds < 0
  ) {
    return "—";
  }

  const minutes =
    Math.floor(
      durationSeconds /
        60
    );

  const seconds =
    durationSeconds %
    60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatGrade(
  grade: number
) {
  if (
    !Number.isFinite(
      grade
    )
  ) {
    return "—";
  }

  return grade.toLocaleString(
    "ro-RO",
    {
      minimumFractionDigits:
        1,
      maximumFractionDigits:
        2,
    }
  );
}