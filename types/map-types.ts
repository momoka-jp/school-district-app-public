export interface GeoJSONData {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: {
      [key: string]: any
    }
    geometry: {
      type: string
      coordinates: any
    }
  }>
}

export interface SchoolGeoJSONData {
  type: "FeatureCollection"
  features: School[]
}

export interface DisplaySettings {
  boundaries: boolean
  elementarySchools: boolean
  elementaryMarkers: boolean
  elementaryLabels: boolean
  middleSchools: boolean
  middleMarkers: boolean
  middleLabels: boolean
  districts: boolean
  excludedMode?: "hidden" | "faded-info" | "faded-no-info"
}

export type DisplayMode = "original" | "current" | "optimized"
export type DistrictOptionValue = "対象外" | "最適化対象" | "固定"
export type SchoolOptimizationOption = "default" | "closed" | "forced_open" | "excluded"

export interface MapExportOptions {
  elementaryMarkers?: boolean
  middleMarkers?: boolean
  labels?: boolean
  disabledMarkers?: boolean
  closedMarkers?: boolean
  filename?: string
  padding?: number | [number, number]
  showAverageDistance?: boolean
  showCapacityRatio?: boolean
  averageDistance?: number | null
  capacityWithin?: number
  capacityTotal?: number
  capacityPercentage?: number
  capacityModeLabel?: string
  panX?: number
  panY?: number
}

export interface SchoolStatusCount {
  total: number
  operating: number
  closed: number
}

export interface SchoolComparisonMetrics extends SchoolStatusCount {
  averageDistance: number | null
  withinCapacity: number
  capacityTotal: number
}

export interface OptimizationComparisonSnapshot {
  elementary: SchoolComparisonMetrics
  middle: SchoolComparisonMetrics
}

export interface MapComponentProps {
  opacity: number
  populationMultiplier: number
  displaySettings: DisplaySettings
  selectedMode: "Name_1" | "Name_2"
  borderColor: "white" | "black"
  selectedYear: number;
  onYearChange?: (value: number[]) => void
  onSwitchToElementaryMode: () => void
  onSwitchToMiddleSchoolMode: () => void
  onResetToInitialState: () => void
  onSchoolDataChange?: (schoolData: SchoolGeoJSONData | null) => void
  onSelectedSchoolChange?: (schoolName: string | null) => void
  onOptimizedDistrictDataChange?: (data: GeoJSONData | null) => void
  onSchoolSelectionSummaryChange?: (
    summary: Record<
      string,
      {
        Name_1: { total: number; selected: number; fixed: number }
        Name_2: { total: number; selected: number; fixed: number }
      }
    >,
  ) => void
  isEditing?: boolean
  onEditingChange?: (enable: boolean) => void
  onOptimizationBaselineChange?: (snapshot: OptimizationComparisonSnapshot | null) => void

  penaltyPlus: number
  penaltyMinus: number
  timeLimitSec: number
  mipGap: number
}

export interface School {
  type: "Feature"
  properties: {
    originalIsClosed: boolean
    name: string
    Name?: string
    min_students?: number
    minStudents?: number
    max_students?: number
    maxStudents?: number
    isClosed?: boolean
    isClosedManual?: boolean
    manualOpenOverride?: boolean
    closedByOptimization?: boolean
    assignedStudentsSho?: number
    assignedStudentsChu?: number
    optimizationOption?: SchoolOptimizationOption
  }
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
}

export type SchoolType = "小学校" | "中学校" | "その他"

export interface SchoolFeature {
  type: "Feature"
  properties: {
    name: string
    min_students?: number
    max_students?: number
    isClosed?: boolean
    isClosedManual?: boolean
    manualOpenOverride?: boolean
    closedByOptimization?: boolean
    assignedStudentsSho?: number
    assignedStudentsChu?: number
  }
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
}

export interface District {
  type: "Feature"
  properties: {
    id: string
    name: string
    Name_1: string
    Name_2: string
    num_sho2024: number
    num_chu2024: number
    centroid_x: number
    centroid_y: number
    originalDistricts?: {
      Name_1: string
      Name_2: string
    }
    editedDistricts?: {
      Name_1: string
      Name_2: string
    }
    optimizedDistricts?: {
      Name_1: string
      Name_2: string
    }
    districtOptions?: {
      Name_1: DistrictOptionValue
      Name_2: DistrictOptionValue
    }
    districtOption?: DistrictOptionValue
    editedStudents?: {
      num_sho: number
      num_chu: number
    }
  }
  geometry: {
    type: "Polygon"
    coordinates: number[][][]
  }
}

export interface DistrictFeature {
  type: "Feature"
  properties: {
    id: string
    name: string
    Name_1: string
    Name_2: string
    num_sho2024: number
    num_chu2024: number
    centroid_x: number
    centroid_y: number
    originalDistricts?: {
      Name_1: string
      Name_2: string
    }
    editedDistricts?: {
      Name_1: string
      Name_2: string
    }
    optimizedDistricts?: {
      Name_1: string
      Name_2: string
    }
    districtOptions?: {
      Name_1: DistrictOptionValue
      Name_2: DistrictOptionValue
    }
    districtOption?: DistrictOptionValue
    editedStudents?: {
      num_sho: number
      num_chu: number
    }
  }
  geometry: {
    type: "Polygon"
    coordinates: number[][][]
  }
}

export interface OptimizationResult {
  optimizedData: GeoJSONData
  changedCount: number
  message: string
}

export interface OptimizeOptions {
  penaltyPlus?: number
  penaltyMinus?: number
  timeLimitSec?: number
  mipGap?: number
  selectedTownIds?: string[]
  rangeMode?: "fix" | "exclude"
  lockedTownIds?: string[]
}

export interface ControlPanelProps {
  displayMode: DisplayMode
  selectedSchool: string | null
  selectedSchoolIsClosed: boolean
  averageDistance: number | null
  isOptimizing: boolean
  optimizedDistrictData: GeoJSONData | null
  schoolData?: SchoolGeoJSONData | null // 学校データを追加
  selectedMode: "Name_1" | "Name_2"

  onDisplayModeChange: (mode: DisplayMode) => void
  onClearSchoolInfo: () => void
  onRunOptimization: () => void
  onResetDistricts: () => void
  onExportMapAsImage: (options?: MapExportOptions) => void
}

// export interface SidePanelProps {
//   selectedYear: number
//   onYearChange: (value: number[]) => void
// }

export interface SidePanelProps {
  opacity: number
  populationMultiplier: number
  displaySettings: DisplaySettings
  displayMode: DisplayMode
  schoolData: SchoolGeoJSONData | null
  selectedYear: number
  selectedMode: "Name_1" | "Name_2"

  // 年度
  onYearChange: (value: number[]) => void

  // 表示系
  onOpacityChange: (value: number[]) => void
  onPopulationChange: (value: number[]) => void
  onDisplaySettingChange: (setting: string, checked: boolean) => void
  onExcludedModeChange: (mode: "hidden" | "faded-info" | "faded-no-info") => void

  // ★ 最適化パラメータ（SettingsTabで編集）
  penaltyPlus: number
  penaltyMinus: number
  timeLimitSec: number
  mipGap: number
  onPenaltyPlusChange: (v: number) => void
  onPenaltyMinusChange: (v: number) => void
  onTimeLimitSecChange: (v: number) => void
  onMipGapChange: (v: number) => void

  // ファイル操作
  onSaveGeoJSON: () => void
  onLoadGeoJSON: (json: unknown) => void
  onExportSchoolsCSV: () => void
  onExportDistrictsCSV: () => void
  onExportMapAsImage: (options?: MapExportOptions) => void
  isExportingMap?: boolean

  // その他
  onShowComparison: () => void
  onSwitchToElementaryMode: () => void
  onSwitchToMiddleSchoolMode: () => void
  onClose: () => void
  onToggleSchoolStatus: (schoolName: string, newIsClosed: boolean) => Promise<void>
  onToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void
  onSelectAllSchools: () => Promise<void> | void
  onClearAllSchools: () => Promise<void> | void
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >
  optimizedDistrictData?: GeoJSONData | null
  optimizationBaselineStats?: OptimizationComparisonSnapshot | null
}

export type CsvRow = Record<string, unknown> | unknown[]
