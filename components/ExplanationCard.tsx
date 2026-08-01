interface ExplanationCardProps {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
}

export default function ExplanationCard({
  isCorrect,
  correctAnswer,
  explanation,
}: ExplanationCardProps) {
  const correctAnswerLetter = String.fromCharCode(
    65 + correctAnswer
  );

  return (
    <div
      className={`mt-8 rounded-2xl border p-5 sm:p-6 ${
        isCorrect
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
            isCorrect
              ? "bg-green-600 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {isCorrect ? "✓" : "×"}
        </div>

        <div className="flex-1">
          <p
            className={`text-sm font-semibold uppercase tracking-wide ${
              isCorrect ? "text-green-700" : "text-red-700"
            }`}
          >
            Rezultat
          </p>

          <h2
            className={`mt-1 text-2xl font-bold ${
              isCorrect ? "text-green-800" : "text-red-800"
            }`}
          >
            {isCorrect
              ? "Răspuns corect"
              : "Răspuns greșit"}
          </h2>

          {!isCorrect && (
            <p className="mt-2 leading-relaxed text-gray-700">
              Răspunsul corect este varianta{" "}
              <span className="font-bold text-gray-900">
                {correctAnswerLetter}
              </span>
              .
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/80 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
          Explicație
        </p>

        <p className="mt-3 whitespace-pre-line leading-7 text-gray-700">
          {explanation}
        </p>
      </div>
    </div>
  );
}