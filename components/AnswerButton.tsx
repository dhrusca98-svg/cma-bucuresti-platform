interface AnswerButtonProps {
  answer: string;
  index: number;
  selectedAnswer: number | null;
  correctAnswer: number;
  isConfirmed: boolean;
  onSelect: (index: number) => void;
}

export default function AnswerButton({
  answer,
  index,
  selectedAnswer,
  correctAnswer,
  isConfirmed,
  onSelect,
}: AnswerButtonProps) {
  const isSelected = selectedAnswer === index;
  const isCorrectAnswer = index === correctAnswer;
  const isWrongSelected =
    isConfirmed && isSelected && !isCorrectAnswer;

  let buttonStyle =
    "border-gray-200 bg-white text-gray-800 hover:border-green-400 hover:bg-green-50";

  let letterStyle =
    "border-gray-200 bg-gray-50 text-gray-600";

  let statusText = "";

  if (isSelected && !isConfirmed) {
    buttonStyle =
      "border-green-600 bg-green-50 text-gray-900 ring-2 ring-green-100";

    letterStyle =
      "border-green-600 bg-green-600 text-white";
  }

  if (isConfirmed && isCorrectAnswer) {
    buttonStyle =
      "border-green-600 bg-green-50 text-gray-900";

    letterStyle =
      "border-green-600 bg-green-600 text-white";

    statusText = "Corect";
  }

  if (isWrongSelected) {
    buttonStyle =
      "border-red-500 bg-red-50 text-gray-900";

    letterStyle =
      "border-red-500 bg-red-500 text-white";

    statusText = "Răspunsul tău";
  }

  return (
    <button
      type="button"
      disabled={isConfirmed}
      onClick={() => onSelect(index)}
      aria-pressed={isSelected}
      className={`group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition duration-200 sm:p-5 ${buttonStyle} ${
        isConfirmed
          ? "cursor-default"
          : "cursor-pointer active:scale-[0.99]"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 font-bold transition ${letterStyle}`}
      >
        {String.fromCharCode(65 + index)}
      </span>

      <span className="flex-1 text-base font-medium leading-relaxed sm:text-lg">
        {answer}
      </span>

      {statusText && (
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${
            isWrongSelected
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {statusText}
        </span>
      )}
    </button>
  );
}