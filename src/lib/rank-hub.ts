export const MAX_RANK_KEYWORDS = 30_000;

export type RankDepth = 10 | 30 | 100;
export type RankPoint = { at: string; rank: number | null; url: string };
export type RankProject = {
  id: string;
  owner: string;
  name: string;
  domain: string;
  depth: RankDepth;
  count: number;
  cursor: number;
  createdAt: string;
  updatedAt: string;
};
export type RankKeyword = {
  id: string;
  projectId: string;
  keyword: string;
  rank: number | null;
  previousRank: number | null;
  bestRank: number | null;
  url: string;
  updatedAt: string;
  history: RankPoint[];
};

export function keywordKey(keyword: string): string {
  return keyword.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

export function parseKeywords(values: Iterable<unknown>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
    if (!text) continue;
    if (text.length > 300) throw new Error(`Từ khóa vượt 300 ký tự: ${text.slice(0, 60)}…`);
    const key = keywordKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length > MAX_RANK_KEYWORDS) throw new Error(`Mỗi dự án tối đa ${MAX_RANK_KEYWORDS.toLocaleString("vi-VN")} từ khóa.`);
  }
  return output;
}

export function extractKeywordColumn(rows: unknown[][]): string[] {
  const sample = rows.slice(0, 12);
  const header = sample.findIndex(row => row.some(cell => /^(từ khóa|tu khoa|keyword|keywords)$/i.test(String(cell ?? "").trim())));
  const column = header >= 0
    ? rows[header].findIndex(cell => /^(từ khóa|tu khoa|keyword|keywords)$/i.test(String(cell ?? "").trim()))
    : rows[0]?.length > 1 && rows[0][0] !== "" && /^\d+$/.test(String(rows[0][0])) ? 1 : 0;
  return parseKeywords(rows.slice(header + 1).map(row => row[column]));
}

export function applyRankResult(row: RankKeyword, rank: number | null, url: string, at: string): RankKeyword {
  return {
    ...row,
    previousRank: row.updatedAt ? row.rank : null,
    rank,
    bestRank: rank === null ? row.bestRank : Math.min(row.bestRank ?? rank, rank),
    url: rank === null ? "" : url,
    updatedAt: at,
    history: [...row.history, { at, rank, url: rank === null ? "" : url }],
  };
}

export function rankMovement(row: RankKeyword): number | null {
  return row.rank === null || row.previousRank === null ? null : row.previousRank - row.rank;
}

const DB_NAME = "cannibal-rank-hub-v1";
const DB_VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không đọc được dữ liệu rank."));
  });
}

function transaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Không lưu được dữ liệu rank."));
    tx.onabort = () => reject(tx.error ?? new Error("Không lưu được dữ liệu rank."));
  });
}

export function openRankDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Trình duyệt này không hỗ trợ lưu dự án rank.")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("projects", { keyPath: "id" }).createIndex("owner", "owner");
      db.createObjectStore("keywords", { keyPath: "id" }).createIndex("projectId", "projectId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không mở được dữ liệu rank."));
    req.onblocked = () => reject(new Error("Đóng các tab cũ của website rồi thử lại."));
  });
}

export async function listRankProjects(db: IDBDatabase, owner: string): Promise<RankProject[]> {
  const result = await request(db.transaction("projects").objectStore("projects").index("owner").getAll(owner) as IDBRequest<RankProject[]>);
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listRankKeywords(db: IDBDatabase, projectId: string): Promise<RankKeyword[]> {
  return request(db.transaction("keywords").objectStore("keywords").index("projectId").getAll(projectId) as IDBRequest<RankKeyword[]>);
}

export async function saveRankProject(db: IDBDatabase, project: RankProject): Promise<void> {
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put(project);
  await transaction(tx);
}

export async function saveRankKeywords(db: IDBDatabase, rows: RankKeyword[]): Promise<void> {
  for (let start = 0; start < rows.length; start += 500) {
    const tx = db.transaction("keywords", "readwrite");
    const store = tx.objectStore("keywords");
    for (const row of rows.slice(start, start + 500)) store.put(row);
    await transaction(tx);
  }
}

export async function removeRankKeywords(db: IDBDatabase, ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 500) {
    const tx = db.transaction("keywords", "readwrite");
    const store = tx.objectStore("keywords");
    for (const id of ids.slice(start, start + 500)) store.delete(id);
    await transaction(tx);
  }
}

export async function removeRankProject(db: IDBDatabase, projectId: string): Promise<void> {
  const rows = await listRankKeywords(db, projectId);
  await removeRankKeywords(db, rows.map(row => row.id));
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").delete(projectId);
  await transaction(tx);
}
