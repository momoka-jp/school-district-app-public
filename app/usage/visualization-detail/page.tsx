import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Eye, Layers, MapPin, BarChart, Settings, Users } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function VisualizationDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/20 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <Link href="/usage">
            <Button variant="ghost" className="mb-6 group">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              使用方法に戻る
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Map className="h-8 w-8 text-primary" />
            </div>
            <div>
              <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
                機能詳細
              </Badge>
              <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                学校区の可視化
              </h1>
              <p className="text-pretty text-lg text-muted-foreground leading-relaxed">
                小学校区・中学校区を色分け表示し，町丁目を最小単位として割当関係を可視化する．
                町丁目の重心から割当校へ引いた補助線も表示し，空間的な対応を直観的に把握できる（経路や距離を厳密に表すものではない）．
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 主要な特徴 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">主要な特徴</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* 色分け表示 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">色分け表示</CardTitle>
                <CardDescription className="leading-relaxed">
                  校区を相互に識別しやすい配色で表示する．上部の切替で小学校区／中学校区を選択できる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 町丁目単位 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">町丁目単位の表示</CardTitle>
                <CardDescription className="leading-relaxed">
                  町丁目を最小単位として割当校を示す．クリックで詳細情報を確認できる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 通学重心線（補助表示） */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">通学重心線（補助表示）</CardTitle>
                <CardDescription className="leading-relaxed">
                  町丁目の重心と割当校を結ぶ補助線を表示する．空間的対応を把握するための目安であり，実際の経路や厳密距離を表すものではない．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* インタラクティブ地図 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">インタラクティブな地図</CardTitle>
                <CardDescription className="leading-relaxed">
                  ズームやパンで関心領域へ移動できる．学校マーカーから学校の詳細にアクセスできる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 指標パネル */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">指標パネル</CardTitle>
                <CardDescription className="leading-relaxed">
                  右側パネルに平均通学距離や適正規模の学校数（例：31/41校）を表示する．校区の状態を定量的に確認できる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 表示スタイル */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">表示スタイル</CardTitle>
                <CardDescription className="leading-relaxed">
                  マーカーのON/OFFやポリゴンの透過率を調整できる．境界が接する領域の判読性を高められる．
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 人口倍率・年度 */}
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">年度</CardTitle>
                <CardDescription className="leading-relaxed">
                  左パネルで年度を選択できる．
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* 使い方 */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">使い方</h2>
          <div className="space-y-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">1. 表示モードの選択</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground mb-4">
                  上部メニューで小学校区/中学校区を選択する．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_mode.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">2. 地図の操作</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  特定の町丁目をクリックすると詳細情報が表示される．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_chochomoku.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">3. 年度の設定</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  左パネルで年度を選択する．将来シナリオや年度別データで表示内容を切り替える．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_nendo.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">4. 学校情報の確認</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  地図上の学校マーカーをクリックするとその学校の詳細情報（名称，定員など）が表示される．
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Image
                    src="/images/ikoma_map_schoolpopup.png"
                    alt="表示モードの選択画面"
                    width={800}
                    height={450}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ヒントとコツ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">ヒントとコツ</h2>
          <Card className="border-l-4 border-l-primary bg-card">
            <CardContent className="pt-6">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    年度を選択することで，将来シナリオや年度別データを表示する．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    町丁目の詳細情報を確認するには，町丁目をクリックする．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    色の識別が難しい場合は透過率を調整する．
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    マウスホイールでズーム，ドラッグで地図を移動する．
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 次のステップ */}
      <section className="border-t border-border bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-foreground">次のステップ</h2>
          <p className="mb-8 text-muted-foreground">可視化機能を把握したら次は「編集機能」を試す．</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/usage/manual-edit-detail">
              <Button size="lg">校区の手動編集について学ぶ</Button>
            </Link>
            <Link href="/usage">
              <Button size="lg" variant="outline">
                使用方法に戻る
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
