export type AioConfig = {
  keyword: string;
  my_url: string;
  n_queries: number;
  top_competitors: number;
  threshold: number;
  provider: "serper" | "serpapi" | "dataforseo" | "none";
  llm_model: string;
  embed_model: string;
  country: string;
  language: string;
  location: string;
  generation_language: string;
  manual_aio: string;
};
export const aioDefaults: AioConfig = {
  keyword: "",
  my_url: "",
  n_queries: 15,
  top_competitors: 10,
  threshold: 0.85,
  provider: "serper",
  llm_model: "gemini-3.8-flash",
  embed_model: "gemini-embedding-001",
  country: "vn",
  language: "vi",
  location: "Vietnam",
  generation_language: "Vietnamese",
  manual_aio: "",
};
export type AioCredentials = { gemini: string; serp: string };
export type AioRun = {
  id: string;
  stage: "fanout" | "pages" | "score" | "done";
  config: AioConfig;
  page_index: number;
  urls?: string[];
  door_count?: number;
  progress: number;
  retry_after?: number;
  logs: string[];
  error: string;
};
export type AioDoor = {
  representative: string;
  members: string[];
  member_indices: number[];
};
export type AioRow = {
  door: string;
  merged_variants: number;
  your_score: number | null;
  best_rival_score: number | null;
  gap: number | null;
  your_rank: string;
  spread: number | null;
  verdict: string;
  reason?: string;
  evidence_label?: string;
  best_rival: string;
  your_best_passage: string;
};
export type AioPassage = {
  score: number | null;
  passage: string;
  comparison?: { url: string; score: number; gap: number | null; passage: string } | null;
  rivals: { url: string; score: number; gap: number | null; passage: string }[];
};
export type AioResult = {
  id: string;
  config: AioConfig;
  rows: AioRow[];
  doors: AioDoor[];
  competitors: string[];
  passages: Record<string, AioPassage>;
  query_count: number;
  read_competitors: number;
};
export type AioRankInput = {
  door: string;
  rank: number | string | null;
  ranking_url: string;
};
export type AioRankLookup = {
  door: string;
  domain: string;
  rank: number | null;
  ranking_url: string;
  checked: number;
  depth: 10 | 30 | 100;
};
export type AioQueue = {
  action: string;
  door: string;
  rank: number | null;
  ranking_url: string;
  url_match: string;
  gap: number | null;
  verdict: string;
};
export type AioRankResult = {
  input: AioRankInput[];
  rows: AioQueue[];
  summary: string;
  k: number;
  total: number;
  probability: number;
  increment: number;
};
export const aioTone = (value: string) =>
  value.startsWith("AHEAD")
    ? "safe"
    : value.startsWith("BEHIND")
      ? "danger"
      : value.startsWith("PARITY")
        ? "medium"
        : "neutral";
export const aioVerdict = (value: string) =>
  value.startsWith("AHEAD")
    ? "Dẫn đầu"
    : value.startsWith("BEHIND - clear")
      ? "Gap điểm rõ"
      : value.startsWith("BEHIND")
        ? "Gap điểm nhỏ"
        : value.startsWith("PARITY - field")
          ? "Điểm tương đương"
          : value.startsWith("PARITY")
            ? "Chênh lệch nhỏ"
            : value.startsWith("INSUFFICIENT - no comparable passage")
              ? "Thiếu đoạn khớp"
              : value.startsWith("INSUFFICIENT")
                ? "Chưa đủ căn cứ"
                : "Ít đối thủ";
export const aioScore = (value: number | null, digits = 4) =>
  value == null
    ? "—"
    : value.toLocaleString("vi-VN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export function readApiKey(text: string) {
  const raw = text.trim();
  if (!raw) throw new Error("File API key đang trống.");
  if (raw.startsWith("{")) {
    const data = JSON.parse(raw);
    const key = data.api_key ?? data.key;
    if (typeof key !== "string" || !key.trim())
      throw new Error("File JSON cần trường api_key hoặc key.");
    return key.trim();
  }
  return raw;
}
