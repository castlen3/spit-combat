<div align="center">
  <img src="banner.jpg?v=2" alt="Spit Combat Banner" width="800">

  <h1>💦 Spit Combat 💦</h1>

  <p>
    <a href="README.md">🇹🇼 繁體中文</a> | <b>[ 🇺🇸 English ]</b>
  </p>

  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
    <img src="https://img.shields.io/badge/Platform-Web-blue.svg" alt="Platform: Web">
    <img src="https://img.shields.io/badge/Language-JavaScript-orange.svg" alt="Language: JavaScript">
    <img src="https://img.shields.io/badge/Engine-Vanilla%20Canvas-success.svg" alt="Engine: Vanilla Canvas">
    <img src="https://img.shields.io/badge/Status-Completed-brightgreen.svg" alt="Status: Completed">
  </p>

  <p><i>A humorous, arcade-style web game developed with Vanilla HTML5 Canvas, CSS, and JavaScript. Play as a character on a rooftop, using your powerful "spit" as a weapon to fight back against pedestrians and powerful level bosses on the street!</i></p>
</div>

---

## 🎮 Controls

*   **`A` / `D` or `←` / `→`**: Move left/right.
*   **`Space`**: Spit attack (Supports rapid-fire, no charging required).
*   **`O` key (Dev Cheat)**: Hydration overload, instantly restores 100 HP.

---

## ✨ Features

### 1. Rogue-lite Stacking Upgrades
Purchase upgrades in the mystery shop after clearing each level. These upgrades become permanent passives and their effects stack perfectly:
*   🌶️ **Chili Spit**: When your spit hits an enemy or the ground, it creates a large red AoE splash explosion.
*   🧋 **Boba Shotgun**: Replaces your normal spit with a double-shot of giant black boba pearls (9px radius). Hitting any target restores 1 HP and costs no hydration. Only missing all shots costs 1 HP.
*   🥤 **Mentos Cola**: Increases projectile speed by 1.8x, making the trajectory straighter with less wind resistance.
*   💥 **Synergy Stack**: Combine all three for twin-shot, ultra-fast, AoE-exploding giant flaming boba!

### 2. Four Unique Bosses
Reaching the score threshold spawns a unique boss for the level, featuring a **red lock-on weak spot**. You must hit the weak spot to deal massive damage:
*   🚪 **Level 1: The Greedy Landlord 💰** — Shoots overdue rent bills upwards. Weak spot: His open mouth while yelling.
*   📱 **Level 2: The Street Influencer 🤳** — Fires heart-shaped barrages into the sky. Weak spot: The camera lens on her selfie stick.
*   🚚 **Level 3: The Street Sweeper Truck 💦** — Sprays high-pressure water drops. Weak spot: The driver's window.
*   🎤 **Level 4: The Politician 📢** — Spouts barrages of "lie bubbles" (💬 🤥 📢 ❗). Weak spot: The glowing microphone while he makes speeches.

### 3. Projectile Interception
*   Your spit can collide with boss projectiles mid-air (bills, hearts, water drops, lie bubbles), canceling them out in a satisfying offensive defense!

### 4. LAN Multiplayer Support
*   Play across devices on your local network. Simply start the local Python server, and use your phone or tablet on the same Wi-Fi to play directly via the browser with touch controls.

---

## 🚀 How to Run

### Quick Start (Double Click)
1.  Open the `spit-combat` folder.
2.  Double-click `index.html` to play directly in your browser.

### Server Start (Python Server - For Mobile/LAN play)
1.  Double-click `啟動遊戲伺服器.command` (macOS only).
2.  It automatically opens a terminal and displays your localhost and LAN IP addresses.
3.  Scan or type the URL (e.g., `http://192.168.x.x:8000`) into your phone's browser to start playing!

---

## 📂 Project Structure

```text
├── index.html                  # Main HTML structure and end-level shop UI
├── style.css                   # Doodle art style visuals and button animations
├── game.js                     # Core game logic, Canvas physics, collision, boss AI
├── 啟動遊戲伺服器.command      # macOS 1-click server launch script
├── banner.jpg                  # README decorative banner
├── landlord.jpg                # Landlord Boss AI sprite (transparent)
├── influencer.jpg              # Influencer Boss AI sprite (transparent)
├── player.jpg                  # Player hand-drawn sprite
└── .gitignore                  # Git ignore rules
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
