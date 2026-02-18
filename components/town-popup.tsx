"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type SyntheticEvent } from "react"
import { createRoot } from "react-dom/client"
import type { DistrictOptionValue } from "@/types/map-types"

interface AssignmentInfo {
  name: string
  isClosed: boolean
}

interface StudentInfo {
  label: string
  value: number | null
  message?: string
  distanceText?: string
}

export interface TownPopupProps {
  townLabel: string
  studentInfo: StudentInfo
  assignments: {
    sho: AssignmentInfo
    chu: AssignmentInfo
  }
  currentOption: DistrictOptionValue
  describeOption: (option: DistrictOptionValue) => string
  hasIdentifier: boolean
  identifierMessage?: string
  onChangeOption: (option: DistrictOptionValue) => void
}

const badgeStyle: CSSProperties = {
  marginLeft: 6,
  padding: "0 6px",
  borderRadius: 9999,
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 10,
  border: "1px solid #fecaca",
}

const optionLabelStyle: CSSProperties = { fontSize: 12, color: "#374151" }
const optionValueStyle: CSSProperties = { fontSize: 12, fontWeight: 600 }

const stopPropagation = (event: SyntheticEvent) => {
  event.stopPropagation()
}

function TownPopup({
  townLabel,
  studentInfo,
  assignments,
  currentOption,
  describeOption,
  hasIdentifier,
  identifierMessage,
  onChangeOption,
}: TownPopupProps) {
  const [localOption, setLocalOption] = useState<DistrictOptionValue>(currentOption)

  useEffect(() => {
    setLocalOption(currentOption)
  }, [currentOption])

  const optionDescription = useMemo(() => describeOption(localOption), [localOption, describeOption])
  const optimizationChecked = localOption !== "対象外"
  const fixedChecked = localOption === "固定"

  const handleOptimizationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const shouldInclude = event.target.checked
    const nextOption: DistrictOptionValue = shouldInclude
      ? fixedChecked
        ? "固定"
        : "最適化対象"
      : "対象外"
    setLocalOption(nextOption)
    onChangeOption(nextOption)
  }

  const handleFixedChange = (event: ChangeEvent<HTMLInputElement>) => {
    const shouldFix = event.target.checked
    const wasOptimizationIncluded = localOption !== "対象外"
    const nextOption: DistrictOptionValue = shouldFix
      ? "固定"
      : wasOptimizationIncluded
        ? "最適化対象"
        : "対象外"
    setLocalOption(nextOption)
    onChangeOption(nextOption)
  }

  const closedBadge = (isClosed: boolean) => (isClosed ? <span style={badgeStyle}>閉</span> : null)

  return (
    <div
      className="district-popup"
      onPointerDown={stopPropagation}
      onPointerUp={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      onWheel={stopPropagation}
      onContextMenu={stopPropagation}
    >
      <div>
        <b>町丁目:</b> {townLabel}
      </div>
      {studentInfo.message ? (
        <div style={{ color: "#666" }}>{studentInfo.message}</div>
      ) : (
        <div>
          <b>{studentInfo.label}:</b> {studentInfo.value ?? 0}人
          {studentInfo.distanceText ? (
            <span style={{ marginLeft: 8, color: "#374151" }}>{studentInfo.distanceText}</span>
          ) : null}
        </div>
      )}
      <div className="district-assignment" style={{ marginTop: 4, lineHeight: 1.4 }}>
        <div>
          <span style={optionLabelStyle}>小学校:</span>{" "}
          <span style={optionValueStyle}>{assignments.sho.name}</span>
          {closedBadge(assignments.sho.isClosed)}
        </div>
        <div>
          <span style={optionLabelStyle}>中学校:</span>{" "}
          <span style={optionValueStyle}>{assignments.chu.name}</span>
          {closedBadge(assignments.chu.isClosed)}
        </div>
      </div>
      {hasIdentifier ? (
        <div className="district-options" style={{ marginTop: 8 }}>
          <label className="toggle" aria-disabled={fixedChecked ? "true" : "false"}>
            <input
              type="checkbox"
              role="switch"
              aria-checked={optimizationChecked ? "true" : "false"}
              checked={optimizationChecked}
              disabled={fixedChecked}
              onChange={handleOptimizationChange}
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            />
            <span data-slider></span>
            <span className="label-text">最適化対象に含める</span>
          </label>

          <label className="toggle" aria-disabled="false">
            <input
              type="checkbox"
              role="switch"
              aria-checked={fixedChecked ? "true" : "false"}
              checked={fixedChecked}
              onChange={handleFixedChange}
              onPointerDown={stopPropagation}
              onClick={stopPropagation}
            />
            <span data-slider></span>
            <span className="label-text">現行割当で固定</span>
          </label>

          <div className="status-text">
            現在の設定: <span>{localOption}</span>
          </div>
          <div className="option-description">{optionDescription}</div>
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "#666" }}>{identifierMessage ?? "この地区には識別子がありません"}</div>
      )}
    </div>
  )
}

export default TownPopup

export const createTownPopup = (initialProps: TownPopupProps) => {
  const container = document.createElement("div")
  const root = createRoot(container)

  const render = (props: TownPopupProps) => {
    root.render(<TownPopup {...props} />)
  }

  render(initialProps)

  return {
    container,
    render,
    unmount: () => {
      setTimeout(() => {
        root.unmount()
      }, 0)
    },
  }
}
