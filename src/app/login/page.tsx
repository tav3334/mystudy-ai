"use client";
import { useActionState, useState } from "react";
import { BookOpen, ArrowRight, ShieldCheck } from "lucide-react";
import { authenticate } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [mode, setMode] = useState("login");
  const [state, action, pending] = useActionState(authenticate, {});
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex bg-[#153e32] p-16 text-white flex-col justify-between">
        <div className="flex items-center gap-3 text-xl font-bold">
          <BookOpen /> MyStudy <span className="text-emerald-300">AI</span>
        </div>
        <div>
          <p className="label text-emerald-300 mb-6">
            Apprendre, à votre rythme
          </p>
          <h1 className="text-5xl leading-tight font-semibold max-w-lg">
            Vos ambitions.
            <br />
            Un peu plus proches,
            <br />
            chaque jour.
          </h1>
          <p className="mt-7 text-emerald-100/70 max-w-sm leading-7">
            Transformez vos cours en révisions utiles. Retrouvez vos documents,
            comprenez vos erreurs et préparez vos examens.
          </p>
        </div>
        <p className="flex items-center gap-2 text-emerald-100/60 text-xs">
          <ShieldCheck size={16} /> Un espace personnel. Vos documents restent
          les vôtres.
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form action={action} className="w-full max-w-sm space-y-5">
          <p className="label text-emerald-700">MyStudy AI</p>
          <h2 className="text-3xl font-semibold">
            {mode === "login"
              ? "Heureux de vous retrouver."
              : "Votre prochain chapitre."}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Connectez-vous à votre espace de travail."
              : "Créez votre compte personnel."}
          </p>
          <input type="hidden" name="mode" value={mode} />
          <label className="block space-y-2">
            <span>E-mail</span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@universite.ma"
            />
          </label>
          <label className="block space-y-2">
            <span>Mot de passe</span>
            <input
              required
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {state.error && (
            <p role="alert" className="text-red-600">
              {state.error}
            </p>
          )}
          {state.message && (
            <p role="status" className="text-emerald-700">
              {state.message}
            </p>
          )}
          <Button className="w-full" disabled={pending}>
            {pending
              ? "Connexion…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
            <ArrowRight size={16} />
          </Button>
          <button
            type="button"
            className="muted text-sm"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "Pas encore de compte ? Créer un compte"
              : "Déjà inscrit ? Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
