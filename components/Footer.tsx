export default function Footer() {
  return (
    <footer className="bg-sky-100">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-16">

          {/* Asociația */}
          <div>
            <h2 className="text-lg font-bold uppercase text-sky-700">
              Asociația Municipală de Fotbal București
            </h2>
          </div>

          {/* Contact */}
          <div>
            <h2 className="text-lg font-bold uppercase text-sky-700">
              Contact
            </h2>

            <div className="mt-5 space-y-3 text-sm text-sky-700">

              {/* Adresă */}
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.54 22.351.07 12.73a8.25 8.25 0 1115.86 0l-4.47 9.62a.75.75 0 01-1.36 0zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>

                <span>
                  Intrarea Baba Novac, nr. 15, sector 3, București
                </span>
              </div>

              {/* Email */}
              <a
                href="mailto:arbitraj@amfb.ro"
                className="flex items-center gap-3 transition hover:opacity-70"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4 shrink-0"
                >
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.93 5.49a3 3 0 01-3.14 0L1.5 8.67z" />
                  <path d="M22.5 6.91V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.16l9.71 5.98a1.5 1.5 0 001.58 0L22.5 6.91z" />
                </svg>

                <span>arbitraj@amfb.ro</span>
              </a>

            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}