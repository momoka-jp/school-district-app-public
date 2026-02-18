import gurobipy as gp
from gurobipy import GRB
import os

class GurobiConfig:
    """Gurobi最適化のための設定クラス"""
    
    @staticmethod
    def setup_model(model_name="School_Optimization"):
        """最適化されたGurobiモデルを作成"""
        model = gp.Model(model_name)
        
        # パフォーマンス設定
        model.Params.OutputFlag = 1  # 詳細ログを出力
        model.Params.TimeLimit = 600  # 10分の制限時間
        model.Params.MIPGap = 0.005  # 0.5%の最適性ギャップ
        model.Params.MIPGapAbs = 1e-6  # 絶対ギャップ
        
        # 並列処理設定
        model.Params.Threads = min(8, os.cpu_count())  # 最大8スレッド
        
        # アルゴリズム設定
        model.Params.Method = -1  # 自動選択
        model.Params.Presolve = 2  # 積極的な前処理
        model.Params.Cuts = 2  # 積極的なカット生成
        model.Params.Heuristics = 0.1  # ヒューリスティック時間の割合
        
        # メモリ設定
        model.Params.NodefileStart = 2.0  # 2GB後にディスクを使用
        
        return model
    
    @staticmethod
    def get_solver_info():
        """Gurobiソルバーの情報を取得"""
        try:
            env = gp.Env()
            return {
                "version": gp.gurobi.version(),
                "license_type": "Academic" if env.get(GRB.IntParam.LicenseID) == 0 else "Commercial",
                "max_threads": os.cpu_count(),
                "available": True
            }
        except Exception as e:
            return {
                "available": False,
                "error": str(e)
            }
    
    @staticmethod
    def validate_license():
        """Gurobiライセンスの有効性を確認"""
        try:
            model = gp.Model("license_test")
            x = model.addVar(name="test")
            model.setObjective(x, GRB.MINIMIZE)
            model.optimize()
            return True, "ライセンスは有効です"
        except Exception as e:
            return False, f"ライセンスエラー: {str(e)}"
