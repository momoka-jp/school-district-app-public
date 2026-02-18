"use client"

import { useReducer, useCallback } from "react"
import { mapReducer, initialState } from "@/utils/map-reducer"
import type { DistanceData } from "@/lib/calculate-average-distance"
import type { DisplayMode, GeoJSONData, SchoolGeoJSONData } from "@/types/map-types"

// 4. useReducerを使用したカスタムフック
export function useMapReducer() {
  const [state, dispatch] = useReducer(mapReducer, initialState)

  // アクションクリエーター関数群
  const actions = {
    // データ初期化
    setInitialData: useCallback(
      (payload: {
        districtData: GeoJSONData
        originalDistrictData: GeoJSONData
        schoolData: SchoolGeoJSONData
        distanceData: DistanceData | null
      }) => {
        dispatch({ type: "SET_INITIAL_DATA", payload })
      },
      [],
    ),

    setDistrictData: useCallback((data: GeoJSONData) => {
      dispatch({ type: "SET_DISTRICT_DATA", payload: data })
    }, []),

    setOptimizedDistrictData: useCallback((data: GeoJSONData | null) => {
      dispatch({ type: "SET_OPTIMIZED_DISTRICT_DATA", payload: data })
    }, []),

    setSchoolData: useCallback((data: SchoolGeoJSONData) => {
      dispatch({ type: "SET_SCHOOL_DATA", payload: data })
    }, []),

    // UI状態変更
    selectSchool: useCallback((schoolName: string | null, isClosed = false) => {
      if (schoolName) {
        dispatch({ type: "SELECT_SCHOOL", payload: { schoolName, isClosed } })
      } else {
        dispatch({ type: "CLEAR_SCHOOL_SELECTION" })
      }
    }, []),

    clearSchoolSelection: useCallback(() => {
      dispatch({ type: "CLEAR_SCHOOL_SELECTION" })
    }, []),

    setDisplayMode: useCallback((mode: DisplayMode) => {
      dispatch({ type: "SET_DISPLAY_MODE", payload: mode })
    }, []),

    setCurrentZoom: useCallback((zoom: number) => {
      dispatch({ type: "SET_CURRENT_ZOOM", payload: zoom })
    }, []),

    setShowComparisonView: useCallback((show: boolean) => {
      dispatch({ type: "SET_SHOW_COMPARISON_VIEW", payload: show })
    }, []),

    // エラー・ローディング状態
    setErrorMessage: useCallback((message: string | null) => {
      dispatch({ type: "SET_ERROR_MESSAGE", payload: message })
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: "SET_LOADING", payload: loading })
    }, []),

    setOptimizing: useCallback((optimizing: boolean) => {
      dispatch({ type: "SET_OPTIMIZING", payload: optimizing })
    }, []),

    setUpdatingSchool: useCallback((updating: boolean) => {
      dispatch({ type: "SET_UPDATING_SCHOOL", payload: updating })
    }, []),

    // 計算結果
    setAverageDistance: useCallback((distance: number | null) => {
      dispatch({ type: "SET_AVERAGE_DISTANCE", payload: distance })
    }, []),

    // 複合操作
    resetToInitialState: useCallback((originalDistrictData: GeoJSONData, schoolData: SchoolGeoJSONData) => {
      dispatch({ type: "RESET_TO_INITIAL_STATE", payload: { originalDistrictData, schoolData } })
    }, []),

    updateSchoolStatus: useCallback(
      (schoolName: string, isClosed: boolean, updatedSchoolData: SchoolGeoJSONData) => {
      dispatch({ type: "UPDATE_SCHOOL_STATUS", payload: { schoolName, isClosed, updatedSchoolData } })
      },
      [],
    ),

    updateDistrictAssignment: useCallback((districtId: string, schoolName: string, mode: "Name_1" | "Name_2") => {
      dispatch({ type: "UPDATE_DISTRICT_ASSIGNMENT", payload: { districtId, schoolName, mode } })
    }, []),
  }

  return {
    state,
    dispatch,
    actions,
  }
}
