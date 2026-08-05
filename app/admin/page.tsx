import Link from "next/link";

const adminSections = [
  {
    title: "Teste",
    description:
      "Vezi toate testele create, publică testul activ și verifică istoricul testelor.",
    href: "/admin/teste",
    action: "Vezi testele",
  },
  {
    title: "Creează test",
    description:
      "Adaugă manual întrebările sau importă un fișier Excel și publică testul.",
    href: "/admin/teste/nou",
    action: "Creează test",
  },
  {
    title: "Participanți",
    description:
      "Importă și sincronizează lista arbitrilor și gestionează conturile de autentificare.",
    href: "/admin/participanti",
    action: "Gestionează participanții",
  },
  {
    title: "Rezultate",
    description:
      "Vezi cine a susținut testul activ, scorurile, participarea și statisticile.",
    href: "/admin/rezultate",
    action: "Vezi rezultatele",
  },
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Panou de administrare
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Administrează testele, participanții și rezultatele platformei.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Înapoi la homepage
          </Link>
        </div>

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          {adminSections.map((section) => (
            <article
              key={section.href}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-bold text-gray-900">
                {section.title}
              </h2>

              <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">
                {section.description}
              </p>

              <Link
                href={section.href}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 sm:w-auto"
              >
                {section.action}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-bold text-green-900">
            Acces rapid
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/test"
              className="rounded-xl border border-green-300 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Vezi testul activ
            </Link>

            <Link
              href="/clasament"
              className="rounded-xl border border-green-300 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Vezi clasamentul
            </Link>

            <Link
              href="/legile-jocului"
              className="rounded-xl border border-green-300 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Legile Jocului
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}