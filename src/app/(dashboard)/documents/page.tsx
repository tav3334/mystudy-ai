import { loadData } from "@/lib/data";
import { PageHeading } from "@/components/page-heading";
import { DocumentList } from "@/components/documents/document-list";
import { SyncButton } from "@/components/documents/sync-button";
export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string }>;
}) {
  const [d, p] = await Promise.all([loadData(), searchParams]);
  return (
    <>
      <PageHeading
        eyebrow="Vos sources de connaissance"
        title="Mes documents"
        description="Vos cours restent sur Google Drive. Ici, ils deviennent la matière de vos révisions."
      >
        <SyncButton connected={d.connected} />
      </PageHeading>
      <DocumentList data={d} initialQuery={p.q} initialModule={p.module} />
    </>
  );
}
