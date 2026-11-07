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
  Layers,
  FileSearch,
  Target,
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
import AioProgressScene from "./aio-progress-scene";
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

export default function AioWorkspace() {
  const motionRoot = useRef<HTMLDivElement>(null);
  const progressFill = useRef<HTMLSpanElement>(null);
  const waitingRef = useRef<HTMLDivElement>(null);
  const progressSectionRef = useRef<HTMLElement>(null);

  const [customModel, setCustomModel] = useState(false);
  const [config, setConfig] = useState<AioConfig>({ ...aioDefaults });
  const [credentials, setCredentials] = useState<AioCredentials>({
    gemini: "",
    serp: "",
  });
  const [run, setRun] = useState<AioRun | null>(null);
  const [result, setResult] = useState<AioResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const working = useRef(false),
    stop = useRef(false),
    alive = useRef(true);

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
            ".aio-flow-stack > .aio-panel",
            { autoAlpha: 0, y: 20 },
            { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.12, clearProps: "all" },
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
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);

  function update<K extends keyof AioConfig>(key: K, value: AioConfig[K]) {
    if (working.current || config[key] === value) return;
    setConfig((before) => ({ ...before, [key]: value }));
    // An edited audit must not display passages, ranks or progress from the previous input.
    setRun(null);
    setResult(null);
    setError("");
    setPaused(false);
  }

  async function execute() {
    if (working.current) return;
    if (!credentials.gemini.trim() ||
        (config.provider !== "none" && !credentials.serp.trim())) {
      setError("Nhập Gemini API key và API key của nhà cung cấp SERP đã chọn.");
      return;
    }
    working.current = true;
    stop.current = false;
    setBusy(true);
    setPaused(false);
    setError("");
    setRun(null);
    setResult(null);

    // Smooth scroll down to progress section when starting run
    setTimeout(() => {
      progressSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 60);

    let current: AioRun | null = null;
    const keys = {
      gemini: credentials.gemini.trim(),
      serp: credentials.serp.trim(),
    };
    try {
      current = await aioRequest<AioRun>({
        action: "start",
        config,
        credentials: keys,
      });
      if (!alive.current) return;
      setRun(current);
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
        if (alive.current) {
          setResult(data);
          // Gently reveal results
          setTimeout(() => {
            document.querySelector(".aio-output")?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
              block: "start",
            });
          }, 300);
        }
      } else if (alive.current) setPaused(true);
    } catch (e) {
      if (!alive.current) return;
      setError(
        e instanceof Error
          ? e.message
          : "Audit chưa hoàn tất. Hãy chạy lại khi kết nối sẵn sàng.",
      );
      setPaused(!!current);
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
    void execute();
  }

  const serpName =
    config.provider === "dataforseo"
      ? "DataForSEO · login:password"
      : config.provider === "serpapi"
        ? "SerpAPI key"
        : "Serper API key";
  const currentPhase = phase(run);

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
                  ? "Phiên gần nhất đã dừng"
                  : "Sẵn sàng"}
          </div>
        </div>
      </header>

      <div className="aio-flow-stack">
        {/* Section 01: Unified Setup Panel (Hình 2 thành 1 khối) */}
        <section
          className="aio-panel aio-setup-unified-panel"
          aria-labelledby="aio-input-title"
        >
          <div className="aio-panel-head">
            <div>
              <span className="aio-eyebrow">01 / Thiết lập</span>
              <h2 id="aio-input-title">Nội dung cần audit</h2>
            </div>
            <span className="aio-count">
              Cấu hình từ khóa mục tiêu, nguồn đối chiếu và kết nối API
            </span>
          </div>

          <form onSubmit={submit} autoComplete="off">
            <fieldset disabled={busy} className="aio-unified-form-grid">
              <legend className="sr-only">Cấu hình audit AIO</legend>

              {/* Column 1: Core Fields & Action CTA */}
              <div className="aio-form-left-col">
                <label className="aio-field">
                  Từ khóa mục tiêu
                  <input
                    required
                    maxLength={500}
                    placeholder="Nhập từ khóa cần phân tích"
                    value={config.keyword}
                    onChange={(e) => update("keyword", e.target.value)}
                  />
                </label>

                <label className="aio-field">
                  URL bài viết của bạn
                  <input
                    required
                    type="url"
                    placeholder="https://example.com/bai-viet"
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
                    disabled={busy}
                  >
                    {busy ? (
                      <>
                        <Sparkles size={16} className="aio-spin-icon" aria-hidden="true" />
                        Đang chạy audit…
                      </>
                    ) : run ? (
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

              {/* Column 2: Analysis Scope Box */}
              <div className="aio-form-right-col">
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
                    <label className="aio-field">
                      URL đối thủ để so sánh
                      <textarea
                        rows={2}
                        value={config.manual_aio}
                        onChange={(e) => update("manual_aio", e.target.value)}
                        placeholder="Mỗi URL một dòng"
                      />
                    </label>
                  </div>
                </section>
              </div>
            </fieldset>
          </form>
        </section>

        {/* Section 02: Dedicated Progress Panel (Đặt dưới khối thiết lập) */}
        <section
          id="aio-progress-section"
          ref={progressSectionRef}
          className="aio-panel aio-progress-unified-panel"
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
                    : paused
                        ? "Phiên audit đã dừng"
                        : "Sẵn sàng bắt đầu"}
              </h2>
            </div>
            <div className="aio-progress-head-actions">
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
              ) : null}
              {run ? (
                <div className="aio-progress-counter-badge">
                  <span className="aio-count-number">{run.progress}%</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* 3D Holographic AI Neural Engine Visualizer */}
          <div className="aio-neural-visualizer-container">
            <AioProgressScene phase={currentPhase} busy={busy} />
            <div className="aio-neural-overlay-badge">
              <span className="aio-neural-dot" />
              <span>
                {!run
                  ? "Chờ bắt đầu audit"
                  : currentPhase === 0
                  ? "Bước 01: Sinh query & gom door"
                  : currentPhase === 1
                    ? `Bước 02: Đọc nội dung (${run.page_index || 0}/${run.urls?.length || 0})`
                    : currentPhase === 2
                      ? "Bước 03: Đối chiếu & chấm điểm"
                      : "Audit đã hoàn tất"}
              </span>
            </div>
            <div className="aio-neural-telemetry-badge">
              <span className="aio-telemetry-pill">AUDIT HIỆN TẠI</span>
              <span className="aio-telemetry-pill">
                {busy ? "ĐANG XỬ LÝ" : result ? "HOÀN TẤT" : run ? "ĐÃ DỪNG" : "CHƯA CHẠY"}
              </span>
            </div>
            <div className="aio-neural-grid-lines" aria-hidden="true" />
          </div>

          {run ? (
            <>
              {/* Rich 3-Stage Cards */}
              <ol className="aio-stages" aria-label="Các bước audit">
                {stages.map((stage, index) => {
                  const isDone = currentPhase > index;
                  const isCurrent = run && currentPhase === index;
                  return (
                    <li
                      key={stage}
                      data-state={isDone ? "done" : isCurrent ? "current" : "waiting"}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`aio-stage-card aio-stage-card-${index + 1}`}
                    >
                      <div className="aio-stage-top">
                        <span className="aio-stage-number">
                          {isDone ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            String(index + 1).padStart(2, "0")
                          )}
                        </span>
                        <span className="aio-stage-status-pill">
                          {isDone ? "Hoàn thành" : isCurrent ? (busy ? "Đang chạy" : "Đã dừng") : "Chờ xử lý"}
                        </span>
                      </div>
                      <div className="aio-stage-info">
                        <strong>{stage}</strong>
                        <span>
                          {index === 0
                            ? "Fan-out từ từ khóa, gom các query tương tự"
                            : index === 1
                              ? "Đọc trang mục tiêu và các nguồn đối chiếu"
                              : "Centering vector và so với đối thủ dẫn đầu"}
                        </span>
                      </div>

                      {/* Live micro-visualizer for active stage */}
                      {isCurrent && busy && (
                        <div className="aio-stage-live-meter">
                          {index === 0 && (
                            <div className="aio-live-queries-chips">
                              <span>{run.config.keyword}</span>
                            </div>
                          )}
                          {index === 1 && (
                            <div className="aio-live-crawl-bar">
                              <span className="aio-crawl-dot" />
                              <span className="aio-crawl-text">
                                Đang đọc URL {run?.page_index || 0} / {run?.urls?.length || 0}
                              </span>
                            </div>
                          )}
                          {index === 2 && (
                            <div className="aio-live-vector-bar">
                              <span className="aio-vector-pulse" />
                              <span className="aio-vector-text">Đang tính độ tương đồng…</span>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* High-Precision Progress Track */}
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
                {busy && paused
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
                              ? "Chọn “Chạy audit mới” để phân tích lại từ đầu."
                              : "Nhập từ khóa, URL và API để chạy audit đầu tiên."}
              </p>

              {/* Waiting state animated skeleton preview cards */}
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
                    <div className="aio-skeleton-card aio-skeleton-card-1">
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
                    <div className="aio-skeleton-card aio-skeleton-card-2">
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
                    <div className="aio-skeleton-card aio-skeleton-card-3">
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
            /* Idle Ready Flow with SEO & AIO Visual Miniatures */
            <div className="aio-ready-flow" aria-label="Ba bước audit">
              {stages.map((stage, index) => (
                <div key={stage} className={`aio-ready-card aio-ready-card-${index + 1}`}>
                  <div className="aio-ready-card-top">
                    <span className="aio-ready-num">{String(index + 1).padStart(2, "0")}</span>
                    {index === 0 ? (
                      <Layers size={18} className="aio-ready-icon" />
                    ) : index === 1 ? (
                      <FileSearch size={18} className="aio-ready-icon" />
                    ) : (
                      <Target size={18} className="aio-ready-icon" />
                    )}
                  </div>
                  <strong>{stage}</strong>
                  <p>
                    {index === 0
                      ? "Mở rộng 5–30 query ngữ nghĩa và phân loại nhóm ý định tìm kiếm."
                      : index === 1
                        ? "Bóc tách từng đoạn văn bản so sánh từ bài của bạn và đối thủ."
                        : "Đo độ lệch vector embedding, xếp hạng và xác định khoảng trống nội dung."}
                  </p>

                  {/* Process labels only. Query examples and metrics must come from a real run. */}
                  {index === 0 && (
                    <div className="aio-ready-diagram aio-diagram-fanout">
                      <div className="aio-mini-search-bar">
                        <span>⌕</span> <em>{config.keyword || "Từ khóa mục tiêu"}</em>
                      </div>
                      <div className="aio-mini-chips">
                        <span>Mở rộng query</span>
                        <span>Gom nhóm ý định</span>
                      </div>
                    </div>
                  )}
                  {index === 1 && (
                    <div className="aio-ready-diagram aio-diagram-crawler">
                      <div className="aio-mini-crawl-row">
                        <span className="aio-crawl-lbl your-lbl">Trang bạn</span>
                        <div className="aio-crawl-track" aria-hidden="true">
                          <div style={{ width: "65%" }} />
                        </div>
                        <span className="aio-crawl-val">Chờ đọc</span>
                      </div>
                      <div className="aio-mini-crawl-row">
                        <span className="aio-crawl-lbl rival-lbl">Đối thủ</span>
                        <div className="aio-crawl-track" aria-hidden="true">
                          <div style={{ width: "85%" }} />
                        </div>
                        <span className="aio-crawl-val">Chờ đọc</span>
                      </div>
                    </div>
                  )}
                  {index === 2 && (
                    <div className="aio-ready-diagram aio-diagram-vector">
                      <div className="aio-mini-vector-bar">
                        <span className="aio-v-tag">Điểm ngữ nghĩa</span>
                        <strong>—</strong>
                      </div>
                      <div className="aio-mini-vector-line" aria-hidden="true">
                        <span className="aio-v-dot v-you" style={{ left: "45%" }} />
                        <span className="aio-v-dot v-rival" style={{ left: "80%" }} />
                      </div>
                      <div className="aio-mini-gap-note">
                        <span>Gap: —</span>
                        <em>Chờ đoạn đối chiếu</em>
                      </div>
                    </div>
                  )}
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
          <AioRankTracker result={result} />
        </div>
      ) : null}
    </div>
  );
}
