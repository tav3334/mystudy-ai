import Link from "next/link";
import { FolderOpen, ArrowUpRight, Cloud } from "lucide-react";
import { loadData } from "@/lib/data";
import { PageHeading } from "@/components/page-heading";
import { SyncButton } from "@/components/documents/sync-button";
import { Button } from "@/components/ui/button";
export default async function Modules() {
  const d = await loadData();
  return (
    <>
      <PageHeading
        eyebrow="Votre bibliothèque"
        title="Mes modules"
        description="Tous vos enseignements, organisés à partir de vos dossiers Google Drive."
      >
        <SyncButton connected={d.connected} />
      </PageHeading>
      {d.modules.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {d.modules.map((m) => (
            <Link
              key={m.id}
              href={`/documents?module=${m.id}`}
              className="panel p-6 hover:border-emerald-600/50 transition-colors"
            >
              <div className="flex justify-between">
                <span className="size-11 bg-emerald-500/10 text-emerald-700 grid place-items-center rounded-xl">
                  <FolderOpen size={23} />
                </span>
                <ArrowUpRight size={17} className="muted" />
              </div>
              <h2 className="font-semibold mt-6 leading-6">{m.name}</h2>
              <p className="muted text-xs mt-2">
                {d.documents.filter((x) => x.module_id === m.id).length}{" "}
                documents
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel empty-pattern p-16 text-center">
          <FolderOpen size={36} className="mx-auto muted mb-5" />
          <h2 className="text-xl font-semibold">
            Votre bibliothèque commence ici
          </h2>
          <p className="muted mt-3">
            Les modules seront découverts automatiquement lors de la première
            synchronisation.
          </p>
          <Button asChild className="mt-6">
            <Link href="/parametres">
              <Cloud size={16} />
              Configurer Google Drive
            </Link>
          </Button>
        </section>
      )}
    </>
  );
}
