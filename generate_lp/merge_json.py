import os
import glob
import json

#!/usr/bin/env python3

def merge_json_files():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # 全ての .json ファイルを取得（出力先の data.json を除く）
    # json_files = [f for f in glob.glob(os.path.join(current_dir, '*.json')) if os.path.basename(f) != 'data.json']
    json_files = [f for f in glob.glob(os.path.join(current_dir, '*json')) if os.path.basename(f) != 'data.json']
    
    merged_data = {}
    for file in json_files:
        file_name = file.split("/")[-1].split(".")[0]
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # JSONの内容がリストならそのままextendし、そうでなければリストに追加
                # if isinstance(data, list):
                #     merged_data.extend(data)
                # else:
                #     merged_data.append(data)
                merged_data[file_name] = data
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    output_path = os.path.join(current_dir, 'data.json')
    try:
        with open(output_path, 'w', encoding='utf-8') as out_file:
            json.dump(merged_data, out_file, ensure_ascii=False, indent=2)
        print(f"Merged JSON written to {output_path}")
    except Exception as e:
        print(f"Error writing {output_path}: {e}")

if __name__ == '__main__':
    merge_json_files()
