"use client";

import {
  BookOpen,
  ChartNoAxesCombined,
  Download,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  Upload,
  ScanSearch,
  ListChecks,
} from "lucide-react";
import type { Week } from "@/lib/comparison";
import HeaderDateSelect from "./header-date-select";
import HeaderScene from "./header-scene";

export type DashboardView = "overview" | "compare" | "rankings" | "aio" | "check-rank";

const tabs = [
  { value: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { value: "compare", label: "So sánh", icon: GitCompareArrows },
  { value: "rankings", label: "Thứ hạng", icon: ChartNoAxesCombined },
  { value: "aio", label: "AIO", icon: ScanSearch },
  { value: "check-rank", label: "Check Rank", icon: ListChecks },
] as const;

type Props = {
  view: DashboardView;
  onView: (view: DashboardView) => void;
  periods: Week[];
  selected: string;
  onDate: (id: string) => void;
  onRules: () => void;
  onExport: () => void;
  onImport: () => void;
  onSignOut: () => void;
};

export default function DashboardHeader({
  view,
  onView,
  periods,
  selected,
  onDate,
  onRules,
  onExport,
  onImport,
  onSignOut,
}: Props) {
  return (
    <header className={`app-header header-${view}`} data-motion-reveal="rows">
      <HeaderScene />
      <a className="skip-link" href="#analysis-content">
        Đến nội dung báo cáo
      </a>
      <a className="brand" href="/" aria-label="Cannibal Query — Trang chủ">
        <span className="brand-mark" aria-hidden="true">
          CQ
        </span>
        <span>
          Cannibal Query<small>SEO Intelligence</small>
        </span>
      </a>
      <nav
        className="main-navigation"
        role="tablist"
        aria-label="Báo cáo SEO"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const current = tabs.findIndex((tab) => tab.value === view);
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (current +
                    (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                  tabs.length;
          const next = tabs[index].value;
          onView(next);
          document.getElementById(`${next}-tab`)?.focus();
        }}
      >
        {tabs.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            id={`${value}-tab`}
            role="tab"
            tabIndex={view === value ? 0 : -1}
            aria-selected={view === value}
            aria-controls="analysis-content"
            onClick={() => onView(value)}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      {view !== "aio" && view !== "check-rank" ? (
        <button
          className="btn secondary header-rules-button"
          aria-label="Quy tắc tính cannibal"
          title="Quy tắc tính cannibal"
          aria-haspopup="dialog"
          onClick={onRules}
        >
          <BookOpen size={17} aria-hidden="true" />
          <span>Quy tắc</span>
        </button>
      ) : null}
      {view === "overview" ? (
        <HeaderDateSelect
          periods={periods}
          value={selected}
          onChange={onDate}
        />
      ) : null}
      <div className="header-actions">
        {view === "overview" || view === "compare" ? (
          <>
            <button
              className="btn secondary"
              aria-label="Xuất CSV"
              title="Xuất CSV"
              onClick={onExport}
            >
              <Download size={16} aria-hidden="true" />
              <span>Xuất CSV</span>
            </button>
            <button
              className="btn primary"
              aria-label="Import dữ liệu"
              title="Import dữ liệu"
              onClick={onImport}
            >
              <Upload size={16} aria-hidden="true" />
              <span>Import dữ liệu</span>
            </button>
          </>
        ) : null}
        <button
          className="icon-button account-button"
          aria-label="Đăng xuất workspace"
          title="Đăng xuất workspace"
          onClick={onSignOut}
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
