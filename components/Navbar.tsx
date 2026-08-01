import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/amfb-logo.png"
            alt="Logo AMFB"
            width={52}
            height={52}
            priority
            className="h-12 w-12 object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-gray-700 md:flex">
          <Link
            href="/"
            className="transition hover:text-green-700"
          >
            Acasă
          </Link>

          <Link
            href="/test"
            className="transition hover:text-green-700"
          >
            Test
          </Link>

          <Link
            href="/legile-jocului"
            className="transition hover:text-green-700"
          >
            Legile Jocului
          </Link>

          <Link
            href="/clasament"
            className="transition hover:text-green-700"
          >
            Clasament
          </Link>
        </nav>

        <Link
          href="/test"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 md:hidden"
        >
          Test
        </Link>
      </div>
    </header>
  );
}