"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase/client";

interface AdminTest {
  id: string;
  title: string;
  timePerQuestion: number;
  isActive: boolean;
  createdAt: string;
  questionCount: number;
  attemptCount: number;
}

export default function AdminTestsPage() {
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Trebuie să fii autentificat ca administrator.");
      }

      const response = await fetch("/api/admin/teste/publica", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      const result = (await response.json()) as { tests?: AdminTest[]; error?: string };
      if (!response.ok || result.error) {
        throw new Error(result.error || "Testele nu au putut fi încărcate.");
      }

      setTests(result.tests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Testele nu au putut fi încărcate.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  async function handlePublish(test: AdminTest) {
    if (test.isActive) return;

    const confirmed = window.confirm(
      `Ești sigur că vrei să publici testul „${test.title}”?\n\nTestul activ în acest moment va fi dezactivat.`
    );
    if (!confirmed) return;

    setPublishingId(test.id);
    setError("");
    setSuccess("");

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Trebuie să fii autentificat ca administrator.");
      }

      const response = await fetch("/api/admin/teste/publica", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ testId: test.id }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error || "Testul nu a putut fi publicat.");
      }

      setSuccess(result.message || "Testul a fost publicat.");
      await loadTests();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Testul nu a putut fi publicat.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">Administrare</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Teste</h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              Vezi toate testele create și alege testul care trebuie afișat pe platformă.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/admin" className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-100">
              Înapoi la administrare
            </Link>
            <Link href="/admin/teste/nou" className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700">
              Creează test nou
            </Link>
          </div>
        </div>

        {error && <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
        {success && <div className="mt-8 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{success}</div>}

        {isLoading ? (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <p className="text-gray-600">Se încarcă testele...</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <h2 className="text-xl font-bold text-gray-900">Nu există teste</h2>
            <p className="mt-2 text-gray-600">Creează primul test pentru a-l putea publica.</p>
            <Link href="/admin/teste/nou" className="mt-6 inline-flex rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700">
              Creează test
            </Link>
          </div>
        ) : (
          <section className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold text-gray-900">Toate testele</h2>
              <p className="mt-1 text-sm text-gray-500">
                {tests.length} {tests.length === 1 ? "test creat" : "teste create"}
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {tests.map((test) => (
                <article key={test.id} className="flex flex-col gap-5 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{test.title}</h3>
                      {test.isActive ? (
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Activ</span>
                      ) : (
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">Inactiv</span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                      <span>{test.questionCount} {test.questionCount === 1 ? "întrebare" : "întrebări"}</span>
                      <span>{test.timePerQuestion} secunde / întrebare</span>
                      <span>{test.attemptCount} {test.attemptCount === 1 ? "rezultat" : "rezultate"}</span>
                      <span>Creat la {new Date(test.createdAt).toLocaleDateString("ro-RO")}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href="/test" className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                      Previzualizează
                    </Link>

                    {test.isActive ? (
                      <button type="button" disabled className="cursor-not-allowed rounded-xl bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-700">
                        Test activ
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublish(test)}
                        disabled={publishingId !== null}
                        className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {publishingId === test.id ? "Se publică..." : "Publică"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}