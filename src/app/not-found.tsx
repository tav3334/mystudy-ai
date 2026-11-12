import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-content-center gap-4 text-center">
      <p className="label muted">404</p>
      <h1 className="text-3xl font-semibold">Cette page est introuvable.</h1>
      <Link href="/" className="text-emerald-600 underline">
        Revenir à mon espace
      </Link>
    </main>
  );
}
