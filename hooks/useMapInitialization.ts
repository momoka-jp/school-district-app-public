"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/leaflet.markercluster.js"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import type { GeoJSONData } from "@/types/map-types"

interface MapRefs {
  mapRef: React.MutableRefObject<L.Map | null>
  districtLayerRef: React.MutableRefObject<L.LayerGroup | null>
  schoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  elementarySchoolLayerRef: React.MutableRefObject<L.MarkerClusterGroup | null>
  middleSchoolLayerRef: React.MutableRefObject<L.MarkerClusterGroup | null>
  lineLayerRef: React.MutableRefObject<L.LayerGroup | null>
  centroidLayerRef: React.MutableRefObject<L.LayerGroup | null>
  highlightLayerRef: React.MutableRefObject<L.LayerGroup | null>
  schoolLabelLayerRef: React.MutableRefObject<L.LayerGroup | null>
  disabledSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedElementarySchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedMiddleSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  currentDistrictPopupIdRef: React.MutableRefObject<string | null>
  fitToData: (geojson: GeoJSONData | null) => void
}

export function useMapInitialization(setCurrentZoom: (zoom: number) => void): MapRefs {
  const mapRef = useRef<L.Map | null>(null)
  const districtLayerRef = useRef<L.LayerGroup | null>(null)
  const schoolLayerRef = useRef<L.LayerGroup | null>(null)
  const elementarySchoolLayerRef = useRef<L.MarkerClusterGroup | null>(null)
  const middleSchoolLayerRef = useRef<L.MarkerClusterGroup | null>(null)
  const lineLayerRef = useRef<L.LayerGroup | null>(null)
  const centroidLayerRef = useRef<L.LayerGroup | null>(null)
  const highlightLayerRef = useRef<L.LayerGroup | null>(null)
  const schoolLabelLayerRef = useRef<L.LayerGroup | null>(null)
  const disabledSchoolLayerRef = useRef<L.LayerGroup | null>(null)
  const closedSchoolLayerRef = useRef<L.LayerGroup | null>(null)
  const closedElementarySchoolLayerRef = useRef<L.LayerGroup | null>(null)
  const closedMiddleSchoolLayerRef = useRef<L.LayerGroup | null>(null)
  const currentDistrictPopupIdRef = useRef<string | null>(null)
  const fitToData = (geojson: GeoJSONData | null) => {
    if (mapRef.current && geojson?.features && geojson.features.length > 0) {
      const tempLayer = L.geoJSON(geojson)
      const bounds = tempLayer.getBounds()
      mapRef.current.fitBounds(bounds, {
        padding: [30, 30], // 周囲に余白を持たせる
        maxZoom: 14        // ズームしすぎ防止
      })
      console.log("Map adjusted to data bounds.")
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleZoomEnd = () => {
      if (mapRef.current) {
        const newZoom = mapRef.current.getZoom()
        setCurrentZoom(newZoom)
      }
    }

    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([34.6851, 135.8328], 13)
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 100)

      mapRef.current.on("zoomend", handleZoomEnd)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        crossOrigin: "anonymous",
      }).addTo(mapRef.current)

      L.control
        .scale({
          position: "bottomleft",
          metric: true,
          imperial: false,
          maxWidth: 200,
        })
        .addTo(mapRef.current)

      // Paneの作成
      const panes = [
        { name: "districtPane", zIndex: "200" },
        { name: "linePane", zIndex: "500" },
        { name: "centroidPane", zIndex: "550" },
        { name: "schoolPane", zIndex: "600" },
        { name: "disabledSchoolPane", zIndex: "590" },
        { name: "closedSchoolPane", zIndex: "595" },
        { name: "schoolLabelPane", zIndex: "750" },
      ]

      panes.forEach(({ name, zIndex }) => {
        mapRef.current!.createPane(name)
        const pane = mapRef.current!.getPane(name)
        if (pane) {
          pane.style.zIndex = zIndex
        }
      })

      // レイヤーグループを作成
      districtLayerRef.current = L.layerGroup().addTo(mapRef.current)
      schoolLayerRef.current = L.layerGroup().addTo(mapRef.current)
      lineLayerRef.current = L.layerGroup().addTo(mapRef.current)
      centroidLayerRef.current = L.layerGroup().addTo(mapRef.current)
      schoolLabelLayerRef.current = L.layerGroup().addTo(mapRef.current)
      highlightLayerRef.current = L.layerGroup().addTo(mapRef.current)
      disabledSchoolLayerRef.current = L.layerGroup().addTo(mapRef.current)
      closedSchoolLayerRef.current = L.layerGroup().addTo(mapRef.current)
      closedElementarySchoolLayerRef.current = L.layerGroup().addTo(mapRef.current)
      closedMiddleSchoolLayerRef.current = L.layerGroup().addTo(mapRef.current)

      // クラスタリング用のレイヤーグループを作成
      elementarySchoolLayerRef.current = new L.MarkerClusterGroup({
        disableClusteringAtZoom: 14,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          return L.divIcon({
            html: `<div class="cluster-icon elementary">${count}</div>`,
            className: "elementary-cluster",
            iconSize: L.point(40, 40),
          })
        },
      }).addTo(mapRef.current)

      middleSchoolLayerRef.current = new L.MarkerClusterGroup({
        disableClusteringAtZoom: 14,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          return L.divIcon({
            html: `<div class="cluster-icon middle">${count}</div>`,
            className: "middle-cluster",
            iconSize: L.point(40, 40),
          })
        },
      }).addTo(mapRef.current)

    }

    // スタイルをヘッドに追加
    const style = document.createElement("style")
    style.innerHTML = `
      .cluster-icon {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: white;
        font-weight: bold;
        font-size: 14px;
      }
      .cluster-icon.elementary {
        background-color: rgba(59, 130, 246, 0.8);
        border: 2px solid #2563eb;
      }
      .cluster-icon.middle {
        background-color: rgba(239, 68, 68, 0.8);
        border: 2px solid #dc2626;
      }
      .icon-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        color: white;
      }
      .icon-container.elementary {
        background-color: #3b82f6;
        border: 2px solid #2563eb;
      }
      .icon-container.middle {
        background-color: #ef4444;
        border: 2px solid #dc2626;
      }
      .icon-container.disabled {
        background-color: #9ca3af;
        border: 2px solid #6b7280;
        opacity: 0.6;
      }
      .icon-container.closed {
        background-color: #1f2937;
        border: 2px solid #111827;
        opacity: 0.8;
      }
      .school-label span {
        background-color: rgba(255, 255, 255, 0.8);
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 12px;
        white-space: nowrap;
      }
      .school-label.closed span {
        text-decoration: line-through;
        color: #4b5563;
      }
      .map-container {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .error-message {
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 2000;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        animation: fadeIn 0.3s ease-in-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      .school-popup-content {
        min-width: 250px;
        padding: 16px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .leaflet-popup-pane {
        z-index: 800 !important;
      }
      .leaflet-popup-content-wrapper {
        min-width: 150px !important;
        z-index: 800 !important;
      }
      .leaflet-popup-content {
        min-width: 120px !important;
        margin: 8px 12px !important;
      }
      .leaflet-popup-tip-container {
        z-index: 800 !important;
      }
      .district-popup {
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #1f2937;
        min-width: 230px;
      }
      .district-popup .district-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .district-popup label.toggle {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 2px 0;
        font-size: 13px;
        font-weight: 500;
        color: #111827;
        cursor: pointer;
      }
      .district-popup label.toggle[aria-disabled="true"] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .district-popup label.toggle input[type="checkbox"] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        margin: 0;
        cursor: pointer;
      }
      .district-popup label.toggle span[data-slider] {
        position: relative;
        flex-shrink: 0;
        width: 38px;
        height: 20px;
        border-radius: 9999px;
        background-color: #d1d5db;
        transition: background-color 0.2s ease;
      }
      .district-popup label.toggle span[data-slider]::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 9999px;
        background-color: #ffffff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
        transition: transform 0.2s ease;
      }
      .district-popup label.toggle input[type="checkbox"]:checked + span[data-slider] {
        background-color: #2563eb;
      }
      .district-popup label.toggle input[type="checkbox"]:checked + span[data-slider]::after {
        transform: translateX(18px);
      }
      .district-popup label.toggle .label-text {
        font-size: 13px;
        font-weight: 500;
      }
      .district-popup .status-text {
        font-size: 12px;
        color: #1f2937;
        margin-top: 4px;
        font-weight: 500;
      }
      .district-popup .option-description {
        font-size: 11px;
        color: #4b5563;
        line-height: 1.4;
      }
    `
    document.head.appendChild(style)

    return () => {
      if (mapRef.current) {
        mapRef.current.off("zoomend", handleZoomEnd)
        mapRef.current.remove()
        mapRef.current = null
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style)
      }
    }
  }, [setCurrentZoom])

  return {
    mapRef,
    districtLayerRef,
    schoolLayerRef,
    elementarySchoolLayerRef,
    middleSchoolLayerRef,
    lineLayerRef,
    centroidLayerRef,
    highlightLayerRef,
    schoolLabelLayerRef,
    disabledSchoolLayerRef,
    closedSchoolLayerRef,
    closedElementarySchoolLayerRef,
    closedMiddleSchoolLayerRef,
    currentDistrictPopupIdRef,
    fitToData
  }
}
