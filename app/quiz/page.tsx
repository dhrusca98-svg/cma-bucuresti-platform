"use client";

import { useState } from "react";
import AnswerButton from "@/components/AnswerButton";
import { quiz1 } from "@/data/quiz1";
import QuizHeader from "@/components/QuizHeader";

export default function QuizPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const question = quiz1[currentQuestionIndex];
  const isCorrect = selectedAnswer === question.correctAnswer;

  function handleConfirm() {
    if (selectedAnswer === null) return;

    if (selectedAnswer === question.correctAnswer) {
      setScore((previousScore) => previousScore + 1);
    }

    setIsConfirmed(true);
  }

  function handleNextQuestion() {
    const isLastQuestion = currentQuestionIndex === quiz1.length - 1;

    if (isLastQuestion) {
      setIsFinished(true);
      return;
    }

    setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
    setSelectedAnswer(null);
    setIsConfirmed(false);
  }

  function handleRestart() {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsConfirmed(false);
    setScore(0);
    setIsFinished(false);
  }

  if (isFinished) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-700">
            Quiz finalizat
          </p>

          <h1 className="mt-4 text-4xl font-bold text-gray-900">
            Scorul tău
          </h1>

          <p className="mt-6 text-6xl font-bold text-green-700">
            {score} / {quiz1.length}
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Reîncepe quiz-ul
            </button>

            <a
              href="/"
              className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Înapoi la pagina principală
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <QuizHeader
  currentQuestion={currentQuestionIndex + 1}
  totalQuestions={quiz1.length}
  law={question.law}
/>

        <h1 className="mt-8 text-3xl font-bold text-gray-900">
          {question.question}
        </h1>

        <div className="mt-8 space-y-4">
  {question.answers.map((answer, index) => (
    <AnswerButton
      key={answer}
      answer={answer}
      index={index}
      selectedAnswer={selectedAnswer}
      correctAnswer={question.correctAnswer}
      isConfirmed={isConfirmed}
      onSelect={setSelectedAnswer}
    />
  ))}
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
          <>
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

            <button
              type="button"
              onClick={handleNextQuestion}
              className="mt-6 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              {currentQuestionIndex === quiz1.length - 1
                ? "Vezi scorul"
                : "Următoarea întrebare"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}