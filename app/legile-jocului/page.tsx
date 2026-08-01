import Navbar from "@/components/Navbar";

export default function LegileJoculuiPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="h-[calc(100vh-64px)]">
        <iframe
          src="/docs/legile-jocului-2026-2027.pdf"
          title="Legile Jocului 2026-2027"
          className="h-full w-full border-0"
        />
      </main>
    </div>
  );
}