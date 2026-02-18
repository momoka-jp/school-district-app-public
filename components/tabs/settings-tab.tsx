"use client"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus, Target, Clock } from "lucide-react"
import type { DisplaySettings } from "@/types/map-types"

interface SettingsTabProps {
  opacity: number
  populationMultiplier: number
  selectedYear: number
  availableYears: number[]  
  displaySettings: DisplaySettings
  penaltyPlus: number
  penaltyMinus: number
  timeLimitSec: number
  mipGap: number
  onOpacityChange: (value: number[]) => void
  onPopulationChange: (value: number[]) => void
  onYearChange: (value: number[]) => void
  onDisplaySettingChange: (setting: string, checked: boolean) => void
  onPenaltyPlusChange: (v: number) => void
  onPenaltyMinusChange: (v: number) => void
  onTimeLimitSecChange: (v: number) => void
  onMipGapChange: (v: number) => void
}

export default function SettingsTab({
  opacity,
  populationMultiplier,
  selectedYear,
  availableYears, 
  displaySettings,
  penaltyPlus,
  penaltyMinus,
  timeLimitSec,
  mipGap,
  onOpacityChange,
  onPopulationChange,
  onYearChange,
  onDisplaySettingChange,
  onPenaltyPlusChange,
  onPenaltyMinusChange,
  onTimeLimitSecChange,
  onMipGapChange,
}: SettingsTabProps) {
  // ★ 年度一覧（空ならフォールバック）
  const yearList = availableYears.length
    ? [...availableYears].sort()
    : [2025, 2026, 2027, 2028, 2029, 2030, 2031]

  const minYear = yearList[0]
  const maxYear = yearList[yearList.length - 1]
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-bold mb-4">表示設定</h3>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="elementarySchools" className="text-sm font-medium">
                小学校
              </Label>
              <Switch
                id="elementarySchools"
                checked={displaySettings.elementarySchools}
                onCheckedChange={(checked) => onDisplaySettingChange("elementarySchools", checked)}
                className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
              />
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="elementaryMarkers" className="text-xs text-gray-600">
                  マーカーを表示
                </Label>
                <Switch
                  id="elementaryMarkers"
                  checked={displaySettings.elementaryMarkers}
                  disabled={!displaySettings.elementarySchools}
                  onCheckedChange={(checked) => onDisplaySettingChange("elementaryMarkers", checked)}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="elementaryLabels" className="text-xs text-gray-600">
                  学校名ラベルを表示
                </Label>
                <Switch
                  id="elementaryLabels"
                  checked={displaySettings.elementaryLabels}
                  disabled={!displaySettings.elementarySchools}
                  onCheckedChange={(checked) => onDisplaySettingChange("elementaryLabels", checked)}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="middleSchools" className="text-sm font-medium">
                中学校
              </Label>
              <Switch
                id="middleSchools"
                checked={displaySettings.middleSchools}
                onCheckedChange={(checked) => onDisplaySettingChange("middleSchools", checked)}
                className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
              />
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="middleMarkers" className="text-xs text-gray-600">
                  マーカーを表示
                </Label>
                <Switch
                  id="middleMarkers"
                  checked={displaySettings.middleMarkers}
                  disabled={!displaySettings.middleSchools}
                  onCheckedChange={(checked) => onDisplaySettingChange("middleMarkers", checked)}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="middleLabels" className="text-xs text-gray-600">
                  学校名ラベルを表示
                </Label>
                <Switch
                  id="middleLabels"
                  checked={displaySettings.middleLabels}
                  disabled={!displaySettings.middleSchools}
                  onCheckedChange={(checked) => onDisplaySettingChange("middleLabels", checked)}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </div>
          </div>

        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">透明度: {Math.round(opacity * 100)}%</Label>
          </div>
          <Slider
            value={[opacity]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={onOpacityChange}
            className="w-full [&>span:first-child]:h-2 [&>span:first-child]:bg-gray-300 [&_[role=slider]]:bg-black [&_[role=slider]]:border-black [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&>span:first-child>span]:bg-black"
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">人口倍率: {populationMultiplier.toFixed(1)}倍</Label>
          </div>
          <Slider
            value={[populationMultiplier]}
            max={2}
            min={0.1}
            step={0.1}
            onValueChange={onPopulationChange}
            className="w-full [&>span:first-child]:h-2 [&>span:first-child]:bg-gray-300 [&_[role=slider]]:bg-black [&_[role=slider]]:border-black [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&>span:first-child>span]:bg-black"
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">年度: {selectedYear}年度</Label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newYear = Math.max(minYear, selectedYear - 1)  // ★ 固定値→minYear
                onYearChange([newYear])
              }}
              disabled={selectedYear <= minYear}                     // ★ 固定値→minYear
              className="h-8 w-8 p-0"
            >
              <Minus size={14} />
            </Button>

            <Select value={selectedYear.toString()} onValueChange={(value) => onYearChange([Number.parseInt(value)])}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearList.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}年度
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newYear = Math.min(maxYear, selectedYear + 1)   // ★ 固定値→maxYear
                onYearChange([newYear])
              }}
              disabled={selectedYear >= maxYear}                      // ★ 固定値→maxYear
              className="h-8 w-8 p-0"
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* 詳細設定 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-bold mb-4">詳細設定</h3>

        <div className="space-y-4">
          {/* ペナルティ設定グループ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Target size={14} />
              <span>ペナルティ設定</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">過密校（+）</Label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={penaltyPlus}
                  onChange={(e) => onPenaltyPlusChange(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">小規模校（−）</Label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={penaltyMinus}
                  onChange={(e) => onPenaltyMinusChange(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded-md">
              💡 値が大きいほど、容量超過/不足に厳しくなります
            </p>
          </div>

          {/* ソルバー設定グループ */}
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Clock size={14} />
              <span>ソルバー設定</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">制限時間（秒）</Label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={timeLimitSec}
                  onChange={(e) => onTimeLimitSecChange(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">MIPギャップ</Label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={mipGap}
                  onChange={(e) => onMipGapChange(Math.min(1, Math.max(0, Number(e.target.value))))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 bg-amber-50 p-2 rounded-md">
              ⚙️ MIPギャップは0〜1の範囲（例: 0.2 = 20%）
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
