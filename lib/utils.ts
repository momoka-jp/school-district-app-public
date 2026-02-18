import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export type SchoolMode = "Name_1" | "Name_2"
export type SchoolStatus = "Over" | "Under" | "OK"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 学校名とモードから色を生成する関数
export function getColor(schoolName: string, mode?: SchoolMode) {
  if (!schoolName) return "#cccccc"

  let hash = 0
  for (let i = 0; i < schoolName.length; i++) {
    hash = schoolName.charCodeAt(i) + ((hash << 5) - hash)
  }

  // RGBの値を決定
  let r = (hash & 0xff0000) >> 16
  let g = (hash & 0x00ff00) >> 8
  let b = hash & 0x0000ff

  if (mode === "Name_1") {
    // 小学校区: パステル寄りの色合い
    r = Math.min(255, r + 100)
    g = Math.min(255, g + 100)
    b = Math.min(255, b + 100)
  } else if (mode === "Name_2") {
    // 中学校区: やや渋めの色合い
    r = Math.max(0, r - 50)
    g = Math.max(0, g - 50)
    b = Math.max(0, b - 50)
  }

  return `rgb(${r}, ${g}, ${b})`
}

// 学校のステータスに応じた色を返す関数
export function getStatusColor(status: SchoolStatus): string
export function getStatusColor(status: string): string
export function getStatusColor(status: string) {
  switch (status) {
    case "Over":
      return "red" // 定員超過 → 赤
    case "Under":
      return "blue" // 定員不足 → 青
    case "OK":
      return "green" // 適正 → 緑
    default:
      return "gray" // その他 → グレー
  }
}
