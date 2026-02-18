from flask import Flask, request, jsonify
import gurobipy as gp
from gurobipy import GRB
import json
import os
import time
import traceback
from datetime import datetime
from flask_cors import CORS
from dotenv import load_dotenv

try:
    from shapely.geometry import shape
    from shapely.errors import ShapelyError
except Exception:  # shapely is optional for non-adjacency routes
    shape = None
    ShapelyError = Exception

load_dotenv()

app = Flask(__name__)
CORS(app)

# ===== パス解決用の基本設定 =====
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "public", "data")
OUTPUT_DIR = os.path.join(PUBLIC_DATA_DIR, "output")

def get_config():
    """config.json を読み込み辞書として返す"""
    config_path = os.path.join(PUBLIC_DATA_DIR, "config.json")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"config.json が見つかりません: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_data_paths(config):
    # config.json に書かれた相対パスを取得
    dist_rel_path = config.get("distance_filename", "distance.json")
    jimoto_rel_path = config.get("jimoto_filename", "jimoto.json")
    
    # DATA_DIR と結合する
    return {
        "distance": os.path.join(PUBLIC_DATA_DIR, dist_rel_path),
        "jimoto": os.path.join(PUBLIC_DATA_DIR, jimoto_rel_path),
        "adj": os.path.join(OUTPUT_DIR, "adj.json")
    }

def _resolve_feature_id(feature, index):
    """Extract a stable identifier from the GeoJSON feature."""
    props = feature.get("properties") or {}
    for key in ("id", "name", "Name", "Name_1", "Name_2"):
        value = props.get(key)
        if value:
            return str(value)
    return f"feature_{index}"

def _bounds_overlap(b1, b2, padding=0.0):
    """Axis-aligned bounding box overlap test (optionally padded)."""
    return not (
        b1[2] < b2[0] - padding
        or b2[2] < b1[0] - padding
        or b1[3] < b2[1] - padding
        or b2[3] < b1[1] - padding
    )

def _shared_boundary_or_overlap(geom1, geom2, min_shared_length):
    """Check whether two polygons share a line boundary or overlap."""
    try:
        intersection = geom1.intersection(geom2)
    except Exception as exc:
        print(f"警告: ポリゴンの交差計算に失敗しました: {exc}")
        return False

    if intersection.is_empty:
        return False

    geom_type = intersection.geom_type
    if geom_type in ("LineString", "MultiLineString"):
        return intersection.length >= min_shared_length

    if geom_type in ("Polygon", "MultiPolygon"):
        # 共有面積がある場合は確実に隣接しているとみなす
        return intersection.area > 0

    if geom_type == "GeometryCollection":
        total_length = sum(
            part.length for part in intersection.geoms if part.geom_type in ("LineString", "MultiLineString")
        )
        if total_length >= min_shared_length:
            return True
        total_area = sum(
            part.area for part in intersection.geoms if part.geom_type in ("Polygon", "MultiPolygon")
        )
        return total_area > 0

    return False

def build_adjacency_from_geojson(geojson_data, min_shared_length=1e-6):
    if shape is None:
        raise RuntimeError("shapely がインストールされていないため隣接判定が実行できません")

    features = (geojson_data or {}).get("features")
    if not isinstance(features, list):
        raise ValueError("GeoJSON の features が不正です")

    geometries = []
    adjacency = {}

    for idx, feature in enumerate(features):
        geometry_data = feature.get("geometry")
        if not geometry_data:
            continue

        try:
            geom = shape(geometry_data)
            if not geom.is_valid:
                geom = geom.buffer(0)
        except ShapelyError as exc:
            print(f"警告: GeoJSON フィーチャのジオメトリ変換に失敗しました (index={idx}): {exc}")
            continue

        feature_id = _resolve_feature_id(feature, idx)
        geometries.append((feature_id, geom, geom.bounds))
        adjacency[feature_id] = set()

    for i in range(len(geometries)):
        fid1, geom1, bounds1 = geometries[i]
        for j in range(i + 1, len(geometries)):
            fid2, geom2, bounds2 = geometries[j]
            if not _bounds_overlap(bounds1, bounds2):
                continue
            if _shared_boundary_or_overlap(geom1, geom2, min_shared_length):
                adjacency[fid1].add(fid2)
                adjacency[fid2].add(fid1)

    return {key: sorted(list(neighbors)) for key, neighbors in adjacency.items()}

@app.route("/generate_lp", methods=["POST"])
def generate_lp():
    try:
        config = get_config()
        paths = get_data_paths(config)

        print("=" * 50)
        print(f"最適化リクエストを受信しました: {config.get('city_name', '不明')}")
        data = request.json

        if not data:
            raise ValueError("リクエストデータが空です")

        # ==== 受け取り ====
        schools  = data.get("schools", {}).get("features", [])
        students = data.get("district", {}).get("features", [])
        mode     = data.get("mode", "elementary")  # "elementary" | "middle"
        year     = int(data.get("year", 2024))

        # 範囲指定（★追加）
        range_mode = data.get("range_mode") or data.get("rangeMode") or "fix"
        if range_mode not in ("fix", "exclude"):
            range_mode = "fix"
        raw_selected_ids = data.get("selected_town_ids") or data.get("selectedTownIds") or []
        if not isinstance(raw_selected_ids, list):
            raw_selected_ids = []
        selected_town_ids = set(raw_selected_ids)

        raw_locked_assignments = data.get("locked_assignments") or data.get("lockedAssignments") or {}
        if not isinstance(raw_locked_assignments, dict):
            raw_locked_assignments = {}
        locked_assignments = {}
        for key, value in raw_locked_assignments.items():
            if value is None:
                continue
            addr = str(key)
            sch = str(value)
            if addr and sch:
                locked_assignments[addr] = sch

        raw_force_close = data.get("force_close_schools") or []
        raw_force_open = data.get("force_open_schools") or []
        force_close_schools = set(str(name) for name in raw_force_close if isinstance(name, str))
        force_open_schools = set(str(name) for name in raw_force_open if isinstance(name, str))
        # 廃校指定が優先
        force_open_schools.difference_update(force_close_schools)

        # ペナルティ・ソルバパラメータ
        Penalty_plus  = float(data.get("penalty_plus", 100))
        Penalty_minus = float(data.get("penalty_minus", 100))
        time_limit_sec = float(data.get("time_limit_sec", 60))
        mip_gap        = float(data.get("mip_gap", 0.80))

        if time_limit_sec <= 0:
            time_limit_sec = 60
        if not (0.0 <= mip_gap <= 1.0):
            mip_gap = 0.80

        print(f"データ確認: 学校数={len(schools)}, 地区数={len(students)}, モード={mode}")
        print(f"ペナルティ: plus={Penalty_plus}, minus={Penalty_minus}")
        print(f"ソルバ設定: TimeLimit={time_limit_sec}s, MIPGap={mip_gap}")
        print(f"範囲指定: range_mode={range_mode}, selected_ids={len(selected_town_ids)}")
        print(f"固定指定: {len(locked_assignments)}件")
        print(f"学校の強制閉鎖: {len(force_close_schools)}件, 強制開校: {len(force_open_schools)}件")

        if not schools or not students:
            raise ValueError("学校データまたは地区データが不足しています")

        # ==== 参照データの読み込み (修正箇所) ====
        print(f"データを読み込み中: {paths['distance']}")
        with open(paths["distance"], "r", encoding="utf-8") as f:
            distances = json.load(f)
            
        print(f"データを読み込み中: {paths['adj']}")
        with open(paths["adj"], "r", encoding="utf-8") as f:
            adj = json.load(f)
            
        print(f"データを読み込み中: {paths['jimoto']}")
        with open(paths["jimoto"], "r", encoding="utf-8") as f:
            jimoto = json.load(f)

        # ==== 学校リスト ====
        school_list = {}
        school_list["elementary"] = [s["properties"]["name"] for s in schools if "小学校" in s["properties"]["name"]]
        school_list["middle"]     = [s["properties"]["name"] for s in schools if "中学校" in s["properties"]["name"]]
        force_close_in_scope = {sch for sch in force_close_schools if sch in school_list[mode]}
        force_open_in_scope = {sch for sch in force_open_schools if sch in school_list[mode]}
        missing_force_close = force_close_schools - force_close_in_scope
        missing_force_open = force_open_schools - force_open_in_scope
        school_list["both"]       = school_list["elementary"] + school_list["middle"]

        print(f"学校リスト: 小学校={len(school_list['elementary'])}, 中学校={len(school_list['middle'])}")
        if len(school_list["elementary"]) <= 3:
            print(f"小学校: {school_list['elementary']}")
        else:
            print(f"小学校: {school_list['elementary'][:3]}...")
        if len(school_list["middle"]) <= 3:
            print(f"中学校: {school_list['middle']}")
        else:
            print(f"中学校: {school_list['middle'][:3]}...")

        # ==== 地区レコード（IDとfeatureのペア） ====
        student_records = []
        for feat in students:
            props = feat.get("properties", {})
            district_id = props.get("id") or props.get("name") or str(props.get("Name_1", "")) or str(props.get("Name_2", ""))
            if district_id:
                student_records.append((district_id, feat))

        all_ids = [d for d, _ in student_records]
        if not selected_town_ids:
            # 範囲未指定なら全域を選択扱い
            selected_town_ids = set(all_ids)

        # exclude の場合は選択外を最初から除外
        if range_mode == "exclude":
            student_records = [rec for rec in student_records if rec[0] in selected_town_ids]

        address_list = [d for d, _ in student_records]
        num_district = len(address_list)

        locked_assignments_in_scope = {
            addr: sch for addr, sch in locked_assignments.items() if addr in address_list
        }
        if locked_assignments and not locked_assignments_in_scope:
            print("警告: 固定対象が最適化範囲に含まれていません")
        elif locked_assignments_in_scope:
            sample_items = list(locked_assignments_in_scope.items())[:5]
            print(f"固定対象（適用）: {len(locked_assignments_in_scope)}件 例: {sample_items}")

        print(f"地区リスト: {num_district}件 (範囲モード: {range_mode}, 選択済み={len(selected_town_ids)})")
        if num_district <= 5:
            print(f"地区: {address_list}")
        else:
            print(f"地区例: {address_list[:5]}...")

        if missing_force_close:
            print(f"警告: 強制廃校がモードに存在しません: {sorted(missing_force_close)}")
        if missing_force_open:
            print(f"警告: 強制開校がモードに存在しません: {sorted(missing_force_open)}")

        # ==== 現行割当 & 生徒数 ====
        assignment_key = "Name_1" if mode == "elementary" else "Name_2"
        current_assignments = {}
        student_counts = {}
        print(f"--- 学生数データチェック: mode={mode}, year={year} ---")

        for district_id, feat in student_records:
            props = feat.get("properties", {})
            edited = props.get("editedStudents", {}) or {}

            # 現行割当（UI編集が優先、無ければ現行列）
            cur = props.get("editedDistricts", {}).get(assignment_key) or props.get(assignment_key)
            if cur:
                current_assignments[district_id] = cur

            # 人数
            student_counts[district_id] = {}
            if mode == "elementary":
                v = edited.get("num_sho")
                if v is None: v = props.get(f"num_sho{year}")
                if v is None: v = props.get("num_sho2024", 0)
                student_counts[district_id][mode] = float(v)
            else:
                v = edited.get("num_chu")
                if v is None: v = props.get(f"num_chu{year}")
                if v is None: v = props.get("num_chu2024", 0)
                student_counts[district_id][mode] = float(v)

            if len(student_counts) <= 10:
                print(f"  {district_id}: count={student_counts[district_id][mode]}")

        # ==== 学校容量 ====
        school_capacity = {}
        for s in schools:
            school_name = s["properties"]["name"]
            school_capacity[school_name] = {
                "min_students": s["properties"].get("min_students", 0),
                "max_students": s["properties"].get("max_students", 1000),
            }

        # ==== 距離テーブル ====
        distance_data = {}
        missing_distances = 0
        for addr in address_list:
            for sch in school_list["both"]:
                key = f"{addr}-{sch}"
                if key in distances:
                    distance_data[(addr, sch)] = distances[key]
                else:
                    distance_data[(addr, sch)] = 1.0  # デフォルト距離
                    missing_distances += 1
        if missing_distances > 0:
            print(f"警告: {missing_distances}件の距離データが不足しています（デフォルト値1.0を使用）")

        # ==== モデル ====
        print("Gurobiモデルを作成中...")
        model = gp.Model("School_Optimization")
        model.Params.OutputFlag = 1
        model.Params.TimeLimit = time_limit_sec
        model.Params.MIPGap = mip_gap
        model.Params.Threads = 0
        model.setParam("LogFile", "gurobi.log")

        # 変数
        x = {}
        y = {}
        z = {}
        c_plus = {}
        c_minus = {}

        print("変数を作成中...")

        # 学校運営 y と容量ペナルティ
        for sch in school_list[mode]:
            y[sch] = model.addVar(vtype=GRB.BINARY, name=f"Operate_{sch}")
            y[sch].start = 1
            c_plus[sch]  = model.addVar(vtype=GRB.CONTINUOUS, name=f"Cplus_{sch}",  lb=0)
            c_minus[sch] = model.addVar(vtype=GRB.CONTINUOUS, name=f"Cminus_{sch}", lb=0)

        if force_close_in_scope:
            print(f"強制廃校制約を適用中 ({len(force_close_in_scope)}件)")
            for sch in force_close_in_scope:
                if sch in y:
                    model.addConstr(y[sch] == 0, name=f"ForceClose_{sch}")
        if force_open_in_scope:
            print(f"強制開校制約を適用中 ({len(force_open_in_scope)}件)")
            for sch in force_open_in_scope:
                if sch in y:
                    model.addConstr(y[sch] == 1, name=f"ForceOpen_{sch}")
                    
        # 割当 x：現行割当を初期値に
        for addr in address_list:
            cur_sch = current_assignments.get(addr)
            for sch in school_list[mode]:
                var = model.addVar(vtype=GRB.BINARY, name=f"Assign_{mode}_{addr}_{sch}")
                x[f"{mode}-{addr}-{sch}"] = var
                var.start = 1 if cur_sch == sch else 0

        if locked_assignments_in_scope:
            print("固定制約を適用中...")
            for addr, locked_school in locked_assignments_in_scope.items():
                if locked_school not in school_list[mode]:
                    print(f"警告: 固定対象 {addr} -> {locked_school} はモード {mode} の学校リストに存在しません（スキップ）")
                    continue
                for sch in school_list[mode]:
                    var_key = f"{mode}-{addr}-{sch}"
                    var = x.get(var_key)
                    if var is None:
                        continue
                    if sch == locked_school:
                        model.addConstr(var == 1, name=f"Lock_{addr}_{sch}")
                    else:
                        model.addConstr(var == 0, name=f"Lock_{addr}_{sch}_zero")

        # フロー z：exclude のとき選択内の隣接だけ
        for addr1 in address_list:
            neighbors = adj.get(addr1, [])
            if range_mode == "exclude":
                neighbors = [a2 for a2 in neighbors if a2 in selected_town_ids]
            for addr2 in neighbors:
                for sch in school_list[mode]:
                    z[f"{mode}-{sch}-{addr1}-{addr2}"] = model.addVar(
                        vtype=GRB.CONTINUOUS,
                        name=f"Flow_{mode}_{sch}_{addr1}_{addr2}"
                    )

        # 目的関数
        print("目的関数を設定中...")
        objective = gp.quicksum(
            max(student_counts.get(addr, {}).get(mode, 0), 0.1)
            * distance_data.get((addr, sch), 1.0)
            * x[f"{mode}-{addr}-{sch}"]
            for addr in address_list for sch in school_list[mode]
        )
        objective += gp.quicksum(Penalty_plus  * c_plus[sch]  for sch in school_list[mode])
        objective += gp.quicksum(Penalty_minus * c_minus[sch] for sch in school_list[mode])
        model.setObjective(objective, GRB.MINIMIZE)

        # 制約
        print("制約を追加中...")
        # 各地区は1校
        for addr in address_list:
            model.addConstr(
                gp.quicksum(x[f"{mode}-{addr}-{sch}"] for sch in school_list[mode]) == 1,
                name=f"OneSchoolPerDistrict_{addr}"
            )

        # 学校容量
        for sch in school_list[mode]:
            capacity = school_capacity.get(sch, {"min_students": 0, "max_students": 1000})
            total_students = gp.quicksum(
                student_counts.get(addr, {}).get(mode, 0) * x[f"{mode}-{addr}-{sch}"]
                for addr in address_list
            )
            model.addConstr(total_students >= capacity["min_students"] * y[sch] - c_minus[sch], name=f"Min_{sch}")
            model.addConstr(total_students <= capacity["max_students"] * y[sch] + c_plus[sch],  name=f"Max_{sch}")
            # 学校が運営されている場合のみ割当可
            for addr in address_list:
                model.addConstr(x[f"{mode}-{addr}-{sch}"] <= y[sch], name=f"UseOnlyIfOpen_{addr}_{sch}")
            # y=0ならペナルティ0（弱含意だがOK）
            model.addConstr((y[sch] == 0) >> (c_plus[sch]  <= 0), name=f"ZeroOpPlus_{sch}")
            model.addConstr((y[sch] == 0) >> (c_minus[sch] <= 0), name=f"ZeroOpMinus_{sch}")

        # ★ 固定制約（fix）：選択外は現行割当で固定
        if range_mode == "fix":
            print("対象外地区は現行割り当てで固定します")
            for addr in address_list:
                if addr in selected_town_ids:
                    continue
                cur_sch = current_assignments.get(addr)
                if not cur_sch:
                    # 現行割当が無ければスキップ（必要なら例外でも可）
                    continue
                for sch in school_list[mode]:
                    var = x.get(f"{mode}-{addr}-{sch}")
                    if var is None:
                        continue
                    # 現行=1、その他=0
                    model.addConstr(var == (1 if sch == cur_sch else 0), name=f"Fix_{addr}_{sch}")
        else:
            print("対象外地区は最適化から除外されています（exclude）")

        # 連結制約（フロー保存）
        for addr1 in address_list:
            neighbors = adj.get(addr1, [])
            if range_mode == "exclude":
                neighbors = [a2 for a2 in neighbors if a2 in selected_town_ids]
            for sch in school_list[mode]:
                lhs = gp.quicksum(
                    z[f"{mode}-{sch}-{addr1}-{a2}"] - z[f"{mode}-{sch}-{a2}-{addr1}"]
                    for a2 in neighbors
                )
                rhs = x[f"{mode}-{addr1}-{sch}"]
                # 学校の地元(jimoto)ノードなら源点：rhs -= N*y
                if jimoto.get(sch) == addr1:
                    rhs -= num_district * y[sch]
                model.addConstr(lhs >= rhs, name=f"flow_{mode}_{sch}_{addr1}")

        # フロー容量（最大流量N − 1）
        for addr1 in address_list:
            neighbors = adj.get(addr1, [])
            if range_mode == "exclude":
                neighbors = [a2 for a2 in neighbors if a2 in selected_town_ids]
            for addr2 in neighbors:
                for sch in school_list[mode]:
                    if f"{mode}-{addr1}-{sch}" not in x or f"{mode}-{addr2}-{sch}" not in x:
                        continue
                    model.addConstr(
                        z[f"{mode}-{sch}-{addr1}-{addr2}"] <= (num_district - 1) * x[f"{mode}-{addr1}-{sch}"],
                        name=f"flow_cap1_{mode}_{sch}_{addr1}_{addr2}"
                    )
                    model.addConstr(
                        z[f"{mode}-{sch}-{addr1}-{addr2}"] <= (num_district - 1) * x[f"{mode}-{addr2}-{sch}"],
                        name=f"flow_cap2_{mode}_{sch}_{addr1}_{addr2}"
                    )

        # ==== 最適化 ====
        model.write("model.lp")  # 大きいのでGit管理からは除外を推奨
        print("最適化を実行中...")
        start_time = time.time()
        model.optimize()
        optimization_time = time.time() - start_time
        print(f"最適化完了 (実行時間: {optimization_time:.2f}秒)")

        # ステータス処理
        if model.Status == GRB.OPTIMAL:
            print(f"最適解が見つかりました。目的関数値: {model.ObjVal}")
            model.write("solution.sol")
        elif model.Status == GRB.TIME_LIMIT:
            print("時間制限に達しました")
            if model.SolCount > 0:
                print(f"実行可能解が見つかりました。目的関数値: {model.ObjVal}")
                model.write("solution.sol")
        elif model.Status == GRB.INFEASIBLE:
            print("実行不可能な問題です")
            model.computeIIS()
            model.write("infeasible.ilp")
            raise ValueError("最適化問題が実行不可能です")
        else:
            raise ValueError(f"最適化が失敗しました。ステータス: {model.Status}")

        # ==== 結果整形 ====
        print("最適化結果を処理中...")
        optimized_assignments = {mode: {}}
        for addr in address_list:
            for sch in school_list[mode]:
                var_name = f"{mode}-{addr}-{sch}"
                if var_name in x and x[var_name].X > 0.5:
                    optimized_assignments[mode][addr] = sch
                    break

        # 互換キー（sho/chu）も付ける
        if mode == "elementary":
            optimized_assignments["sho"] = optimized_assignments[mode]
        elif mode == "middle":
            optimized_assignments["chu"] = optimized_assignments[mode]

        operating_school = [sch for sch in school_list[mode] if y[sch].X > 0.5]

        result = {
            "status": model.Status,
            "objective": model.ObjVal if model.SolCount > 0 else None,
            "optimization_time": optimization_time,
            "solver_params": {
                "time_limit_sec": time_limit_sec,
                "mip_gap": mip_gap,
            },
            "optimized_assignments": optimized_assignments,
            "assignments": {
                mode: {k: var.X for k, var in x.items() if var.X > 0.5},
                "operations": {
                    mode: {k: var.X for k, var in y.items() if var.X > 0.5},
                }
            }
        }

        print("=" * 50)
        print("最適化結果サマリー:")
        print(f"- 目的関数値: {result['objective']}")
        print(f"- 実行時間: {optimization_time:.2f}秒")
        print("=" * 50)

        return jsonify({"status": "success", "result": result})

    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }), 500

@app.route("/extract_adjacency", methods=["POST"])
def extract_adjacency():
    start_time = time.time()
    config = get_config()
    paths = get_data_paths(config)
    adj_save_path = paths["adj"]  # config.json から解決した adj 出力先

    payload = None
    try:
        payload = request.get_json(force=True, silent=False)
    except Exception as exc:
        print(f"警告: リクエストのJSON解析に失敗しました: {exc}")

    if not payload:
        return jsonify({"status": "error", "message": "リクエストボディが空です"}), 400

    if isinstance(payload, dict) and payload.get("type") == "FeatureCollection" and "features" in payload:
        geojson = payload
    else:
        geojson = payload.get("geojson")

    if not geojson:
        return jsonify({"status": "error", "message": "geojson が指定されていません"}), 400

    try:
        min_shared_length = float(payload.get("min_shared_length", 0.0))
    except (TypeError, ValueError):
        min_shared_length = 0.0

    try:
        adjacency = build_adjacency_from_geojson(geojson, min_shared_length=min_shared_length)
        
        # 保存処理: output フォルダに保存
        os.makedirs(os.path.dirname(adj_save_path), exist_ok=True)
        with open(adj_save_path, "w", encoding="utf-8") as f:
            json.dump(adjacency, f, ensure_ascii=False, indent=2)

        # 統計情報の計算
        feature_count = len(geojson.get("features", [])) if isinstance(geojson, dict) else 0
        total_edges = sum(len(neigh) for neigh in adjacency.values()) // 2
        elapsed = time.time() - start_time

        print(f"隣接関係抽出完了: features={feature_count}, edges={total_edges}, time={elapsed:.2f}s")
        print(f"保存先: {adj_save_path}")

        return jsonify(
            {
                "status": "success",
                "adjacency": adjacency,
                "server_save": {
                    "path": adj_save_path,
                    "success": True,
                    "error": None,
                },
                "stats": {
                    "feature_count": feature_count,
                    "edge_count": total_edges,
                    "processing_time": elapsed,
                    "min_shared_length": min_shared_length,
                },
            }
        )
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"隣接関係の抽出に失敗しました: {exc}"}), 500

@app.route("/check_gurobi", methods=["GET"])
def check_gurobi():
    try:
        model = gp.Model("test")
        model.addVar(name="test_var")
        model.optimize()
        return jsonify({"status": "success", "message": "Gurobi is working properly"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Gurobi error: {str(e)}"})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
