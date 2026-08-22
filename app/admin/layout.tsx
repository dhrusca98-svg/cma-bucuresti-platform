"use client";

import { useRouter } from "next/navigation";
import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase/client";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const router = useRouter();

  const [isChecking, setIsChecking] =
    useState(true);

  const [isAllowed, setIsAllowed] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function verifyAdmin() {
      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          router.replace(
            "/login?next=/admin"
          );
          return;
        }

        const response = await fetch(
          "/api/admin/verifica",
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          router.replace("/");
          return;
        }

        const result =
          (await response.json()) as {
            isAdmin?: boolean;
          };

        if (!result.isAdmin) {
          router.replace("/");
          return;
        }

        if (mounted) {
          setIsAllowed(true);
        }
      } catch (error) {
        console.error(
          "Eroare verificare acces admin:",
          error
        );

        router.replace("/");
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    }

    void verifyAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
          <p className="font-medium text-gray-600">
            Se verifică accesul...
          </p>
        </div>
      </main>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}