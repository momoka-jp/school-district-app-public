import { resolveFlaskEndpoint } from "@/lib/flask-url"

/**
 * Flaskサーバーからマージされたデータを取得するユーティリティ関数
 */
export async function fetchMergedData() {
  try {
    const endpoint = resolveFlaskEndpoint("/data")
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`サーバーからエラーレスポンスを受信しました: ${response.status}`)
    }

    const data = await response.json()
    console.log("マージされたデータの取得に成功しました")
    return data
  } catch (error) {
    console.error("マージされたデータの取得に失敗しました:", error)
    throw error
  }
}
