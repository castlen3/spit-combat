<div align="center">
  <img src="banner.jpg?v=3" alt="Spit Combat Banner" width="800">

  <h1>💦 吐痰大作戰 (Spit Combat) 💦</h1>

  <p>
    <b>[ 🇹🇼 繁體中文 ]</b> | <a href="README-en.md">🇺🇸 English</a>
  </p>

  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
    <img src="https://img.shields.io/badge/Platform-Web-blue.svg" alt="Platform: Web">
    <img src="https://img.shields.io/badge/Language-JavaScript-orange.svg" alt="Language: JavaScript">
    <img src="https://img.shields.io/badge/Engine-Vanilla%20Canvas-success.svg" alt="Engine: Vanilla Canvas">
    <img src="https://img.shields.io/badge/Status-Completed-brightgreen.svg" alt="Status: Completed">
  </p>

  <p><i>這是一款使用 Vanilla HTML5 Canvas、CSS 與 JavaScript 開發的惡搞街機風網頁遊戲。玩家將扮演站在天台上的主角，以強力的「吐痰」作為武器，反擊地面的行人和各種強大的關卡魔王！</i></p>
</div>

---

## 🎮 遊戲操作方式 (Controls)

*   **`A` / `D` 或 `←` / `→`**：左右移動主角。
*   **`Space` (空白鍵)**：吐痰攻擊（支援連續極速發射，無蓄力時間）。
*   **`O` 鍵 (開發者密技)**：水分超載，一次補充 100 點 HP。

---

## ✨ 遊戲核心特色 (Features)

### 1. 永久疊加的被動道具 (Rogue-lite Stacking Upgrades)
在每關通關後的神秘商店購買道具，購買後將變為永久被動，且多種效果完全疊加：
*   🌶️ **麻辣火鍋 (Chili Spit)**：痰液擊中行人或地面時，會產生大範圍的紅色爆炸濺射 (AOE)。
*   🧋 **珍珠奶茶 (Boba Shotgun)**：每次發射改為 **2 顆** 直徑 9 像素的超大黑色珍珠雙發齊射。只要有一發擊中就不扣水分且補滿 1 滴血；若全數落空才扣 1 滴血。
*   🥤 **可樂薄荷糖 (Mentos Cola)**：痰液發射初速增快 1.8 倍，彈道更為筆直，風阻更低。
*   💥 **兼容疊加**：若同時啟動三種道具，將發射雙軌超高速、落地引爆大範圍濺射的毀滅性火焰巨型珍珠！

### 2. 四大獨特關卡魔王 (4 Unique Bosses)
每關分數達標後，會有專屬魔王降臨，並配備**紅色鎖定弱點靶心**。只有攻擊弱點才能造成巨額傷害：
*   🚪 **Level 1：惡房東 💰** — 朝上噴吐催繳帳單彈幕，弱點是吼叫時張開的嘴巴。
*   📱 **Level 2：街頭網紅 🤳** — 朝天發射愛心彈幕，弱點是手持的自拍棒鏡頭。
*   🚚 **Level 3：高壓灑水清潔車 💦** — 噴出高壓水滴。弱點是駕駛座的司機車窗。
*   🎤 **Level 4：政客大叔 📢** — 發射大量謊言泡泡（💬 🤥 📢 ❗）。弱點是演講時發光的麥克風。

### 3. 防禦攔截機制 (Projectile Interception)
*   玩家吐出的痰在半空中如果碰上魔王發射的子彈（帳單、愛心、水滴、泡泡），將會發生**「互相抵消 (攔截)」**，攻防一體！

### 4. 區域網路連線遊玩 (LAN Multiplayer)
*   支援多裝置連線。只要啟動本機 Python 伺服器，同一個 Wi-Fi 內的手機或平板掃碼/輸入 IP 即可直接用觸控或瀏覽器暢玩。

---

## 🚀 快速啟動指南 (How to Run)

### 簡易啟動 (Double Click)
1.  進入 `spit-combat` 資料夾。
2.  雙擊開啟 `index.html` 即可直接在瀏覽器遊玩。

### 伺服器啟動 (Python Server - 支援手機/同區網遊玩)
1.  點擊桌面上的 `啟動遊戲伺服器.command` (僅限 macOS)。
2.  它會自動開啟終端機並算出您的本機網址與手機區網網址。
3.  拿起手機掃描或輸入畫面上顯示的網址（例如：`http://192.168.x.x:8000`）即可開始遊玩！

---

## 📂 專案檔案結構 (Project Structure)

```text
├── index.html                  # 遊戲主 HTML 結構與過關商店 UI
├── style.css                   # Doodle (塗鴉) 風格視覺與按鈕動畫
├── game.js                     # 遊戲主邏輯、Canvas 物理引擎、碰撞判定、魔王 AI
├── 啟動遊戲伺服器.command      # macOS 雙擊一鍵啟動伺服器腳本
├── banner.jpg                  # README 裝飾橫幅圖
├── landlord.jpg                # 房東魔王 AI 精美繪圖 (已去背)
├── influencer.jpg              # 網紅魔王 AI 精美繪圖 (已去背)
├── player.jpg                  # 主角手繪線稿圖
└── .gitignore                  # Git 忽略檔案設定
```

---

## 📜 授權條款 (License)

本專案採用 [MIT License](LICENSE) 進行授權。
