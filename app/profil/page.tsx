"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface ProfileHistoryItem {
  attemptId: string;
  testId: string;
  title: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  durationSeconds: number | null;
  completedAt: string;
}

interface ProfileResponse {
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
  };
  stats: {
    testsTaken: number;
    publishedTests: number;
    totalPoints: number;
    maximumPoints: number;
    averagePercentage: number;
    participationPercentage: number;
  };
  history: ProfileHistoryItem[];
}

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<ProfileResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadProfile() {
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
            "/login?next=/profil"
          );
          return;
        }

        const response = await fetch(
          "/api/profil",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as
            | ProfileResponse
            | { error: string };

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

        setProfile(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Profilul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
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
                Se încarcă profilul...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <h1 className="text-xl font-bold text-red-800">
                Profilul nu este disponibil
              </h1>

              <p className="mt-2 text-red-700">
                {error}
              </p>

              <Link
                href="/"
                className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white"
              >
                Înapoi la homepage
              </Link>
            </div>
          ) : profile ? (
            <>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
                    Contul meu
                  </p>

                  <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                    {profile.participant.fullName}
                  </h1>

                  <p className="mt-2 text-gray-300">
                    {profile.participant.email}
                  </p>
                </div>

                <Link
                  href="/clasament"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/40 px-5 py-3 font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
                >
                  Vezi clasamentul
                </Link>
              </div>

              <section className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Teste susținute"
                  value={`${profile.stats.testsTaken}/${profile.stats.publishedTests}`}
                />

                <StatCard
                  label="Puncte"
                  value={`${profile.stats.totalPoints}/${profile.stats.maximumPoints}`}
                />

                <StatCard
                  label="Medie"
                  value={`${Math.round(
                    profile.stats.averagePercentage
                  )}%`}
                />

                <StatCard
                  label="Participare"
                  value={`${Math.round(
                    profile.stats.participationPercentage
                  )}%`}
                />
              </section>

              <section className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
                  <h2 className="text-lg font-bold text-gray-900">
                    Istoric teste
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Rezultatele tale la toate
                    testele susținute.
                  </p>
                </div>

                {profile.history.length === 0 ? (
                  <div className="p-10 text-center">
                    <h3 className="text-lg font-bold text-gray-900">
                      Nu ai susținut încă niciun test
                    </h3>

                    <p className="mt-2 text-gray-600">
                      După primul test, rezultatul
                      va apărea aici.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[760px] text-left">
                        <thead className="bg-gray-50 text-sm text-gray-500">
                          <tr>
                            <th className="px-5 py-4 font-semibold sm:px-6">
                              Test
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Scor
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Procent
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Timp
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Data
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {profile.history.map(
                            (item) => (
                              <tr
                                key={item.attemptId}
                                className="transition hover:bg-gray-50"
                              >
                                <td className="px-5 py-4 font-semibold text-gray-900 sm:px-6">
                                  {item.title}
                                </td>

                                <td className="px-5 py-4 text-center font-bold text-green-700">
                                  {item.score}/
                                  {item.totalQuestions}
                                </td>

                                <td className="px-5 py-4 text-center font-semibold text-gray-900">
                                  {Math.round(
                                    item.percentage
                                  )}
                                  %
                                </td>

                                <td className="px-5 py-4 text-center text-gray-700">
                                  {formatDuration(
                                    item.durationSeconds
                                  )}
                                </td>

                                <td className="px-5 py-4 text-center text-gray-700">
                                  {formatDate(
                                    item.completedAt
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile */}
                    <div className="divide-y divide-gray-200 md:hidden">
                      {profile.history.map(
                        (item) => (
                          <article
                            key={item.attemptId}
                            className="p-5"
                          >
                            <h3 className="font-bold text-gray-900">
                              {item.title}
                            </h3>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <MiniStat
                                label="Scor"
                                value={`${item.score}/${item.totalQuestions}`}
                              />

                              <MiniStat
                                label="Procent"
                                value={`${Math.round(
                                  item.percentage
                                )}%`}
                              />

                              <MiniStat
                                label="Timp"
                                value={formatDuration(
                                  item.durationSeconds
                                )}
                              />

                              <MiniStat
                                label="Data"
                                value={formatDate(
                                  item.completedAt
                                )}
                              />
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  </>
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
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function formatDuration(
  seconds: number | null
) {
  if (
    seconds === null ||
    !Number.isFinite(seconds)
  ) {
    return "—";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  const remainingSeconds =
    Math.max(0, seconds % 60);

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "ro-RO",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(new Date(value));
}