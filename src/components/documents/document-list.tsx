"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ExternalLink,
  Search,
  Play,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StudyData } from "@/lib/data";
import { Button } from "@/components/ui/button";
export function DocumentList({
  data,
  initialQuery = "",
  initialModule = "",
}: {
  data: StudyData;
  initialQuery?: string;
  initialModule?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [module, setModule] = useState(initialModule);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const documents = data.documents.filter(
    (d) =>
      (!module || d.module_id === module) &&
      d.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  async function process(id: string) {
    setBusy(id);
    try {
      const r = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      toast.success("Traitement enregistré. Le worker indexera le document.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Traitement impossible");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="panel overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-3 muted" />
          <input
            className="!pl-10"
            aria-label="Filtrer les documents"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un document…"
          />
        </div>
        <select
          aria-label="Filtrer par module"
          className="sm:!w-64"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option value="">Tous les modules</option>
          {data.modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[650px]">
          <thead className="bg-[var(--background)] text-[10px] muted uppercase tracking-wider">
            <tr>
              <th className="p-4 font-medium">Document</th>
              <th>Catégorie</th>
              <th>État</th>
              <th>Modifié le</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t border-[var(--border)]">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <FileText size={19} className="text-emerald-700 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold max-w-64 truncate">
                        {d.name}
                      </p>
                      <p className="text-[10px] muted mt-1">
                        {data.modules.find((m) => m.id === d.module_id)?.name ??
                          "Racine"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-xs muted">{d.category}</td>
                <td>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full ${d.status === "ready" ? "bg-emerald-500/10 text-emerald-700" : d.status === "failed" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}
                  >
                    {(
                      {
                        ready: "Indexé",
                        pending: "À indexer",
                        queued: "En attente",
                        processing: "En cours",
                        failed: "Échec",
                        unsupported: "Non pris en charge",
                      } as Record<string, string>
                    )[d.status] ?? d.status}
                  </span>
                  {d.processing_error && (
                    <p className="text-[10px] text-red-600 max-w-44 mt-1">
                      {d.processing_error}
                    </p>
                  )}
                </td>
                <td className="text-xs muted">
                  {new Date(d.modified_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="p-4">
                  <div className="flex gap-2 items-center">
                    <a
                      href={d.source_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ouvrir ${d.name} dans Drive`}
                    >
                      <ExternalLink size={16} className="muted" />
                    </a>
                    {d.status !== "ready" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null || d.status === "processing"}
                        onClick={() => process(d.id)}
                      >
                        {busy === d.id ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          <Play size={13} />
                        )}
                        Indexer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!documents.length && (
        <div className="text-center p-16">
          <FileText size={32} className="mx-auto muted mb-4" />
          <h2 className="font-semibold">
            {query ? "Aucun résultat" : "Aucun document pour le moment"}
          </h2>
          <p className="text-xs muted mt-2">
            {query
              ? "Essayez un autre nom de document."
              : "Connectez votre Drive puis lancez une synchronisation pour retrouver vos cours."}
          </p>
        </div>
      )}
    </section>
  );
}
