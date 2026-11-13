import { BookOpen, ExternalLink } from "lucide-react";
import { courseSourceUrl } from "@/lib/learning/source";
type CourseSource = {
  quote: string;
  document_name?: string;
  source_url?: string;
  page?: number | null;
  section?: string | null;
};
export function QuizSource({ source }: { source: CourseSource }) {
  const url = courseSourceUrl(source.source_url);
  return (
    <aside
      aria-label="Source de la réponse"
      className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4 space-y-3"
    >
      <p className="text-xs font-semibold flex items-center gap-2">
        <BookOpen size={15} />
        Vérifier dans mon cours
      </p>
      <div className="text-sm break-words">
        <p className="font-medium">
          {source.document_name || "Document du cours"}
        </p>
        {(source.page || source.section) && (
          <p className="text-xs muted mt-1">
            {source.page ? "Page / diapositive " + source.page : ""}
            {source.page && source.section ? " · " : ""}
            {source.section}
          </p>
        )}
      </div>
      <blockquote className="text-sm muted border-l-2 border-emerald-600 pl-3 leading-6 whitespace-pre-wrap break-words">
        {source.quote}
      </blockquote>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-2 font-semibold"
        >
          <ExternalLink size={14} />
          Ouvrir le document Google Drive
        </a>
      ) : (
        <p className="text-xs muted">
          Le lien du document est indisponible. L’extrait utilisé reste
          consultable ici.
        </p>
      )}
    </aside>
  );
}
