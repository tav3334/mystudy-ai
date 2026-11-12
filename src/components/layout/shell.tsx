"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  BookOpen,
  LayoutDashboard,
  FolderOpen,
  Files,
  Sparkles,
  ListChecks,
  Timer,
  Code2,
  Layers,
  CalendarDays,
  ChartNoAxesCombined,
  Settings2,
  Search,
  Sun,
  Moon,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
const navigation = [
  ["/", "Tableau de bord", LayoutDashboard],
  ["/modules", "Mes modules", FolderOpen],
  ["/documents", "Documents", Files],
  ["/revision", "Révision AI", Sparkles],
  ["/qcm", "QCM", ListChecks],
  ["/examens", "Examens blancs", Timer],
  ["/pratique", "TD / TP", Code2],
  ["/flashcards", "Flashcards", Layers],
  ["/planning", "Planning", CalendarDays],
  ["/statistiques", "Statistiques", ChartNoAxesCombined],
  ["/parametres", "Paramètres", Settings2],
] as const;
export function Shell({
  children,
  email,
  configured,
}: {
  children: React.ReactNode;
  email: string | null;
  configured: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const title = navigation.find(([href]) => href === path)?.[1] ?? "Mon espace";
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-72 focus:z-50"
      >
        Aller au contenu
      </a>
      {open && (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed z-40 inset-y-0 left-0 w-60 border-r border-[var(--border)] bg-[var(--panel)] flex flex-col transition-transform`}
      >
        <Link
          href="/"
          className="h-20 flex items-center gap-2.5 px-6 text-xl tracking-tight font-bold"
        >
          <span className="size-9 bg-emerald-800 text-white rounded-xl grid place-items-center">
            <BookOpen size={20} />
          </span>
          MyStudy{" "}
          <span className="text-emerald-600 -ml-1">
            AI
            <span className="inline-block size-1 rounded-full bg-emerald-600 ml-0.5" />
          </span>
        </Link>
        <div className="px-5 mt-5 mb-3 label muted text-[10px]">
          Mon espace d’apprentissage
        </div>
        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {navigation.map(([href, label, Icon], i) => (
            <div key={href}>
              {i === 9 && <div className="h-px bg-[var(--border)] my-4 mx-3" />}
              <Link
                onClick={() => setOpen(false)}
                href={href}
                aria-current={path === href ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] ${path === href ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 font-semibold" : "muted hover:bg-[var(--muted)]"}`}
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
                {label === "Révision AI" && (
                  <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded ml-auto">
                    AI
                  </span>
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="m-4 rounded-xl bg-[var(--muted)] p-4">
          <div className="flex gap-2 text-xs font-semibold">
            <span className="size-2 bg-emerald-500 rounded-full mt-1" />
            Votre savoir, bien organisé
          </div>
          <p className="text-xs muted leading-5 mt-2">
            Connectez vos cours. Donnez une direction à vos révisions.
          </p>
          <Link
            href="/parametres"
            className="mt-3 flex gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold"
          >
            Configurer mon espace
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="p-4 border-t border-[var(--border)] flex items-center gap-3">
          <div className="size-9 rounded-full bg-[#eee6da] text-[#746549] flex items-center justify-center font-bold">
            {email?.[0]?.toUpperCase() ?? "M"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {email ?? "Mon espace étudiant"}
            </p>
            <p className="text-[10px] muted mt-1">Compte personnel</p>
          </div>
          {email && (
            <form action={signOut}>
              <button aria-label="Se déconnecter">
                <LogOut size={16} className="muted" />
              </button>
            </form>
          )}
        </div>
      </aside>
      <div className="lg:ml-60">
        <header className="h-[72px] border-b border-[var(--border)] bg-[var(--panel)] px-5 md:px-9 flex items-center gap-4">
          <button
            onClick={() => setOpen(!open)}
            aria-label="Ouvrir le menu"
            className="lg:hidden"
          >
            {open ? <X /> : <Menu />}
          </button>
          <span className="muted hidden sm:inline text-xs">Mon espace</span>
          <ChevronRight className="muted hidden sm:inline" size={13} />
          <span className="text-xs font-semibold">{title}</span>
          <form
            action="/documents"
            className="ml-auto relative hidden md:block w-64"
          >
            <Search size={15} className="absolute left-3 top-2.5 muted" />
            <input
              aria-label="Rechercher un document"
              name="q"
              placeholder="Rechercher dans mes cours…"
              className="!pl-9 !py-2 !text-xs !bg-[var(--background)]"
            />
          </form>
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="size-9 grid place-items-center rounded-lg hover:bg-[var(--muted)]"
            aria-label="Changer le thème"
          >
            <Sun size={18} className="hidden dark:block" />
            <Moon size={18} className="dark:hidden" />
          </button>
          <span className="hidden sm:block h-6 w-px bg-[var(--border)]" />
          <div className="size-8 rounded-full bg-[#eee6da] text-[#746549] flex items-center justify-center font-bold text-xs">
            {email?.[0]?.toUpperCase() ?? "M"}
          </div>
        </header>
        {!configured && (
          <div className="bg-amber-500/8 text-amber-800 dark:text-amber-300 text-xs px-5 md:px-9 py-2.5 border-b border-amber-500/15 flex items-center justify-between gap-3">
            <span>
              Configuration requise · Connectez Supabase pour activer votre
              espace personnel.
            </span>
            <Link
              href="/parametres"
              className="font-semibold underline shrink-0"
            >
              Configurer
            </Link>
          </div>
        )}
        <main id="content" className="max-w-[1600px] mx-auto p-5 md:p-9">
          {children}
        </main>
        <footer className="px-9 pb-5 text-[10px] muted flex justify-between">
          <span>MyStudy AI · Apprendre avec intention.</span>
          <span>Votre espace personnel de révision</span>
        </footer>
      </div>
    </>
  );
}
