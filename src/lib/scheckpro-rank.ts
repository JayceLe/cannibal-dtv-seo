import type { AioRankLookup } from "@/lib/aio";

const extensionId = "aiacepmnmgokkgjaplbbloiccdmmfcaa";
const requestTimeout = 20_000;

export function normalizeRankDomain(value: string): string {
  const input = value.trim();
  if (!input || /[\s/?#]/.test(input.replace(/^https?:\/\//i, ""))) {
    throw new Error("Nhập domain hợp lệ, ví dụ dienthoaivui.com.vn.");
  }
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) throw new Error();
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    throw new Error("Nhập domain hợp lệ, ví dụ dienthoaivui.com.vn.");
  }
}

export function isRankDomainMatch(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch { return false; }
}

export function detectSCheckPro(signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || signal?.aborted) { resolve(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    const finish = (found: boolean) => {
      clearTimeout(timer);
      document.removeEventListener("TestScheckProSuccess", onFound);
      signal?.removeEventListener("abort", onAbort);
      resolve(found);
    };
    const onFound = () => finish(true);
    const onAbort = () => finish(false);
    document.addEventListener("TestScheckProSuccess", onFound, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => finish(false), 1_500);
    document.dispatchEvent(new CustomEvent("TestScheckPro"));
  });
}

function requestGoogleHtml(url: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Đã dừng", "AbortError")); return; }
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener("RequestLinkSuccess", onSuccess);
      document.removeEventListener("RequestLinkError", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onSuccess = (event: Event) => {
      cleanup();
      resolve(String((event as CustomEvent).detail || ""));
    };
    const onError = (event: Event) => {
      cleanup();
      const code = String((event as CustomEvent).detail || "");
      reject(new Error(code === "-4"
        ? "Google đang chặn lượt kiểm tra trên Chrome này. Thử lại sau."
        : "SCheckPro không tải được kết quả Google. Thử lại sau."));
    };
    const onAbort = () => { cleanup(); reject(new DOMException("Đã dừng", "AbortError")); };
    document.addEventListener("RequestLinkSuccess", onSuccess, { once: true });
    document.addEventListener("RequestLinkError", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("SCheckPro chưa trả kết quả. Kiểm tra tab xác minh Google rồi thử lại."));
    }, requestTimeout);
    document.dispatchEvent(new CustomEvent("RequestLink", {
      detail: { url, captcha: false, mid: `aio-rank-${Date.now()}` },
    }));
  });
}

export function parseGoogleOrganic(html: string, query: string): { urls: string[]; hasNext: boolean } {
  const page = new DOMParser().parseFromString(html, "text/html");
  const simplify = (value: string) => value.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
  const title = simplify(page.title);
  const queryStart = simplify(query).slice(0, 40);
  if (!page.querySelector("#rso") || !title.includes(queryStart)) {
    throw new Error("Google trả về trang không khớp từ khóa hoặc yêu cầu xác minh. Dừng tra rank để tránh kết quả sai.");
  }
  const urls: string[] = [];
  page.querySelectorAll("#rso h3").forEach((heading) => {
    const raw = heading.closest("a")?.getAttribute("href");
    if (!raw) return;
    try {
      const parsed = new URL(raw, "https://www.google.com");
      const target = parsed.hostname.endsWith("google.com") && parsed.pathname === "/url"
        ? parsed.searchParams.get("q") || "" : parsed.href;
      if (/^https?:\/\//i.test(target)) urls.push(target);
    } catch { /* Ignore malformed Google links. */ }
  });
  return { urls, hasNext: !!page.querySelector("#pnnext") };
}

export async function lookupSCheckProRank(
  domainInput: string, door: string, depth: 10 | 30 | 100, signal?: AbortSignal,
): Promise<AioRankLookup> {
  const domain = normalizeRankDomain(domainInput);
  if (!(await detectSCheckPro(signal))) {
    throw new Error(`Không tìm thấy SCheckPro trên Chrome. Cài hoặc bật tiện ích ${extensionId}, rồi tải lại trang.`);
  }
  let checked = 0;
  for (let start = 0; start < depth; start += 10) {
    if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
    const url = new URL("https://www.google.com/search");
    url.searchParams.set("q", door);
    url.searchParams.set("num", "10");
    url.searchParams.set("start", String(start));
    url.searchParams.set("hl", "vi");
    url.searchParams.set("gl", "vn");
    const { urls, hasNext } = parseGoogleOrganic(await requestGoogleHtml(url.href, signal), door);
    checked += urls.length;
    const index = urls.findIndex((item) => isRankDomainMatch(item, domain));
    if (index >= 0) {
      return { door, domain, rank: start + index + 1, ranking_url: urls[index], checked, depth };
    }
    if (!hasNext) break;
  }
  return { door, domain, rank: null, ranking_url: "", checked, depth };
}
