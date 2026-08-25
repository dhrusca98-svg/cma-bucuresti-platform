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

interface QuestionStatistic {
  questionId: string;
  orderNumber: number;
  question: string;
  answers: string[];
  correctAnswer: number;
  totalAnswers: number;
  correctCount: number;
  incorrectCount: number;
  correctPercentage: number;
  answerCounts: number[];
  answerPercentages: number[];
  mostSelectedWrongAnswer:
    | number
    | null;
  mostSelectedWrongCount: number;
}

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

  questionStatistics:
    QuestionStatistic[];

  questionAnalysisSummary: {
    hardestQuestion: {
      orderNumber: number;
      correctPercentage: number;
    } | null;

    easiestQuestion: {
      orderNumber: number;
      correctPercentage: number;
    } | null;

    averageCorrectPercentage: number;
  } | null;
}

type QuestionSort =
  | "order"
  | "hardest"
  | "easiest";

const ANSWER_LABELS = [
  "A",
  "B",
  "C",
  "D",
];

export default function AdminResultsPage() {
  const [
    data,
    setData,
  ] =
    useState<DashboardResponse | null>(
      null
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    searchMissing,
    setSearchMissing,
  ] =
    useState("");

  const [
    expandedQuestion,
    setExpandedQuestion,
  ] =
    useState<string | null>(
      null
    );

  const [
    questionSort,
    setQuestionSort,
  ] =
    useState<QuestionSort>(
      "order"
    );

  useEffect(() => {
    async function loadDashboard() {
      try {
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
          !session?.access_token
        ) {
          throw new Error(
            "Trebuie să fii autentificat ca administrator."
          );
        }

        const response =
          await fetch(
            "/api/admin/rezultate",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const result =
          (await response.json()) as
            | DashboardResponse
            | {
                error: string;
              };

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

        setData(
          result
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof
          Error
            ? loadError.message
            : "Dashboard-ul nu a putut fi încărcat."
        );
      } finally {
        setIsLoading(
          false
        );
      }
    }

    loadDashboard();
  }, []);

  const filteredMissing =
    useMemo(() => {
      const query =
        searchMissing
          .trim()
          .toLowerCase();

      if (
        !query ||
        !data
      ) {
        return (
          data
            ?.missingParticipants ??
          []
        );
      }

      return data.missingParticipants.filter(
        (
          participant
        ) =>
          participant.fullName
            .toLowerCase()
            .includes(
              query
            ) ||
          participant.email
            .toLowerCase()
            .includes(
              query
            )
      );
    }, [
      data,
      searchMissing,
    ]);

  const sortedQuestionStatistics =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const questions =
        [
          ...data.questionStatistics,
        ];

      if (
        questionSort ===
        "hardest"
      ) {
        return questions.sort(
          (
            first,
            second
          ) =>
            first.correctPercentage -
            second.correctPercentage
        );
      }

      if (
        questionSort ===
        "easiest"
      ) {
        return questions.sort(
          (
            first,
            second
          ) =>
            second.correctPercentage -
            first.correctPercentage
        );
      }

      return questions.sort(
        (
          first,
          second
        ) =>
          first.orderNumber -
          second.orderNumber
      );
    }, [
      data,
      questionSort,
    ]);

  function handleExportResults() {
    if (
      !data?.activeTest
    ) {
      return;
    }

    const resultRows =
      data.results.map(
        (result) => ({
          Loc:
            result.rank,

          Nume:
            result.fullName,

          Email:
            result.email,

          Scor:
            result.score,

          Total:
            result.totalQuestions,

          Nota:
            formatGrade(
              result.grade
            ),

          Durata:
            formatDuration(
              result.durationSeconds
            ),

          Data:
            new Date(
              result.completedAt
            ).toLocaleString(
              "ro-RO"
            ),
        })
      );

    const analysisRows =
      data.questionStatistics.map(
        (
          question
        ) => ({
          "Nr. întrebare":
            question.orderNumber,

          Întrebare:
            question.question,

          "Răspuns corect":
            ANSWER_LABELS[
              question.correctAnswer
            ] ?? "",

          "Total răspunsuri":
            question.totalAnswers,

          Corecte:
            question.correctCount,

          Greșite:
            question.incorrectCount,

          "% corect":
            `${question.correctPercentage.toFixed(
              1
            )}%`,

          "A - răspunsuri":
            question.answerCounts[
              0
            ] ?? 0,

          "B - răspunsuri":
            question.answerCounts[
              1
            ] ?? 0,

          "C - răspunsuri":
            question.answerCounts[
              2
            ] ?? 0,

          "D - răspunsuri":
            question.answerCounts[
              3
            ] ?? 0,

          "Varianta A":
            question.answers[
              0
            ] ?? "",

          "Varianta B":
            question.answers[
              1
            ] ?? "",

          "Varianta C":
            question.answers[
              2
            ] ?? "",

          "Varianta D":
            question.answers[
              3
            ] ?? "",

          "Distractor principal":
            question.mostSelectedWrongAnswer ===
            null
              ? "—"
              : ANSWER_LABELS[
                  question
                    .mostSelectedWrongAnswer
                ],

          "Selecții distractor":
            question.mostSelectedWrongCount,
        })
      );

    const resultsWorksheet =
      XLSX.utils.json_to_sheet(
        resultRows
      );

    const analysisWorksheet =
      XLSX.utils.json_to_sheet(
        analysisRows
      );

    resultsWorksheet[
      "!cols"
    ] = [
      {
        wch: 8,
      },
      {
        wch: 30,
      },
      {
        wch: 35,
      },
      {
        wch: 10,
      },
      {
        wch: 10,
      },
      {
        wch: 10,
      },
      {
        wch: 12,
      },
      {
        wch: 22,
      },
    ];

    analysisWorksheet[
      "!cols"
    ] = [
      {
        wch: 14,
      },
      {
        wch: 70,
      },
      {
        wch: 16,
      },
      {
        wch: 18,
      },
      {
        wch: 12,
      },
      {
        wch: 12,
      },
      {
        wch: 12,
      },
      {
        wch: 16,
      },
      {
        wch: 16,
      },
      {
        wch: 16,
      },
      {
        wch: 16,
      },
      {
        wch: 55,
      },
      {
        wch: 55,
      },
      {
        wch: 55,
      },
      {
        wch: 55,
      },
      {
        wch: 20,
      },
      {
        wch: 18,
      },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      resultsWorksheet,
      "Rezultate"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      analysisWorksheet,
      "Analiza intrebari"
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
                Participare, rezultate și
                analiză statistică a
                întrebărilor.
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
                  {
                    data
                      .activeTest
                      .title
                  }
                </h2>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                  <span>
                    {
                      data
                        .activeTest
                        .questionCount
                    }{" "}
                    întrebări
                  </span>

                  <span>
                    {
                      data
                        .activeTest
                        .timePerQuestion
                    }{" "}
                    secunde / întrebare
                  </span>

                  <span>
                    Publicat:{" "}
                    {new Date(
                      data.activeTest
                        .createdAt
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
                    data.stats
                      .completed
                  }
                />

                <StatCard
                  label="Nu au susținut"
                  value={
                    data.stats
                      .missing
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
                    data.stats
                      .averageGrade
                  )}
                />

                <StatCard
                  label="Nota maximă"
                  value={
                    data.stats
                      .maximumGrade ===
                    null
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
                      .minimumGrade ===
                    null
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
                          data
                            .results
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
                          .length ===
                        0
                      }
                      className="rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      Export rezultate
                    </button>
                  </div>

                  {data.results
                    .length ===
                  0 ? (
                    <div className="p-10 text-center text-gray-600">
                      Nu există încă
                      rezultate.
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
                            (
                              result
                            ) => (
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
                      value={
                        searchMissing
                      }
                      onChange={(
                        event
                      ) =>
                        setSearchMissing(
                          event
                            .target
                            .value
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
                        Nu există
                        rezultate pentru
                        căutarea curentă.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredMissing.map(
                          (
                            participant
                          ) => (
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
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.grade
                        }
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <p className="text-lg font-bold text-gray-900">
                          Nota{" "}
                          {formatGrade(
                            item.grade
                          )}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {
                            item.count
                          }{" "}
                          {item.count ===
                          1
                            ? "participant"
                            : "participanți"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </section>

              <section className="mt-8">
                <div className="mb-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-400">
                    Analiză
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-white">
                    Analiza întrebărilor
                  </h2>

                  <p className="mt-2 text-gray-300">
                    Vezi gradul de
                    dificultate și
                    distribuția
                    răspunsurilor pentru
                    fiecare întrebare.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <AnalysisCard
                    label="Cea mai greșită"
                    value={
                      data
                        .questionAnalysisSummary
                        ?.hardestQuestion
                        ? `Întrebarea ${data.questionAnalysisSummary.hardestQuestion.orderNumber}`
                        : "—"
                    }
                    secondary={
                      data
                        .questionAnalysisSummary
                        ?.hardestQuestion
                        ? `${formatPercentage(
                            data
                              .questionAnalysisSummary
                              .hardestQuestion
                              .correctPercentage
                          )} corect`
                        : "Fără răspunsuri"
                    }
                  />

                  <AnalysisCard
                    label="Cea mai ușoară"
                    value={
                      data
                        .questionAnalysisSummary
                        ?.easiestQuestion
                        ? `Întrebarea ${data.questionAnalysisSummary.easiestQuestion.orderNumber}`
                        : "—"
                    }
                    secondary={
                      data
                        .questionAnalysisSummary
                        ?.easiestQuestion
                        ? `${formatPercentage(
                            data
                              .questionAnalysisSummary
                              .easiestQuestion
                              .correctPercentage
                          )} corect`
                        : "Fără răspunsuri"
                    }
                  />

                  <AnalysisCard
                    label="Media răspunsurilor corecte"
                    value={
                      data
                        .questionAnalysisSummary
                        ? formatPercentage(
                            data
                              .questionAnalysisSummary
                              .averageCorrectPercentage
                          )
                        : "—"
                    }
                    secondary="toate întrebările"
                  />
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Statistici per
                        întrebare
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Click pe o
                        întrebare pentru
                        analiza completă.
                      </p>
                    </div>

                    <select
                      value={
                        questionSort
                      }
                      onChange={(
                        event
                      ) =>
                        setQuestionSort(
                          event
                            .target
                            .value as QuestionSort
                        )
                      }
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    >
                      <option value="order">
                        Ordinea testului
                      </option>

                      <option value="hardest">
                        Cele mai greșite
                      </option>

                      <option value="easiest">
                        Cele mai ușoare
                      </option>
                    </select>
                  </div>

                  {sortedQuestionStatistics.length ===
                  0 ? (
                    <div className="p-10 text-center text-gray-600">
                      Nu există încă
                      suficiente date
                      pentru analiza
                      întrebărilor.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] text-left">
                        <thead className="bg-gray-50 text-sm text-gray-500">
                          <tr>
                            <th className="px-5 py-4 text-center font-semibold sm:px-6">
                              #
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Întrebare
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Corecte
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              Greșite
                            </th>

                            <th className="px-5 py-4 text-center font-semibold">
                              % corect
                            </th>

                            {ANSWER_LABELS.map(
                              (
                                label
                              ) => (
                                <th
                                  key={
                                    label
                                  }
                                  className="px-4 py-4 text-center font-semibold"
                                >
                                  {
                                    label
                                  }
                                </th>
                              )
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {sortedQuestionStatistics.map(
                            (
                              question
                            ) => {
                              const isExpanded =
                                expandedQuestion ===
                                question.questionId;

                              return (
                                <>
                                  <tr
                                    key={
                                      question.questionId
                                    }
                                    onClick={() =>
                                      setExpandedQuestion(
                                        isExpanded
                                          ? null
                                          : question.questionId
                                      )
                                    }
                                    className="cursor-pointer transition hover:bg-gray-50"
                                  >
                                    <td className="px-5 py-4 text-center sm:px-6">
                                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                                        {
                                          question.orderNumber
                                        }
                                      </span>
                                    </td>

                                    <td className="max-w-[440px] px-5 py-4">
                                      <p className="line-clamp-2 font-semibold text-gray-900">
                                        {
                                          question.question
                                        }
                                      </p>

                                      <p className="mt-1 text-xs font-medium text-green-700">
                                        {isExpanded
                                          ? "Ascunde detaliile"
                                          : "Vezi detaliile"}
                                      </p>
                                    </td>

                                    <td className="px-5 py-4 text-center font-semibold text-green-700">
                                      {
                                        question.correctCount
                                      }
                                    </td>

                                    <td className="px-5 py-4 text-center font-semibold text-red-600">
                                      {
                                        question.incorrectCount
                                      }
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                      <PercentageBadge
                                        value={
                                          question.correctPercentage
                                        }
                                      />
                                    </td>

                                    {question.answerCounts.map(
                                      (
                                        count,
                                        index
                                      ) => (
                                        <td
                                          key={
                                            index
                                          }
                                          className="px-4 py-4 text-center"
                                        >
                                          <span
                                            className={
                                              index ===
                                              question.correctAnswer
                                                ? "font-bold text-green-700"
                                                : "text-gray-700"
                                            }
                                          >
                                            {
                                              count
                                            }

                                            {index ===
                                              question.correctAnswer &&
                                              " ✓"}
                                          </span>
                                        </td>
                                      )
                                    )}
                                  </tr>

                                  {isExpanded && (
                                    <tr
                                      key={`${question.questionId}-details`}
                                    >
                                      <td
                                        colSpan={
                                          9
                                        }
                                        className="bg-gray-50 px-5 py-6 sm:px-8"
                                      >
                                        <QuestionDetails
                                          question={
                                            question
                                          }
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="mt-10 rounded-2xl border border-white/15 bg-white/95 p-10 text-center shadow-sm backdrop-blur-sm">
              <h2 className="text-xl font-bold text-gray-900">
                Nu există un test
                activ
              </h2>

              <p className="mt-2 text-gray-600">
                Publică un test pentru
                a vedea rezultatele.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function QuestionDetails({
  question,
}: {
  question: QuestionStatistic;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
          Întrebarea{" "}
          {
            question.orderNumber
          }
        </span>

        <span className="text-sm text-gray-500">
          {
            question.totalAnswers
          }{" "}
          răspunsuri
        </span>
      </div>

      <p className="mt-4 max-w-4xl text-lg font-bold leading-7 text-gray-900">
        {
          question.question
        }
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {question.answers.map(
          (
            answer,
            index
          ) => {
            const isCorrect =
              index ===
              question.correctAnswer;

            const count =
              question.answerCounts[
                index
              ] ?? 0;

            const percentage =
              question.answerPercentages[
                index
              ] ?? 0;

            return (
              <div
                key={
                  index
                }
                className={`rounded-2xl border p-5 ${
                  isCorrect
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isCorrect
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {
                      ANSWER_LABELS[
                        index
                      ]
                    }
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`font-medium ${
                          isCorrect
                            ? "text-green-900"
                            : "text-gray-900"
                        }`}
                      >
                        {
                          answer
                        }
                      </p>

                      {isCorrect && (
                        <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
                          Corect
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {
                            count
                          }{" "}
                          {count ===
                          1
                            ? "participant"
                            : "participanți"}
                        </span>

                        <span className="font-semibold text-gray-900">
                          {formatPercentage(
                            percentage
                          )}
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={
                            isCorrect
                              ? "h-full rounded-full bg-green-600"
                              : "h-full rounded-full bg-gray-500"
                          }
                          style={{
                            width:
                              `${Math.min(
                                Math.max(
                                  percentage,
                                  0
                                ),
                                100
                              )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>

      {question.mostSelectedWrongAnswer !==
        null && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">
            Distractor principal:{" "}
            {
              ANSWER_LABELS[
                question
                  .mostSelectedWrongAnswer
              ]
            }{" "}
            — ales de{" "}
            {
              question.mostSelectedWrongCount
            }{" "}
            {question.mostSelectedWrongCount ===
            1
              ? "participant"
              : "participanți"}
            .
          </p>
        </div>
      )}
    </div>
  );
}

function PercentageBadge({
  value,
}: {
  value: number;
}) {
  let className =
    "bg-green-100 text-green-800";

  if (
    value < 50
  ) {
    className =
      "bg-red-100 text-red-700";
  } else if (
    value < 70
  ) {
    className =
      "bg-amber-100 text-amber-800";
  }

  return (
    <span
      className={`inline-flex min-w-[72px] justify-center rounded-full px-3 py-1.5 text-sm font-bold ${className}`}
    >
      {formatPercentage(
        value
      )}
    </span>
  );
}

function AnalysisCard({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 p-5 shadow-sm backdrop-blur-sm sm:p-6">
      <p className="text-sm font-medium text-gray-500">
        {
          label
        }
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {
          value
        }
      </p>

      <p className="mt-1 text-sm font-medium text-green-700">
        {
          secondary
        }
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
      <p className="text-2xl font-bold text-gray-900 sm:text-3xl">
        {
          value
        }
      </p>

      <p className="mt-1 text-sm text-gray-500">
        {
          label
        }
      </p>
    </div>
  );
}

function formatGrade(
  value: number
) {
  return value.toLocaleString(
    "ro-RO",
    {
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  );
}

function formatPercentage(
  value: number
) {
  return `${value.toLocaleString(
    "ro-RO",
    {
      minimumFractionDigits:
        1,
      maximumFractionDigits:
        1,
    }
  )}%`;
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
    .padStart(
      2,
      "0"
    )}`;
}