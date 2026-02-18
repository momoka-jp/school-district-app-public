import { NextRequest, NextResponse } from "next/server"
import { resolveFlaskEndpoint } from "@/lib/flask-url"

const FLASK_EXTRACT_ADJ_URL = resolveFlaskEndpoint("/extract_adjacency")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payloadGeoJSON = body?.geojson ?? body

    if (!payloadGeoJSON || payloadGeoJSON.type !== "FeatureCollection" || !Array.isArray(payloadGeoJSON.features)) {
      throw new Error("GeoJSON (FeatureCollection) をアップロードしてください")
    }

    const minSharedLength =
      typeof body?.min_shared_length === "number" ? body.min_shared_length : undefined

    const flaskRequestBody = {
      geojson: payloadGeoJSON,
      ...(minSharedLength !== undefined ? { min_shared_length: minSharedLength } : {}),
    }

    const response = await fetch(FLASK_EXTRACT_ADJ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flaskRequestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Flaskサーバーエラー: ${response.status} - ${errorText}`)
    }

    const flaskResult = await response.json().catch(() => null)
    if (!flaskResult) {
      throw new Error("Flaskサーバーからの応答が不正です")
    }
    if (flaskResult.status !== "success") {
      throw new Error(flaskResult.message || "隣接関係の抽出に失敗しました")
    }

    return NextResponse.json({
      success: true,
      adjacency: flaskResult.adjacency,
      stats: flaskResult.stats,
      serverSave: flaskResult.server_save,
    })
  } catch (error) {
    console.error("隣接関係抽出APIでエラー:", error)
    const message = error instanceof Error ? error.message : "隣接関係の抽出に失敗しました"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
