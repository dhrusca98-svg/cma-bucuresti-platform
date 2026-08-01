"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="border-b border-gray-200 bg-white">
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

        {/* Desktop */}
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

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg border border-gray-300 p-2 md:hidden"
          aria-label="Deschide meniul"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="border-t border-gray-200 bg-white md:hidden">
          <Link
            href="/"
            onClick={closeMenu}
            className="block px-6 py-4 text-gray-700 hover:bg-gray-100"
          >
            Acasă
          </Link>

          <Link
            href="/test"
            onClick={closeMenu}
            className="block px-6 py-4 text-gray-700 hover:bg-gray-100"
          >
            Test
          </Link>

          <Link
            href="/legile-jocului"
            onClick={closeMenu}
            className="block px-6 py-4 text-gray-700 hover:bg-gray-100"
          >
            Legile Jocului
          </Link>

          <Link
            href="/clasament"
            onClick={closeMenu}
            className="block px-6 py-4 text-gray-700 hover:bg-gray-100"
          >
            Clasament
          </Link>
        </nav>
      )}
    </header>
  );
}