"use client";

import { useState } from "react";
import { quiz1 } from "@/data/quiz1";

export default function QuizPage() {
  const question = quiz1[0];

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const isCorrect = selectedAnswer === question.correctAnswer;

  function handleConfirm() {
    if (selectedAnswer === null) return;

    setIsConfirmed(true);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">
            Întrebarea 1 din 10
          </p>

          <p className="text-sm font-medium text-green-700">
            Legea 8
          </p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-[10%] rounded-full bg-green-600" />
        </div>

        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          {question.question}
        </h1>

        <div className="mt-8 space-y-4">
          {question.answers.map((answer, index) => {
            const isSelected = selectedAnswer === index;

            let answerStyle =
              "border-gray-200 bg-white hover:border-green-400 hover:bg-green-50";

            if (isSelected && !isConfirmed) {
              answerStyle = "border-green-600 bg-green-50";
            }

            if (isConfirmed && index === question.correctAnswer) {
              answerStyle = "border-green-600 bg-green-50";
            }

            if (
              isConfirmed &&
              isSelected &&
              index !== question.correctAnswer
            ) {
              answerStyle = "border-red-500 bg-red-50";
            }

            return (
              <button
                key={answer}
                type="button"
                disabled={isConfirmed}
                onClick={() => setSelectedAnswer(index)}
                className={`w-full rounded-xl border-2 p-4 text-left transition ${answerStyle}`}
              >
                <span className="mr-3 font-bold">
                  {String.fromCharCode(65 + index)}.
                </span>

                {answer}
              </button>
            );
          })}
        </div>

        {!isConfirmed ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedAnswer === null}
            className="mt-8 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Confirmă răspunsul
          </button>
        ) : (
          <div
            className={`mt-8 rounded-2xl border p-6 ${
              isCorrect
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <h2
              className={`text-2xl font-bold ${
                isCorrect ? "text-green-700" : "text-red-700"
              }`}
            >
              {isCorrect ? "Corect!" : "Greșit"}
            </h2>

            {!isCorrect && (
              <p className="mt-2 font-medium text-gray-800">
                Răspunsul corect este varianta{" "}
                {String.fromCharCode(65 + question.correctAnswer)}.
              </p>
            )}

            <div className="mt-5 rounded-xl bg-white p-5">
              <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
                Explicație
              </p>

              <p className="mt-2 leading-7 text-gray-700">
                {question.explanation}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}