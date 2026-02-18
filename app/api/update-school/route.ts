// app/api/update-school/route.ts
import { NextResponse } from "next/server"
import fs from "fs"
import { loadAppConfig, resolveDataPath } from "@/lib/app-config"

export async function POST(request: Request) {
  try {
    // リクエストボディからデータを取得
    const body = await request.json()
    const schoolName = body.schoolName
    const optimizationOption = body.optimizationOption as string | undefined
    const isClosedLegacy = body.isClosed as boolean | undefined

    if (typeof schoolName !== "string") {
      return NextResponse.json({ error: "学校名が不正です" }, { status: 400 })
    }

    const allowedOptions = new Set(["default", "closed", "forced_open", "excluded"])
    let resolvedOption: string | null = null

    if (typeof optimizationOption === "string" && allowedOptions.has(optimizationOption)) {
      resolvedOption = optimizationOption
    } else if (typeof isClosedLegacy === "boolean") {
      resolvedOption = isClosedLegacy ? "closed" : "default"
    }

    if (!resolvedOption) {
      return NextResponse.json({ error: "無効な学校設定です" }, { status: 400 })
    }

    // GeoJSONファイルのパス
    const config = loadAppConfig()
    const filePath = resolveDataPath(config.schools_filename)

    // ファイルを読み込む
    const fileData = fs.readFileSync(filePath, "utf8")
    const jsonData = JSON.parse(fileData)

    // 該当する学校を探して更新
    let schoolFound = false
    jsonData.features.forEach((feature: any) => {
      if (feature.properties.name === schoolName) {
        feature.properties.optimizationOption = resolvedOption
        feature.properties.closedByOptimization = false

        switch (resolvedOption) {
          case "closed":
            feature.properties.isClosed = true
            feature.properties.isClosedManual = true
            feature.properties.manualOpenOverride = false
            break
          case "forced_open":
            feature.properties.isClosed = false
            feature.properties.isClosedManual = false
            feature.properties.manualOpenOverride = true
            break
          case "excluded":
            feature.properties.isClosed = true
            feature.properties.isClosedManual = false
            feature.properties.manualOpenOverride = false
            break
          default:
            feature.properties.isClosed = false
            feature.properties.isClosedManual = false
            feature.properties.manualOpenOverride = false
            break
        }
        schoolFound = true
      }
    })

    if (!schoolFound) {
      return NextResponse.json({ error: "指定された学校が見つかりませんでした" }, { status: 404 })
    }

    // 更新したデータをファイルに書き込む
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2))

    const messageLabel =
      resolvedOption === "closed"
        ? "廃校"
        : resolvedOption === "forced_open"
          ? "強制開校"
          : resolvedOption === "excluded"
            ? "対象外"
            : "指定なし"

    return NextResponse.json({
      success: true,
      message: `学校 "${schoolName}" を ${messageLabel} に設定しました`,
    })
  } catch (error) {
    console.error("学校データの更新中にエラーが発生しました:", error)
    return NextResponse.json({ error: "学校データの更新に失敗しました" }, { status: 500 })
  }
}
