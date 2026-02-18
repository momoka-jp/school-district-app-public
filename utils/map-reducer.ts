import type { MapState, MapAction } from "@/types/map-state-types"

// 3. 初期状態を定義（型定義ファイルから移動）
export const initialState: MapState = {
  // データ関連
  districtData: null,
  originalDistrictData: null,
  optimizedDistrictData: null,
  schoolData: null,
  distanceData: null,

  // UI状態
  selectedSchool: null,
  selectedSchoolIsClosed: false,
  displayMode: "current",
  currentZoom: 13,
  showComparisonView: false,

  // エラー・ローディング状態
  errorMessage: null,
  isLoading: true,
  isOptimizing: false,
  isUpdatingSchool: false,

  // 計算結果
  averageDistance: null,
}

// 4. Actionの種類に応じて状態をどう変更するかを記述するReducer関数
export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    // データ初期化関連
    case "SET_INITIAL_DATA":
      return {
        ...state,
        districtData: action.payload.districtData,
        originalDistrictData: action.payload.originalDistrictData,
        optimizedDistrictData: null,
        schoolData: action.payload.schoolData,
        distanceData: action.payload.distanceData,
        selectedSchool: null,
        selectedSchoolIsClosed: false,
        showComparisonView: false,
        averageDistance: null,
        isOptimizing: false,
        isUpdatingSchool: false,
        isLoading: false,
        errorMessage: null,
      }

    case "SET_DISTRICT_DATA":
      return {
        ...state,
        districtData: action.payload,
      }

    case "SET_OPTIMIZED_DISTRICT_DATA":
      return {
        ...state,
        optimizedDistrictData: action.payload,
      }

    case "SET_SCHOOL_DATA":
      return {
        ...state,
        schoolData: action.payload,
      }

    // UI状態変更関連
    case "SELECT_SCHOOL":
      // 選択した学校が同じなら解除、違えば選択
      const isSameSchool = state.selectedSchool === action.payload.schoolName
      return {
        ...state,
        selectedSchool: isSameSchool ? null : action.payload.schoolName,
        selectedSchoolIsClosed: isSameSchool ? false : action.payload.isClosed,
      }

    case "CLEAR_SCHOOL_SELECTION":
      return {
        ...state,
        selectedSchool: null,
        selectedSchoolIsClosed: false,
      }

    case "SET_DISPLAY_MODE":
      return {
        ...state,
        displayMode: action.payload,
        // 表示モードが変わったらエラーメッセージをクリア
        errorMessage: null,
      }

    case "SET_CURRENT_ZOOM":
      return {
        ...state,
        currentZoom: action.payload,
      }

    case "SET_SHOW_COMPARISON_VIEW":
      return {
        ...state,
        showComparisonView: action.payload,
      }

    // エラー・ローディング状態関連
    case "SET_ERROR_MESSAGE":
      return {
        ...state,
        errorMessage: action.payload,
      }

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
        // ローディング開始時はエラーメッセージをクリア
        errorMessage: action.payload ? null : state.errorMessage,
      }

    case "SET_OPTIMIZING":
      return {
        ...state,
        isOptimizing: action.payload,
        // 最適化開始時はエラーメッセージをクリア
        errorMessage: action.payload ? null : state.errorMessage,
      }

    case "SET_UPDATING_SCHOOL":
      return {
        ...state,
        isUpdatingSchool: action.payload,
        // 学校更新開始時はエラーメッセージをクリア
        errorMessage: action.payload ? null : state.errorMessage,
      }

    // 計算結果関連
    case "SET_AVERAGE_DISTANCE":
      return {
        ...state,
        averageDistance: action.payload,
      }

    // 複合操作関連
    case "RESET_TO_INITIAL_STATE":
      return {
        ...state,
        districtData: action.payload.originalDistrictData,
        schoolData: action.payload.schoolData,
        selectedSchool: null,
        selectedSchoolIsClosed: false,
        displayMode: "current",
        optimizedDistrictData: null,
        showComparisonView: false,
        errorMessage: "すべての設定が初期状態にリセットされました",
        averageDistance: null,
      }

    case "UPDATE_SCHOOL_STATUS":
      const { schoolName, isClosed, updatedSchoolData } = action.payload
      return {
        ...state,
        schoolData: updatedSchoolData,
        // 廃校になった学校が選択されていた場合は選択を解除
        selectedSchool: state.selectedSchool === schoolName && isClosed ? null : state.selectedSchool,
        selectedSchoolIsClosed: state.selectedSchool === schoolName ? isClosed : state.selectedSchoolIsClosed,
        errorMessage: `${schoolName}を${isClosed ? "廃校" : "開校"}にしました`,
      }

    case "UPDATE_DISTRICT_ASSIGNMENT":
      if (!state.districtData) {
        return {
          ...state,
          errorMessage: "地区データが読み込まれていません",
        }
      }

      const { districtId, schoolName: assignedSchoolName, mode } = action.payload

      const updatedDistrictData = {
        ...state.districtData,
        features: state.districtData.features.map((feature) => {
          if (feature.properties.id === districtId) {
            return {
              ...feature,
              properties: {
                ...feature.properties,
                editedDistricts: {
                  ...feature.properties.editedDistricts,
                  [mode]: assignedSchoolName,
                },
              },
            }
          }
          return feature
        }),
      }

      return {
        ...state,
        districtData: updatedDistrictData,
        errorMessage: `地区 ${districtId} の${mode === "Name_1" ? "小学校" : "中学校"}を ${assignedSchoolName} に変更しました`,
      }

    // 未知のActionタイプの場合は現在の状態をそのまま返す
    default:
      console.warn(`Unknown action type: ${(action as any).type}`)
      return state
  }
}
