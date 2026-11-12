import { Shell } from "@/components/layout/shell";
import { loadData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadData();
  return (
    <Shell email={data.email} configured={data.configured}>
      {children}
    </Shell>
  );
}
