import type { SourceChunk } from "@/lib/ai/schemas";
const stop = new Set(
  "le la les un une des du de d et ou en au aux pour par avec sans sur dans ce ces cette que qui qu est sont a the a an of and or to in on for with is are chapitre chapter".split(
    " ",
  ),
);
function words(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}
function terms(value: string) {
  return [
    ...new Set(
      words(value).filter(
        (w) => !stop.has(w) && (w.length >= 2 || /^\d+$/.test(w)),
      ),
    ),
  ];
}
export function rankSourceChunks(
  chunks: SourceChunk[],
  query: string,
  limit = 24,
): SourceChunk[] {
  const search = terms(query);
  if (!search.length) return [];
  const indexed = chunks.map((chunk) => ({
    chunk,
    body: words(chunk.content),
    heading: words(`${chunk.section ?? ""} ${chunk.document_name}`),
  }));
  const average =
    indexed.reduce((n, row) => n + row.body.length, 0) /
    Math.max(1, indexed.length);
  const frequencies = new Map(
    search.map((term) => [
      term,
      indexed.filter(
        (row) => row.body.includes(term) || row.heading.includes(term),
      ).length,
    ]),
  );
  return indexed
    .map((row, order) => {
      let score = 0;
      for (const term of search) {
        const tf = row.body.filter((w) => w === term).length;
        const heading = row.heading.includes(term);
        if (!tf && !heading) continue;
        const idf = Math.log(
          1 +
            (indexed.length - (frequencies.get(term) ?? 0) + 0.5) /
              ((frequencies.get(term) ?? 0) + 0.5),
        );
        score +=
          idf *
            ((tf * 2.2) /
              (tf +
                1.2 *
                  (0.25 + (0.75 * row.body.length) / Math.max(1, average)))) +
          (heading ? 2 * idf : 0);
      }
      return { chunk: row.chunk, score, order };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((row) => row.chunk);
}
