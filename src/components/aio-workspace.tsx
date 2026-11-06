"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Pause,
  RotateCcw,
  ScanSearch,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  aioDefaults,
  type AioConfig,
  type AioCredentials,
  type AioResult,
  type AioRun,
} from "@/lib/aio";
import { aioRequest } from "@/lib/aio-client";
import SelectMenu from "./select-menu";
import { completeAioRun } from "@/lib/aio-runner";
import AioResults from "./aio-results";
import AioRankTracker from "./aio-rank-tracker";
import AioHeroScene from "./aio-hero-scene";
import "../app/aio.css";
import "../app/aio-rank-lookup.css";

const stages = ["Sinh query & gom door", "Đọc nội dung", "Chấm điểm"];
const phase = (run: AioRun | null) =>
  run?.stage === "done"
    ? 3
    : run?.stage === "score"
      ? 2
      : run?.stage === "pages"
        ? 1
        : 0;

function ApiField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="aio-field">
      <label htmlFor={id}>{label}</label>
      <span className="aio-api-input">
        <KeyRound size={16} aria-hidden="true" />
        <input
          id={id}
          name={label.includes("Gemini") ? "gemini_api_key" : "serp_api_key"}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Dán API key"
          autoComplete="off"
          spellCheck={false}
          maxLength={4096}
          required
        />
        <button
          type="button"
          className="aio-key-visibility"
          aria-label={`${visible ? "Ẩn" : "Hiện"} ${label}`}
          onClick={() => setVisible(!visible)}
        >
          {visible ? (
            <EyeOff size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </button>
      </span>
    </div>
  );
}

const generationModels = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

export default function AioWorkspace({ userId }: { userId: string }) {
  const motionRoot = useRef<HTMLDivElement>(null);
  const progressFill = useRef<HTMLSpanElement>(null);
  const waitingRef = useRef<HTMLDivElement>(null);
  const [customModel, setCustomModel] = useState(false);
  const [config, setConfig] = useState<AioConfig>({ ...aioDefaults });
  const [credentials, setCredentials] = useState<AioCredentials>({
    gemini: "",
    serp: "",
  });
  const [run, setRun] = useState<AioRun | null>(null);
  const [result, setResult] = useState<AioResult | null>(null);
  const [busy, setBusy] = useState(false);
  const restoring = false;
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const working = useRef(false),
    stop = useRef(false),
    alive = useRef(true);
  const storageKey = `aio-last-run:${userId}`;

  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            ".aio-hero-copy > *",
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.52, stagger: 0.08, clearProps: "all" },
          )
          .fromTo(
            ".aio-hero-status",
            { autoAlpha: 0, scale: 0.95 },
            { autoAlpha: 1, scale: 1, duration: 0.4, clearProps: "all" },
            0.15,
          )
          .fromTo(
            ".aio-setup-grid > .aio-panel",
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.54, stagger: 0.1, clearProps: "all" },
            0.18,
          );
      }, motionRoot);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  const progress = run?.progress ?? 0;
  useEffect(() => {
    const fill = progressFill.current;
    if (!fill) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let tween: gsap.core.Tween | undefined;
    if (reducedMotion.matches) {
      gsap.set(fill, { scaleX: progress / 100 });
    } else {
      tween = gsap.to(fill, {
        scaleX: progress / 100,
        duration: 0.65,
        ease: "power2.out",
        overwrite: true,
      });
    }
    const onPreferenceChange = () => {
      if (!reducedMotion.matches) return;
      tween?.kill();
      gsap.set(fill, { scaleX: progress / 100 });
    };
    reducedMotion.addEventListener("change", onPreferenceChange);
    return () => {
      reducedMotion.removeEventListener("change", onPreferenceChange);
      tween?.kill();
    };
  }, [progress]);

  // Entrance for waiting cards when busy starts
  useEffect(() => {
    if (busy && waitingRef.current) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion) {
        gsap.fromTo(
          waitingRef.current.querySelectorAll(".aio-skeleton-card"),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: "power2.out" },
        );
      }
    }
  }, [busy]);

  useEffect(() => {
    alive.current = true;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage may be disabled. */
    }
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, [storageKey]);

  function update<K extends keyof AioConfig>(key: K, value: AioConfig[K]) {
    setConfig((before) => ({ ...before, [key]: value }));
  }

  async function execute(fresh: boolean) {
    if (working.current || restoring) return;
    if (
      (fresh || run?.stage !== "done") &&
      (!credentials.gemini.trim() ||
        (config.provider !== "none" && !credentials.serp.trim()))
    ) {
      setError("Nhập Gemini API key và API key của nhà cung cấp SERP đã chọn.");
      return;
    }
    working.current = true;
    stop.current = false;
    setBusy(true);
    setPaused(false);
    setError("");
    if (run) setRun({ ...run, error: "" });
    let current = run;
    const keys = {
      gemini: credentials.gemini.trim(),
      serp: credentials.serp.trim(),
    };
    try {
      if (fresh) {
        current = await aioRequest<AioRun>({
          action: "start",
          config,
          credentials: keys,
        });
        if (!alive.current) return;
        setResult(null);
        setRun(current);
      }
      if (!current) return;
      current = await completeAioRun(current, {
        step: (id) => aioRequest<AioRun>({ action: "step", id, credentials: keys }),
        onUpdate: setRun,
        shouldStop: () => stop.current || !alive.current,
        wait: (milliseconds) =>
          new Promise((resolve) => setTimeout(resolve, milliseconds)),
      });
      if (!alive.current) return;
      setRun(current);
      if (current.stage === "done") {
        const data = await aioRequest<AioResult>({
          action: "result",
          id: current.id,
        });
        if (alive.current) setResult(data);
      } else if (alive.current) setPaused(true);
    } catch (e) {
      if (!alive.current) return;
      setError(
        e instanceof Error
          ? e.message
          : "Chưa hoàn tất audit. Có thể tiếp tục bước đang dở.",
      );
      setPaused(true);
      if (current) {
        try {
          const latest = await aioRequest<AioRun>({
            action: "status",
            id: current.id,
          });
          if (alive.current) setRun(latest);
        } catch {
          /* Keep the last usable checkpoint. */
        }
      }
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void execute(!run || (run.stage === "done" && result !== null) || configChanged);
  }

  const serpName =
    config.provider === "dataforseo"
      ? "DataForSEO · login:password"
      : config.provider === "serpapi"
        ? "SerpAPI key"
        : "Serper API key";
  const currentPhase = phase(run);
  const configChanged =
    !!run && JSON.stringify(config) !== JSON.stringify(run.config);

  return (
    <div className="aio-workspace" ref={motionRoot}>
      <header className="aio-page-head">
        <AioHeroScene />
        <div className="aio-hero-inner">
          <div className="aio-hero-copy">
            <span className="aio-hero-kicker">
              <ScanSearch size={16} aria-hidden="true" />
              AIO / CONTENT AUDIT
            </span>
            <h1>Audit nội dung AIO</h1>
            <p>Từ query fan-out đến bằng chứng nội dung và hành động ưu tiên.</p>
          </div>
          <div
            className="aio-hero-status"
            data-state={result ? "done" : busy ? "busy" : "ready"}
          >
            <span className="aio-status-dot" aria-hidden="true" />
            {result
              ? "Đã hoàn tất"
              : busy
                ? "Đang phân tích"
                : run
                  ? "Có thể tiếp tục"
                  : "Sẵn sàng"}
          </div>
        </div>
      </header>

      <div className="aio-setup-grid">
        <section
          className="aio-panel aio-input-panel"
          aria-labelledby="aio-input-title"
        >
          <div className="aio-panel-head">
            <div>
              <span className="aio-eyebrow">01 / Thiết lập</span>
              <h2 id="aio-input-title">Nội dung cần audit</h2>
            </div>
          </div>
          <form onSubmit={submit}>
            <fieldset disabled={busy || restoring} className="aio-fields">
              <legend className="sr-only">Cấu hình audit AIO</legend>
              <div className="aio-content-fields">
                <label className="aio-field">
                  Từ khóa mục tiêu
                  <input
                    required
                    maxLength={500}
                    placeholder="Ví dụ: thay pin iPhone 13"
                    value={config.keyword}
                    onChange={(e) => update("keyword", e.target.value)}
                  />
                </label>
                <label className="aio-field">
                  URL bài viết của bạn
                  <input
                    required
                    type="url"
                    placeholder="https://dienthoaivui.com.vn/..."
                    value={config.my_url}
                    onChange={(e) => update("my_url", e.target.value)}
                  />
                </label>
                <div className="aio-credentials">
                  <div className="aio-section-label">
                    <KeyRound size={15} aria-hidden="true" />
                    <h3>Kết nối API</h3>
                  </div>
                  <div className="aio-two-fields">
                    <ApiField
                      label="Gemini API key"
                      value={credentials.gemini}
                      onChange={(key) =>
                        setCredentials((v) => ({ ...v, gemini: key }))
                      }
                    />
                    {config.provider !== "none" && (
                      <ApiField
                        label={serpName}
                        value={credentials.serp}
                        onChange={(key) =>
                          setCredentials((v) => ({ ...v, serp: key }))
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="aio-form-actions">
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={busy || restoring}
                  >
                    {busy ? (
                      <>
                        <Sparkles size={16} className="aio-spin-icon" aria-hidden="true" />
                        Đang chạy audit…
                      </>
                    ) : run && !configChanged && run.stage !== "done" ? (
                      <>
                        Tiếp tục audit
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    ) : run?.stage === "done" || configChanged ? (
                      <>
                        Chạy audit mới
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Chạy audit
                        <ArrowRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <section className="aio-settings" aria-labelledby="aio-settings-title">
                <div className="aio-settings-heading">
                  <Settings2 size={16} aria-hidden="true" />
                  <h3 id="aio-settings-title">Phạm vi phân tích</h3>
                  <span>
                    {config.n_queries} query · {config.top_competitors} đối thủ
                  </span>
                </div>
                <div className="aio-settings-body">
                  <SelectMenu
                    label="Nhà cung cấp SERP"
                    value={config.provider}
                    onChange={(value) =>
                      update("provider", value as AioConfig["provider"])
                    }
                    options={[
                      { value: "serper", label: "Serper" },
                      { value: "serpapi", label: "SerpAPI" },
                      { value: "dataforseo", label: "DataForSEO" },
                      { value: "none", label: "Không dùng SERP" },
                    ]}
                  />
                  <div className="aio-three-fields">
                    <label className="aio-field">
                      Số query
                      <input
                        type="number"
                        min={5}
                        max={30}
                        step={1}
                        value={config.n_queries}
                        onChange={(e) =>
                          update("n_queries", Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="aio-field">
                      Số đối thủ
                      <input
                        type="number"
                        min={3}
                        max={20}
                        step={1}
                        value={config.top_competitors}
                        onChange={(e) =>
                          update("top_competitors", Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="aio-field">
                      Ngưỡng gom door
                      <input
                        type="number"
                        min={0.5}
                        max={0.99}
                        step={0.01}
                        value={config.threshold}
                        onChange={(e) =>
                          update("threshold", Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <SelectMenu
                    label="Model Gemini sinh query"
                    value={
                      customModel || !generationModels.includes(config.llm_model)
                        ? "custom"
                        : config.llm_model
                    }
                    onChange={(value) => {
                      setCustomModel(value === "custom");
                      if (value !== "custom") update("llm_model", value);
                    }}
                    options={[
                      ...generationModels.map((value) => ({
                        value,
                        label: value,
                      })),
                      { value: "custom", label: "Model khác…" },
                    ]}
                  />
                  {(customModel ||
                    !generationModels.includes(config.llm_model)) && (
                    <label className="aio-field">
                      Tên model
                      <input
                        value={config.llm_model}
                        required
                        onChange={(e) => update("llm_model", e.target.value)}
                      />
                    </label>
                  )}
                  <SelectMenu
                    label="Model embedding so sánh"
                    value={config.embed_model}
                    onChange={(value) => update("embed_model", value)}
                    options={[
                      {
                        value: "gemini-embedding-001",
                        label: "Gemini Embedding 001",
                      },
                      {
                        value: "gemini-embedding-2",
                        label: "Gemini Embedding 2",
                      },
                    ]}
                  />
                  {configChanged && (
                    <p className="aio-description">
                      Cấu hình đã đổi. Chạy audit sẽ áp dụng model mới từ đầu.
                    </p>
                  )}
                  <label className="aio-field">
                    URL đối thủ để so sánh
                    <textarea
                      rows={3}
                      value={config.manual_aio}
                      onChange={(e) => update("manual_aio", e.target.value)}
                      placeholder="Mỗi URL một dòng"
                    />
                  </label>
                </div>
              </section>
            </fieldset>
          </form>
        </section>

        <section
          className="aio-panel aio-progress-panel"
          data-state={result ? "done" : busy ? "busy" : run ? "paused" : "ready"}
          aria-labelledby="aio-progress-title"
        >
          <div className="aio-panel-head">
            <div>
              <span className="aio-eyebrow">02 / Tiến trình</span>
              <h2 id="aio-progress-title">
                {result
                  ? "Audit đã hoàn tất"
                  : busy
                    ? "Đang phân tích nội dung"
                    : restoring
                      ? "Đang mở phiên audit"
                      : paused
                        ? "Audit đã lưu tiến độ"
                        : "Sẵn sàng bắt đầu"}
              </h2>
            </div>
            {busy ? (
              <button
                className="btn secondary"
                disabled={paused}
                onClick={() => {
                  stop.current = true;
                  setPaused(true);
                }}
              >
                <Pause size={15} aria-hidden="true" />
                {paused ? "Đang dừng…" : "Tạm dừng"}
              </button>
            ) : run ? (
              <span className="aio-count">{run.progress}%</span>
            ) : null}
          </div>

          {run ? (
            <>
              <ol className="aio-stages" aria-label="Các bước audit">
                {stages.map((stage, index) => (
                  <li
                    key={stage}
                    data-state={
                      currentPhase > index
                        ? "done"
                        : run && currentPhase === index
                          ? "current"
                          : "waiting"
                    }
                    aria-current={
                      run && currentPhase === index ? "step" : undefined
                    }
                  >
                    <span className="aio-stage-number">
                      {currentPhase > index ? (
                        <Check size={16} aria-hidden="true" />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <div>
                      <strong>{stage}</strong>
                      <span>
                        {index === 0
                          ? "Fan-out từ từ khóa, gom các query tương tự"
                          : index === 1
                            ? "Đọc trang mục tiêu và các nguồn đối chiếu"
                            : "Centering vector và so với đối thủ dẫn đầu"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>

              <div
                className="aio-progress-track"
                role="progressbar"
                aria-label="Tiến độ audit"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={run.progress || 0}
              >
                <span ref={progressFill} />
              </div>

              <p className="aio-progress-caption" role="status">
                {restoring
                  ? "Đang kiểm tra phiên audit gần nhất…"
                  : busy && paused
                    ? "Hoàn tất bước đang chạy rồi tạm dừng."
                    : run?.stage === "done"
                      ? `${run.door_count} door đã có kết quả. Xem bảng bên dưới.`
                      : busy && run?.retry_after
                        ? "Đang chờ quota API, audit sẽ tự tiếp tục…"
                        : run?.stage === "pages"
                          ? `${run.page_index} / ${run.urls?.length || 0} trang đã xử lý${paused ? " · Tiến độ đã lưu" : ""}`
                          : busy
                            ? "API đang xử lý, có thể cần chờ theo giới hạn quota."
                            : paused
                              ? "Chọn “Tiếp tục audit” để chạy phần còn lại."
                              : "Nhập từ khóa, URL và API để chạy audit đầu tiên."}
              </p>

              {/* Waiting state visualizer and animated skeleton cards */}
              {busy && (
                <div className="aio-waiting-area" ref={waitingRef} aria-live="polite">
                  <div className="aio-live-scanner">
                    <div className="aio-scanner-pulse">
                      <span className="aio-pulse-ring" />
                      <span className="aio-pulse-dot" />
                    </div>
                    <div className="aio-scanner-info">
                      <div className="aio-scanner-title">
                        <strong>
                          {currentPhase === 0
                            ? "Đang sinh query fan-out và gom cụm door…"
                            : currentPhase === 1
                              ? `Đang đọc nội dung bài viết và đối thủ (${run.page_index || 0}/${run.urls?.length || 0})…`
                              : "Đang tính toán vector embeddings và đối chiếu điểm số…"}
                        </strong>
                        <span className="aio-scanner-tag">
                          {currentPhase === 0
                            ? "Query Fan-out"
                            : currentPhase === 1
                              ? "Crawl Pages"
                              : "Vector Scoring"}
                        </span>
                      </div>
                      <div className="aio-scanner-beam-track">
                        <span className="aio-scanner-beam" />
                      </div>
                    </div>
                  </div>

                  <div className="aio-skeleton-grid" aria-label="Đang chuẩn bị kết quả door">
                    <div className="aio-skeleton-card">
                      <div className="aio-skeleton-head">
                        <span className="aio-shimmer aio-skel-title" />
                        <span className="aio-shimmer aio-skel-badge" />
                      </div>
                      <div className="aio-skeleton-body">
                        <span className="aio-shimmer aio-skel-line w-85" />
                        <span className="aio-shimmer aio-skel-line w-65" />
                        <div className="aio-skel-score-row">
                          <span className="aio-shimmer aio-skel-box" />
                          <span className="aio-shimmer aio-skel-box" />
                        </div>
                      </div>
                    </div>
                    <div className="aio-skeleton-card">
                      <div className="aio-skeleton-head">
                        <span className="aio-shimmer aio-skel-title" />
                        <span className="aio-shimmer aio-skel-badge" />
                      </div>
                      <div className="aio-skeleton-body">
                        <span className="aio-shimmer aio-skel-line w-90" />
                        <span className="aio-shimmer aio-skel-line w-70" />
                        <div className="aio-skel-score-row">
                          <span className="aio-shimmer aio-skel-box" />
                          <span className="aio-shimmer aio-skel-box" />
                        </div>
                      </div>
                    </div>
                    <div className="aio-skeleton-card">
                      <div className="aio-skeleton-head">
                        <span className="aio-shimmer aio-skel-title" />
                        <span className="aio-shimmer aio-skel-badge" />
                      </div>
                      <div className="aio-skeleton-body">
                        <span className="aio-shimmer aio-skel-line w-80" />
                        <span className="aio-shimmer aio-skel-line w-60" />
                        <div className="aio-skel-score-row">
                          <span className="aio-shimmer aio-skel-box" />
                          <span className="aio-shimmer aio-skel-box" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="aio-ready-flow" aria-label="Ba bước audit">
              {stages.map((stage, index) => (
                <div key={stage} className={`aio-ready-card aio-ready-card-${index + 1}`}>
                  <span className="aio-ready-num">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{stage}</strong>
                  <p>
                    {index === 0
                      ? "Mở rộng 5–30 query ngữ nghĩa và phân loại nhóm ý định tìm kiếm."
                      : index === 1
                        ? "Bóc tách từng đoạn văn bản so sánh từ bài của bạn và đối thủ."
                        : "Đo độ lệch vector embedding, xếp hạng và xác định khoảng trống nội dung."}
                  </p>
                </div>
              ))}
            </div>
          )}

          {error || run?.error ? (
            <div className="error-message" role="alert">
              {error || run?.error}
            </div>
          ) : null}

          {run?.logs.length ? (
            <details className="aio-disclosure">
              <summary>
                <RotateCcw size={14} aria-hidden="true" />
                Nhật ký xử lý <span>{run.logs.length} dòng</span>
              </summary>
              <pre>{run.logs.join("\n")}</pre>
            </details>
          ) : null}
        </section>
      </div>

      {result ? (
        <div className="aio-output" key={result.id}>
          <AioResults result={result} />
          <div className="aio-next-step">
            <span>03 / Chuyển kết quả thành hành động</span>
          </div>
          <AioRankTracker result={result} credentials={credentials} />
        </div>
      ) : null}
    </div>
  );
}
