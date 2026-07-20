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
  return (
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
          {String.fromCharCode(65 + correctAnswer)}.
        </p>
      )}

      <div className="mt-5 rounded-xl bg-white p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-gray-500">
          Explicație
        </p>

        <p className="mt-2 leading-7 text-gray-700">
          {explanation}
        </p>
      </div>
    </div>
  );
}