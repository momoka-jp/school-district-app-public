"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FileDown, Upload, ImageIcon, ChevronDown } from "lucide-react"
import { useRef, useState, useCallback, useEffect } from "react"

import type GeoJSON from "geojson"
import type { MapExportOptions } from "@/types/map-types"

interface FilesTabProps {
  onSaveGeoJSON: () => void
  onLoadGeoJSON: (json: unknown) => void
  onExportSchoolsCSV: () => void
  onExportDistrictsCSV: () => void
  onExportMapAsImage: (options?: MapExportOptions) => void | Promise<void>
  isExportingMap?: boolean
  selectedMode: "Name_1" | "Name_2"
}

export default function FilesTab({
  onSaveGeoJSON,
  onLoadGeoJSON,
  onExportSchoolsCSV,
  onExportDistrictsCSV,
  onExportMapAsImage,
  isExportingMap,
  selectedMode,
}: FilesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const adjacencyFileInputRef = useRef<HTMLInputElement>(null)
  const [showCaptureOptions, setShowCaptureOptions] = useState(false)
  const [captureOptions, setCaptureOptions] = useState({
    showAverageDistance: true,
    showCapacityRatio: true,
    elementaryMarkers: selectedMode === "Name_1",
    middleMarkers: selectedMode === "Name_2",
    labels: true,
    padding: 40,
    panX: 0,
    panY: 0,
  })
  const isElementaryMode = selectedMode === "Name_1"

  useEffect(() => {
    setCaptureOptions((prev) => ({
      ...prev,
      elementaryMarkers: selectedMode === "Name_1",
      middleMarkers: selectedMode === "Name_2",
    }))
  }, [selectedMode])
  const [adjacencyGeoJSON, setAdjacencyGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null)
  const [adjacencyFileName, setAdjacencyFileName] = useState<string>("")
  const [adjacencyStatus, setAdjacencyStatus] = useState<{ type: "idle" | "ready" | "processing" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  })
  const [adjacencyHistory, setAdjacencyHistory] = useState<
    Array<{ id: number; type: "success" | "error"; message: string; timestamp: string }>
  >([])
  const [isExtractingAdjacency, setIsExtractingAdjacency] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)

  const getErrorMessage = useCallback((error: unknown, fallback: string) => {
    return error instanceof Error ? error.message : fallback
  }, [])

  // ファイル読み込み処理
  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  const readGeoJsonFile = useCallback(
    (file: File, onSuccess: (data: GeoJSON.FeatureCollection) => void) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string
          const geoJsonData = JSON.parse(content) as GeoJSON.FeatureCollection
          onSuccess(geoJsonData)
        } catch (error) {
          console.error("ファイルの読み込みエラー:", error)
          alert(getErrorMessage(error, "ファイルの形式が正しくありません。GeoJSONファイルを選択してください。"))
        }
      }
      reader.readAsText(file)
    },
    [getErrorMessage],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      readGeoJsonFile(file, (geoJsonData) => {
        console.log("読み込まれたGeoJSONデータ:", geoJsonData)
        onLoadGeoJSON(geoJsonData)
        alert("ファイルの読み込みが完了しました。")
      })
    }
    e.target.value = ""
  }

  const appendAdjacencyHistory = useCallback((entry: { type: "success" | "error"; message: string }) => {
    const timestamp = new Date().toLocaleString()
    setAdjacencyHistory((prev) => {
      const next = [{ id: Date.now(), timestamp, ...entry }, ...prev]
      return next.slice(0, 5)
    })
  }, [readGeoJsonFile])

  const handleAdjacencyFileInputClick = () => {
    adjacencyFileInputRef.current?.click()
  }

  const processAdjacencyFile = useCallback((file: File) => {
    readGeoJsonFile(file, (geoJsonData) => {
      if (!geoJsonData || geoJsonData.type !== "FeatureCollection" || !Array.isArray(geoJsonData.features)) {
        const message = "FeatureCollection 形式の GeoJSON を選択してください。"
        setAdjacencyGeoJSON(null)
        setAdjacencyFileName("")
        setAdjacencyStatus({ type: "error", message })
        return
      }

      setAdjacencyGeoJSON(geoJsonData)
      setAdjacencyFileName(file.name)
      setAdjacencyStatus({
        type: "ready",
        message: `${file.name} を読み込みました（地区数: ${geoJsonData.features.length}）`,
      })
    })
  }, [readGeoJsonFile])

  const handleAdjacencyFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processAdjacencyFile(file)
    e.target.value = ""
  }, [processAdjacencyFile])

  const handleExtractAdjacency = useCallback(async () => {
    if (!adjacencyGeoJSON) {
      alert("GeoJSONファイルを選択してください。")
      return
    }

    setIsExtractingAdjacency(true)
    setAdjacencyStatus({ type: "processing", message: "隣接関係を計算中です..." })

    try {
      const response = await fetch("/api/extract-adjacency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ geojson: adjacencyGeoJSON }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "隣接関係の抽出に失敗しました")
      }

      const blob = new Blob([JSON.stringify(result.adjacency, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "adj.json"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const districtCount = result.stats?.feature_count ?? adjacencyGeoJSON.features?.length ?? 0
      const edgeCount = result.stats?.edge_count ?? 0
      const serverSaveSuccess = result.serverSave?.success
      const serverMessage = serverSaveSuccess
        ? "サーバー側の adj.json も更新しました。"
        : result.serverSave?.error
          ? `サーバー保存でエラー: ${result.serverSave.error}`
          : "サーバー側の保存状態は不明です。"

      setAdjacencyStatus({
        type: "success",
        message: `adj.json を生成しました（地区: ${districtCount} / 近傍: ${edgeCount}）。${serverMessage}`,
      })
      appendAdjacencyHistory({
        type: "success",
        message: `adj.json を生成しました（地区: ${districtCount} / 近傍: ${edgeCount}）。${serverMessage}`,
      })
      if (!serverSaveSuccess) {
        console.warn("サーバー側のadj.json保存に失敗:", result.serverSave)
        alert("adj.jsonをダウンロードしましたが、サーバー側の保存に失敗しました。ログを確認してください。")
      }
    } catch (error) {
      console.error("隣接関係抽出でエラー:", error)
      const message = getErrorMessage(error, "隣接関係の抽出に失敗しました")
      setAdjacencyStatus({ type: "error", message })
      appendAdjacencyHistory({ type: "error", message })
    } finally {
      setIsExtractingAdjacency(false)
    }
  }, [adjacencyGeoJSON, appendAdjacencyHistory, getErrorMessage])

  const adjacencyStatusClass =
    adjacencyStatus.type === "error"
      ? "text-red-600"
      : adjacencyStatus.type === "success"
      ? "text-green-600"
      : "text-gray-600"

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold mb-4">画面キャプチャ</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => setShowCaptureOptions((prev) => !prev)}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <ImageIcon size={16} className="mr-2" />
              画面キャプチャ設定
              <ChevronDown
                size={16}
                className={`ml-2 transition-transform ${showCaptureOptions ? "rotate-180" : ""}`}
              />
            </Button>
            {showCaptureOptions && (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={captureOptions.showAverageDistance}
                    onCheckedChange={(checked) =>
                      setCaptureOptions((prev) => ({
                        ...prev,
                        showAverageDistance: checked === true,
                      }))
                    }
                  />
                  平均通学距離を表示
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={captureOptions.showCapacityRatio}
                    onCheckedChange={(checked) =>
                      setCaptureOptions((prev) => ({
                        ...prev,
                        showCapacityRatio: checked === true,
                      }))
                    }
                  />
                  適正規模校数を表示
                </label>
                <div className="pt-2 text-xs font-medium text-gray-500">拡大具合</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={captureOptions.padding}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setCaptureOptions((prev) => ({
                        ...prev,
                        padding: Number.isFinite(next) ? next : prev.padding,
                      }))
                    }}
                    className="h-8 w-24"
                  />
                  <span className="text-xs text-gray-500">小さいほど拡大</span>
                </div>
                <div className="pt-2 text-xs font-medium text-gray-500">位置調整</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={captureOptions.panX}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setCaptureOptions((prev) => ({
                        ...prev,
                        panX: Number.isFinite(next) ? next : prev.panX,
                      }))
                    }}
                    className="h-8 w-24"
                  />
                  <span className="text-xs text-gray-500">左右(px)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={captureOptions.panY}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      setCaptureOptions((prev) => ({
                        ...prev,
                        panY: Number.isFinite(next) ? next : prev.panY,
                      }))
                    }}
                    className="h-8 w-24"
                  />
                  <span className="text-xs text-gray-500">上下(px)</span>
                </div>
                <div className="pt-2 text-xs font-medium text-gray-500">マーカー表示</div>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={captureOptions.elementaryMarkers}
                    onCheckedChange={(checked) =>
                      setCaptureOptions((prev) => ({
                        ...prev,
                        elementaryMarkers: checked === true,
                      }))
                    }
                    disabled={!isElementaryMode}
                  />
                  小学校マーカー
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={captureOptions.middleMarkers}
                    onCheckedChange={(checked) =>
                      setCaptureOptions((prev) => ({
                        ...prev,
                        middleMarkers: checked === true,
                      }))
                    }
                    disabled={isElementaryMode}
                  />
                  中学校マーカー
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={captureOptions.labels}
                    onCheckedChange={(checked) =>
                      setCaptureOptions((prev) => ({
                        ...prev,
                        labels: checked === true,
                      }))
                    }
                  />
                  学校ラベル
                </label>
                <Button
                  onClick={() =>
                    onExportMapAsImage({
                      showAverageDistance: captureOptions.showAverageDistance,
                      showCapacityRatio: captureOptions.showCapacityRatio,
                      elementaryMarkers: captureOptions.elementaryMarkers,
                      middleMarkers: captureOptions.middleMarkers,
                      labels: captureOptions.labels,
                      padding: captureOptions.padding,
                      panX: captureOptions.panX,
                      panY: captureOptions.panY,
                    })
                  }
                  disabled={isExportingMap}
                  className="w-full"
                >
                  {isExportingMap ? "キャプチャ中..." : "この設定でキャプチャ"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold mb-4">データの読込</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleFileInputClick}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <Upload size={16} className="mr-2" />
              ファイル読み込み
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold mb-4">データの出力</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={onSaveGeoJSON}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <FileDown size={16} className="mr-2" />
              geojson保存
            </Button>
            {/* 追加: 学校別サマリーCSV */}
            <Button
              variant="outline"
              onClick={onExportSchoolsCSV}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <FileDown size={16} className="mr-2" />
              学校別サマリーCSV
            </Button>

            {/* 追加: 地区別割当CSV */}
            <Button
              variant="outline"
              onClick={onExportDistrictsCSV}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <FileDown size={16} className="mr-2" />
              地区別割当CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-bold mb-2">隣接関係抽出（adj.json）</h3>
          <p className="text-sm text-gray-500 mb-4">
            町丁目GeoJSONを選択して隣接グラフ（adj.json）を生成します。生成されたファイルは自動的にダウンロードされます。
          </p>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={handleAdjacencyFileInputClick}
              className="w-full flex items-center justify-center bg-transparent hover:bg-gray-50"
            >
              <Upload size={16} className="mr-2" />
              GeoJSONを選択
            </Button>
            <div
              className={`rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
              }`}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragActive(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!isDragActive) setIsDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragActive(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragActive(false)
                const file = e.dataTransfer.files?.[0]
                if (file) {
                  processAdjacencyFile(file)
                }
              }}
            >
              <p className="font-medium mb-1">ここに GeoJSON をドラッグ＆ドロップ</p>
              <p className="text-xs text-gray-500">
                または上のボタンからファイルを選択してください
              </p>
            </div>
            {adjacencyFileName && (
              <p className="text-xs text-gray-600 break-words">
                選択中: <span className="font-medium">{adjacencyFileName}</span>
              </p>
            )}
            <Button
              variant="default"
              onClick={handleExtractAdjacency}
              disabled={!adjacencyGeoJSON || isExtractingAdjacency}
              className="w-full flex items-center justify-center disabled:opacity-70"
            >
              {isExtractingAdjacency ? "抽出中..." : "隣接関係抽出 & ダウンロード"}
            </Button>
            {adjacencyStatus.message && (
              <p className={`text-sm ${adjacencyStatusClass}`}>{adjacencyStatus.message}</p>
            )}
            {adjacencyHistory.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
                <div className="mb-2 font-semibold text-gray-600">履歴</div>
                <ul className="space-y-1">
                  {adjacencyHistory.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-2">
                      <span className={entry.type === "success" ? "text-green-700" : "text-red-700"}>
                        {entry.message}
                      </span>
                      <span className="whitespace-nowrap text-[10px] text-gray-500">{entry.timestamp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* 隠しファイル入力要素 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <input
          ref={adjacencyFileInputRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleAdjacencyFileChange}
          style={{ display: "none" }}
        />
      </div>
    </>
  )
}
