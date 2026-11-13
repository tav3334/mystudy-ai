"use client";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Files,
  Target,
  Clock3,
  Sparkles,
  FolderOpen,
  Check,
  CalendarDays,
  Cloud,
  Leaf,
  ListChecks,
  Layers,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudyData } from "@/lib/data";
import { SyncButton } from "@/components/documents/sync-button";
export function Dashboard({ data }: { data: StudyData }) {
  const score = data.attempts.length
    ? Math.round(
        data.attempts.reduce((s, a) => s + (100 * a.score) / a.total, 0) /
          data.attempts.length,
      )
    : null;
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Casablanca",
  }).format(new Date());
  const tasks = data.tasks.filter((t) => !t.completed).slice(0, 3);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs muted capitalize mb-2">{today}</p>
          <h1 className="text-[28px] font-semibold tracking-tight">
            Chaque jour, un pas de plus{" "}
            <span className="text-emerald-600">.</span>
          </h1>
          <p className="muted text-sm mt-2">
            Bienvenue dans votre espace. Prêt à faire avancer vos révisions ?
          </p>
        </div>
        <div className="pt-2 hidden sm:block">
          <SyncButton connected={data.connected} />
        </div>
      </div>
      <section className="relative overflow-hidden rounded-2xl bg-[#173f33] text-white p-7 md:p-8 min-h-52 flex items-center">
        <div className="relative z-10 max-w-xl">
          <p className="label text-[#a0cfb6] text-[10px] flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[#a0cfb6]" /> Un espace
            pour aller plus loin
          </p>
          <h2 className="text-[27px] font-medium mt-4 tracking-tight">
            Moins de dispersion.
            <br />
            Plus de compréhension.
          </h2>
          <p className="text-[#b7d0c3] text-xs leading-6 mt-3 max-w-md">
            Vos cours deviennent des réponses claires, des quiz ciblés
            <br className="hidden md:block" /> et des révisions qui font la
            différence.
          </p>
          <Button
            asChild
            className="mt-5 !bg-[#f2f7ee] !text-[#214536] hover:!bg-white"
            size="sm"
          >
            <Link href={data.documents.length ? "/qcm" : "/parametres"}>
              {data.documents.length ? "Créer un QCM" : "Connecter mes cours"}
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        <div
          aria-hidden
          className="absolute right-8 md:right-20 bottom-[-10px] opacity-80 hidden sm:block"
        >
          <div className="absolute size-64 border border-white/10 rounded-full -left-14 -top-16" />
          <div className="absolute size-80 border border-white/10 rounded-full -left-22 -top-24" />
          <div className="w-36 h-44 rotate-[-12deg] rounded-xl border border-[#8ea998]/30 bg-[#32624d] p-5 shadow-xl">
            <div className="w-8 h-1.5 rounded bg-[#a9cbb3] mb-6" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1 rounded bg-[#a9cbb3]/40 my-3"
                style={{ width: `${90 - i * 12}%` }}
              />
            ))}
          </div>
          <div className="absolute -right-8 bottom-8 w-28 h-32 rotate-12 rounded-xl border border-white/20 bg-[#e2eacb] p-4 text-[#395340] shadow-2xl">
            <Sparkles size={25} />
            <div className="h-1 w-14 bg-[#8a9b75]/50 mt-5 rounded" />
            <div className="h-1 w-10 bg-[#8a9b75]/50 mt-2 rounded" />
          </div>
          <div className="absolute -left-6 -top-4 size-12 rounded-xl border border-white/15 bg-[#2e5946] grid place-items-center">
            <Leaf size={22} className="text-[#bfd4ac]" />
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Modules découverts",
            value: data.modules.length,
            caption: "Depuis votre Google Drive",
            Icon: BookOpen,
            color: "bg-emerald-500/10 text-emerald-700",
          },
          {
            label: "Documents disponibles",
            value: data.documents.length,
            caption: `${data.documents.filter((d) => d.status === "ready").length} documents prêts`,
            Icon: Files,
            color: "bg-blue-500/10 text-blue-600",
          },
          {
            label: "Précision moyenne",
            value: score === null ? "—" : `${score}%`,
            caption:
              score === null
                ? "Après votre premier QCM"
                : `${data.attempts.length} QCM terminés`,
            Icon: Target,
            color: "bg-amber-500/10 text-amber-600",
          },
          {
            label: "Révisions à faire",
            value: data.flashcards.filter(
              (c) => new Date(c.due_at) <= new Date(),
            ).length,
            caption: "Flashcards à revoir",
            Icon: Clock3,
            color: "bg-violet-500/10 text-violet-600",
          },
        ].map(({ label, value, caption, Icon, color }) => (
          <div key={label} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs muted">{label}</span>
              <span
                className={`size-8 rounded-lg flex items-center justify-center ${color}`}
              >
                <Icon size={16} />
              </span>
            </div>
            <div className="text-[30px] font-semibold tracking-tight mt-3">
              {value}
            </div>
            <p className="text-[10px] muted mt-1.5">{caption}</p>
          </div>
        ))}
      </div>
      <div className="grid xl:grid-cols-[1.55fr_1fr] gap-6">
        <section className="panel">
          <div className="p-5 flex justify-between items-center border-b border-[var(--border)]">
            <h2 className="font-semibold">
              Votre feuille de route{" "}
              <span className="ml-2 rounded bg-[var(--muted)] text-[10px] muted font-normal px-2 py-1">
                Aujourd’hui
              </span>
            </h2>
            <Link
              href="/planning"
              className="text-[11px] muted flex items-center gap-1"
            >
              Voir le planning
              <ChevronRight size={13} />
            </Link>
          </div>
          {tasks.length ? (
            <div className="p-5 space-y-4">
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  href="/planning"
                  className="flex items-center gap-3 py-2"
                >
                  <span className="size-5 rounded-full border border-[var(--border)]" />
                  <span className="flex-1">{t.title}</span>
                  <span className="muted text-xs">
                    {t.duration_minutes} min
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center text-center min-h-52 justify-center">
              <div className="size-10 rounded-xl bg-[var(--muted)] grid place-items-center muted mb-3">
                <CalendarDays size={20} />
              </div>
              <h3 className="text-sm font-semibold">
                Faites de la place pour apprendre
              </h3>
              <p className="muted text-xs mt-2 max-w-xs leading-5">
                Ajoutez votre première séance de révision.
                <br />
                Un petit objectif suffit pour commencer.
              </p>
              <Link
                href="/planning"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-4 flex gap-2"
              >
                <Plus size={14} /> Planifier une séance
              </Link>
            </div>
          )}
        </section>
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <ListChecks size={20} className="text-emerald-700" />
            <h2 className="font-semibold">Vos prochaines étapes</h2>
          </div>
          <p className="text-xs muted mt-3 leading-6">
            Vos cours sont préparés automatiquement. Choisissez ensuite comment
            tester vos connaissances.
          </p>
          <div className="mt-4 space-y-2">
            {[
              { title: "Créer un QCM à partir de mes cours", href: "/qcm" },
              { title: "Préparer un examen blanc", href: "/examens" },
              { title: "Voir mes documents", href: "/documents" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg bg-[var(--background)] border border-[var(--border)] p-3 text-[11px] hover:border-emerald-500/50"
              >
                {item.title}
                <ArrowUpRight size={13} className="muted" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="grid xl:grid-cols-[1.55fr_1fr] gap-6">
        <section className="panel overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-[var(--border)]">
            <div>
              <h2 className="font-semibold">Mes modules</h2>
              <p className="muted text-[11px] mt-1">
                Un savoir organisé, des idées plus claires.
              </p>
            </div>
            <Link
              href="/modules"
              className="muted text-[11px] flex items-center gap-1"
            >
              Tout voir
              <ArrowUpRight size={13} />
            </Link>
          </div>
          {data.modules.length ? (
            <div className="divide-y divide-[var(--border)]">
              {data.modules.slice(0, 4).map((m) => (
                <Link
                  href={`/documents?module=${m.id}`}
                  key={m.id}
                  className="p-4 flex gap-3 items-center hover:bg-[var(--muted)]"
                >
                  <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center text-emerald-700">
                    <FolderOpen size={18} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-semibold">{m.name}</h3>
                    <p className="text-[10px] muted mt-1">
                      {
                        data.documents.filter((d) => d.module_id === m.id)
                          .length
                      }{" "}
                      documents
                    </p>
                  </div>
                  <ChevronRight size={15} className="muted" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-pattern min-h-52 flex flex-col items-center justify-center p-6 text-center">
              <FolderOpen size={29} strokeWidth={1.2} className="muted mb-3" />
              <h3 className="font-semibold text-sm">
                Vos modules vous attendent
              </h3>
              <p className="muted text-xs mt-2 max-w-xs leading-5">
                Connectez Google Drive pour retrouver automatiquement vos
                dossiers et vos cours.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-4">
                <Link href="/parametres">
                  <Cloud size={14} /> Connecter Google Drive
                </Link>
              </Button>
            </div>
          )}
        </section>
        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="font-semibold">À votre rythme</h2>
            <p className="muted text-[11px] mt-1">
              Choisissez votre prochaine étape.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                {
                  label: "Tester mes acquis",
                  sub: "Générer un QCM",
                  href: "/qcm",
                  Icon: ListChecks,
                  color: "text-amber-600 bg-amber-500/10",
                },
                {
                  label: "Ancrer l’essentiel",
                  sub: "Revoir mes cartes",
                  href: "/flashcards",
                  Icon: Layers,
                  color: "text-violet-600 bg-violet-500/10",
                },
              ].map(({ label, sub, href, Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="border border-[var(--border)] p-3 rounded-xl hover:bg-[var(--muted)]"
                >
                  <span
                    className={`size-8 rounded-lg grid place-items-center ${color}`}
                  >
                    <Icon size={16} />
                  </span>
                  <h3 className="text-[11px] font-semibold mt-3">{label}</h3>
                  <p className="text-[10px] muted mt-1">{sub}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="panel p-5 flex items-center gap-3">
            <span
              className={`size-9 rounded-full grid place-items-center ${data.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--muted)] muted"}`}
            >
              {data.connected ? <Check size={18} /> : <Cloud size={18} />}
            </span>
            <div className="flex-1">
              <h3 className="text-xs font-semibold">Google Drive</h3>
              <p className="muted text-[10px] mt-1">
                {data.connected
                  ? data.sync?.finished_at
                    ? `Synchronisé le ${new Date(data.sync.finished_at).toLocaleDateString("fr-FR")}`
                    : "Prêt à synchroniser"
                  : "En attente de connexion"}
              </p>
            </div>
            <Link href="/parametres" aria-label="Paramètres Google Drive">
              <ArrowUpRight size={16} className="muted" />
            </Link>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
