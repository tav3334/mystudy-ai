import Link from "next/link";
import {
  Cloud,
  ShieldCheck,
  KeyRound,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { SyncButton } from "@/components/documents/sync-button";
import { loadData } from "@/lib/data";
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string }>;
}) {
  const [d, p] = await Promise.all([loadData(), searchParams]);
  const items = [
    [
      "Supabase",
      d.configured,
      "Authentification et sauvegarde de vos données.",
    ],
    [
      "Google OAuth",
      !!(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.TOKEN_ENCRYPTION_KEY
      ),
      "Connexion indépendante à votre Google Drive.",
    ],
    [
      "Gemini",
      !!process.env.GEMINI_API_KEY,
      "QCM, examens blancs et préparation des documents.",
    ],
  ] as const;
  return (
    <>
      <PageHeading
        eyebrow="Votre espace, vos préférences"
        title="Paramètres"
        description="Gérez vos connexions et gardez le contrôle sur vos données et votre consommation AI."
      />
      {p.drive && (
        <p
          role="status"
          className={`panel p-4 mb-5 ${p.drive === "connected" ? "text-emerald-700" : "text-red-600"}`}
        >
          {p.drive === "connected"
            ? "Google Drive connecté. Vous pouvez lancer votre première synchronisation."
            : "La connexion Google Drive a échoué. Vérifiez la configuration OAuth puis réessayez."}
        </p>
      )}
      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-6">
          <section className="panel p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-600 p-3 rounded-xl">
                <Cloud size={23} />
              </div>
              <div>
                <h2 className="font-semibold">Google Drive</h2>
                <p className="muted text-xs mt-1">
                  {d.connected
                    ? "Compte connecté · Lecture seule"
                    : "Connectez vos ressources pédagogiques"}
                </p>
              </div>
            </div>
            <p className="muted text-sm leading-6 mt-5">
              MyStudy AI découvre vos modules dans le dossier académique. Vos
              fichiers d’origine ne sont jamais modifiés.
            </p>
            <div className="bg-[var(--background)] p-4 rounded-lg my-5">
              <p className="label muted text-[9px]">Dossier racine</p>
              <a
                href={`https://drive.google.com/drive/folders/${process.env.GOOGLE_DRIVE_ROOT_ID ?? "1rqYB2_0rdDhoWJbqzPNOhFtNedQZgERn"}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 break-all"
              >
                Ouvrir mon dossier académique
                <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild disabled={!d.configured}>
                <a
                  href={d.configured ? "/api/drive/connect" : "#configuration"}
                >
                  <Cloud size={15} />
                  {d.connected
                    ? "Reconnecter mon compte"
                    : "Connecter Google Drive"}
                </a>
              </Button>
              {d.connected && <SyncButton connected />}
            </div>
            <p className="text-[11px] muted mt-4 flex gap-2">
              <ShieldCheck size={14} />
              Autorisation Google indépendante. Accès strictement en lecture
              seule.
            </p>
            {d.sync && (
              <div className="border-t border-[var(--border)] mt-5 pt-4 text-xs space-y-2">
                <p>Dernière synchronisation : {d.sync.status}</p>
                <p className="muted">
                  {d.sync.added} nouveaux · {d.sync.updated} modifiés ·{" "}
                  {d.sync.removed} retirés
                </p>
                {d.sync.error && <p className="text-red-600">{d.sync.error}</p>}
              </div>
            )}
          </section>
          <section id="configuration" className="panel p-6">
            <h2 className="font-semibold flex gap-2 items-center">
              <KeyRound size={17} />
              Configuration des services
            </h2>
            <div className="divide-y divide-[var(--border)] mt-3">
              {items.map(([name, ready, description]) => (
                <div className="py-4 flex items-center gap-3" key={name}>
                  <span
                    className={`size-7 grid place-items-center rounded-full ${ready ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--muted)] muted"}`}
                  >
                    {ready ? (
                      <Check size={15} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-xs">{name}</p>
                    <p className="text-xs muted mt-1">{description}</p>
                  </div>
                  <span className="text-[10px] muted">
                    {ready ? "Configuré" : "À configurer"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs muted leading-6 border-t border-[var(--border)] pt-4">
              Copiez <code>.env.example</code> vers <code>.env.local</code>,
              renseignez les valeurs sur votre machine et appliquez la migration
              Supabase. Les étapes détaillées sont dans le README du projet.
            </p>
          </section>
        </div>
        <div className="space-y-6">
          <section className="panel p-6">
            <p className="label muted text-[10px]">Consommation AI</p>
            <h2 className="mt-4 text-3xl font-semibold">
              {d.usage}
              <span className="text-sm muted font-normal">
                {" "}
                / {process.env.AI_DAILY_REQUEST_LIMIT ?? 50}
              </span>
            </h2>
            <p className="muted text-xs mt-2">
              Requêtes réservées aujourd’hui (UTC)
            </p>
            <div className="h-1.5 bg-[var(--muted)] rounded-full mt-5 overflow-hidden">
              <div
                className="h-full bg-emerald-600"
                style={{
                  width: `${Math.min(100, (d.usage / Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 50)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs muted mt-5 leading-6">
              Les quotas du fournisseur s’appliquent aussi. Aucune facturation
              n’est activée par l’application. Le quota inclut l’indexation et
              les appels ayant échoué.
            </p>
          </section>
          <section className="panel p-6">
            <ShieldCheck className="text-emerald-600" size={24} />
            <h2 className="font-semibold mt-4">
              Un espace qui vous appartient
            </h2>
            <p className="text-xs muted leading-6 mt-3">
              Vos résultats sont associés à votre compte. Les jetons Google sont
              chiffrés côté serveur. Vos clés AI ne sont jamais envoyées au
              navigateur.
            </p>
            <Link
              href="/documents"
              className="text-xs text-emerald-700 dark:text-emerald-400 mt-4 flex items-center gap-2"
            >
              Retrouver mes documents
              <ArrowUpRight size={14} />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
