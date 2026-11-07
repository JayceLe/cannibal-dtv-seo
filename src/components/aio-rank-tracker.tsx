"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Download, Upload, ArrowRight, Search, Square } from "lucide-react";
import { aioRequest, downloadAio } from "@/lib/aio-client";
import { motionEase, motionTiming } from "@/lib/motion-tokens";
import { detectSCheckPro, lookupSCheckProRank, normalizeRankDomain } from "@/lib/scheckpro-rank";
import {
  aioScore,
  type AioRankInput,
  type AioRankLookup,
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
  const [domain, setDomain] = useState(() => {
    try { return new URL(result.config.my_url).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  });
  const [depth, setDepth] = useState<10 | 30 | 100>(30);
  const [lookupProgress, setLookupProgress] = useState(0);
  const [lookupResults, setLookupResults] = useState<Record<string, AioRankLookup>>({});
  const [extensionReady, setExtensionReady] = useState<boolean | null>(null);
  const lookupController = useRef<AbortController | null>(null);
  const stopLookup = useRef(false);
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
  useEffect(() => () => {
    stopLookup.current = true;
    lookupController.current?.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void detectSCheckPro(controller.signal).then((ready) => setExtensionReady(ready));
    return () => controller.abort();
  }, []);
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
    const door = rows[index]?.door;
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    if (door) setLookupResults((current) => {
      const next = { ...current };
      delete next[door];
      return next;
    });
    setAnalysis(null);
  }
  async function lookupAll() {
    let trackingDomain: string;
    try { trackingDomain = normalizeRankDomain(domain); }
    catch (error) { setError(error instanceof Error ? error.message : "Domain không hợp lệ."); return; }
    if (!extensionReady) {
      setError("Chưa kết nối SCheckPro. Bật tiện ích trên Chrome rồi tải lại trang.");
      return;
    }
    stopLookup.current = false;
    setDomain(trackingDomain);
    setLookupProgress(0);
    setRows((current) => current.map((row) => lookupResults[row.door]?.rank != null
      ? { ...row, rank: "", ranking_url: "" } : row));
    setLookupResults({});
    await task("lookup", async () => {
      for (let index = 0; index < result.doors.length; index++) {
        if (stopLookup.current) break;
        const controller = new AbortController();
        lookupController.current = controller;
        try {
          const found = await lookupSCheckProRank(
            trackingDomain, result.doors[index].representative, depth, controller.signal,
          );
          setLookupResults((current) => ({ ...current, [found.door]: found }));
          if (found.rank != null) {
            setRows((current) => current.map((row) => row.door === found.door
              ? { ...row, rank: found.rank, ranking_url: found.ranking_url }
              : row));
            setAnalysis(null);
          }
        } catch (error) {
          if (controller.signal.aborted) break;
          throw error;
        } finally {
          lookupController.current = null;
          setLookupProgress(index + 1);
        }
      }
    });
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
      setLookupResults({});
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
        Nhập domain cần tracking. Bảng lấy kết quả Google đầu tiên có cùng tên miền cho từng door, không xét slug của URL.
      </p>
      <div className="aio-rank-lookup" aria-label="Tra thứ hạng tự động">
        <label className="aio-rank-domain">
          <span>Domain tracking</span>
          <input type="text" inputMode="url" autoComplete="off" spellCheck={false}
            placeholder="example.com hoặc URL của site" value={domain} disabled={!!busy}
            onChange={(event) => {
              setRows((current) => current.map((row) => lookupResults[row.door]?.rank != null
                ? { ...row, rank: "", ranking_url: "" } : row));
              setDomain(event.target.value);
              setLookupResults({});
              setAnalysis(null);
            }} />
        </label>
        <label className="aio-rank-depth">
          <span>Phạm vi kiểm tra</span>
          <select value={depth} disabled={!!busy}
            onChange={(event) => setDepth(Number(event.target.value) as 10 | 30 | 100)}>
            <option value={10}>Top 10 · nhanh</option>
            <option value={30}>Top 30 · cân bằng</option>
            <option value={100}>Top 100 · đầy đủ</option>
          </select>
        </label>
        {busy === "lookup" ? (
          <button type="button" className="btn secondary" onClick={() => {
            stopLookup.current = true;
            lookupController.current?.abort();
          }}><Square size={15} aria-hidden="true" /> Dừng</button>
        ) : (
          <button type="button" className="btn primary" disabled={!!busy || extensionReady !== true}
            onClick={() => void lookupAll()}>
            <Search size={16} aria-hidden="true" /> Tra rank tự động
          </button>
        )}
        <p className="aio-rank-lookup-note">
          {extensionReady === null ? "Đang kiểm tra SCheckPro trên Chrome…"
            : extensionReady ? "SCheckPro đã kết nối · không cần API key."
              : <>Chưa tìm thấy <a href="https://chromewebstore.google.com/detail/scheckpro/aiacepmnmgokkgjaplbbloiccdmmfcaa" target="_blank" rel="noopener noreferrer">SCheckPro</a>. Bật tiện ích trên Chrome và tải lại trang.</>}
          {" "}Chỉ tra khi bạn bấm; không lưu kết quả tra cứu. Rank nhập tay vẫn được giữ nếu chưa tìm thấy.
          {busy === "lookup" ? ` Đang kiểm tra ${lookupProgress}/${rows.length} door…` : ""}
        </p>
        {busy === "lookup" ? (
          <div className="aio-rank-lookup-progress" role="progressbar" aria-label="Tiến độ tra rank"
            aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={lookupProgress}>
            <span style={{ width: `${rows.length ? lookupProgress / rows.length * 100 : 0}%` }} />
          </div>
        ) : null}
      </div>
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
                <th scope="row">{row.door}
                  {lookupResults[row.door] ? (
                    <small className="aio-rank-lookup-status">
                      {lookupResults[row.door].rank != null
                        ? `Đã thấy ở vị trí ${lookupResults[row.door].rank}`
                        : `Chưa thấy trong ${lookupResults[row.door].checked} kết quả đã kiểm`}
                    </small>
                  ) : null}
                </th>
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
