"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";
import * as XLSX from "xlsx";

import { supabase } from "@/lib/supabase/client";

interface ParsedParticipant {
  firstName: string;
  lastName: string;
  email: string;
}

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
}

interface AccountCreationResult {
  created: number;
  linkedExisting: number;
  failed: number;
  remaining: number;
  errors: string[];
}

interface ActivationUser {
  participantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  hasAccount: boolean;
  activated: boolean;
  lastSignInAt: string | null;
}

interface ActivationStats {
  total: number;
  withAccount: number;
  activated: number;
  notActivated: number;
  withoutAccount: number;
}

interface ActivationListResponse {
  users: ActivationUser[];
  stats: ActivationStats;
}

interface SendEmailResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
  message: string;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getCellValue(
  row: Record<string, unknown>,
  expectedHeader: string
) {
  const matchingEntry = Object.entries(row).find(
    ([header]) =>
      normalizeHeader(header) === expectedHeader
  );

  return String(matchingEntry?.[1] ?? "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ParticipantsAdminPage() {
  const [fileName, setFileName] = useState("");
  const [participants, setParticipants] =
    useState<ParsedParticipant[]>([]);

  const [importError, setImportError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] =
    useState<SyncResult | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  const [isCreatingAccounts, setIsCreatingAccounts] =
    useState(false);

  const [accountError, setAccountError] =
    useState("");

  const [accountResult, setAccountResult] =
    useState<AccountCreationResult | null>(null);

  const [activationUsers, setActivationUsers] =
    useState<ActivationUser[]>([]);

  const [activationStats, setActivationStats] =
    useState<ActivationStats | null>(null);

  const [isLoadingActivations, setIsLoadingActivations] =
    useState(true);

  const [activationError, setActivationError] =
    useState("");

  const [selectedActivationIds, setSelectedActivationIds] =
    useState<string[]>([]);

  const [isSendingActivation, setIsSendingActivation] =
    useState(false);

  const [sendingParticipantId, setSendingParticipantId] =
    useState<string | null>(null);

  const [sendResult, setSendResult] =
    useState<SendEmailResult | null>(null);

  async function loadActivationUsers() {
    setIsLoadingActivations(true);
    setActivationError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response = await fetch(
        "/api/admin/participanti/invitatii",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = (await response.json()) as
        | ActivationListResponse
        | { error: string };

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? result.error
            : "Lista conturilor nu a putut fi încărcată."
        );
      }

      setActivationUsers(result.users);
      setActivationStats(result.stats);

      setSelectedActivationIds((current) =>
        current.filter((participantId) =>
          result.users.some(
            (user) =>
              user.participantId === participantId &&
              user.hasAccount &&
              !user.activated
          )
        )
      );
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? error.message
          : "Lista conturilor nu a putut fi încărcată."
      );
    } finally {
      setIsLoadingActivations(false);
    }
  }

  useEffect(() => {
    void loadActivationUsers();
  }, []);

  function toggleActivationSelection(
    participantId: string
  ) {
    setSelectedActivationIds((current) =>
      current.includes(participantId)
        ? current.filter(
            (id) => id !== participantId
          )
        : [...current, participantId]
    );
  }

  function selectAllUnactivated() {
    setSelectedActivationIds(
      activationUsers
        .filter(
          (user) =>
            user.hasAccount &&
            !user.activated
        )
        .map((user) => user.participantId)
    );
  }

  async function sendAccountEmail(options: {
    mode: "activation" | "reset";
    participantIds?: string[];
    allUnactivated?: boolean;
    participantIdForLoading?: string;
  }) {
    setActivationError("");
    setSendResult(null);

    if (options.participantIdForLoading) {
      setSendingParticipantId(
        options.participantIdForLoading
      );
    } else {
      setIsSendingActivation(true);
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response = await fetch(
        "/api/admin/participanti/invitatii",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mode: options.mode,
            participantIds:
              options.participantIds,
            allUnactivated:
              options.allUnactivated === true,
          }),
        }
      );

      const result = (await response.json()) as
        | (SendEmailResult & {
            success: true;
          })
        | { error: string };

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? result.error
            : "Emailul nu a putut fi trimis."
        );
      }

      setSendResult(result);

      if (options.mode === "activation") {
        setSelectedActivationIds([]);
      }

      await loadActivationUsers();
    } catch (error) {
      setActivationError(
        error instanceof Error
          ? error.message
          : "Emailul nu a putut fi trimis."
      );
    } finally {
      setIsSendingActivation(false);
      setSendingParticipantId(null);
    }
  }

  async function handleExcelImport(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    setParticipants([]);
    setFileName("");
    setImportError("");
    setSyncError("");
    setSyncResult(null);

    if (!file) {
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error(
          "Fișierul Excel nu conține nicio foaie."
        );
      }

      const worksheet =
        workbook.Sheets[firstSheetName];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: "",
        });

      if (rows.length === 0) {
        throw new Error(
          "Fișierul Excel nu conține participanți."
        );
      }

      const parsedParticipants = rows
        .map((row, index) => {
          const rowNumber = index + 2;

          const lastName = getCellValue(
            row,
            "nume"
          );

          const firstName = getCellValue(
            row,
            "prenume"
          );

          const email = getCellValue(
            row,
            "email"
          ).toLowerCase();

          if (!lastName && !firstName && !email) {
            return null;
          }

          if (!lastName || !firstName || !email) {
            throw new Error(
              `Rândul ${rowNumber} trebuie să conțină Nume, Prenume și Email.`
            );
          }

          if (!isValidEmail(email)) {
            throw new Error(
              `Emailul de pe rândul ${rowNumber} nu este valid: ${email}`
            );
          }

          return {
            firstName,
            lastName,
            email,
          };
        })
        .filter(
          (
            participant
          ): participant is ParsedParticipant =>
            participant !== null
        );

      const seenEmails = new Set<string>();

      for (const participant of parsedParticipants) {
        if (seenEmails.has(participant.email)) {
          throw new Error(
            `Emailul ${participant.email} apare de mai multe ori în fișier.`
          );
        }

        seenEmails.add(participant.email);
      }

      setFileName(file.name);
      setParticipants(parsedParticipants);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : "Fișierul nu a putut fi citit."
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleSync() {
    setSyncError("");
    setSyncResult(null);
    setIsSyncing(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      const response = await fetch(
        "/api/admin/participanti/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            participants,
          }),
        }
      );

      const result = (await response.json()) as
        | (SyncResult & { success: true })
        | { error: string };

      if (!response.ok || "error" in result) {
        throw new Error(
          "error" in result
            ? result.error
            : "Sincronizarea a eșuat."
        );
      }

      setSyncResult(result);
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? error.message
          : "Sincronizarea a eșuat."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleCreateAccounts() {
    setAccountError("");
    setAccountResult(null);
    setIsCreatingAccounts(true);

    const totalResult: AccountCreationResult = {
      created: 0,
      linkedExisting: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    };

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          "Trebuie să fii autentificat ca administrator."
        );
      }

      let remaining = 1;

      while (remaining > 0) {
        const response = await fetch(
          "/api/admin/participanti/conturi",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = (await response.json()) as
          | (AccountCreationResult & {
              success: true;
            })
          | { error: string };

        if (!response.ok || "error" in result) {
          throw new Error(
            "error" in result
              ? result.error
              : "Crearea conturilor a eșuat."
          );
        }

        totalResult.created += result.created;
        totalResult.linkedExisting +=
          result.linkedExisting;
        totalResult.failed += result.failed;
        totalResult.errors.push(...result.errors);

        remaining = result.remaining;
        totalResult.remaining = remaining;

        setAccountResult({
          ...totalResult,
          errors: totalResult.errors.slice(0, 10),
        });
      }
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "Crearea conturilor a eșuat."
      );
    } finally {
      setIsCreatingAccounts(false);
      await loadActivationUsers();
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-700">
              Administrare
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Participanți
            </h1>

            <p className="mt-2 max-w-2xl text-gray-600">
              Încarcă Excel-ul complet cu arbitrii.
              Participanții noi vor fi adăugați,
              cei existenți vor fi actualizați, iar
              cei care nu mai apar vor fi dezactivați.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Înapoi la administrare
          </Link>
        </div>

        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-gray-900">
            Sincronizează lista
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Fișierul trebuie să conțină coloanele
            Nume, Prenume și Email.
          </p>

          <label className="mt-6 block rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <span className="block text-sm font-semibold text-gray-700">
              Alege fișierul Excel
            </span>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-green-700"
            />
          </label>

          {importError && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {importError}
            </p>
          )}

          {participants.length > 0 && (
            <>
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
                <p className="font-semibold text-green-800">
                  Fișier pregătit pentru sincronizare
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Info
                    label="Fișier"
                    value={fileName}
                  />

                  <Info
                    label="Participanți"
                    value={participants.length.toString()}
                  />
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-700">
                    Verificare — primele{" "}
                    {Math.min(
                      participants.length,
                      10
                    )}{" "}
                    rânduri
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          Nume
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Prenume
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Email
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {participants
                        .slice(0, 10)
                        .map((participant) => (
                          <tr key={participant.email}>
                            <td className="px-4 py-3 text-gray-900">
                              {participant.lastName}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {participant.firstName}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {participant.email}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-6 py-4 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto"
              >
                {isSyncing
                  ? "Se sincronizează..."
                  : "Sincronizează participanții"}
              </button>
            </>
          )}

          {syncError && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {syncError}
            </p>
          )}

          {syncResult && (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
              <h2 className="text-lg font-bold text-green-800">
                Sincronizare finalizată
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <ResultItem
                  label="Total"
                  value={syncResult.total}
                />
                <ResultItem
                  label="Noi"
                  value={syncResult.created}
                />
                <ResultItem
                  label="Actualizați"
                  value={syncResult.updated}
                />
                <ResultItem
                  label="Neschimbați"
                  value={syncResult.unchanged}
                />
                <ResultItem
                  label="Dezactivați"
                  value={syncResult.deactivated}
                />
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-gray-900">
            Conturi de autentificare
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Creează conturile în Supabase Auth pentru
            participanții activi care nu au încă un cont.
            Nu se trimite niciun email acum. Când
            platforma este finalizată, vom trimite
            separat linkurile pentru alegerea parolei.
          </p>

          <button
            type="button"
            onClick={handleCreateAccounts}
            disabled={isCreatingAccounts}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-6 py-4 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400 sm:w-auto"
          >
            {isCreatingAccounts
              ? "Se creează conturile..."
              : "Creează conturile fără email"}
          </button>

          {accountError && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {accountError}
            </p>
          )}

          {accountResult && (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-lg font-bold text-blue-900">
                Procesare conturi
              </h3>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ResultItem
                  label="Conturi noi"
                  value={accountResult.created}
                />
                <ResultItem
                  label="Deja existente"
                  value={
                    accountResult.linkedExisting
                  }
                />
                <ResultItem
                  label="Erori"
                  value={accountResult.failed}
                />
                <ResultItem
                  label="Rămase"
                  value={accountResult.remaining}
                />
              </div>

              {accountResult.errors.length > 0 && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">
                    Primele erori
                  </p>

                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    {accountResult.errors.map(
                      (message) => (
                        <li key={message}>
                          {message}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Activare și resetare parolă
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Trimite linkul prin care arbitrul își setează parola
                pentru prima dată. Pentru conturile deja activate poți
                trimite oricând un link de resetare a parolei.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadActivationUsers()
              }
              disabled={isLoadingActivations}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingActivations
                ? "Se actualizează..."
                : "Actualizează lista"}
            </button>
          </div>

          {activationStats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultItem
                label="Cu cont"
                value={activationStats.withAccount}
              />
              <ResultItem
                label="Activate"
                value={activationStats.activated}
              />
              <ResultItem
                label="Neactivate"
                value={activationStats.notActivated}
              />
              <ResultItem
                label="Fără cont"
                value={activationStats.withoutAccount}
              />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                void sendAccountEmail({
                  mode: "activation",
                  allUnactivated: true,
                })
              }
              disabled={
                isSendingActivation ||
                (activationStats?.notActivated ?? 0) === 0
              }
              className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSendingActivation
                ? "Se trimit emailurile..."
                : "Trimite tuturor neactivaților"}
            </button>

            <button
              type="button"
              onClick={() =>
                void sendAccountEmail({
                  mode: "activation",
                  participantIds:
                    selectedActivationIds,
                })
              }
              disabled={
                isSendingActivation ||
                selectedActivationIds.length === 0
              }
              className="inline-flex items-center justify-center rounded-xl border border-green-600 bg-white px-5 py-3 font-semibold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
            >
              Trimite activare selectaților
              {selectedActivationIds.length > 0
                ? ` (${selectedActivationIds.length})`
                : ""}
            </button>

            <button
              type="button"
              onClick={selectAllUnactivated}
              disabled={
                (activationStats?.notActivated ?? 0) === 0
              }
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Selectează toți neactivații
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-gray-500">
            „Neactivat” înseamnă că utilizatorul nu și-a setat încă
            parola prin linkul primit de la platformă.
          </p>

          {activationError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {activationError}
            </div>
          )}

          {sendResult && (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="font-semibold text-green-800">
                {sendResult.message}
              </p>

              <p className="mt-2 text-sm text-green-700">
                Trimise: {sendResult.sent} · Omise:{" "}
                {sendResult.skipped} · Erori:{" "}
                {sendResult.failed}
              </p>

              {sendResult.errors.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-red-700">
                  {sendResult.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">
                Conturi participanți
              </p>
            </div>

            {isLoadingActivations ? (
              <div className="p-8 text-center text-sm text-gray-600">
                Se încarcă lista...
              </div>
            ) : activationUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-600">
                Nu există participanți activi.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-white text-gray-500">
                    <tr>
                      <th className="w-12 px-4 py-3 font-semibold">
                        Sel.
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Arbitru
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Email
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Acțiune
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {activationUsers.map((user) => {
                      const canActivate =
                        user.hasAccount &&
                        !user.activated;

                      return (
                        <tr key={user.participantId}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedActivationIds.includes(
                                user.participantId
                              )}
                              disabled={!canActivate}
                              onChange={() =>
                                toggleActivationSelection(
                                  user.participantId
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-40"
                              aria-label={`Selectează ${user.fullName}`}
                            />
                          </td>

                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {user.fullName}
                          </td>

                          <td className="px-4 py-3 text-gray-600">
                            {user.email || "—"}
                          </td>

                          <td className="px-4 py-3">
                            {!user.hasAccount ? (
                              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                Fără cont
                              </span>
                            ) : user.activated ? (
                              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                Activat
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                Neactivat
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {canActivate && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void sendAccountEmail({
                                      mode: "activation",
                                      participantIds: [
                                        user.participantId,
                                      ],
                                      participantIdForLoading:
                                        user.participantId,
                                    })
                                  }
                                  disabled={
                                    sendingParticipantId !== null ||
                                    isSendingActivation
                                  }
                                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                >
                                  {sendingParticipantId ===
                                  user.participantId
                                    ? "Se trimite..."
                                    : "Trimite activare"}
                                </button>
                              )}

                              {user.hasAccount && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const confirmed =
                                      window.confirm(
                                        `Trimiți un email de resetare a parolei către ${user.fullName} (${user.email})?`
                                      );

                                    if (!confirmed) {
                                      return;
                                    }

                                    void sendAccountEmail({
                                      mode: "reset",
                                      participantIds: [
                                        user.participantId,
                                      ],
                                      participantIdForLoading:
                                        user.participantId,
                                    });
                                  }}
                                  disabled={
                                    sendingParticipantId !== null ||
                                    isSendingActivation
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Resetare parolă
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}

interface InfoProps {
  label: string;
  value: string;
}

function Info({ label, value }: InfoProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-medium text-gray-900">
        {value}
      </p>
    </div>
  );
}

interface ResultItemProps {
  label: string;
  value: number;
}

function ResultItem({
  label,
  value,
}: ResultItemProps) {
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {label}
      </p>
    </div>
  );
}