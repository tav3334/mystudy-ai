import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  admin: () => ({ from: mocks.from }),
  checked: (r: { data: unknown; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  },
}));
import { selectedChunks } from "../src/lib/rag/retrieve";
function query(rows: unknown[], count = rows.length) {
  let start = 0,
    end = rows.length;
  const q = {
    eq: vi.fn(),
    in: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn((n: number) => {
      end = n;
      return q;
    }),
    range: vi.fn((a: number, b: number) => {
      start = a;
      end = b + 1;
      return q;
    }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        data: rows.slice(start, end),
        count,
        error: null,
      }).then(resolve),
  };
  for (const method of [q.eq, q.in, q.select, q.order])
    method.mockReturnValue(q);
  return q;
}
beforeEach(() => vi.clearAllMocks());
describe("question source coverage and ownership", () => {
  it("retrieves current owned passages from the beginning, middle and end of a long document", async () => {
    const docs = query([
      {
        id: "doc",
        name: "Docker.pdf",
        source_url: "https://drive.google.com/file/d/course/view",
        version: "v2",
      },
    ]);
    const all = Array.from({ length: 400 }, (_, i) => ({
      id: "chunk" + i,
      document_id: "doc",
      content: "Docker notion " + i,
      section: null,
      page: i + 1,
    }));
    const queries: ReturnType<typeof query>[] = [];
    mocks.from.mockImplementation((t) => {
      if (t === "documents") return docs;
      const q = query(all);
      queries.push(q);
      return q;
    });
    const chunks = await selectedChunks("owner", ["doc"], "", 96);
    expect(chunks).toHaveLength(96);
    expect(chunks[0].page).toBe(1);
    expect(chunks.at(-1)?.page).toBe(400);
    expect(chunks.some((c) => (c.page ?? 0) > 150 && (c.page ?? 0) < 300)).toBe(
      true,
    );
    expect(docs.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(docs.eq).toHaveBeenCalledWith("status", "ready");
    for (const q of queries) {
      expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
      expect(q.eq).toHaveBeenCalledWith("document_id", "doc");
      expect(q.eq).toHaveBeenCalledWith("version", "v2");
    }
  });
  it("cannot retrieve another account's or unprepared document", async () => {
    mocks.from.mockReturnValue(query([]));
    await expect(selectedChunks("owner", ["foreign"], "", 96)).rejects.toThrow(
      "prepared and owned",
    );
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
