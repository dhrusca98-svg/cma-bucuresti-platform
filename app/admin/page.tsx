import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Teste teoretice
            </h1>

            <p className="mt-2 text-gray-600">
              Creează, verifică și publică testele disponibile pe platformă.
            </p>
          </div>

          <Link
            href="/admin/teste/nou"
            className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200"
          >
            Creează test
          </Link>
        </div>

        <section className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-lg font-bold text-gray-900">
              Teste disponibile
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            <article className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    Test teoretic nr. 1
                  </h3>

                  <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    Activ
                  </span>
                </div>

                <p className="mt-2 text-sm text-gray-600">
                  10 întrebări • 90 secunde per întrebare
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/test"
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Previzualizează
                </Link>

                <button
                  type="button"
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Editează
                </button>
              </div>
            </article>
          </div>
        </section>

        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <h2 className="text-lg font-bold text-gray-900">
            Următorul pas
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
            Vom conecta butonul „Creează test” la un formular în care vei
            putea introduce întrebările sau încărca un fișier Excel.
          </p>
        </div>
      </div>
    </main>
  );
}