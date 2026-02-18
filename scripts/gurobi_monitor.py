from flask import Flask, jsonify
import gurobipy as gp
from gurobipy import GRB
import threading
import time

app = Flask(__name__)

class GurobiMonitor:
    def __init__(self):
        self.current_model = None
        self.optimization_status = "idle"
        self.progress_info = {}
    
    def callback(self, model, where):
        """Gurobiコールバック関数で最適化の進行状況を監視"""
        if where == GRB.Callback.MIP:
            objbst = model.cbGet(GRB.Callback.MIP_OBJBST)
            objbnd = model.cbGet(GRB.Callback.MIP_OBJBND)
            time_elapsed = model.cbGet(GRB.Callback.RUNTIME)
            
            if objbst < GRB.INFINITY:
                gap = abs((objbst - objbnd) / objbst) * 100
                self.progress_info = {
                    "best_objective": objbst,
                    "best_bound": objbnd,
                    "gap_percent": gap,
                    "time_elapsed": time_elapsed,
                    "status": "optimizing"
                }
    
    def start_optimization(self, model):
        """最適化を開始"""
        self.current_model = model
        self.optimization_status = "running"
        
        def optimize():
            try:
                model.optimize(self.callback)
                self.optimization_status = "completed"
            except Exception as e:
                self.optimization_status = f"error: {str(e)}"
        
        thread = threading.Thread(target=optimize)
        thread.start()
        return thread

monitor = GurobiMonitor()

@app.route("/optimization_status", methods=["GET"])
def get_optimization_status():
    """最適化の進行状況を取得"""
    return jsonify({
        "status": monitor.optimization_status,
        "progress": monitor.progress_info
    })

@app.route("/cancel_optimization", methods=["POST"])
def cancel_optimization():
    """最適化をキャンセル"""
    if monitor.current_model:
        monitor.current_model.terminate()
        monitor.optimization_status = "cancelled"
        return jsonify({"status": "success", "message": "最適化をキャンセルしました"})
    return jsonify({"status": "error", "message": "実行中の最適化がありません"})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
