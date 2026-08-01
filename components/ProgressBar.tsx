interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({
  current,
  total,
}: ProgressBarProps) {
  const percentage = Math.max(
    0,
    Math.min(100, (current / total) * 100)
  );

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-label="Progres quiz"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-green-600 transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}