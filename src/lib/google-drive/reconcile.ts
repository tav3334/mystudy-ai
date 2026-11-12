export function fileVersion(file: {
  md5Checksum?: string;
  version?: string;
  modifiedTime: string;
}) {
  return file.md5Checksum ?? file.version ?? file.modifiedTime;
}
export function classifyFolder(name: string, inherited = "Autre") {
  const n = name.toLocaleLowerCase().trim();
  if (/^(cours|course|lectures?)$/.test(n)) return "Cours";
  if (/^td\b|travaux dirig/.test(n)) return "TD";
  if (/^tp\b|travaux prati/.test(n)) return "TP";
  if (/exam|annale/.test(n)) return "Examens";
  if (/corrig|solution/.test(n)) return "Solutions";
  return inherited;
}
export function reconcileFiles(
  existing: { drive_id: string; version: string; active: boolean }[],
  seen: { id: string; version: string }[],
) {
  const old = new Map(existing.map((f) => [f.drive_id, f]));
  const ids = new Set(seen.map((f) => f.id));
  return {
    added: seen.filter((f) => !old.has(f.id)).map((f) => f.id),
    updated: seen
      .filter(
        (f) =>
          old.has(f.id) &&
          (!old.get(f.id)!.active || old.get(f.id)!.version !== f.version),
      )
      .map((f) => f.id),
    removed: existing
      .filter((f) => f.active && !ids.has(f.drive_id))
      .map((f) => f.drive_id),
  };
}
