export default function Navbar() {
  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold text-green-700">
          ⚽ CMA București
        </h1>

        <nav className="flex gap-8 text-sm font-medium text-gray-700">
          <a href="#">Acasă</a>
          <a href="#">Quiz</a>
          <a href="#">Legile Jocului</a>
          <a href="#">Clasament</a>
        </nav>
      </div>
    </header>
  );
}