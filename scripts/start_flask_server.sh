#!/bin/bash

# エラーが発生したら終了
set -e

# 色の設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo -e "${GREEN}Flaskサーバーを起動します...${NC}"

# 仮想環境の確認と作成
VENV_DIR="$PROJECT_ROOT/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}仮想環境が見つかりません。新しく作成します...${NC}"
    python3 -m venv "$VENV_DIR"
fi

# 仮想環境をアクティベート
source "$VENV_DIR/bin/activate"

# 必要なパッケージをインストール
echo -e "${GREEN}必要なパッケージをインストールしています...${NC}"
pip install flask flask-cors pulp paramiko python-dotenv pyopenssl shapely

# 環境変数の設定
export FLASK_ENV=development
export USE_HTTPS=true  # HTTPSを有効にする

# マージスクリプトを実行
echo -e "${GREEN}JSONファイルをマージしています...${NC}"
python "$PROJECT_ROOT/generate_lp/merge_json.py"

# Flaskサーバーを起動
echo -e "${GREEN}Flaskサーバーを起動しています...${NC}"
python "$PROJECT_ROOT/scripts/mk_lp.py"

# 終了時に仮想環境を非アクティベート
function cleanup {
    echo -e "${GREEN}Flaskサーバーを終了しています...${NC}"
    deactivate
}

# スクリプト終了時にクリーンアップを実行
trap cleanup EXIT
