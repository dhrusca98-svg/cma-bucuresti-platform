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

  let answerStyle =
    "border-gray-200 bg-white hover:border-green-400 hover:bg-green-50";

  if (isSelected && !isConfirmed) {
    answerStyle = "border-green-600 bg-green-50";
  }

  if (isConfirmed && index === correctAnswer) {
    answerStyle = "border-green-600 bg-green-50";
  }

  if (
    isConfirmed &&
    isSelected &&
    index !== correctAnswer
  ) {
    answerStyle = "border-red-500 bg-red-50";
  }

  return (
    <button
      type="button"
      disabled={isConfirmed}
      onClick={() => onSelect(index)}
      className={`w-full rounded-xl border-2 p-4 text-left transition ${answerStyle}`}
    >
      <span className="mr-3 font-bold">
        {String.fromCharCode(65 + index)}.
      </span>

      {answer}
    </button>
  );
}