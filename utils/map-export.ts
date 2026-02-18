"use client"

import L from "leaflet"
import html2canvas from "html2canvas"
import type { MutableRefObject } from "react"
import { getTimestamp } from "@/utils/map-utils"
import type GeoJSON from "geojson"
import type { LayerRefs } from "@/utils/map-drawing-utils"
import type { DisplaySettings, GeoJSONData, MapExportOptions } from "@/types/map-types"

interface ExportMapParams {
  options?: MapExportOptions
  districtData: GeoJSONData | null
  layerRefs: LayerRefs
  displaySettings: DisplaySettings
  updateLayerVisibility: () => void
  updateSchoolLabelVisibility: () => void
  setErrorMessage: (message: string | null) => void
}

/** map の移動・タイル描画が一段落するまで待機 */
const waitForMapToSettle = (map: L.Map): Promise<void> =>
  new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      requestAnimationFrame(() => setTimeout(resolve, 60))
    }
    map.once("moveend", finish)
    const tiles: L.TileLayer[] = []
    map.eachLayer((lyr) => lyr instanceof L.TileLayer && tiles.push(lyr))
    if (tiles.length === 0) return
    let remain = tiles.length
    tiles.forEach((t) => t.once("load", () => (--remain <= 0) && finish()))
    setTimeout(finish, 1000)
  })

const normalizePadding = (padding: MapExportOptions["padding"]): L.PointExpression => {
  if (Array.isArray(padding)) return L.point(padding[0], padding[1])
  return L.point(padding ?? 40, padding ?? 40)
}

const reportExportError = (error: unknown, setErrorMessage: (message: string | null) => void) => {
  console.error(error)
  setErrorMessage("画像の生成に失敗しました。")
}

let isExporting = false

export const exportMapAsImage = async ({
  districtData, layerRefs, displaySettings,
  updateLayerVisibility, updateSchoolLabelVisibility, setErrorMessage, options,
}: ExportMapParams) => {
  if (isExporting) {
    setErrorMessage("画像の生成中です。しばらくお待ちください。")
    return
  }
  const map = layerRefs.mapRef.current
  if (!districtData || !map) return

  const mapContainer = map.getContainer()
  if (!mapContainer) return
  isExporting = true

  const geoBounds = L.geoJSON(districtData as GeoJSON.FeatureCollection).getBounds()
  let bounds = geoBounds
  let schoolCenter: L.LatLng | null = null

  const getLayerBounds = (layer: L.Layer | null | undefined): L.LatLngBounds | null => {
    if (!layer || !("getBounds" in layer)) return null
    const candidate = (layer as { getBounds?: () => L.LatLngBounds }).getBounds
    return typeof candidate === "function" ? candidate.call(layer) : null
  }

  const schoolLayers: Array<MutableRefObject<L.LayerGroup | null> | undefined> = [
    layerRefs.elementarySchoolLayerRef,
    layerRefs.middleSchoolLayerRef,
    layerRefs.disabledSchoolLayerRef,
    layerRefs.closedElementarySchoolLayerRef,
    layerRefs.closedMiddleSchoolLayerRef,
    layerRefs.closedSchoolLayerRef,
  ]

  let schoolBounds: L.LatLngBounds | null = null
  schoolLayers.forEach((ref) => {
    const b = getLayerBounds(ref?.current ?? undefined)
    if (b && b.isValid()) {
      if (!schoolBounds) {
        schoolBounds = b
      } else {
        schoolBounds.extend(b)
      }
    }
  })

  if (schoolBounds && (schoolBounds as L.LatLngBounds).isValid()) {
    bounds = bounds.extend(schoolBounds)
    schoolCenter = (schoolBounds as L.LatLngBounds).getCenter()
  }

  if (!bounds.isValid()) return

  const opts = options ?? {}
  const prevCenter = map.getCenter()
  const prevZoom   = map.getZoom()
  const origTransform = mapContainer.style.transform
  const origPosition  = mapContainer.style.position
  const origBg        = mapContainer.style.backgroundColor
  let overlayCard: HTMLDivElement | null = null

  // 一時的に外すレイヤを管理
  const removed: L.Layer[] = []
  const detach = (cond: boolean, ref: MutableRefObject<L.LayerGroup | null>) => {
    if (!cond) return
    const lyr = ref.current
    if (lyr && map.hasLayer(lyr)) { map.removeLayer(lyr); removed.push(lyr) }
  }

  // const actualElementaryVisible = displaySettings.elementarySchools && displaySettings.elementaryMarkers
  // const actualMiddleVisible     = displaySettings.middleSchools && displaySettings.middleMarkers
  // const actualLabelVisible      = displaySettings.elementaryLabels || displaySettings.middleLabels

  const showElementaryMarkers = opts.elementaryMarkers ?? true
  const showMiddleMarkers = opts.middleMarkers ?? true
  const showLabels = opts.labels ?? true
  const showDisabledMarkers = opts.disabledMarkers ?? true
  const showClosedMarkers = opts.closedMarkers ?? true

  detach(!showElementaryMarkers, layerRefs.elementarySchoolLayerRef)
  detach(!showMiddleMarkers,     layerRefs.middleSchoolLayerRef)

  // detach(actualElementaryVisible && !(opts.elementaryMarkers ?? true), layerRefs.elementarySchoolLayerRef)
  // detach(actualMiddleVisible     && !(opts.middleMarkers ?? true),     layerRefs.middleSchoolLayerRef)
  // detach(actualLabelVisible      && !(opts.labels ?? true),            layerRefs.schoolLabelLayerRef)
  detach(!showDisabledMarkers, layerRefs.disabledSchoolLayerRef)
  detach(!showClosedMarkers, layerRefs.closedSchoolLayerRef)
  detach(!showClosedMarkers || !showElementaryMarkers, layerRefs.closedElementarySchoolLayerRef)
  detach(!showClosedMarkers || !showMiddleMarkers, layerRefs.closedMiddleSchoolLayerRef)
  detach(true, layerRefs.lineLayerRef)
  detach(true, layerRefs.centroidLayerRef)

  const hiddenLabels: HTMLElement[] = []

  if (!showLabels) {
    document.querySelectorAll(".school-label").forEach((el) => {
      const html = el as HTMLElement
      if (html.style.display !== "none") {
        hiddenLabels.push(html)
        html.style.display = "none"
      }
    })
  }

  let addedDistrictLayer = false
  if (layerRefs.districtLayerRef.current && !map.hasLayer(layerRefs.districtLayerRef.current)) {
    map.addLayer(layerRefs.districtLayerRef.current)
    addedDistrictLayer = true
  }

  // Leafletのtransformとタイルを一時的に無効化
  mapContainer.style.backgroundColor = "#ffffff"

  mapContainer.style.transform = ""
  mapContainer.style.position  = "relative"

  const pad = normalizePadding(opts.padding)
  const basePaddingValue = Array.isArray(opts.padding)
    ? Math.min(opts.padding[0], opts.padding[1])
    : (opts.padding ?? 40)

  const showAverageDistance = opts.showAverageDistance !== false
  const showCapacityRatio = opts.showCapacityRatio !== false
  if (showAverageDistance || showCapacityRatio) {
    overlayCard = document.createElement("div")
    overlayCard.style.position = "absolute"
    overlayCard.style.top = "16px"
    overlayCard.style.right = "16px"
    overlayCard.style.zIndex = "1200"
    overlayCard.style.background = "#ffffff"
    overlayCard.style.border = "1px solid #e5e7eb"
    overlayCard.style.borderRadius = "10px"
    overlayCard.style.padding = "10px 12px"
    overlayCard.style.boxShadow = "0 6px 14px rgba(0, 0, 0, 0.12)"
    overlayCard.style.fontSize = "12px"
    overlayCard.style.color = "#111827"
    overlayCard.style.lineHeight = "1.4"
    overlayCard.style.minWidth = "160px"

    if (showAverageDistance) {
      const title = document.createElement("div")
      title.textContent = "平均通学距離"
      title.style.fontWeight = "600"
      overlayCard.appendChild(title)

      const value = document.createElement("div")
      value.style.fontSize = "16px"
      value.style.fontWeight = "700"
      value.textContent =
        opts.averageDistance !== null && opts.averageDistance !== undefined
          ? `${opts.averageDistance.toFixed(2)} km`
          : "計算中..."
      overlayCard.appendChild(value)
    }

    if (showCapacityRatio) {
      const title = document.createElement("div")
      title.textContent = `適正規模${opts.capacityModeLabel ?? ""}数`
      title.style.fontWeight = "600"
      title.style.marginTop = showAverageDistance ? "8px" : "0"
      overlayCard.appendChild(title)

      const total = opts.capacityTotal ?? 0
      const within = opts.capacityWithin ?? 0
      const percentage = opts.capacityPercentage ?? 0

      const value = document.createElement("div")
      value.style.fontSize = "16px"
      value.style.fontWeight = "700"
      value.textContent = `${within} / ${total}校`
      overlayCard.appendChild(value)

      const percent = document.createElement("div")
      percent.style.color = "#6b7280"
      percent.textContent = `(${percentage}%)`
      overlayCard.appendChild(percent)
    }

    mapContainer.appendChild(overlayCard)
  }

  map.fitBounds(bounds, { padding: pad, animate: false })
  const zoomAdjust = Math.round((40 - basePaddingValue) / 20)
  if (zoomAdjust !== 0) {
    const getMinZoom = typeof map.getMinZoom === "function" ? map.getMinZoom() : -Infinity
    const getMaxZoom = typeof map.getMaxZoom === "function" ? map.getMaxZoom() : Infinity
    const nextZoom = Math.min(getMaxZoom, Math.max(getMinZoom, map.getZoom() + zoomAdjust))
    map.setZoom(nextZoom, { animate: false })
  }
  if (schoolCenter) {
    map.panTo(schoolCenter, { animate: false })
    if (typeof map.panInsideBounds === "function") {
      map.panInsideBounds(bounds, { animate: false })
    }
  }
  if (opts.panX || opts.panY) {
    const panX = opts.panX ?? 0
    const panY = opts.panY ?? 0
    map.panBy([panX, panY], { animate: false })
  }
  map.invalidateSize()
  await waitForMapToSettle(map)

  try {
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))

    const canvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
      logging: false,
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        doc.querySelectorAll("svg").forEach((svg) => {
          const rect = (svg as SVGSVGElement).getBoundingClientRect()
          svg.setAttribute("width",  String(rect.width))
          svg.setAttribute("height", String(rect.height))
        })
      },
    })

    const a = document.createElement("a")
    const ts = getTimestamp()
    const name = (opts.filename?.trim() || `map_snapshot_${ts}`).replace(/\.png$/i, "")
    a.href = canvas.toDataURL("image/png")
    a.download = `${name}.png`
    a.click()
  } catch (error) {
    reportExportError(error, setErrorMessage)
  } finally {
    isExporting = false
    if (overlayCard) {
      overlayCard.remove()
      overlayCard = null
    }
    mapContainer.style.backgroundColor = origBg ?? ""
    mapContainer.style.transform = origTransform
    mapContainer.style.position  = origPosition

    removed.forEach((lyr) => !map.hasLayer(lyr) && map.addLayer(lyr))
    if (addedDistrictLayer && !displaySettings.boundaries && layerRefs.districtLayerRef.current) {
      map.removeLayer(layerRefs.districtLayerRef.current)
    }
    updateLayerVisibility()
    updateSchoolLabelVisibility()

    map.setView(prevCenter, prevZoom, { animate: false })
    map.once("moveend", () => map.invalidateSize())

    hiddenLabels.forEach((el) => {
      el.style.display = ""
    })
  }
}
