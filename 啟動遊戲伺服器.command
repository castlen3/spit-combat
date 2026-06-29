#!/bin/bash
# 取得此執行檔所在的目錄
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 智慧判斷路徑，確保不論在桌面或資料夾內都能正確進入
if [ -d "$DIR/spit-combat" ]; then
  cd "$DIR/spit-combat"
elif [ -f "$DIR/index.html" ]; then
  cd "$DIR"
else
  cd ~/Desktop/spit-combat 2>/dev/null || cd "$DIR"
fi

echo "=================================================="
echo "        💦 吐痰大作戰 遊戲伺服器啟動中 💦"
echo "=================================================="
echo "正在取得您的 Mac 區域網路 IP..."

# 取得 macOS 常用網卡的區網 IP
IP_ADDR=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || ipconfig getifaddr en2 || ipconfig getifaddr ap1 || hostname)

echo ""
echo "👉 本機遊玩網址：    http://localhost:8000"
if [ ! -z "$IP_ADDR" ]; then
  echo "👉 手機/區網遊玩網址：http://$IP_ADDR:8000"
else
  echo "⚠️ 無法自動取得區網 IP，請確認 Wi-Fi 是否開啟。"
fi
echo ""
echo "💡 提示：遊玩結束後，直接「關閉此終端機視窗」即可停止伺服器。"
echo "=================================================="

# 啟動 Python 伺服器
python3 -m http.server 8000
