import Navbar from "@/components/Navbar";
import FeatureCard from "@/components/FeatureCard";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-7xl px-6 py-20">
        <section className="text-center">
          <h1 className="text-5xl font-bold text-gray-900">
            Comisia Municipală a Arbitrilor București
          </h1>

          <p className="mt-6 text-xl text-gray-600">
            Platformă oficială de pregătire și evaluare a arbitrilor
          </p>

          <a
  href="/quiz"
  className="mt-10 inline-block rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-green-700"
>
  Începe Quiz-ul
</a>
        </section>

        <section className="mt-20 grid gap-8 md:grid-cols-3">
          <FeatureCard
            icon="⚽"
            title="Quiz-ul săptămânii"
            description="10 întrebări • Explicații după fiecare răspuns"
            buttonText="Începe"
          />

          <FeatureCard
            icon="📖"
            title="Biblioteca Legilor Jocului"
            description="Studiază toate Legile Jocului"
            buttonText="Explorează"
          />

          <FeatureCard
            icon="🏆"
            title="Clasament"
            description="Vezi cei mai activi arbitri"
            buttonText="Vezi"
          />
        </section>
      </main>
    </>
  );
}