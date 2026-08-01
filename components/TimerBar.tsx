interface TimerBarProps {
  timeLeft: number;
  totalTime: number;
}

export default function TimerBar({
  timeLeft,
  totalTime,
}: TimerBarProps) {
  const percentage = Math.max(
    0,
    Math.min(100, (timeLeft / totalTime) * 100)
  );

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  let barColor = "bg-green-600";
  let textColor = "text-green-700";
  let backgroundColor = "bg-green-50";
  let pulseClass = "";

  if (timeLeft <= 30 && timeLeft > 10) {
    barColor = "bg-yellow-500";
    textColor = "text-yellow-700";
    backgroundColor = "bg-yellow-50";
  }

  if (timeLeft <= 10) {
    barColor = "bg-red-600";
    textColor = "text-red-700";
    backgroundColor = "bg-red-50";
    pulseClass = timeLeft > 0 ? "animate-pulse" : "";
  }

  return (
    <div
      className={`mt-6 rounded-2xl border border-gray-200 p-5 transition-colors duration-300 ${backgroundColor}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            Timp rămas
          </p>

          <p className="mt-1 text-sm text-gray-600">
            Răspunsul se confirmă automat la expirarea timpului.
          </p>
        </div>

        <span
          className={`rounded-xl bg-white px-4 py-2 font-mono text-2xl font-bold shadow-sm ${textColor} ${pulseClass}`}
        >
          {formattedTime}
        </span>
      </div>

      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalTime}
        aria-valuenow={timeLeft}
      >
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}