"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Download, Upload, ArrowRight } from "lucide-react";
import { aioRequest, downloadAio } from "@/lib/aio-client";
import { motionEase, motionTiming } from "@/lib/motion-tokens";
import {
  aioScore,
  type AioRankInput,
  type AioRankResult,
  type AioResult,
} from "@/lib/aio";
import { AioUrl } from "./aio-results";

const actions: Record<string, string> = {
  "7": "Kiểm tra nội dung cho query",
  "1": "Đang hiệu quả",
  "2": "Viết lại nội dung",
  "3": "Hợp nhất URL",
  "4": "Viết lại & hợp nhất",
  "5": "Tăng độ hiển thị",
  "6": "Ưu tiên thấp",
};

export default function AioRankTracker({ result }: { result: AioResult }) {
  const panelRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<AioRankInput[]>(() =>
    result.doors.map((d) => ({
      door: d.representative,
      rank: "",
      ranking_url: "",
    })),
  );
  const [analysis, setAnalysis] = useState<AioRankResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const working = useRef(false);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(
          ":scope > .aio-panel-head, :scope > .aio-description, :scope > .aio-toolbar",
          { opacity: 0.72, y: 7 },
          {
            opacity: 1,
            y: 0,
            duration: motionTiming.open,
            stagger: 0.04,
            ease: motionEase.reveal,
            clearProps: "opacity,transform",
          },
        );
      }, panelRef);
      return () => context.revert();
    });
    return () => media.revert();
  }, [result.id]);
  async function task(name: string, work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(name);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xử lý được bảng rank.");
    } finally {
      working.current = false;
      setBusy("");
    }
  }
  function update(index: number, field: "rank" | "ranking_url", value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    setAnalysis(null);
  }
  async function importFile(file?: File) {
    if (!file) return;
    await task("import", async () => {
      if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024)
        throw new Error("Chọn file XLSX tối đa 2 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let raw = "";
      for (let i = 0; i < bytes.length; i += 8192)
        raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const data = await aioRequest<AioRankResult>({
        action: "import_ranks",
        id: result.id,
        name: file.name,
        file: btoa(raw),
      });
      setRows(data.input);
      setAnalysis(data);
    });
  }
  return (
    <section ref={panelRef} className="aio-panel" aria-labelledby="aio-ranks-title">
      <div className="aio-panel-head">
        <div>
          <span className="aio-eyebrow">Rank Tracker</span>
          <h2 id="aio-ranks-title">Từ kết quả audit đến hành động</h2>
        </div>
        <span className="aio-count">
          {result.doors.length} door · {result.config.keyword}
        </span>
      </div>
      <p className="aio-description">
        Nhập rank Google và URL đang xếp hạng cho từng door. Không có rank thì
        để trống cả rank và URL.
      </p>
      <div className="aio-toolbar">
        <button
          className="btn secondary"
          disabled={!!busy}
          onClick={() =>
            void task("template", async () =>
              downloadAio(
                await aioRequest<Blob>({ action: "template", id: result.id }),
                "aio-rank-mau.xlsx",
              ),
            )
          }
        >
          <Download size={16} aria-hidden="true" />
          Tải mẫu XLSX
        </button>
        <label
          className={`btn secondary aio-file-button ${busy ? "is-disabled" : ""}`}
        >
          <Upload size={16} aria-hidden="true" />
          Import rank XLSX
          <input
            type="file"
            accept=".xlsx"
            disabled={!!busy}
            aria-label="Import rank XLSX"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="btn secondary"
          disabled={!!busy}
          onClick={() =>
            void task("export", async () =>
              downloadAio(
                await aioRequest<Blob>({
                  action: "export_ranks",
                  id: result.id,
                  rows,
                }),
                "aio-rank-da-nhap.xlsx",
              ),
            )
          }
        >
          <Download size={16} aria-hidden="true" />
          Xuất bảng đang nhập
        </button>
      </div>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className="aio-table-scroll"
        role="region"
        tabIndex={0}
        aria-label="Nhập rank và URL cho từng door"
      >
        <table className="aio-table aio-rank-input">
          <thead>
            <tr>
              <th scope="col">Door</th>
              <th scope="col">Rank Google</th>
              <th scope="col">URL đang xếp hạng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.door}>
                <th scope="row">{row.door}</th>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`Rank Google: ${row.door}`}
                    placeholder="Chưa có"
                    value={row.rank ?? ""}
                    disabled={!!busy}
                    onChange={(e) => update(index, "rank", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    aria-label={`URL xếp hạng: ${row.door}`}
                    placeholder="https://..."
                    value={row.ranking_url}
                    disabled={!!busy}
                    onChange={(e) =>
                      update(index, "ranking_url", e.target.value)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="aio-rank-submit">
        <span className="aio-description">
          Giữ đủ danh sách door của audit hiện tại.
        </span>
        <button
          className="btn primary"
          disabled={!!busy}
          onClick={() =>
            void task("analysis", async () =>
              setAnalysis(
                await aioRequest<AioRankResult>({
                  action: "ranks",
                  id: result.id,
                  rows,
                }),
              ),
            )
          }
        >
          {busy === "analysis" ? "Đang phân tích…" : "Phân tích rank & URL"}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {busy ? (
        <p className="aio-description" role="status">
          Đang xử lý{" "}
          {busy === "import"
            ? "file XLSX"
            : busy === "analysis"
              ? "rank và URL"
              : "file tải về"}
          …
        </p>
      ) : null}
      {analysis ? (
        <div className="aio-rank-results">
          <div className="aio-rank-summary">
            <div>
              <span>Door có rank</span>
              <strong>
                {analysis.k}
                <small> / {analysis.total}</small>
              </strong>
            </div>
            <div>
              <span>P(retrieved) ước tính</span>
              <strong>{aioScore(analysis.probability * 100, 0)}%</strong>
            </div>
            <div>
              <span>Thêm một door</span>
              <strong>
                +{aioScore(analysis.increment, 1)}
                <small> điểm %</small>
              </strong>
            </div>
          </div>
          <p className="aio-description">
            P(retrieved) giữ công thức notebook, dùng như mức trần tham khảo.
          </p>
          <h3>Danh sách hành động</h3>
          <div
            className="aio-table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Hành động từ kết quả rank"
          >
            <table className="aio-table">
              <thead>
                <tr>
                  <th scope="col">Hành động</th>
                  <th scope="col">Door</th>
                  <th scope="col" className="aio-numeric">
                    Rank
                  </th>
                  <th scope="col">URL / đối chiếu</th>
                  <th scope="col" className="aio-numeric">
                    Gap theo điểm
                  </th>
                  <th scope="col">Kết luận audit</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map((row) => (
                  <tr key={row.door}>
                    <td>
                      <span
                        className={`aio-badge aio-action-${row.action[0]}`}
                        title={row.action}
                      >
                        {row.action[0]} · {actions[row.action[0]] || row.action}
                      </span>
                      <small>
                        {row.action.includes("UNKNOWN") ||
                        row.url_match === "UNKNOWN"
                          ? "Chưa có URL để đối chiếu"
                          : ""}
                      </small>
                    </td>
                    <th scope="row">{row.door}</th>
                    <td className="aio-numeric">{row.rank ?? "—"}</td>
                    <td>
                      <AioUrl url={row.ranking_url} />
                      <small>
                        {row.url_match === "CORRECT TARGET"
                          ? "Đúng URL mục tiêu"
                          : row.url_match === "OTHER PAGE"
                            ? "Trang khác trong domain"
                            : row.url_match === "UNKNOWN"
                              ? "Chưa có URL"
                              : "Chưa có rank"}
                      </small>
                    </td>
                    <td className="aio-numeric">{aioScore(row.gap)}</td>
                    <td className="aio-original-verdict">{row.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="aio-disclosure">
            <summary>Quy tắc và thống kê gốc</summary>
            <pre>{analysis.summary}</pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
