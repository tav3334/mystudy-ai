"use client";
import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Cloud } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function SyncButton({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (!connected)
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/parametres">
          <Cloud size={14} />
          Connecter Google Drive
        </Link>
      </Button>
    );
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch("/api/drive/sync", { method: "POST" });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          toast.success(
            `Synchronisation terminée : ${d.added} nouveaux, ${d.updated} modifiés.`,
          );
          router.refresh();
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Synchronisation impossible",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
      {busy ? "Synchronisation…" : "Synchroniser Google Drive"}
    </Button>
  );
}
