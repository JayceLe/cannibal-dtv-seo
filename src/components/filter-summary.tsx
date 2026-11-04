"use client";
import { X } from "lucide-react";

export type FilterChip = { key: string; label: string; clear: () => void };

/** A view of existing filter state; it owns no filtering or data logic. */
export default function FilterSummary({
  chips,
  onClear,
}: {
  chips: FilterChip[];
  onClear: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="filter-summary" aria-label="Bộ lọc đang áp dụng">
      <span>Đang xem</span>
      <ul>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={chip.clear}
              aria-label={`Bỏ lọc ${chip.label}`}
            >
              <span>{chip.label}</span>
              <X size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="text-link" onClick={onClear}>
        Xóa tất cả
      </button>
    </div>
  );
}
