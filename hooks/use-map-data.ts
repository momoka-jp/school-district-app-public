"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { GeoJSONData, SchoolGeoJSONData, District } from "@/types/map-types"
import { calculateSchoolEnrollment } from "@/utils/map-utils"
import type { DistanceData } from "@/lib/calculate-average-distance"

export interface CsvRow {
  [key: string]: string | number | undefined
  小学校区: string
  中学校区: string
  町名: string
  町丁目名: string
  id: string
}

/* =========================
  正規化ユーティリティ
   ========================= */
// 学校名：末尾を「小」「中」に統一し，空白除去
const normalizeSchoolName = (name: string): string => {
  return String(name || "")
    .replace(/小学校$/, "小")
    .replace(/中学校$/, "中")
    .replace(/\s+/g, "")
    .trim()
}

// 町丁目名：空白/ダッシュ/BOM等を除去し，混入した「学校名-学校名-町丁目」形式なら末尾だけ採用
const normalizeTown = (s: string): string => {
  let t = String(s || "")
    .replace(/\uFEFF/g, "") // BOM
    .replace(/\u200B/g, "") // ゼロ幅空白
    .replace(/\s+/g, "") // 空白
    .replace(/[‐-‒–—―-]/g, "-") // ダッシュを半角ハイフンに統一
  if (t.includes("-")) t = t.split("-").slice(-1)[0] // 末尾の町丁目のみ
  // よくある表記ゆれ
  t = t.replace(/ヶ/g, "ケ").replace(/ノ/g, "の")
  t = t
    .replace(/一/g, "１")
    .replace(/二/g, "２")
    .replace(/三/g, "３")
    .replace(/四/g, "４")
    .replace(/五/g, "５")
    .replace(/六/g, "６")
    .replace(/七/g, "７")
    .replace(/八/g, "８")
    .replace(/九/g, "９")
    .replace(/十/g, "１０")
    // 逆方向も対応（全角数字→漢数字）
    .replace(/１/g, "一")
    .replace(/２/g, "二")
    .replace(/３/g, "三")
    .replace(/４/g, "四")
    .replace(/５/g, "五")
    .replace(/６/g, "六")
    .replace(/７/g, "七")
    .replace(/８/g, "八")
    .replace(/９/g, "九")
    .replace(/１０/g, "十")
  return t
}

// GeoJSON の id を CSV 側に合わせて正規化（小/中表記・空白・ダッシュ）
// GeoJSON の id を CSV 側に合わせて正規化
const normalizeFeatureId = (id: string): string => {
  const raw = String(id || "").trim()
  // ダッシュ統一して分割
  const unified = raw.replace(/[‐-‒–—―-]/g, "-")
  const parts = unified.split("-")

  const s0 = normalizeSchoolName(parts[0] ?? "")
  const s1 = normalizeSchoolName(parts[1] ?? "")
  const town = normalizeTown(parts[parts.length - 1] ?? "")

  return [s0, s1, town].join("-")
}

const normalizeSchoolGeoJSON = (schoolJson: SchoolGeoJSONData): SchoolGeoJSONData => {
  if (!schoolJson?.features || !Array.isArray(schoolJson.features)) {
    return { ...schoolJson, features: [] }
  }

  return {
    ...schoolJson,
    features: schoolJson.features.map((feature) => {
      const props = feature.properties ?? {}
      const manualClosed = Boolean(props.isClosed)

      return {
        ...feature,
        properties: {
          ...props,
          originalIsClosed:
            props.originalIsClosed !== undefined ? Boolean(props.originalIsClosed) : manualClosed,
          isClosed: manualClosed,
          isClosedManual: manualClosed,
          manualOpenOverride: false,
          closedByOptimization: false,
          assignedStudentsSho: props.assignedStudentsSho ?? 0,
          assignedStudentsChu: props.assignedStudentsChu ?? 0,
        },
      }
    }),
  }
}

/* =========================
  CSV パース
   ========================= */
export const parseCSV = (csvText: string): CsvRow[] => {
  const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  const lines = normalizedText
    .trim()
    .split("\n")
    .filter((line) => line.trim() !== "")

  // console.log("CSV lines count:", lines.length)
  // console.log("First 3 lines:", lines.slice(0, 3))

  if (lines.length < 3) {
    console.warn("CSVファイルに行が少なすぎます.")
    return []
  }

  const categoryHeaders = lines[0].split(",")
  const detailHeaders = lines[1].split(",")

  // console.log("Category headers:", categoryHeaders)
  // console.log("Detail headers:", detailHeaders)

  const combinedHeaders: string[] = []
  let currentCategory = ""

  // ヘッダー結合
  for (let i = 0; i < detailHeaders.length; i++) {
    const detailHeader = (detailHeaders[i] ?? "").trim()
    const categoryHeader = (categoryHeaders[i] ?? "").trim()

    if (categoryHeader !== "") currentCategory = categoryHeader

    if (i < 4) {
      combinedHeaders.push(detailHeader)
    } else if (detailHeader.includes("年度")) {
      const year = detailHeader.replace("年度", "")
      combinedHeaders.push(`${currentCategory}_${year}`) // 例: 児童数_2025
    } else {
      combinedHeaders.push(currentCategory || `col_${i}`)
    }
  }

  // console.log("Combined headers:", combinedHeaders)

  const dataLines = lines.slice(2)
  const rows: CsvRow[] = []

  dataLines.forEach((line, index) => {
    const values = line.split(",")
    if (values.length === 0 || values.every((v) => v.trim() === "")) return

    const row: Partial<CsvRow> = {}
    for (let j = 0; j < combinedHeaders.length && j < values.length; j++) {
      const header = combinedHeaders[j]
      const value = (values[j] ?? "").trim()
      const numValue = Number.parseFloat(value)
      row[header] = !isNaN(numValue) && value !== "" ? numValue : value
    }

    // 型アサーション + 正規化
    const sho = normalizeSchoolName(String(row.小学校区 || ""))
    const chu = normalizeSchoolName(String(row.中学校区 || ""))
    const town = normalizeTown(String(row.町丁目名 || ""))

    row.小学校区 = sho
    row.中学校区 = chu
    row.町名 = String(row.町名 || "")
    row.町丁目名 = town

    if (sho && chu && town) {
      row.id = `${sho}-${chu}-${town}`
    } else {
      row.id = `unknown-${index}`
    }

    rows.push(row as CsvRow)
  })

  // console.log("Parsed CSV rows count:", rows.length)
  if (rows.length > 0) {
    const sampleRow = rows[0]
    // console.log("First CSV row:", sampleRow)
    // console.log("Sample row keys:", Object.keys(sampleRow))
    // console.log("Sample CSV ID format:", sampleRow.id)
    const shoKey2025 = `児童数_2025`
    const chuKey2025 = `生徒数_2025`
    // console.log("2025年度児童数キー存在:", shoKey2025 in sampleRow)
    // console.log("2025年度生徒数キー存在:", chuKey2025 in sampleRow)
    // console.log("2025年度児童数値:", (sampleRow as Record<string, unknown>)[shoKey2025])
    // console.log("2025年度生徒数値:", (sampleRow as Record<string, unknown>)[chuKey2025])
  }

  return rows
}

const townFromId = (id: string): string => {
  const t = String(id || "")
  const parts = t.split("-")
  return normalizeTown(parts[parts.length - 1] || "")
}

/* =========================
  CSV と GeoJSON の結合
   ========================= */
const buildMergedStudentsMap = (mergedGeoJson?: GeoJSONData | null) => {
  if (!mergedGeoJson?.features || !Array.isArray(mergedGeoJson.features)) return null
  const map = new Map<string, Record<string, unknown>>()
  mergedGeoJson.features.forEach((feature) => {
    const id = String(feature?.properties?.id ?? "").trim()
    if (id) {
      map.set(id, feature.properties ?? {})
    }
  })
  return map
}

const ensureDistrictAssignments = (data: GeoJSONData) => {
  data.features.forEach((feature: GeoJSONData["features"][number]) => {
    if (!feature.properties.editedDistricts) {
      feature.properties.editedDistricts = {
        Name_1: feature.properties.Name_1 || "",
        Name_2: feature.properties.Name_2 || "",
      }
    }
    if (!feature.properties.originalDistricts) {
      feature.properties.originalDistricts = {
        Name_1: feature.properties.Name_1 || "",
        Name_2: feature.properties.Name_2 || "",
      }
    }
  })
}

export const combineData = (
  geojson: GeoJSONData,
  csvData: CsvRow[],
  selectedYear: number,
  mergedStudentsMap?: Map<string, Record<string, unknown>> | null,
): GeoJSONData => {
  console.log("=== データ結合開始 ===")
  console.log(`選択年度: ${selectedYear}`)
  console.log(`CSV行数: ${csvData.length}`)
  console.log(`GeoJSON地区数: ${geojson.features.length}`)

  const resolveYearKeys = (row: CsvRow, year: number) => {
    const shoKey = `児童数_${year}` as keyof CsvRow
    const chuKey = `生徒数_${year}` as keyof CsvRow
    return {
      shoKey,
      chuKey,
      shoValue: row[shoKey],
      chuValue: row[chuKey],
    }
  }

  if (csvData.length > 0) {
    const sampleRow = csvData[0]
    const availableKeys = Object.keys(sampleRow).filter((key) => key.includes("児童数") || key.includes("生徒数"))
    console.log("=== CSV年度別キー確認 ===")
    console.log("利用可能な年度キー:", availableKeys)

    const { shoKey, chuKey, shoValue, chuValue } = resolveYearKeys(sampleRow, selectedYear)
    console.log(`検索対象キー: ${shoKey}, ${chuKey}`)
    console.log(`${shoKey}存在: ${shoKey in sampleRow}`)
    console.log(`${chuKey}存在: ${chuKey in sampleRow}`)

    if (shoKey in sampleRow && chuKey in sampleRow) {
      console.log(`サンプル値 - ${shoKey}: ${shoValue}, ${chuKey}: ${chuValue}`)
    }
  }

  const combinedData: GeoJSONData = JSON.parse(JSON.stringify(geojson))

  // CSVデータを id でインデックス化
  const csvMap = new Map<string, CsvRow>()
  const csvTownMap = new Map<string, CsvRow>()

  console.log("=== CSVデータインデックス化 ===")
  csvData.forEach((row, index) => {
    if (!row) return
    // 既にparseCSVでrow.idは「小-中-町丁目（正規化済み）」になっている
    const id = String(row.id || "").trim()
    const townName = String(row.町丁目名 || "").trim()

    if (id) {
      csvMap.set(id, row)
      const town = townFromId(id)
      if (town && !csvTownMap.has(town)) {
        csvTownMap.set(town, row)
      }

      // 最初の5件の詳細ログ
      if (index < 5) {
        console.log(`CSV行${index + 1}: ID="${id}", 町丁目="${townName}", 正規化町丁目="${town}"`)
        const shoKey = `児童数_${selectedYear}`
        const chuKey = `生徒数_${selectedYear}`
        if (shoKey in row && chuKey in row) {
          console.log(`  -> ${selectedYear}年度データ: 児童数=${row[shoKey]}, 生徒数=${row[chuKey]}`)
        }
      }
    }
  })

  const toNum = (v: unknown) => {
    if (v === null || v === undefined) return undefined
    const n = Number(String(v).replace(/[, ]/g, "")) // カンマ/空白除去
    return Number.isFinite(n) ? n : undefined
  }

  const pickCsvValue = (
    row: Record<string, unknown>,
    year: number,
    kind: "sho" | "chu",
  ) => {
    const want = kind === "sho" ? /児童数/ : /生徒数/;
    const yWithKanji = `${year}年度`;   // 例: "2025年度"
    const yWithUnderscore = `_${year}`; // 例: "_2025"

    const key = Object.keys(row).find((k) =>
      want.test(k) && (k.includes(yWithKanji) || k.endsWith(yWithUnderscore))
    );

    if (!key) return undefined;
    const v = row[key];
    const n = Number(String(v ?? "").replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };

  const getMergedProps = (rawId: string, normalizedId: string) => {
    if (!mergedStudentsMap) return undefined
    const direct = mergedStudentsMap.get(rawId)
    if (direct) return direct
    return mergedStudentsMap.get(normalizedId)
  }

  console.log(`CSVマップサイズ: ${csvMap.size}`)
  console.log("CSVキー例 (最初の5件):", Array.from(csvMap.keys()).slice(0, 5))

  let matchedCount = 0
  let unmatchedCount = 0
  let yearDataFoundCount = 0
  let yearDataMissingCount = 0

  // 収集：重複のない失敗リスト
  const unmatchedList: Array<{ 元ID: string; 正規化ID: string; 町丁目: string; 近いCSV候補?: string }> = []

  console.log("=== 年度別データ取得開始 ===")

  combinedData.features.forEach((feature: GeoJSONData["features"][number], featureIndex) => {
    const rawId = String(feature.properties.id)
    const normalizedId = normalizeFeatureId(rawId)
    const csvRow = csvMap.get(normalizedId)
    const mergedProps = getMergedProps(rawId, normalizedId)

    const id = feature.properties?.id
    const row = csvData.find((r) => normalizeTown(r["町丁目名"]) === normalizeTown(id))

    if (featureIndex < 10) {
      console.log(`\n--- Feature ${featureIndex + 1} ---`)
      console.log(`元ID: "${rawId}"`)
      console.log(`正規化ID: "${normalizedId}"`)
      console.log(`CSVマッチ: ${csvRow ? "あり" : "なし"}`)

      if (csvRow) {
        const { shoKey, chuKey, shoValue, chuValue } = resolveYearKeys(csvRow, selectedYear)

        console.log(`${selectedYear}年度データ:`)
        console.log(`  児童数キー "${shoKey}": ${shoValue}`)
        console.log(`  生徒数キー "${chuKey}": ${chuValue}`)

        if (shoValue !== undefined && chuValue !== undefined) {
          yearDataFoundCount++
          console.log(`  -> 年度データ取得成功`)
        } else {
          yearDataMissingCount++
          console.log(`  -> 年度データ不足、フォールバック使用`)
        }
      }
    }

    // 2025〜2031 の年別キーを生成
    for (let y = 2025; y <= 2031; y++) {
      let sho = toNum(mergedProps?.[`num_sho${y}`])
      let chu = toNum(mergedProps?.[`num_chu${y}`])

      if (sho === undefined && row) sho = pickCsvValue(row, y, "sho")
      if (chu === undefined && row) chu = pickCsvValue(row, y, "chu")

      // 値が無い年は 2024 の値にフォールバック（必要なら 0 にしてOK）
      if (sho === undefined) sho = toNum(feature.properties?.[`num_sho2024`]) ?? 0
      if (chu === undefined) chu = toNum(feature.properties?.[`num_chu2024`]) ?? 0

      feature.properties[`num_sho${y}`] = sho
      feature.properties[`num_chu${y}`] = chu
    }

    if (csvRow) {
      matchedCount++
      const shoKey = `児童数_${selectedYear}` as keyof CsvRow
      const chuKey = `生徒数_${selectedYear}` as keyof CsvRow
      const csvSho = toNum(csvRow[shoKey])
      const csvChu = toNum(csvRow[chuKey])
      const mergedSho = toNum(mergedProps?.[`num_sho${selectedYear}`])
      const mergedChu = toNum(mergedProps?.[`num_chu${selectedYear}`])

      const fallbackSho =
        toNum(feature.properties?.[`num_sho${selectedYear}`]) ?? toNum(feature.properties?.num_sho2024) ?? 0
      const fallbackChu =
        toNum(feature.properties?.[`num_chu${selectedYear}`]) ?? toNum(feature.properties?.num_chu2024) ?? 0

      const numSho = mergedSho ?? csvSho ?? fallbackSho
      const numChu = mergedChu ?? csvChu ?? fallbackChu

      if (matchedCount <= 2) {
        console.log(`✓ マッチ成功 ${matchedCount}:`, {
          元ID: rawId,
          正規化ID: normalizedId,
          児童数: numSho,
          生徒数: numChu,
        })
      }

      feature.properties.editedStudents = {
        num_sho: (numSho),
        num_chu: (numChu),
      }
    } else {
      unmatchedCount++

      // 同じ町丁目を持つCSV側候補（学校名違いなどのニアミス発見用）
      const town = townFromId(normalizedId)
      const near = town ? csvTownMap.get(town) : undefined
      const nearId = near?.id ? String(near.id) : undefined

      // ログは最初の100件だけ詳細表示（多すぎ防止）
      if (unmatchedCount <= 100) {
        console.log(`✗ マッチ失敗 ${unmatchedCount}:`, {
          元ID: rawId,
          正規化ID: normalizedId,
          町丁目: town,
          近いCSV候補: nearId,
        })
      }

      // 重複登録を避ける
      if (!unmatchedList.find((r) => r.正規化ID === normalizedId)) {
        unmatchedList.push({
          元ID: rawId,
          正規化ID: normalizedId,
          町丁目: town,
          近いCSV候補: nearId,
        })
      }

      // フォールバック（2024年度 or 0）
      const fallbackSho = toNum(mergedProps?.[`num_sho${selectedYear}`]) ?? feature.properties.num_sho2024 ?? 0
      const fallbackChu = toNum(mergedProps?.[`num_chu${selectedYear}`]) ?? feature.properties.num_chu2024 ?? 0
      feature.properties.editedStudents = {
        num_sho: fallbackSho,
        num_chu: fallbackChu,
      }
    }
  })

  console.log("=== 結合結果 ===")
  console.log(`成功: ${matchedCount}件`)
  console.log(`失敗: ${unmatchedCount}件`)
  console.log(`合計: ${combinedData.features.length}件`)
  console.log(`成功率: ${((matchedCount / combinedData.features.length) * 100).toFixed(1)}%`)

  console.log("=== 年度データ取得状況 ===")
  console.log(`${selectedYear}年度データ取得成功: ${yearDataFoundCount}件`)
  console.log(`${selectedYear}年度データ不足: ${yearDataMissingCount}件`)
  console.log(
    `年度データ取得率: ${yearDataFoundCount > 0 ? ((yearDataFoundCount / (yearDataFoundCount + yearDataMissingCount)) * 100).toFixed(1) : 0}%`,
  )

  return combinedData
}

/* =========================
   データ読み込みフック
   ========================= */
export const useMapData = (selectedYear = 2024) => {
  const [districtData, setDistrictData] = useState<GeoJSONData | null>(null)
  const [originalDistrictData, setOriginalDistrictData] = useState<GeoJSONData | null>(null)
  const [optimizedDistrictData, setOptimizedDistrictData] = useState<GeoJSONData | null>(null)
  const [schoolData, setSchoolData] = useState<SchoolGeoJSONData | null>(null)
  const [originalSchoolData, setOriginalSchoolData] = useState<SchoolGeoJSONData | null>(null)
  const [distanceData, setDistanceData] = useState<DistanceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rawDistrictGeoJSON, setRawDistrictGeoJSON] = useState<GeoJSONData | null>(null)
  const [parsedCsvData, setParsedCsvData] = useState<CsvRow[]>([])
  const [mergedStudentsMap, setMergedStudentsMap] = useState<Map<string, Record<string, unknown>> | null>(null)
  const configRef = useRef<{
    students_csv_filename: string
    schools_original_filename: string
    merged_with_students_filename: string
    distance_filename: string
  } | null>(null)

  const loadData = async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const maxAttempts = 3

    setIsLoading(true)
    setLoadError(null)

    let didLoad = false
    let lastError: unknown = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const defaultConfig = {
          students_csv_filename: "小中町丁目別学校区別学齢別性別集計.csv",
          schools_original_filename: "schools.original.geojson",
          merged_with_students_filename: "merged_with_students.geojson",
          distance_filename: "distance.json",
        }

        if (!configRef.current) {
          try {
            const configResponse = await fetch("/data/config.json")
            if (configResponse.ok) {
              const parsed = await configResponse.json()
              configRef.current = { ...defaultConfig, ...parsed }
            } else {
              configRef.current = { ...defaultConfig }
            }
          } catch (error) {
            console.warn("config.json の読み込みに失敗しました。デフォルト設定を使用します。", error)
            configRef.current = { ...defaultConfig }
          }
        }

        const cfg = configRef.current ?? defaultConfig

        const [districtResponse, schoolResponse, distanceResponse, csvResponse, originalSchoolResponse, mergedStudentsResponse] = await Promise.all([
          fetch("/api/district-data"),
          fetch("/api/school-data"),
          fetch(`/data/${cfg.distance_filename}`),
          fetch(`/data/${cfg.students_csv_filename}`),
          fetch(`/data/output/${cfg.schools_original_filename}`), // output/ を追加
          fetch(`/data/output/${cfg.merged_with_students_filename}`), // output/ を追加
        ])

        if (
          !districtResponse.ok
          || !schoolResponse.ok
          || !distanceResponse.ok
          || !csvResponse.ok
          || !mergedStudentsResponse.ok
        ) {
          throw new Error("データの取得に失敗しました")
        }

        const districtJson = (await districtResponse.json()) as GeoJSONData
        const schoolJson = (await schoolResponse.json()) as SchoolGeoJSONData
        const originalSchoolJson = originalSchoolResponse.ok
          ? ((await originalSchoolResponse.json()) as SchoolGeoJSONData)
          : null
        const distanceJson = (await distanceResponse.json()) as DistanceData
        const mergedStudentsJson = mergedStudentsResponse.ok
          ? ((await mergedStudentsResponse.json()) as GeoJSONData)
          : null
        const csvText = await csvResponse.text()

        // console.log("CSV response status:", csvResponse.status)
        // console.log("CSV text length:", csvText.length)
        // console.log("CSV text preview:", csvText.substring(0, 200))

        const parsedCsv = parseCSV(csvText)

        if (!districtJson?.features || !Array.isArray(districtJson.features)) {
          throw new Error("地区データの形式が正しくありません")
        }
        if (!schoolJson?.features || !Array.isArray(schoolJson.features)) {
          throw new Error("学校データの形式が正しくありません")
        }

        setRawDistrictGeoJSON(JSON.parse(JSON.stringify(districtJson)))
        setParsedCsvData(parsedCsv)

        // 結合と初期付帯情報設定
        const mergedMap = buildMergedStudentsMap(mergedStudentsJson)
        setMergedStudentsMap(mergedMap)

        const combinedData = combineData(districtJson, parsedCsv, selectedYear, mergedMap)
        ensureDistrictAssignments(combinedData)

        // オリジナルのフォールバックも用意
        const originalJson = JSON.parse(JSON.stringify(districtJson))
        originalJson.features.forEach((feature: District) => {
          if (!feature.properties.editedStudents) {
            feature.properties.editedStudents = {
              num_sho: feature.properties.num_sho2024 ?? 0,
              num_chu: feature.properties.num_chu2024 ?? 0,
            }
          }
        })

        const normalizedSchoolJson = normalizeSchoolGeoJSON(schoolJson)
        const normalizedOriginalSchoolJson = originalSchoolJson ? normalizeSchoolGeoJSON(originalSchoolJson) : null

        setDistrictData(combinedData)
        setOriginalDistrictData(originalJson)
        setSchoolData(normalizedSchoolJson)
        setOriginalSchoolData(
          JSON.parse(JSON.stringify(normalizedOriginalSchoolJson ?? normalizedSchoolJson)) as SchoolGeoJSONData,
        )
        setDistanceData(distanceJson)

        calculateSchoolEnrollment(combinedData, normalizedSchoolJson, "Name_1", "current", selectedYear)
        calculateSchoolEnrollment(combinedData, normalizedSchoolJson, "Name_2", "current", selectedYear)

        didLoad = true
        lastError = null
        break
      } catch (error) {
        lastError = error
        console.error("データの読み込み中にエラーが発生しました:", error)
        if (attempt < maxAttempts - 1) {
          const delayMs = 500 * Math.pow(2, attempt)
          console.warn(`再試行まで ${delayMs}ms 待機します (試行 ${attempt + 1}/${maxAttempts})`)
          await wait(delayMs)
        }
      }
    }

    if (!didLoad && lastError) {
      const message = lastError instanceof Error ? lastError.message : "データの読み込みに失敗しました"
      setLoadError(message)
    }

    setIsLoading(false)
  }

  // 年度やソースデータが変わったら再結合
  useEffect(() => {
    if (rawDistrictGeoJSON && parsedCsvData.length > 0 && schoolData) {
      const combinedData = combineData(rawDistrictGeoJSON, parsedCsvData, selectedYear, mergedStudentsMap)
      ensureDistrictAssignments(combinedData)
      setDistrictData(combinedData)
      calculateSchoolEnrollment(combinedData, schoolData, "Name_1", "current", selectedYear)
      calculateSchoolEnrollment(combinedData, schoolData, "Name_2", "current", selectedYear)
    }
  }, [selectedYear, rawDistrictGeoJSON, parsedCsvData, schoolData, mergedStudentsMap])

  // 初回ロード
  useEffect(() => {
    loadData()
  }, [])

  const refreshSchoolData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [schoolResponse, originalSchoolResponse] = await Promise.all([
        fetch("/api/school-data"),
        fetch(`/data/${configRef.current?.schools_original_filename ?? "schools.original.geojson"}`),
      ])

      if (!schoolResponse.ok) {
        throw new Error("学校データの取得に失敗しました")
      }

      const schoolJson = (await schoolResponse.json()) as SchoolGeoJSONData
      const originalSchoolJson = originalSchoolResponse.ok
        ? ((await originalSchoolResponse.json()) as SchoolGeoJSONData)
        : null

      if (!schoolJson?.features || !Array.isArray(schoolJson.features)) {
        throw new Error("学校データの形式が正しくありません")
      }

      const normalizedSchoolJson = normalizeSchoolGeoJSON(schoolJson)
      const normalizedOriginalSchoolJson = originalSchoolJson ? normalizeSchoolGeoJSON(originalSchoolJson) : null
      setSchoolData(normalizedSchoolJson)
      setOriginalSchoolData(
        JSON.parse(JSON.stringify(normalizedOriginalSchoolJson ?? normalizedSchoolJson)) as SchoolGeoJSONData,
      )

      if (districtData) {
        calculateSchoolEnrollment(districtData, normalizedSchoolJson, "Name_1", "current", selectedYear)
        calculateSchoolEnrollment(districtData, normalizedSchoolJson, "Name_2", "current", selectedYear)
      }
    } catch (error) {
      console.error("学校データのリロードに失敗しました:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [districtData, selectedYear])

  return {
    districtData,
    setDistrictData,
    originalDistrictData,
    optimizedDistrictData,
    setOptimizedDistrictData,
    schoolData,
    setSchoolData,
    originalSchoolData,
    distanceData,
    isLoading,
    loadError,
    rawDistrictGeoJSON,
    parsedCsvData,
    refreshSchoolData,
    mergedStudentsMap,
  }
}
