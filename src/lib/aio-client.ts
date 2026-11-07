import { db } from "./supabase";
export async function aioRequest<T>(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const {
    data: { session },
  } = await db().auth.getSession();
  if (!session) throw new Error("Đăng nhập lại workspace để sử dụng AIO.");
  const response = await fetch("/api/aio", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error ||
        `Bước audit chưa hoàn tất (HTTP ${response.status}). Có thể tiếp tục phiên hiện tại.`,
    );
  }
  if (response.headers.get("content-type")?.includes("spreadsheetml"))
    return (await response.blob()) as T;
  return response.json() as Promise<T>;
}
export function downloadAio(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
