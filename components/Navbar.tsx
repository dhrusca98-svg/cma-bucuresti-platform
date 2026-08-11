"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { supabase } from "@/lib/supabase/client";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  const [authLoading, setAuthLoading] =
    useState(true);

  function closeMenu() {
    setMenuOpen(false);
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(Boolean(session));
      setAuthLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(Boolean(session));
        setAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();

    setIsAuthenticated(false);
    closeMenu();

    window.location.href = "/";
  }

  return (
    <>
      <header className="relative z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">

          {/* MOBILE - Hamburger stânga */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-gray-300 p-2 transition hover:bg-gray-50 md:hidden"
            aria-label="Deschide meniul"
            aria-expanded={menuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          {/* DESKTOP - Logo stânga */}
          <Link
            href="/"
            className="hidden items-center md:flex"
          >
            <Image
              src="/images/amfb-logo.png"
              alt="Logo AMFB"
              width={52}
              height={52}
              priority
              className="h-12 w-12 object-contain"
            />
          </Link>

          {/* DESKTOP - Meniu */}
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

            {!authLoading &&
              (isAuthenticated ? (
                <>
                  <Link
                    href="/profil"
                    className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
                  >
                    Profilul meu
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                  >
                    Deconectare
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
                >
                  Login
                </Link>
              ))}
          </nav>

          {/* MOBILE - Logo dreapta */}
          <Link
            href="/"
            className="flex items-center md:hidden"
          >
            <Image
              src="/images/amfb-logo.png"
              alt="Logo AMFB"
              width={52}
              height={52}
              priority
              className="h-12 w-12 object-contain"
            />
          </Link>
        </div>
      </header>

      {/* Overlay mobile */}
      <div
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer mobile */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[82%] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          menuOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center"
          >
            <Image
              src="/images/amfb-logo.png"
              alt="Logo AMFB"
              width={52}
              height={52}
              className="h-12 w-12 object-contain"
            />
          </Link>

          <button
            type="button"
            onClick={closeMenu}
            className="rounded-lg border border-gray-300 p-2 transition hover:bg-gray-50"
            aria-label="Închide meniul"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="px-3 py-4">
          <MobileLink
            href="/"
            label="Acasă"
            onClick={closeMenu}
          />

          <MobileLink
            href="/test"
            label="Test"
            onClick={closeMenu}
          />

          <MobileLink
            href="/legile-jocului"
            label="Legile Jocului"
            onClick={closeMenu}
          />

          <MobileLink
            href="/clasament"
            label="Clasament"
            onClick={closeMenu}
          />

          {!authLoading && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <Link
                    href="/profil"
                    onClick={closeMenu}
                    className="block w-full rounded-xl bg-green-600 px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-green-700"
                  >
                    Profilul meu
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-base font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Deconectare
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="block w-full rounded-xl bg-green-600 px-4 py-4 text-center text-base font-semibold text-white transition hover:bg-green-700"
                >
                  Login
                </Link>
              )}
            </div>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 px-5 py-4">
          <p className="text-xs leading-5 text-gray-400">
            Comisia Municipală a Arbitrilor București
          </p>
        </div>
      </aside>
    </>
  );
}

interface MobileLinkProps {
  href: string;
  label: string;
  onClick: () => void;
}

function MobileLink({
  href,
  label,
  onClick,
}: MobileLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-xl px-4 py-4 text-base font-semibold text-gray-800 transition hover:bg-green-50 hover:text-green-700"
    >
      {label}
    </Link>
  );
}