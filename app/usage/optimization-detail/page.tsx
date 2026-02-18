import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sigma, Zap, Settings, BarChart, TrendingDown, Users } from "lucide-react"
import Link from "next/link"

export default function OptimizationDetailPage() {
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
              <Sigma className="h-8 w-8 text-primary" />
            </div>
            <div>
              <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
                機能詳細
              </Badge>
              <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                校区再編の最適化計算
              </h1>
              <p className="text-pretty text-lg text-muted-foreground leading-relaxed">
                現在の割当と制約（距離・定員・隣接など）を考慮し，数理最適化で自動配置する．実行条件（時間制限・ギャップ・ペナルティ）は設定できる．
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
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">MILPベースの計算</CardTitle>
                <CardDescription className="leading-relaxed">
                  Gurobi / PuLPを使用した混合整数線形計画法（MILP）で解を探索する．
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">柔軟な制約設定</CardTitle>
                <CardDescription className="leading-relaxed">
                  距離制約、定員制約、隣接制約など、複数の制約条件を組み合わせて最適化できます。
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingDown className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">通学距離の最小化</CardTitle>
                <CardDescription className="leading-relaxed">
                  平均通学距離を最小化校区配置を実現する．
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">定員の均等化</CardTitle>
                <CardDescription className="leading-relaxed">
                  各学校の児童・生徒数を均等化し，過密・過疎を防ぐバランスの取れた配置を提案する．
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
                <CardTitle className="text-lg">1. 実行パラメータの設定</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  <strong>時間制限</strong>（秒），<strong>許容ギャップ</strong>（MIPGap），
                  <strong>ランダム種</strong>，<strong>ソルバ選択</strong>（Gurobi / PuLP）を設定する．
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">2. 学校や町丁目の設定</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  学校や町丁目の最適化範囲などを指定する．
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">3. 最適化の実行</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  「最適化計算」ボタンをクリックする．
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">4. 結果の確認</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  計算が完了すると，最適化後の校区配置が地図上に表示される．右のパネルで平均通学距離と適正規模校数などの指標を確認できる．
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">5. 結果の採用または調整</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  調整が必要な場合は，制約条件を変更して再計算するか，手動編集で微調整できる．
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 制約条件の詳細 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">制約条件の詳細</h2>
          <div className="space-y-4">
            <Card className="border-l-4 border-l-blue-500 bg-card">
              <CardHeader>
                <CardTitle className="text-lg">ソルバ・実行パラメータ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground mb-3">
                  ソルバ（Gurobi / PuLP），時間制限，許容ギャップ（MIPGap），ランダム種，スレッド数などを設定する．
                  探索を打ち切る基準を適切に設けることで実務的な解を得やすい．
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>設定例：</strong> 時間制限 60秒，MIPGap 0.02，種 0（固定），スレッド 自動．
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>            
      {/* 結果の評価指標 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">結果の評価指標</h2>
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">平均通学距離</CardTitle>
                <CardDescription className="leading-relaxed">
                  町丁目から割当校までの距離の平均値．小さいほど良い．
                </CardDescription>
              </CardHeader>
            </Card>

          </div>
        </div>
      </section>

      {/* 最適化のヒント */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">最適化のヒント</h2>
          <Card className="border-l-4 border-l-primary bg-card">
            <CardContent className="pt-6">
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    初めて最適化を実行する場合は、すべての制約を有効にして標準的な重みで試してみてください。
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary">•</span>
                  <span className="leading-relaxed">
                    「固定」に設定した町丁目は最適化の対象外となるため、計算時間の短縮にも役立ちます。
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 結果の評価指標 */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold text-foreground">結果の評価指標</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">平均通学距離</CardTitle>
                <CardDescription className="leading-relaxed">
                  すべての町丁目から割り当てられた学校までの距離の平均値．この値が小さいほど児童・生徒の通学負担が軽減される．
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">定員充足率</CardTitle>
                <CardDescription className="leading-relaxed">
                  各学校の児童・生徒数が定員に対してどの程度充足しているかを示す．
                </CardDescription>
              </CardHeader>
            </Card>

          </div>
        </div>
      </section>

      {/* 次のステップ */}
      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-foreground">次のステップ</h2>
          <p className="mb-8 text-muted-foreground">
            最適化計算を理解したら、実際にアプリを使って校区の再編を試してみましょう。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/">
              <Button size="lg">アプリを使い始める</Button>
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
