import { Dashboard } from "@/components/dashboard/dashboard";
import { loadData } from "@/lib/data";
export default async function Home() {
  return <Dashboard data={await loadData()} />;
}
