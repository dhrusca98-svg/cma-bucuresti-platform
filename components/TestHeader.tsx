interface TestHeaderProps {
  currentQuestion: number;
  totalQuestions: number;
  law?: number;
}

export default function TestHeader({
  currentQuestion,
  totalQuestions,
  law,
}: TestHeaderProps) {
  return (
    <header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
            Test teoretic
          </p>

          <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
            Întrebarea {currentQuestion} din {totalQuestions}
          </h2>
        </div>

        {law !== undefined && (
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            Legea {law}
          </span>
        )}
      </div>
    </header>
  );
}