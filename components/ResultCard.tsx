interface ResultCardProps {
  score: number;
  totalQuestions: number;
}

export default function ResultCard({
  score,
  totalQuestions,
}: ResultCardProps) {
  const percentage = Math.round(
    (score / totalQuestions) * 100
  );

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-700"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-green-700">
        Quiz finalizat
      </p>

      <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">
        Rezultatul tău
      </h1>

      <div className="mt-10 flex items-end justify-center gap-3">
        <span className="text-7xl font-bold text-green-700">
          {score}
        </span>

        <span className="pb-3 text-3xl font-semibold text-gray-400">
          / {totalQuestions}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-gray-900">
        {percentage}%
      </p>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
        <div className="flex justify-between border-b border-gray-200 pb-3">
          <span className="text-gray-600">
            Întrebări
          </span>

          <span className="font-semibold text-gray-900">
            {totalQuestions}
          </span>
        </div>

        <div className="mt-3 flex justify-between border-b border-gray-200 pb-3">
          <span className="text-gray-600">
            Răspunsuri corecte
          </span>

          <span className="font-semibold text-green-700">
            {score}
          </span>
        </div>

        <div className="mt-3 flex justify-between">
          <span className="text-gray-600">
            Procent
          </span>

          <span className="font-semibold text-gray-900">
            {percentage}%
          </span>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
        <p className="text-sm font-medium text-amber-800">
          Rezultatul acestui quiz a fost înregistrat. După implementarea autentificării,
          fiecare utilizator va putea completa quizul oficial o singură dată.
        </p>
      </div>

      <a
        href="/"
        className="mt-8 inline-flex rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200"
      >
        Înapoi la pagina principală
      </a>
    </div>
  );
}