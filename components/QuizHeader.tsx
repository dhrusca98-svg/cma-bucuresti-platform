interface QuizHeaderProps {
  currentQuestion: number;
  totalQuestions: number;
  law: number;
}

export default function QuizHeader({
  currentQuestion,
  totalQuestions,
  law,
}: QuizHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          Întrebarea {currentQuestion} din {totalQuestions}
        </p>

        <p className="text-sm font-medium text-green-700">
          Legea {law}
        </p>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-green-600 transition-all"
          style={{
            width: `${(currentQuestion / totalQuestions) * 100}%`,
          }}
        />
      </div>
    </>
  );
}