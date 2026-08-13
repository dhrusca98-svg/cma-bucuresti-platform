"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface DraftQuestion {
  id: number;
  question: string;
  answers: string[];
  correctAnswer: number;
  explanation: string;
  law?: number;
}

interface ExcelQuestionRow {
  Question?: string;
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  Correct?: string;
  Explanation?: string;
  Law?: number | string;
}

const EMPTY_QUESTION: Omit<DraftQuestion, "id"> = {
  question: "",
  answers: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  law: undefined,
};

export default function NewTestPage() {
  const router = useRouter();

  const [title, setTitle] = useState("Test teoretic");
  const [timePerQuestion, setTimePerQuestion] = useState(90);

  const [questions, setQuestions] = useState<DraftQuestion[]>([
    {
      id: 1,
      ...EMPTY_QUESTION,
    },
  ]);

  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateQuestion(
    questionIndex: number,
    field: keyof Omit<DraftQuestion, "answers">,
    value: string | number | undefined
  ) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              [field]: value,
            }
          : question
      )
    );

    setSaveMessage("");
  }

  function updateAnswer(
    questionIndex: number,
    answerIndex: number,
    value: string
  ) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, index) => {
        if (index !== questionIndex) {
          return question;
        }

        const updatedAnswers = [...question.answers];
        updatedAnswers[answerIndex] = value;

        return {
          ...question,
          answers: updatedAnswers,
        };
      })
    );

    setSaveMessage("");
  }

  function addQuestion() {
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      {
        id: currentQuestions.length + 1,
        ...EMPTY_QUESTION,
        answers: [...EMPTY_QUESTION.answers],
      },
    ]);

    setSaveMessage("");
  }

  function removeQuestion(questionIndex: number) {
    setQuestions((currentQuestions) =>
      currentQuestions
        .filter((_, index) => index !== questionIndex)
        .map((question, index) => ({
          ...question,
          id: index + 1,
        }))
    );

    setSaveMessage("");
  }

  async function handleExcelImport(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const excelTitle = file.name
      .replace(/\.(xlsx|xls)$/i, "")
      .trim();

    if (excelTitle) {
      setTitle(excelTitle);
    }

    setImportMessage("");
    setImportError("");
    setSaveMessage("");

    try {
      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error(
          "Fișierul Excel nu conține nicio foaie."
        );
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json<ExcelQuestionRow>(
        worksheet,
        {
          defval: "",
        }
      );

      if (rows.length === 0) {
        throw new Error(
          "Fișierul Excel nu conține întrebări."
        );
      }

      const importedQuestions: DraftQuestion[] = rows.map(
        (row, index) => {
          const excelRowNumber = index + 2;

          const questionText = String(
            row.Question ?? ""
          ).trim();

          const answers = [
            String(row.A ?? "").trim(),
            String(row.B ?? "").trim(),
            String(row.C ?? "").trim(),
            String(row.D ?? "").trim(),
          ];

          const correctLetter = String(
            row.Correct ?? ""
          )
            .trim()
            .toUpperCase();

          const correctAnswer = [
            "A",
            "B",
            "C",
            "D",
          ].indexOf(correctLetter);

          const explanation = String(
            row.Explanation ?? ""
          ).trim();

          const lawText = String(row.Law ?? "").trim();

          if (!questionText) {
            throw new Error(
              `Întrebarea de pe rândul ${excelRowNumber} nu are text.`
            );
          }

          if (answers.some((answer) => !answer)) {
            throw new Error(
              `Rândul ${excelRowNumber} trebuie să conțină toate cele patru variante de răspuns.`
            );
          }

          if (correctAnswer === -1) {
            throw new Error(
              `Răspunsul corect de pe rândul ${excelRowNumber} trebuie să fie A, B, C sau D.`
            );
          }

          let law: number | undefined;

          if (lawText) {
            law = Number(lawText);

            if (
              !Number.isInteger(law) ||
              law < 1 ||
              law > 17
            ) {
              throw new Error(
                `Legea de pe rândul ${excelRowNumber} trebuie să fie un număr între 1 și 17.`
              );
            }
          }

          return {
            id: index + 1,
            question: questionText,
            answers,
            correctAnswer,
            explanation,
            law,
          };
        }
      );

      setQuestions(importedQuestions);

      setImportMessage(
        `${importedQuestions.length} ${
          importedQuestions.length === 1
            ? "întrebare a fost importată"
            : "întrebări au fost importate"
        } cu succes.`
      );
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Fișierul nu a putut fi importat."
      );
    } finally {
      event.target.value = "";
    }
  }

  function validateTest() {
    if (!title.trim()) {
      return "Completează titlul testului.";
    }

    if (
      !Number.isInteger(timePerQuestion) ||
      timePerQuestion < 10
    ) {
      return "Timpul per întrebare trebuie să fie de minimum 10 secunde.";
    }

    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];

      if (!question.question.trim()) {
        return `Completează textul întrebării ${
          index + 1
        }.`;
      }

      if (
        question.answers.some(
          (answer) => !answer.trim()
        )
      ) {
        return `Completează toate variantele de răspuns pentru întrebarea ${
          index + 1
        }.`;
      }

      if (
        question.correctAnswer < 0 ||
        question.correctAnswer >
          question.answers.length - 1
      ) {
        return `Selectează răspunsul corect pentru întrebarea ${
          index + 1
        }.`;
      }

      if (
        question.law !== undefined &&
        (question.law < 1 || question.law > 17)
      ) {
        return `Legea pentru întrebarea ${
          index + 1
        } trebuie să fie între 1 și 17.`;
      }
    }

    return null;
  }

  function buildTest() {
    return {
      id: crypto.randomUUID(),
      title: title.trim(),
      timePerQuestion,
      updatedAt: new Date().toISOString(),
      questions: questions.map((question) => ({
        ...question,
        question: question.question.trim(),
        answers: question.answers.map((answer) =>
          answer.trim()
        ),
        explanation: question.explanation.trim(),
      })),
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaveMessage("");

    const validationError = validateTest();

    if (validationError) {
      setSaveMessage(validationError);
      return;
    }

    setIsSaving(true);

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

      const preparedTest = buildTest();

      const response = await fetch(
        "/api/admin/teste/creeaza",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: preparedTest.title,
            timePerQuestion:
              preparedTest.timePerQuestion,
            questions:
              preparedTest.questions.map(
                (question) => ({
                  question: question.question,
                  answers: question.answers,
                  correctAnswer:
                    question.correctAnswer,
                  explanation:
                    question.explanation,
                  law: question.law,
                })
              ),
          }),
        }
      );

      const result = (await response.json()) as {
        success?: boolean;
        testId?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok || result.error) {
        throw new Error(
          result.error ||
            "Testul nu a putut fi salvat."
        );
      }

      localStorage.removeItem("activeTest");
      localStorage.removeItem("savedTest");

      setSaveMessage(
        result.message ||
          "Testul a fost salvat."
      );

      router.push("/admin/teste");
      router.refresh();
    } catch (error) {
      console.error(
        "Eroare la salvarea testului:",
        error
      );

      setSaveMessage(
        error instanceof Error
          ? `Salvarea a eșuat: ${error.message}`
          : "Salvarea testului a eșuat."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-5xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Creează un test nou
            </h1>

            <p className="mt-2 text-gray-600">
              Completează informațiile testului și
              adaugă întrebările manual sau prin
              importarea unui fișier Excel.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSaving
                ? "Se salvează..."
                : "Salvează testul"}
            </button>
          </div>
        </div>

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">
            Informații generale
          </h2>

          <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">
                Importă întrebările din Excel
              </span>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Fișierul trebuie să conțină coloanele:
                Question, A, B, C, D, Correct,
                Explanation și Law.
              </p>

              <p className="mt-1 text-sm text-gray-500">
                În coloana Correct scrie A, B, C sau D.
                Coloana Law este opțională.
              </p>

              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-green-700"
              />
            </label>

            {importMessage && (
              <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {importMessage}
              </p>
            )}

            {importError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {importError}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">
                Titlul testului
              </span>

              <input
                type="text"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaveMessage("");
                }}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-gray-700">
                Timp per întrebare
              </span>

              <div className="relative mt-2">
                <input
                  type="number"
                  min={10}
                  step={1}
                  value={timePerQuestion}
                  onChange={(event) => {
                    setTimePerQuestion(
                      Number(event.target.value)
                    );
                    setSaveMessage("");
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-24 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
                  secunde
                </span>
              </div>
            </label>
          </div>
        </section>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Întrebări
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Total: {questions.length}
            </p>
          </div>

          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Adaugă întrebare
          </button>
        </div>

        <section className="mt-5 space-y-6">
          {questions.map(
            (question, questionIndex) => (
              <article
                key={question.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    Întrebarea {questionIndex + 1}
                  </h2>

                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        removeQuestion(questionIndex)
                      }
                      className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                    >
                      Șterge întrebarea
                    </button>
                  )}
                </div>

                <div className="mt-6 grid gap-6">
                  <label className="block">
                    <span className="text-sm font-semibold text-gray-700">
                      Textul întrebării
                    </span>

                    <textarea
                      value={question.question}
                      onChange={(event) =>
                        updateQuestion(
                          questionIndex,
                          "question",
                          event.target.value
                        )
                      }
                      rows={4}
                      placeholder="Scrie textul întrebării..."
                      className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    />
                  </label>

                  <label className="block max-w-xs">
                    <span className="text-sm font-semibold text-gray-700">
                      Legea
                    </span>

                    <input
                      type="number"
                      min={1}
                      max={17}
                      value={question.law ?? ""}
                      onChange={(event) =>
                        updateQuestion(
                          questionIndex,
                          "law",
                          event.target.value
                            ? Number(event.target.value)
                            : undefined
                        )
                      }
                      placeholder="Opțional"
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    />
                  </label>

                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Variante de răspuns
                    </p>

                    <div className="mt-3 space-y-3">
                      {question.answers.map(
                        (answer, answerIndex) => (
                          <div
                            key={answerIndex}
                            className="flex items-center gap-3"
                          >
                            <input
                              type="radio"
                              name={`correct-answer-${question.id}`}
                              checked={
                                question.correctAnswer ===
                                answerIndex
                              }
                              onChange={() =>
                                updateQuestion(
                                  questionIndex,
                                  "correctAnswer",
                                  answerIndex
                                )
                              }
                              aria-label={`Răspunsul ${
                                answerIndex + 1
                              } este corect`}
                              className="h-5 w-5 shrink-0 accent-green-600"
                            />

                            <span className="w-6 shrink-0 text-sm font-bold text-gray-500">
                              {String.fromCharCode(
                                65 + answerIndex
                              )}
                            </span>

                            <input
                              type="text"
                              value={answer}
                              onChange={(event) =>
                                updateAnswer(
                                  questionIndex,
                                  answerIndex,
                                  event.target.value
                                )
                              }
                              placeholder={`Varianta ${String.fromCharCode(
                                65 + answerIndex
                              )}`}
                              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                            />
                          </div>
                        )
                      )}
                    </div>

                    <p className="mt-3 text-sm text-gray-500">
                      Selectează cercul din dreptul
                      răspunsului corect.
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-700">
                      Explicație
                    </span>

                    <textarea
                      value={question.explanation}
                      onChange={(event) =>
                        updateQuestion(
                          questionIndex,
                          "explanation",
                          event.target.value
                        )
                      }
                      rows={4}
                      placeholder="Explică de ce răspunsul selectat este corect..."
                      className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    />
                  </label>
                </div>
              </article>
            )
          )}
        </section>

        {saveMessage && (
          <p
            className={`mt-8 rounded-xl border px-4 py-3 text-sm font-medium ${
              saveMessage.startsWith("Testul a fost")
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {saveMessage}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={addQuestion}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Adaugă întrebare
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSaving
              ? "Se salvează..."
              : "Salvează testul"}
          </button>
        </div>
      </form>
    </main>
  );
}