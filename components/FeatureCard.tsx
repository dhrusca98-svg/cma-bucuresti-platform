interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
}

export default function FeatureCard({
  icon,
  title,
  description,
  buttonText,
}: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="text-4xl">{icon}</div>

      <h3 className="mt-4 text-2xl font-bold">
        {title}
      </h3>

      <p className="mt-3 text-gray-600">
        {description}
      </p>

      <button className="mt-6 rounded-xl bg-green-600 px-5 py-3 text-white transition hover:bg-green-700">
        {buttonText}
      </button>
    </div>
  );
}