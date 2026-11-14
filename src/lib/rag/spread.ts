export function spreadAcross<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 1) return items.slice(0, Math.max(0, limit));
  return Array.from(
    { length: limit },
    (_, i) => items[Math.floor((i * (items.length - 1)) / (limit - 1))],
  );
}
export function interleave<T>(groups: T[][]): T[] {
  const result: T[] = [];
  for (let i = 0; i < Math.max(0, ...groups.map((g) => g.length)); i++)
    for (const group of groups) if (i < group.length) result.push(group[i]);
  return result;
}
