"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel p-10 space-y-4">
      <h1 className="text-xl font-semibold">
        Impossible de charger votre espace
      </h1>
      <p className="muted">
        Vérifiez la connexion Supabase et appliquez les migrations. Vos données
        restent conservées.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </section>
  );
}
