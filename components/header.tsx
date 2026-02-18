"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, X, School, GraduationCap } from "lucide-react"

interface HeaderProps {
  selectedMode: "Name_1" | "Name_2"
  sidePanelOpen: boolean
  selectedSchool: string | null
  onToggleSidePanel: () => void
  onSwitchToElementaryMode: () => void
  onSwitchToMiddleSchoolMode: () => void

  // ▼ 追加
  isEditing: boolean
  onToggleEditing: (enable: boolean) => void
}

export default function Header({
  selectedMode,
  sidePanelOpen,
  selectedSchool,
  onToggleSidePanel,
  onSwitchToElementaryMode,
  onSwitchToMiddleSchoolMode,
  // ▼ 追加
  isEditing,
  onToggleEditing,
}: HeaderProps) {
  const isSchoolSelected = selectedSchool !== null

  // 目標モードに切り替えるときの共通ガード
  const requestModeChange = (target: "Name_1" | "Name_2", action: () => void) => {
    if (selectedMode === target) return
    if (isSchoolSelected && selectedMode !== target) {
      window.alert("学校の選択を解除してからモードを変更してください。")
      return
    }
    action()
  }

  const handleClickEditToggle = () => {
    if (!isSchoolSelected) return
    onToggleEditing(!isEditing)
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm z-50">
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左側: サイドパネル切り替えとタイトル */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleSidePanel} className="p-2">
            {sidePanelOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <h1 className="text-xl font-bold text-gray-900">学校区最適化・可視化システム</h1>
        </div>

        {/* 中央: モード切り替えボタン */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestModeChange("Name_1", onSwitchToElementaryMode)}
            className={`flex items-center gap-2 ${
              selectedMode === "Name_1"
                ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            } ${
              isSchoolSelected && selectedMode !== "Name_1" ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={isSchoolSelected && selectedMode !== "Name_1" ? "学校の選択を解除してからモードを変更してください" : ""}
          >
            <School size={16} />
            小学校区
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => requestModeChange("Name_2", onSwitchToMiddleSchoolMode)}
            className={`flex items-center gap-2 ${
              selectedMode === "Name_2"
                ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            } ${
              isSchoolSelected && selectedMode !== "Name_2" ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={isSchoolSelected && selectedMode !== "Name_2" ? "学校の選択を解除してからモードを変更してください" : ""}
          >
            <GraduationCap size={16} />
            中学校区
          </Button>
        </div>

        {/* 右側: 編集トグル＋現在のモード表示 */}
        <div className="flex items-center gap-3">
          {/* 編集トグル */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">校区拡大</span>
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={handleClickEditToggle}
              disabled={!isSchoolSelected}
              aria-pressed={isEditing}
              aria-label={
                !isSchoolSelected ? "学校を選択すると校区拡大を開始できます" : isEditing ? "編集を完了" : "編集を開始"
              }
              className="flex items-center gap-2 px-3"
            >
              {isEditing ? "✅完了" : "🖊編集"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
