// lib/event-constants.ts
export const SCHOOL_SELECTION_SUMMARY_EVENT = "schoolSelectionSummaryUpdated" as const

// 学校ごとの { Name_1: {total, selected}, Name_2: {...} } マップ
export type SelectionSummaryMap = Record<
  string,
  {
    Name_1: { total: number; selected: number; fixed: number }
    Name_2: { total: number; selected: number; fixed: number }
  }
>

// どこからでも同じ名前・同じ形で発火できるようにする
export function emitSchoolSelectionSummary(summary: SelectionSummaryMap) {
  if (typeof window === "undefined") return
  window.__schoolSelectionSummaryCache = summary
  window.dispatchEvent(
    new CustomEvent(SCHOOL_SELECTION_SUMMARY_EVENT, { detail: { summary } })
  )
}

declare global {
  interface Window {
    __schoolSelectionSummaryCache?: SelectionSummaryMap
  }
}
