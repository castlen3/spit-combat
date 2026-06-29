/**
 * 《痰指之間》 (Spit Combat)
 * Game Logic, Physics Engine, and Canvas Renderer
 */

// Audio Controller using Web Audio API
class AudioController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playCharge(pitchFactor) {
    if (!this.enabled) return;
    this.init();
    
    // Slurping/inhaling sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    // Frequency sweeps up
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150 + pitchFactor * 100, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playSpit() {
    if (!this.enabled) return;
    this.init();

    // "Ptu!" sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    // Apply lowpass band filter to sound squishy
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playHit() {
    if (!this.enabled) return;
    this.init();

    // "Splat!" sound
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Fill buffer with random noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.15);
  }

  playDmg() {
    if (!this.enabled) return;
    this.init();

    // Sad error beep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();

    const now = this.ctx.currentTime;
    const playTone = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(261.63, now, 0.1); // C4
    playTone(329.63, now + 0.12, 0.1); // E4
    playTone(392.00, now + 0.24, 0.1); // G4
    playTone(523.25, now + 0.36, 0.3); // C5
  }
}

const audio = new AudioController();

// Game Configuration & Constants
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;
const GRAVITY = 0.25; // Gravity acceleration
const FLOOR_Y = 530; // Pedestrian walk line
const PLAYER_Y = 100; // Roof ledge Y coordinate

// Image cache for transparent sprites
const spriteCache = {
  player: null,
  landlord: null,
  influencer: null
};

// Helper: load image and make white background transparent
function loadAndProcessSprite(src, key) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    try {
      spriteCache[key] = makeImageTransparent(img);
    } catch (e) {
      console.warn("去背失敗（可能為 local file:// 跨網域安全性限制），改用原圖顯示：", e);
      spriteCache[key] = img; // Fallback to raw image
    }
  };
  img.onerror = () => {
    console.error("無法載入圖案資源: " + src);
  };
}

function makeImageTransparent(img) {
  const tempCanvas = document.createElement('canvas');
  // 縮小至 256x256 提昇效能與 BFS 運算速度
  tempCanvas.width = 256;
  tempCanvas.height = 256;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0, 256, 256);
  
  const imgData = tempCtx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  const w = 256;
  const h = 256;
  
  // 記錄已被訪問的背景像素
  const visited = new Uint8Array(w * h);
  const queue = [];
  
  // 判斷像素是否為白底（偏背景色）
  function isWhite(x, y) {
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const g = data[idx+1];
    const b = data[idx+2];
    return (r > 220 && g > 220 && b > 220); // 容差門檻
  }
  
  // 將邊框上的所有白底像素加入佇列 (BFS 起點)
  for (let x = 0; x < w; x++) {
    if (isWhite(x, 0)) { queue.push(x, 0); visited[0 * w + x] = 1; }
    if (isWhite(x, h - 1)) { queue.push(x, h - 1); visited[(h - 1) * w + x] = 1; }
  }
  for (let y = 0; y < h; y++) {
    if (isWhite(0, y)) { queue.push(0, y); visited[y * w + 0] = 1; }
    if (isWhite(w - 1, y)) { queue.push(w - 1, y); visited[y * w + (w - 1)] = 1; }
  }
  
  // BFS 洪水填充演算法 (僅針對邊緣相連的外部背景)
  let head = 0;
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];
  
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    
    for (let i = 0; i < 4; i++) {
      const nx = cx + dx[i];
      const ny = cy + dy[i];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const vIdx = ny * w + nx;
        if (visited[vIdx] === 0 && isWhite(nx, ny)) {
          visited[vIdx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }
  
  // 將所有與邊緣相通的背景白色區域設為透明 (Alpha = 0)
  // 角色內部封閉區塊（如衣服、臉部）的白色則被保留，防止破圖
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visited[y * w + x] === 1) {
        const idx = (y * w + x) * 4;
        data[idx + 3] = 0; 
      }
    }
  }
  
  tempCtx.putImageData(imgData, 0, 0);
  return tempCanvas;
}

// 載入去背圖片
loadAndProcessSprite('landlord.jpg', 'landlord');
loadAndProcessSprite('influencer.jpg', 'influencer');

// Pedestrian Database
const PEDESTRIAN_TYPES = {
  NORMAL: { name: '路人甲', type: 'NORMAL', speed: 1.5, score: 30, penalty: 0, hpChange: 0, scale: 1, color: '#4a6fa5' },
  JOGGER: { name: '慢跑青年', type: 'JOGGER', speed: 3.2, score: 50, penalty: 0, hpChange: 0, scale: 0.95, color: '#f79f79' },
  BOSS: { name: '無良老闆', type: 'BOSS', speed: 1.8, score: 100, penalty: 0, hpChange: 0, scale: 1.05, color: '#333333' },
  BIKER: { name: '噪音重機仔', type: 'BIKER', speed: 6.0, score: 150, penalty: 0, hpChange: 0, scale: 1.1, color: '#d62246' },
  INFLUENCER: { name: '尬舞網紅', type: 'INFLUENCER', speed: 1.1, score: 120, penalty: 0, hpChange: 0, scale: 1, color: '#8a2be2' },
  PREGNANT: { name: '孕婦', type: 'PREGNANT', speed: 0.7, score: -100, penalty: -100, hpChange: -1, scale: 1, color: '#ff85a2' },
  CHILD: { name: '氣球小孩', type: 'CHILD', speed: 2.2, score: -100, penalty: -100, hpChange: -1, scale: 0.8, color: '#4cd964' },
  POLICE: { name: '黑道大哥', type: 'POLICE', speed: 1.4, score: 0, penalty: 0, hpChange: -99, scale: 1.1, color: '#1a1a2e' } // Instant defeat trigger
};

// Main Game State Variables
let score = 0;
let levelScore = 0;
let hp = 10;
const maxHp = 10;
let level = 1;
let currentWind = 0; // Wind velocity (-6 to +6)
let windTimer = 0;
let gameState = 'START'; // START, PLAYING, LEVEL_CLEAR, GAMEOVER, VICTORY

// Player State
const player = {
  x: STAGE_WIDTH / 2,
  y: PLAYER_Y,
  width: 40,
  height: 50,
  speed: 6,
  vx: 0,
  facing: 1, // 1 = right, -1 = left
  isCharging: false,
  chargePower: 0,
  chargeDirection: 1, // 1 = going up, -1 = going down
  upgrades: {
    chili: false,
    boba: false,
    cola: false
  }
};

// Arrays to track active elements
let spits = [];
let bossProjectiles = [];
let pedestrians = [];
let particles = [];
let floatingTexts = [];
let boss = null;
let bossSpawned = false;
let spawnTimer = 0;
let levelSpawnsRemaining = 10;
let levelSpawnedCount = 0;

let activeShots = {};
let shotIdCounter = 0;

// Key Press Tracking
const keys = {};
let spacePressed = false;

// Reference DOM elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const powerBarContainer = document.getElementById('power-bar-container');
const powerBarFill = document.getElementById('power-bar-fill');

const scoreVal = document.getElementById('score-val');
const hpBar = document.getElementById('hp-bar');
const hpVal = document.getElementById('hp-val');
const windArrow = document.getElementById('wind-arrow');
const windSpeed = document.getElementById('wind-speed');
const levelVal = document.getElementById('level-val');

// Screens
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const shopScreen = document.getElementById('shop-screen');
const victoryScreen = document.getElementById('victory-screen');

// Initialize Keyboard Event Listeners
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' && gameState === 'PLAYING') {
    e.preventDefault(); // Prevent page scrolling
    if (!spacePressed) {
      spacePressed = true;
      performSpit();
    }
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Space') {
    spacePressed = false;
  }
});

// Event Listeners for UI buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('next-level-btn').addEventListener('click', nextLevel);
document.getElementById('play-again-btn').addEventListener('click', resetGame);
document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);

// Connect shop buttons
const buyButtons = document.querySelectorAll('.buy-btn');
buyButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const item = btn.getAttribute('data-item');
    const price = parseInt(btn.getAttribute('data-price'));
    buyItem(item, price, btn);
  });
});

// Setup audio toggle button state
function toggleAudio() {
  const enabled = audio.toggle();
  document.getElementById('audio-toggle-btn').innerText = `🔊 音效: ${enabled ? '開' : '關'}`;
}

// Start Game from Home screen
function startGame() {
  startScreen.classList.add('hidden');
  gameState = 'PLAYING';
  score = 0;
  hp = maxHp;
  level = 1;
  player.upgrades = { chili: false, boba: false, cola: false };
  spits = [];
  activeShots = {};
  shotIdCounter = 0;
  pedestrians = [];
  particles = [];
  floatingTexts = [];
  boss = null;
  bossSpawned = false;
  bossProjectiles = [];
  levelScore = 0;
  levelSpawnsRemaining = 10;
  levelSpawnedCount = 0;
  spawnTimer = 0;
  updateHUD();
  updateWind();
  audio.init();
}

// Reset entire game on game over
function resetGame() {
  gameOverScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  startGame();
}

// Go to next level from shop
function nextLevel() {
  shopScreen.classList.add('hidden');
  gameState = 'PLAYING';
  spits = [];
  pedestrians = [];
  particles = [];
  floatingTexts = [];
  boss = null;
  bossSpawned = false;
  bossProjectiles = [];
  levelScore = 0;
  
  if (level === 1) {
    level = 2;
    levelSpawnsRemaining = 12;
  } else if (level === 2) {
    level = 3;
    levelSpawnsRemaining = 15;
  } else if (level === 3) {
    level = 4;
    levelSpawnsRemaining = 18;
  } else {
    // Should not reach here
  }
  
  levelSpawnedCount = 0;
  spawnTimer = 0;
  updateHUD();
  updateWind();
}

// Update UI HUD values
function updateHUD() {
  scoreVal.innerText = score;
  hpVal.innerText = `${hp}/${maxHp}`;
  hpBar.style.width = `${Math.min(100, (hp / maxHp) * 100)}%`;
  if (hp <= 2) {
    hpBar.style.backgroundColor = 'var(--danger-color)';
  } else {
    hpBar.style.backgroundColor = '#3a86c8';
  }
  levelVal.innerText = `${level}/4`;

  // Update wind arrow angle
  // Negative wind points left, positive wind points right
  const angle = currentWind * 15; // 15 degrees per unit
  windArrow.style.transform = `rotate(${angle}deg)`;
  windSpeed.innerText = `${Math.abs(currentWind.toFixed(1))} m/s ${currentWind > 0 ? '右' : currentWind < 0 ? '左' : ''}`;
}

// Refresh wind direction (wind is turned off)
function updateWind() {
  currentWind = 0;
  updateHUD();
}

// Trigger buy action
function buyItem(item, price, button) {
  if (score >= price) {
    score -= price;
    updateHUD();
    
    player.upgrades[item] = true;
    addFloatingText(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 - 50, `已啟用 ${getItemChineseName(item)}!`, 'var(--accent-color)', 20);
    
    // Play buy sound
    audio.playVictory();
    updateShopButtonStates();
  }
}

function getItemChineseName(item) {
  if (item === 'chili') return '麻辣火鍋痰';
  if (item === 'boba') return '珍奶散彈';
  if (item === 'cola') return '可樂薄荷糖';
  return '';
}

// Update states of buttons in the shop depending on score
function updateShopButtonStates() {
  buyButtons.forEach(btn => {
    const price = parseInt(btn.getAttribute('data-price'));
    const item = btn.getAttribute('data-item');
    
    if (score < price || player.upgrades[item]) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
    
    if (player.upgrades[item]) {
      btn.innerHTML = `已啟用`;
    } else {
      btn.innerHTML = `${price} 分`;
    }
  });
}

// Open Shop screen overlay
function openShop() {
  gameState = 'LEVEL_CLEAR';
  updateShopButtonStates();
  shopScreen.classList.remove('hidden');
}

// Open Game Over Screen
function triggerGameOver() {
  gameState = 'GAMEOVER';
  audio.playDmg();
  document.getElementById('final-score').innerText = score;
  document.getElementById('final-level').innerText = level;
  gameOverScreen.classList.remove('hidden');
}

// Open Victory Screen
function triggerVictory() {
  gameState = 'VICTORY';
  audio.playVictory();
  document.getElementById('victory-score').innerText = score;
  victoryScreen.classList.remove('hidden');
}

// Add flying cartoon text particle
function addFloatingText(x, y, text, color = '#000', size = 16) {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    size,
    alpha: 1.0,
    vy: -1.2,
    life: 80 // Frames
  });
}

// Add simple particle effects
function addSplashParticles(x, y, color = '#3a86c8', count = 12, sizeFactor = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 3 + 1) * sizeFactor;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 2), // slightly upwards bias
      radius: (Math.random() * 3 + 1) * sizeFactor,
      color,
      alpha: 1.0,
      life: 30 + Math.random() * 20
    });
  }
}

// Helper: Doodle-style shaky lines
// Adds a cartoon hand-drawn wobble to canvas strokes
function drawDoodleLine(ctx, x1, y1, x2, y2, strokeColor = '#000', lineWidth = 2) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 0.1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  
  // Number of segments to break line into
  const segments = Math.max(2, Math.floor(distance / 15));
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    // Base target point
    const tx = x1 + dx * t;
    const ty = y1 + dy * t;
    
    // Add small random noise perpendicular to line
    if (i < segments) {
      const wobble = (Math.random() - 0.5) * 2.2;
      const nx = -dy / distance;
      const ny = dx / distance;
      ctx.lineTo(tx + nx * wobble, ty + ny * wobble);
    } else {
      ctx.lineTo(x2, y2);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// Helper: Draw sketchy circle
function drawDoodleCircle(ctx, cx, cy, r, color = 'transparent', strokeColor = '#000', lineWidth = 2) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  // Draw circle as multiple bezier curves with slight deviations
  ctx.beginPath();
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wobble = (Math.random() - 0.5) * (r * 0.08);
    const rad = r + wobble;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  if (color !== 'transparent') ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Handle Spitting Logic
function performSpit() {
  audio.playSpit();

  // Speed modifiers (no charging, constant responsive spit speed)
  const speedMult = player.upgrades.cola ? 1.8 : 1.0;
  const vy = 7.5 * speedMult;
  const vx = (player.vx * 0.5 + (player.facing * 0.5)) * speedMult;

  shotIdCounter++;
  const shotId = shotIdCounter;

  if (player.upgrades.boba) {
    // 2-way spread of huge boba pearls!
    activeShots[shotId] = { totalSpits: 2, resolvedSpits: 0, hitRegistered: false };
    spits.push(createSpitObject(player.x, player.y + 15, vx - 1.2, vy - 0.4, player.upgrades, shotId));
    spits.push(createSpitObject(player.x, player.y + 15, vx + 1.2, vy - 0.4, player.upgrades, shotId));
  } else {
    // Single shot
    activeShots[shotId] = { totalSpits: 1, resolvedSpits: 0, hitRegistered: false };
    spits.push(createSpitObject(player.x, player.y + 15, vx, vy, player.upgrades, shotId));
  }
}

function createSpitObject(x, y, vx, vy, upgrades, shotId) {
  let color = '#a3e2f7';
  let size = 6;
  
  if (upgrades.boba && upgrades.chili) {
    color = '#d63031'; // Fire boba red
    size = 9; // smaller boba
  } else if (upgrades.boba) {
    color = '#1f1308'; // Boba brown
    size = 9; // smaller boba
  } else if (upgrades.chili) {
    color = '#ff3333';
    size = 8;
  } else if (upgrades.cola) {
    color = '#8b4513';
    size = 5;
  }
  
  return {
    x,
    y,
    vx,
    vy,
    radius: size,
    type: upgrades.chili ? 'chili' : 'normal',
    isCola: upgrades.cola,
    color,
    shotId,
    trail: [] // History points for stretching effect
  };
}

// Resolve a single spit within a shot
function resolveSpit(shotId, isHit, hitX, hitY) {
  const shot = activeShots[shotId];
  if (!shot) return;
  
  shot.resolvedSpits++;
  if (isHit) {
    shot.hitRegistered = true;
  }
  
  if (shot.resolvedSpits >= shot.totalSpits) {
    // Shot is fully resolved!
    if (shot.hitRegistered) {
      // Heal 1 HP if not at max
      if (hp < maxHp) {
        hp++;
        updateHUD();
        addFloatingText(player.x, PLAYER_Y - 40, '+1 水分! 💧', '#00ffff', 16);
      }
    } else {
      // Missed completely! Deduct 1 HP
      hp--;
      updateHUD();
      addFloatingText(hitX, FLOOR_Y - 20, '未命中 -1 HP!', 'var(--danger-color)', 16);
      if (hp <= 0) triggerGameOver();
    }
    delete activeShots[shotId];
  }
}

// Generate Pedestrians dynamically
function spawnPedestrian() {

  // Pick type randomly based on weights
  const types = Object.values(PEDESTRIAN_TYPES);
  let pickedType = PEDESTRIAN_TYPES.NORMAL;

  const rand = Math.random();
  if (level === 1) {
    // Only normal, jogger, boss, pregnant, child
    if (rand < 0.4) pickedType = PEDESTRIAN_TYPES.NORMAL;
    else if (rand < 0.6) pickedType = PEDESTRIAN_TYPES.JOGGER;
    else if (rand < 0.75) pickedType = PEDESTRIAN_TYPES.BOSS;
    else if (rand < 0.88) pickedType = PEDESTRIAN_TYPES.CHILD;
    else pickedType = PEDESTRIAN_TYPES.PREGNANT;
  } else if (level === 2) {
    // Add influencer, biker
    if (rand < 0.25) pickedType = PEDESTRIAN_TYPES.NORMAL;
    else if (rand < 0.45) pickedType = PEDESTRIAN_TYPES.JOGGER;
    else if (rand < 0.6) pickedType = PEDESTRIAN_TYPES.BOSS;
    else if (rand < 0.75) pickedType = PEDESTRIAN_TYPES.INFLUENCER;
    else if (rand < 0.85) pickedType = PEDESTRIAN_TYPES.BIKER;
    else if (rand < 0.93) pickedType = PEDESTRIAN_TYPES.CHILD;
    else pickedType = PEDESTRIAN_TYPES.PREGNANT;
  } else if (level === 3) {
    // Level 3: Add police/gangster
    if (rand < 0.2) pickedType = PEDESTRIAN_TYPES.NORMAL;
    else if (rand < 0.35) pickedType = PEDESTRIAN_TYPES.JOGGER;
    else if (rand < 0.45) pickedType = PEDESTRIAN_TYPES.BOSS;
    else if (rand < 0.55) pickedType = PEDESTRIAN_TYPES.INFLUENCER;
    else if (rand < 0.65) pickedType = PEDESTRIAN_TYPES.BIKER;
    else if (rand < 0.75) pickedType = PEDESTRIAN_TYPES.POLICE;
    else if (rand < 0.88) pickedType = PEDESTRIAN_TYPES.CHILD;
    else pickedType = PEDESTRIAN_TYPES.PREGNANT;
  } else {
    // Level 4: Denser and harder crowd
    if (rand < 0.15) pickedType = PEDESTRIAN_TYPES.NORMAL;
    else if (rand < 0.25) pickedType = PEDESTRIAN_TYPES.JOGGER;
    else if (rand < 0.35) pickedType = PEDESTRIAN_TYPES.BOSS;
    else if (rand < 0.50) pickedType = PEDESTRIAN_TYPES.INFLUENCER;
    else if (rand < 0.60) pickedType = PEDESTRIAN_TYPES.BIKER;
    else if (rand < 0.72) pickedType = PEDESTRIAN_TYPES.POLICE;
    else if (rand < 0.86) pickedType = PEDESTRIAN_TYPES.CHILD;
    else pickedType = PEDESTRIAN_TYPES.PREGNANT;
  }

  // Direction: 1 = left-to-right, -1 = right-to-left
  const dir = Math.random() < 0.5 ? 1 : -1;
  const startX = dir === 1 ? -50 : STAGE_WIDTH + 50;

  pedestrians.push({
    x: startX,
    y: FLOOR_Y,
    width: 32 * pickedType.scale,
    height: 60 * pickedType.scale,
    vx: pickedType.speed * dir,
    type: pickedType,
    direction: dir,
    isHit: false,
    hitTimer: 0,
    bobTimer: Math.random() * 100, // For bobbing walk animation
    angerState: 0 // Used if gangster/police gets angry
  });
}

// Generate the Boss
function spawnBoss() {
  bossSpawned = true;
  if (level === 1) {
    // Boss Landlord
    boss = {
      x: STAGE_WIDTH / 2,
      y: FLOOR_Y - 80,
      width: 80,
      height: 100,
      vx: 1.5,
      hp: 100,
      maxHp: 100,
      state: 'WALKING', // WALKING, SHOUTING
      stateTimer: 0,
      weakSpot: {
        relX: 20, // relative to boss X
        relY: -20, // relative to boss Y
        radius: 18,
        active: false // active only when shouting
      }
    };
  } else if (level === 2) {
    // Boss Influencer
    boss = {
      x: STAGE_WIDTH / 2,
      y: FLOOR_Y - 70,
      width: 70,
      height: 90,
      vx: 1.8,
      hp: 120,
      maxHp: 120,
      state: 'WALKING', // WALKING, DANCING
      stateTimer: 0,
      weakSpot: {
        relX: 45, // camera tripod position
        relY: -10,
        radius: 15,
        active: true // Camera is always active target
      }
    };
  } else if (level === 3) {
    // Boss Sweeper Truck
    boss = {
      x: STAGE_WIDTH / 2,
      y: FLOOR_Y - 90,
      width: 180,
      height: 110,
      vx: 1.2,
      hp: 150,
      maxHp: 150,
      state: 'DRIVING', // DRIVING, SPRAYING
      stateTimer: 0,
      sprayers: [
        { relX: 30, timer: 0 },
        { relX: 90, timer: 60 },
        { relX: 150, timer: 120 }
      ],
      weakSpot: {
        relX: -70, // Driver's cab (depending on direction)
        relY: -25,
        radius: 20,
        active: true
      }
    };
  } else if (level === 4) {
    // Boss Politician
    boss = {
      x: STAGE_WIDTH / 2,
      y: FLOOR_Y - 95,
      width: 75,
      height: 100,
      vx: 2.0,
      hp: 180,
      maxHp: 180,
      state: 'WALKING', // WALKING, SPEECHING
      stateTimer: 0,
      weakSpot: {
        relX: 0,
        relY: 10,
        radius: 16,
        active: false // Active only while giving speech
      }
    };
  }
  
  addFloatingText(STAGE_WIDTH / 2, 200, '⚠️ 魔王來襲！ ⚠️', 'var(--danger-color)', 28);
}

// ----------------- UPDATE AND LOGIC -----------------
function update() {
  if (gameState !== 'PLAYING') return;

  // 1. Wind remains constant for each level (removed mid-level wind timer changes)

  // 2. Player horizontal movement
  player.vx = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) {
    player.vx = -player.speed;
    player.facing = -1;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    player.vx = player.speed;
    player.facing = 1;
  }
  player.x += player.vx;
  
  // Boundary check
  if (player.x < 30) player.x = 30;
  if (player.x > STAGE_WIDTH - 30) player.x = STAGE_WIDTH - 30;

  // Spitting Charge Mechanic is removed for instant firing
  // Player spits instantly upon pressing Spacebar

  // Developer cheat: Press O key to add 100 HP (can accumulate/stack)
  if (keys['KeyO']) {
    hp += 100;
    updateHUD();
    addFloatingText(player.x, player.y - 60, '❤️ 密技：水分超載 +100!', '#ff00ff', 22);
    keys['KeyO'] = false; // Trigger once per keypress
  }

  // Weapon switching is removed (weapons are permanently stacked passives)

  // 4. Update Spits (Physics & Trajectory)
  for (let i = spits.length - 1; i >= 0; i--) {
    const s = spits[i];
    
    // Store path history for drawing stretch trail
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 5) s.trail.shift();

    // Horizontal acceleration from wind (cola type is affected much less)
    const windFactor = s.type === 'cola' ? 0.08 : 0.45;
    s.vx += currentWind * 0.05 * windFactor;

    // Apply gravity
    s.y += s.vy;
    s.x += s.vx;
    s.vy += GRAVITY;

    let hitRegistered = false;

    // Check hit with boss projectiles (interception!)
    for (let k = bossProjectiles.length - 1; k >= 0; k--) {
      const bp = bossProjectiles[k];
      const dist = Math.sqrt((s.x - bp.x) ** 2 + (s.y - bp.y) ** 2);
      if (dist < s.radius + bp.radius) {
        hitRegistered = true;
        addSplashParticles(bp.x, bp.y, bp.color, 12, 1.0);
        addFloatingText(bp.x, bp.y - 15, '攔截！💥', 'var(--accent-color)', 16);
        audio.playHit();
        bossProjectiles.splice(k, 1); // remove boss projectile
        break;
      }
    }

    if (hitRegistered) {
      spits.splice(i, 1);
      continue;
    }

    // Check hit with normal pedestrians
    for (let p of pedestrians) {
      if (p.isHit) continue;
      
      // Collision box check
      const px = p.x - p.width / 2;
      const py = p.y - p.height;
      if (s.x > px && s.x < px + p.width && s.y > py && s.y < py + p.height) {
        // HIT!
        p.isHit = true;
        p.hitTimer = 60; // Shake animation frames
        hitRegistered = true;
        
        // Impact particle effect
        addSplashParticles(s.x, s.y, s.color, 12);
        audio.playHit();

        // Check if boss level trigger / police trigger
        if (p.type.type === 'POLICE') {
          // If we hit the gangster/police, they get angry and run up
          p.angerState = 1;
          p.vx = 0; // stop moving horizontally
          addFloatingText(p.x, p.y - p.height - 15, '💢 找死啊！', 'var(--danger-color)', 20);
          addSplashParticles(p.x, p.y - p.height/2, 'red', 20, 1.5);
          hp -= 2; // massive health loss
          updateHUD();
          if (hp <= 0) triggerGameOver();
        } else {
          // Score and stats adjustment
          const points = p.type.score;
          score += points;
          levelScore += points;
          updateHUD(); // Immediate score updates
          
          if (points > 0) {
            addFloatingText(p.x, p.y - p.height - 10, `+${points}`, 'var(--success-color)', 20);
          } else {
            // Protected targets
            addFloatingText(p.x, p.y - p.height - 10, `${points}!!`, 'var(--danger-color)', 20);
            hp = Math.max(0, hp + p.type.hpChange);
            updateHUD();
            if (hp <= 0) triggerGameOver();
          }
          
          // Chili Splash AOE logic
          if (s.type === 'chili') {
            triggerChiliSplash(s.x, s.y);
          }
        }
        break;
      }
    }

    // Check hit with Boss
    if (!hitRegistered && boss) {
      let isBossHit = false;
      const bx = boss.x - boss.width/2;
      const by = boss.y; // boss base is at FLOOR_Y - height, drawn upwards
      
      // Weak spot absolute coords
      // Boss 3 (Truck) and Boss 4 (Politician) change direction, weak spot mirrors
      let wsX = boss.x + boss.weakSpot.relX;
      if ((level === 3 || level === 4) && boss.vx < 0) {
        wsX = boss.x - boss.weakSpot.relX; // Mirror horizontal relX
      }
      const wsY = boss.y + boss.weakSpot.relY;

      // Distance to weak spot
      const distToWeakSpot = Math.sqrt((s.x - wsX) ** 2 + (s.y - wsY) ** 2);
      
      if (boss.weakSpot.active && distToWeakSpot < boss.weakSpot.radius + s.radius) {
        // CRITICAL WEAK SPOT HIT!
        isBossHit = true;
        hitRegistered = true;
        const dmg = s.type === 'chili' ? 40 : s.type === 'cola' ? 30 : 25;
        boss.hp = Math.max(0, boss.hp - dmg);
        addFloatingText(wsX, wsY - 30, `💥 弱點重擊! -${dmg} HP`, '#ff8c00', 22);
        addSplashParticles(s.x, s.y, '#ffd23f', 25, 2.0);
        audio.playHit();
      } else if (s.x > bx && s.x < bx + boss.width && s.y > by && s.y < by + boss.height) {
        // Normal boss body hit (very little damage)
        isBossHit = true;
        hitRegistered = true;
        const dmg = 2; // minor graze
        boss.hp = Math.max(0, boss.hp - dmg);
        addFloatingText(s.x, s.y - 20, `無效傷害 -${dmg}`, '#888', 15);
        addSplashParticles(s.x, s.y, s.color, 6);
        audio.playHit();
      }

      if (isBossHit && boss.hp <= 0) {
        // Beat Boss!
        triggerBossDefeat();
      }
    }

    // Remove spit if hit
    if (hitRegistered) {
      resolveSpit(s.shotId, true, s.x, s.y);
      spits.splice(i, 1);
      continue;
    }

    // Check hit the ground (MISS)
    if (s.y >= FLOOR_Y + 10) {
      // Create splash on ground
      addSplashParticles(s.x, FLOOR_Y + 10, s.color, 8, 0.6);
      audio.playDmg();
      
      resolveSpit(s.shotId, false, s.x, s.y);

      // Chili splash on ground
      if (s.type === 'chili') {
        triggerChiliSplash(s.x, FLOOR_Y + 10);
      }

      spits.splice(i, 1);
    }
  }

  // 5. Chili Splash Explosion (AOE)
  function triggerChiliSplash(splashX, splashY) {
    const radius = 60;
    // visual circle splash
    addSplashParticles(splashX, splashY, '#ff3333', 25, 1.8);
    
    // Hit any pedestrians nearby
    for (let p of pedestrians) {
      if (p.isHit) continue;
      const dist = Math.abs(p.x - splashX);
      if (dist < radius) {
        p.isHit = true;
        p.hitTimer = 60;
        audio.playHit();

        if (p.type.type === 'POLICE') {
          p.angerState = 1;
          p.vx = 0;
          addFloatingText(p.x, p.y - p.height - 15, '💢 找死啊！', 'var(--danger-color)', 20);
          addSplashParticles(p.x, p.y - p.height/2, 'red', 20, 1.5);
          hp -= 2;
          updateHUD();
          if (hp <= 0) triggerGameOver();
        } else {
          const points = p.type.score;
          score += points;
          levelScore += points;
          updateHUD(); // Immediate score updates
          
          if (points > 0) {
            addFloatingText(p.x, p.y - p.height - 15, `💥 濺射! +${points}`, 'orange', 18);
            if (hp < maxHp) {
              hp++;
              updateHUD();
              addFloatingText(p.x, p.y - p.height - 35, '+1 水分! 💧', '#00ffff', 14);
            }
          } else {
            addFloatingText(p.x, p.y - p.height - 15, `💥 濺射! ${points}!!`, 'var(--danger-color)', 18);
            hp = Math.max(0, hp + p.type.hpChange);
            updateHUD();
            if (hp <= 0) triggerGameOver();
          }
        }
      }
    }
  }

  // 6. Update Pedestrians
  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const p = pedestrians[i];
    
    // Boss Level 3 Water sweep can wash away/clean walking pedestrians if needed,
    // but we just move them.
    
    // If police is angry, they transition into scaling up anger and then game over
    if (p.type.type === 'POLICE' && p.angerState > 0) {
      p.angerState += 0.02;
      // They look up and scale, then trigger arrest Game Over animation
      if (p.angerState > 2.0) {
        triggerGameOver();
        return;
      }
      continue;
    }

    // Walking animation bob
    p.bobTimer += 0.15;
    
    if (p.isHit) {
      p.hitTimer--;
      // Keep moving slowly or slide
      p.x += p.vx * 0.15;
      
      if (p.hitTimer <= 0) {
        pedestrians.splice(i, 1);
        continue;
      }
    } else {
      p.x += p.vx;
    }

    // Remove if walked off screen
    if ((p.vx > 0 && p.x > STAGE_WIDTH + 80) || (p.vx < 0 && p.x < -80)) {
      pedestrians.splice(i, 1);
    }
  }

  // 7. Spawning Pedestrians Scheduler (Spawn until levelScore reaches 200)
  if (levelScore < 200) {
    spawnTimer++;
    // Spawn every 100-180 frames depending on level
    const spawnRate = level === 1 ? 160 : level === 2 ? 140 : level === 3 ? 120 : 100;
    if (spawnTimer > spawnRate) {
      spawnPedestrian();
      spawnTimer = 0;
    }
  } else if (pedestrians.length === 0 && !boss && !bossSpawned) {
    // If all pedestrians are cleared and Boss hasn't spawned yet
    spawnBoss();
  }

  // 8. Update Boss
  if (boss) {
    boss.stateTimer++;

    if (level === 1) {
      // Boss Landlord
      if (boss.state === 'WALKING') {
        boss.x += boss.vx;
        // Turn around
        if (boss.x < 150 || boss.x > STAGE_WIDTH - 150) {
          boss.vx *= -1;
        }
        
        // Stop to shout occasionally
        if (boss.stateTimer > 180) {
          boss.state = 'SHOUTING';
          boss.stateTimer = 0;
          boss.weakSpot.active = true;
          // Set weak spot relative to face depending on direction
          boss.weakSpot.relX = boss.vx > 0 ? 25 : -25;
          boss.weakSpot.relY = -60; 
        }
      } else if (boss.state === 'SHOUTING') {
        // Screaming "交房租！"
        // Every few shouting frames, spawn a floating font "交房租！" that goes upwards
        if (boss.stateTimer % 20 === 0) {
          addFloatingText(boss.x + boss.weakSpot.relX, boss.y - 70, '交房租！！💰', 'var(--danger-color)', 18);
        }

        if (boss.stateTimer % 35 === 0) {
          // Launch a flying red bill (dollar bill / notice) upwards towards player
          const mouthX = boss.x + boss.weakSpot.relX;
          const mouthY = boss.y + boss.weakSpot.relY;
          const angle = Math.atan2(player.y - mouthY, player.x - mouthX);
          const noiseAngle = angle + (Math.random() - 0.5) * 0.4;
          const speed = 3.0 + Math.random() * 1.0;
          bossProjectiles.push({
            x: mouthX,
            y: mouthY,
            vx: Math.cos(noiseAngle) * speed,
            vy: Math.sin(noiseAngle) * speed,
            radius: 8,
            type: 'bill',
            color: '#e53e3e',
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.1
          });
        }

        // Return to walking
        if (boss.stateTimer > 120) {
          boss.state = 'WALKING';
          boss.stateTimer = 0;
          boss.weakSpot.active = false;
        }
      }
    } 
    else if (level === 2) {
      // Boss Influencer (Dancer)
      if (boss.state === 'WALKING') {
        boss.x += boss.vx;
        if (boss.x < 150 || boss.x > STAGE_WIDTH - 150) {
          boss.vx *= -1;
        }
        
        // Position camera tripod at some horizontal offset
        boss.weakSpot.relX = boss.vx > 0 ? 45 : -45;
        boss.weakSpot.relY = -15;

        if (boss.stateTimer > 140) {
          boss.state = 'DANCING';
          boss.stateTimer = 0;
        }
      } else if (boss.state === 'DANCING') {
        // Shake camera tripod around
        boss.weakSpot.relX = (boss.vx > 0 ? 45 : -45) + Math.sin(boss.stateTimer * 0.2) * 10;
        
        if (boss.stateTimer % 30 === 0) {
          addFloatingText(boss.x, boss.y - 95, '❤️ 求點讚 ❤️', '#ff1493', 17);
        }

        if (boss.stateTimer % 25 === 0) {
          // Launch flying heart
          const startX = boss.x;
          const startY = boss.y - 50;
          const angle = Math.atan2(player.y - startY, player.x - startX);
          const noiseAngle = angle + (Math.random() - 0.5) * 0.3;
          const speed = 3.5 + Math.random() * 1.0;
          bossProjectiles.push({
            x: startX,
            y: startY,
            vx: Math.cos(noiseAngle) * speed,
            vy: Math.sin(noiseAngle) * speed,
            radius: 7,
            type: 'heart',
            color: '#ff1493'
          });
        }

        if (boss.stateTimer > 150) {
          boss.state = 'WALKING';
          boss.stateTimer = 0;
        }
      }
    } 
    else if (level === 3) {
      // Boss Sweeper Truck
      boss.x += boss.vx;
      if (boss.x < 150 || boss.x > STAGE_WIDTH - 150) {
        boss.vx *= -1;
      }

      // Update sprayers
      boss.sprayers.forEach(spray => {
        spray.timer++;
        
        // Every 160 frames, active spraying
        const cycle = spray.timer % 180;
        if (cycle > 80 && cycle < 130) {
          // Emit cleaning water drops upwards!
          if (Math.random() < 0.25) {
            const wx = boss.x - boss.width/2 + spray.relX;
            particles.push({
              x: wx,
              y: FLOOR_Y - 50,
              vx: (Math.random() - 0.5) * 1.5,
              vy: -4.2 - (Math.random() * 1.8), // fast enough to reach roof
              radius: 6 + Math.random() * 4,
              color: 'rgba(54, 162, 235, 0.8)',
              alpha: 0.9,
              life: 120, // long life to reach player Y = 100
              isWaterShield: true // Specially marked to intercept player's spit
            });
          }
        }
      });

      // Weak spot mirrors depending on movement direction
      boss.weakSpot.relX = boss.vx > 0 ? -55 : 55; // driver window
      boss.weakSpot.relY = -45;

      // Clean player spits that hit water shields (mutual destruction)
      for (let j = spits.length - 1; j >= 0; j--) {
        const s = spits[j];
        let spitDestroyed = false;
        for (let k = particles.length - 1; k >= 0; k--) {
          const p = particles[k];
          if (p.isWaterShield) {
            const dist = Math.sqrt((s.x - p.x)**2 + (s.y - p.y)**2);
            if (dist < s.radius + p.radius) {
              // Destroy both spit and water shield particle
              addSplashParticles(s.x, s.y, 'rgba(100,200,255,0.5)', 8, 0.9);
              particles.splice(k, 1); // remove water particle!
              spitDestroyed = true;
              addFloatingText(s.x, s.y - 10, '互消！💥', '#88c', 14);
              break;
            }
          }
        }
        if (spitDestroyed) {
          resolveSpit(s.shotId, true, s.x, s.y);
          spits.splice(j, 1);
        }
      }
    }
    else if (level === 4) {
      // Boss Politician
      if (boss.state === 'WALKING') {
        boss.x += boss.vx;
        if (boss.x < 150 || boss.x > STAGE_WIDTH - 150) {
          boss.vx *= -1;
        }
        boss.weakSpot.active = false;
        // Stop to give a speech
        if (boss.stateTimer > 150) {
          boss.state = 'SPEECHING';
          boss.stateTimer = 0;
          boss.weakSpot.active = true;
          boss.weakSpot.relX = boss.vx > 0 ? 30 : -30;
          boss.weakSpot.relY = 5;
        }
      } else if (boss.state === 'SPEECHING') {
        // Standing still, ranting into microphone
        if (boss.stateTimer % 15 === 0) {
          addFloatingText(boss.x, boss.y - 110, ['謊言！', '空話！', '選我！', '改革！', '幹大事！'][Math.floor(boss.stateTimer / 15) % 5], '#8B5CF6', 16);
        }
        // Fire speech bubble projectiles
        if (boss.stateTimer % 28 === 0) {
          const micX = boss.x + boss.weakSpot.relX;
          const micY = boss.y + boss.weakSpot.relY;
          const angle = Math.atan2(player.y - micY, player.x - micX);
          const noiseAngle = angle + (Math.random() - 0.5) * 0.5;
          const speed = 2.5 + Math.random() * 1.2;
          bossProjectiles.push({
            x: micX,
            y: micY,
            vx: Math.cos(noiseAngle) * speed,
            vy: Math.sin(noiseAngle) * speed,
            radius: 10,
            type: 'bubble',
            color: '#8B5CF6',
            text: ['💬', '🤥', '📢', '❗'][Math.floor(Math.random() * 4)]
          });
        }
        // Return to walking
        if (boss.stateTimer > 160) {
          boss.state = 'WALKING';
          boss.stateTimer = 0;
          boss.weakSpot.active = false;
        }
      }
    }
  }

  // Update Boss Projectiles
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const bp = bossProjectiles[i];
    bp.x += bp.vx;
    bp.y += bp.vy;

    // Check hit player
    const pxMin = player.x - 20;
    const pxMax = player.x + 20;
    const pyMin = player.y - 45;
    const pyMax = player.y + 15;

    if (bp.x > pxMin && bp.x < pxMax && bp.y > pyMin && bp.y < pyMax) {
      // Hit!
      hp--;
      updateHUD();
      audio.playDmg();
      addFloatingText(player.x, player.y - 60, '痛！HP -1 💥', 'var(--danger-color)', 22);
      addSplashParticles(bp.x, bp.y, bp.color, 15, 1.2);
      bossProjectiles.splice(i, 1);

      if (hp <= 0) {
        triggerGameOver();
      }
      continue;
    }

    if (bp.y < -50 || bp.x < -50 || bp.x > STAGE_WIDTH + 50) {
      bossProjectiles.splice(i, 1);
    }
  }

  // 9. Update Particles (Visuals)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    
    // Water sprays don't have gravity, but normal splash particles do
    if (!p.isWaterShield) {
      p.vy += 0.15; // slow gravity
    } else {
      // Check hit player!
      const pxMin = player.x - 20;
      const pxMax = player.x + 20;
      const pyMin = player.y - 45;
      const pyMax = player.y + 15;
      if (p.x > pxMin && p.x < pxMax && p.y > pyMin && p.y < pyMax) {
        // HIT!
        hp--;
        updateHUD();
        audio.playDmg();
        addFloatingText(player.x, player.y - 60, '被水沖！HP -1 💦', '#3a86c8', 20);
        addSplashParticles(p.x, p.y, 'rgba(100,200,255,0.8)', 10, 0.8);
        particles.splice(i, 1);
        
        if (hp <= 0) {
          triggerGameOver();
        }
        continue;
      }
    }
    
    p.life--;
    p.alpha = Math.max(0, p.life / 50);

    if (p.life <= 0 || p.y > STAGE_HEIGHT + 20) {
      particles.splice(i, 1);
    }
  }

  // 10. Update Floating Text Particles
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life--;
    ft.alpha = Math.max(0, ft.life / 80);
    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

// Defeat Boss Handler
function triggerBossDefeat() {
  score += level * 500; // Large reward
  hp = maxHp; // Full health restore!
  updateHUD();
  addFloatingText(STAGE_WIDTH / 2, PLAYER_Y + 40, '💦 水分已補滿！ 💦', 'var(--success-color)', 26);
  addFloatingText(boss.x, boss.y - 80, `🏆 擊敗魔王！ +${level * 500}`, 'var(--success-color)', 28);
  addSplashParticles(boss.x, boss.y, '#ffd23f', 50, 2.5);
  boss = null;
  
  if (level < 4) {
    setTimeout(() => {
      openShop();
    }, 1500);
  } else {
    // Game Completed!
    setTimeout(() => {
      triggerVictory();
    }, 1800);
  }
}

// ----------------- RENDERING ENGINE (CANVAS) -----------------
function draw() {
  // Clear screen
  ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  // Draw Sky & Clouds (doodle style)
  drawBackground();

  // Draw Building Structure on which player is standing
  // The player stands on the rooftop of a building that fills the left-to-right top screen.
  // Let's draw the brick roof ledge
  drawRoofLedge();

  // Draw Wind Indicator on roof (Indicator removed)

  // Draw Pedestrian sidewalks and roads at bottom
  drawStreet();

  // Draw Pedestrians
  for (let p of pedestrians) {
    drawPedestrian(p);
  }

  // Draw Boss
  if (boss) {
    drawBoss();
  }

  // Draw Spits
  for (let s of spits) {
    drawSpit(s);
  }

  // Draw Boss Projectiles
  for (let bp of bossProjectiles) {
    ctx.save();
    if (bp.type === 'bill') {
      ctx.translate(bp.x, bp.y);
      ctx.rotate(bp.rotation);
      ctx.fillStyle = bp.color;
      ctx.fillRect(-10, -6, 20, 12);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -6, 20, 12);
      ctx.fillStyle = '#fff';
      ctx.font = '10px Fredoka';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
      bp.rotation += bp.rotSpeed;
    } else if (bp.type === 'heart') {
      ctx.fillStyle = bp.color;
      ctx.font = '22px Fredoka';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', bp.x, bp.y);
    } else if (bp.type === 'bubble') {
      // Speech bubble projectile
      ctx.fillStyle = 'rgba(139,92,246,0.25)';
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = '14px Fredoka';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bp.text, bp.x, bp.y);
    }
    ctx.restore();
  }

  // Draw Particles
  for (let p of particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Player
  drawPlayer();

  // Draw Floating Text effects
  for (let ft of floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.size}px 'Fredoka', 'Gaegu', sans-serif`;
    ctx.textAlign = 'center';
    // Doodle text outline
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

// Draw doodle backdrop
function drawBackground() {
  // Pastel yellow paper-like background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
  grad.addColorStop(0, '#f9f6ef');
  grad.addColorStop(1, '#f1ede2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

  // Draw cartoon sketch sun
  ctx.save();
  ctx.strokeStyle = '#e5c158';
  ctx.lineWidth = 3;
  // sun body
  drawDoodleCircle(ctx, STAGE_WIDTH - 80, 80, 24, '#fff9e6', '#e5c158', 3);
  // sunrays
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x1 = (STAGE_WIDTH - 80) + Math.cos(angle) * 32;
    const y1 = 80 + Math.sin(angle) * 32;
    const x2 = (STAGE_WIDTH - 80) + Math.cos(angle) * 44;
    const y2 = 80 + Math.sin(angle) * 44;
    drawDoodleLine(ctx, x1, y1, x2, y2, '#e5c158', 2);
  }
  ctx.restore();

  // Draw doodle cloud
  drawCloud(120, 70, 45);
  drawCloud(550, 90, 55);
}

function drawCloud(cx, cy, w) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.4, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx + w * 0.3, cy - w * 0.25, w * 0.45, Math.PI * 1.0, Math.PI * 2.0);
  ctx.arc(cx + w * 0.7, cy - w * 0.1, w * 0.4, Math.PI * 1.2, Math.PI * 2.2);
  ctx.arc(cx + w * 0.8, cy + w * 0.1, w * 0.35, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawRoofLedge() {
  ctx.save();
  // Draw top building ledge where player runs
  // It's a horizontal brick roof running across at Y = 120
  ctx.fillStyle = '#cc5a5a'; // Red brick
  ctx.fillRect(0, 0, STAGE_WIDTH, 120);

  // Draw sketch outline at the roof edge
  drawDoodleLine(ctx, 0, 120, STAGE_WIDTH, 120, '#1a1a2e', 4);
  
  // Draw some brick joint lines randomly
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  for (let x = 40; x < STAGE_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 120);
    ctx.stroke();
  }
  // horizontal joints
  for (let y = 30; y < 120; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(STAGE_WIDTH, y);
    ctx.stroke();
  }

  // Draw metal fence at roof top
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 2.5;
  for (let x = 15; x < STAGE_WIDTH; x += 30) {
    // vertical bars
    drawDoodleLine(ctx, x, 120, x, 90, '#4a5568', 2);
  }
  // top rail
  drawDoodleLine(ctx, 0, 90, STAGE_WIDTH, 90, '#4a5568', 3);

  ctx.restore();
}

function drawStreet() {
  ctx.save();
  // Sidewalk and concrete street at bottom Y = 530 to 600
  ctx.fillStyle = '#b0ac9c'; // grey sidewalk
  ctx.fillRect(0, FLOOR_Y, STAGE_WIDTH, 70);
  
  // Sidewalk border line
  drawDoodleLine(ctx, 0, FLOOR_Y, STAGE_WIDTH, FLOOR_Y, '#1a1a2e', 3);

  // Draw curb stone lines
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (let x = 0; x < STAGE_WIDTH; x += 100) {
    drawDoodleLine(ctx, x, FLOOR_Y, x - 10, FLOOR_Y + 15, '#555', 2);
  }

  // Asphalt road below sidewalk
  ctx.fillStyle = '#4a4947';
  ctx.fillRect(0, FLOOR_Y + 15, STAGE_WIDTH, 55);

  // Yellow dashed lane marker
  ctx.strokeStyle = '#fcd116';
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y + 40);
  ctx.lineTo(STAGE_WIDTH, FLOOR_Y + 40);
  ctx.stroke();
  ctx.setLineDash([]); // clear dash

  // Draw a sketchy garbage can on sidewalk
  ctx.fillStyle = '#718096';
  ctx.fillRect(720, FLOOR_Y - 20, 24, 30);
  drawDoodleLine(ctx, 720, FLOOR_Y - 20, 744, FLOOR_Y - 20, '#1a1a2e', 3);
  drawDoodleLine(ctx, 720, FLOOR_Y - 20, 720, FLOOR_Y + 10, '#1a1a2e', 3);
  drawDoodleLine(ctx, 744, FLOOR_Y - 20, 744, FLOOR_Y + 10, '#1a1a2e', 3);

  ctx.restore();
}

function drawWindVaneOnRoof() {
  ctx.save();
  // Simple wind flagpole with funny flapping underpants or socks
  const x = STAGE_WIDTH - 50;
  const y = 90; // fence top
  
  // pole
  drawDoodleLine(ctx, x, y, x, y - 50, '#333', 3);

  // Sock flapping direction based on wind velocity
  const length = currentWind * 8; // length of stretch
  ctx.fillStyle = '#ff7f50'; // orange wind sock
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(x, y - 50);
  // draw flapping cone
  ctx.lineTo(x + length, y - 46);
  ctx.lineTo(x + length, y - 36);
  ctx.lineTo(x, y - 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Draw Player Character (doodle stickman)
function drawPlayer() {
  ctx.save();
  const px = player.x;
  const py = player.y - 10; // offset upwards

  // Shake slightly when charging spit
  let shakeX = 0;
  let shakeY = 0;
  if (player.isCharging) {
    shakeX = (Math.random() - 0.5) * (player.chargePower * 0.08);
    shakeY = (Math.random() - 0.5) * (player.chargePower * 0.08);
  }

  // Draw player body
  // Head
  ctx.fillStyle = '#fff';
  drawDoodleCircle(ctx, px + shakeX, py - 25 + shakeY, 15, '#fff', '#1a1a2e', 3);

  // Googly Eyes (look down)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  // Left eye
  ctx.arc(px - 6 + shakeX, py - 25 + shakeY, 2.5, 0, Math.PI*2);
  // Right eye
  ctx.arc(px + 6 + shakeX, py - 25 + shakeY, 2.5, 0, Math.PI*2);
  ctx.fill();

  // Simple line mouth
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(px, py - 18, 5, 0, Math.PI, false);
  ctx.stroke();

  // Hair (funny spiky doodle)
  ctx.beginPath();
  ctx.moveTo(px - 12 + shakeX, py - 38 + shakeY);
  ctx.lineTo(px - 6 + shakeX, py - 48 + shakeY);
  ctx.lineTo(px + shakeX, py - 39 + shakeY);
  ctx.lineTo(px + 6 + shakeX, py - 49 + shakeY);
  ctx.lineTo(px + 12 + shakeX, py - 37 + shakeY);
  ctx.stroke();

  // Stick body
  drawDoodleLine(ctx, px + shakeX, py - 10 + shakeY, px + shakeX, py + 15 + shakeY, '#1a1a2e', 3);
  
  // Normal arms resting on rails
  drawDoodleLine(ctx, px - 12, py, px - 16, py + 10, '#1a1a2e', 3);
  drawDoodleLine(ctx, px + 12, py, px + 16, py + 10, '#1a1a2e', 3);

  // Draw active upgrade icons above player head
  let activeUpgrades = [];
  if (player.upgrades.chili) activeUpgrades.push('🌶️');
  if (player.upgrades.boba) activeUpgrades.push('🧋');
  if (player.upgrades.cola) activeUpgrades.push('🥤');
  if (activeUpgrades.length > 0) {
    ctx.font = '20px Fredoka';
    ctx.fillText(activeUpgrades.join(' '), px + 25, py - 35);
  }

  ctx.restore();
}

// Draw flying spit with dynamic stretch effect
function drawSpit(s) {
  ctx.save();
  ctx.fillStyle = s.color;
  ctx.strokeStyle = s.color;
  
  // If there's enough history trail, draw stretched tear drop shape
  if (s.trail.length > 2) {
    ctx.beginPath();
    const start = s.trail[0];
    ctx.moveTo(start.x, start.y);
    
    // Stretch thicker towards current position
    for (let i = 1; i < s.trail.length; i++) {
      const pt = s.trail[i];
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineWidth = s.radius * 0.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Head circle
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Normal circle
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Draw Pedestrians (Procedural Doodle characters)
function drawPedestrian(p) {
  ctx.save();

  // If hit, shake violently and turn blue/green
  let shakeX = 0;
  let shakeY = 0;
  if (p.isHit) {
    shakeX = (Math.random() - 0.5) * 8;
    shakeY = (Math.random() - 0.5) * 8;
    ctx.fillStyle = '#adff2f'; // Green sludge hit color
  } else {
    ctx.fillStyle = p.type.color;
  }

  const px = p.x + shakeX;
  const py = p.y + shakeY;
  const scale = p.type.scale;

  // Face reaction if hit
  const isBiker = p.type.type === 'BIKER';
  
  // If police is angry and scaling up
  if (p.type.type === 'POLICE' && p.angerState > 0) {
    ctx.translate(px, py);
    ctx.scale(p.angerState, p.angerState);
    ctx.translate(-px, -py);
  }

  // Bobbing offset
  const bobY = Math.sin(p.bobTimer) * 3;

  if (isBiker) {
    // Draw motorcycle silhouette first
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(px - 30, py - 30, 60, 20); // bike body
    drawDoodleCircle(ctx, px - 25, py - 10, 12, '#1a1a2e', '#000', 2); // left wheel
    drawDoodleCircle(ctx, px + 25, py - 10, 12, '#1a1a2e', '#000', 2); // right wheel
    // handlebars
    drawDoodleLine(ctx, px + (p.direction * 15), py - 30, px + (p.direction * 25), py - 45, '#000', 3);
  }

  // Draw body (doodle dress or shirt)
  if (!isBiker) {
    ctx.fillStyle = p.isHit ? '#a3e2f7' : p.type.color;
    ctx.beginPath();
    ctx.moveTo(px - 10 * scale, py);
    ctx.lineTo(px - 8 * scale, py - 40 * scale - bobY);
    ctx.lineTo(px + 8 * scale, py - 40 * scale - bobY);
    ctx.lineTo(px + 10 * scale, py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Stick legs
    const legSwing = Math.sin(p.bobTimer) * 8;
    drawDoodleLine(ctx, px - 4 * scale, py - 5, px - 6 * scale + legSwing, py, '#000', 2.5);
    drawDoodleLine(ctx, px + 4 * scale, py - 5, px + 6 * scale - legSwing, py, '#000', 2.5);
  } else {
    // Biker body sitting
    drawDoodleLine(ctx, px, py - 20, px - (p.direction * 15), py - 40, '#000', 4);
  }

  // Head
  const headY = py - 50 * scale - bobY;
  drawDoodleCircle(ctx, px, headY, 11 * scale, p.isHit ? '#00e5ff' : '#fff', '#000', 2.5);

  // Character specific hats/accessories
  if (p.type.type === 'BOSS') {
    // Top Hat
    ctx.fillStyle = '#000';
    ctx.fillRect(px - 14, headY - 20, 28, 5); // brim
    ctx.fillRect(px - 9, headY - 35, 18, 16); // crown
  } else if (p.type.type === 'PREGNANT') {
    // Large baby bump circle in front
    ctx.fillStyle = p.type.color;
    const offset = p.direction * 10;
    drawDoodleCircle(ctx, px + offset, py - 18, 14, p.type.color, '#000', 2.5);
  } else if (p.type.type === 'CHILD') {
    // Holding a floating balloon
    const handX = px + p.direction * 8;
    const handY = py - 30;
    const balloonX = px + p.direction * 25;
    const balloonY = py - 85;
    // draw line
    drawDoodleLine(ctx, handX, handY, balloonX, balloonY, '#555', 1);
    // draw balloon
    drawDoodleCircle(ctx, balloonX, balloonY, 12, '#ff3366', '#000', 2);
  } else if (p.type.type === 'POLICE') {
    // Sunglasses & police cap
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(px - 12, headY - 18, 24, 7); // Cap base
    ctx.beginPath();
    ctx.arc(px, headY - 16, 12, Math.PI, 0); // cap top
    ctx.fill();
    
    // Glasses line
    drawDoodleLine(ctx, px - 8, headY - 2, px + 8, headY - 2, '#000', 3);
  } else if (p.type.type === 'INFLUENCER') {
    // Selfie stick
    const stickX = px + p.direction * 20;
    const stickY = headY - 10;
    drawDoodleLine(ctx, px, headY, stickX, stickY, '#333', 2); // stick
    drawDoodleCircle(ctx, stickX, stickY, 6, '#ffd23f', '#000', 2); // phone camera
  }

  // Face reactions
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  if (p.isHit) {
    // Dizzy/Dead X-X eyes
    drawDoodleLine(ctx, px - 5, headY - 3, px - 1, headY + 1);
    drawDoodleLine(ctx, px - 1, headY - 3, px - 5, headY + 1);
    drawDoodleLine(ctx, px + 1, headY - 3, px + 5, headY + 1);
    drawDoodleLine(ctx, px + 5, headY - 3, px + 1, headY + 1);
    // Open screaming mouth
    drawDoodleCircle(ctx, px, headY + 5, 4, '#ff3333', '#000', 1.5);
  } else {
    // Simple look-ahead dots
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px + (p.direction * 3), headY - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth
    ctx.beginPath();
    if (p.type.type === 'BOSS') {
      // Grumpy flat mouth
      drawDoodleLine(ctx, px, headY + 4, px + (p.direction * 5), headY + 4, '#000', 1.5);
    } else {
      // Small smile
      ctx.arc(px + (p.direction * 2), headY + 2, 3, 0, Math.PI, false);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// Draw Bosses
function drawBoss() {
  ctx.save();
  const bx = boss.x;
  const by = boss.y;
  const bw = boss.width;
  const bh = boss.height;

  // Flash red on damage
  let shakeX = 0;
  let shakeY = 0;
  if (boss.hp < boss.maxHp) {
    // Shake relative to health lost
    const healthPct = boss.hp / boss.maxHp;
    if (Math.random() > healthPct) {
      shakeX = (Math.random() - 0.5) * 12;
      shakeY = (Math.random() - 0.5) * 12;
    }
  }

  const drawX = bx + shakeX;
  const drawY = by + shakeY;

  // Boss HP Bar above head
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(drawX - 50, drawY - 40, 100, 10);
  ctx.fillStyle = 'var(--danger-color)';
  ctx.fillRect(drawX - 50, drawY - 40, (boss.hp / boss.maxHp) * 100, 10);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(drawX - 50, drawY - 40, 100, 10);

  // Name tag
  ctx.fillStyle = '#000';
  ctx.font = "bold 14px 'Fredoka'";
  ctx.textAlign = 'center';
  let bossName = '惡房東';
  if (level === 2) bossName = '街頭網紅 舞王';
  if (level === 3) bossName = '高壓灑水清潔車';
  if (level === 4) bossName = '政客大叔 🎤';
  ctx.fillText(bossName, drawX, drawY - 48);

  if (level === 1) {
    // Boss 1: Landlord
    if (spriteCache.landlord) {
      ctx.save();
      // Flip sprite horizontally when moving left
      if (boss.vx < 0) {
        ctx.translate(drawX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-drawX, 0);
      }
      ctx.drawImage(spriteCache.landlord, drawX - 60, drawY - 45, 120, 120);
      ctx.restore();

      // Target indicator if shouting (Changed to Red)
      if (boss.state === 'SHOUTING') {
        const mouthX = drawX + (boss.vx > 0 ? 12 : -12);
        const mouthY = drawY + 2;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, boss.weakSpot.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Coat
      ctx.fillStyle = '#78350f';
      ctx.fillRect(drawX - 25, drawY + 20, 50, 60);
      drawDoodleLine(ctx, drawX - 25, drawY + 20, drawX - 25, drawY + 80, '#000', 3);
      drawDoodleLine(ctx, drawX + 25, drawY + 20, drawX + 25, drawY + 80, '#000', 3);

      // Head
      drawDoodleCircle(ctx, drawX, drawY, 24, '#fff', '#000', 3);
      
      // Mega hair / bald spot
      ctx.fillStyle = '#000';
      ctx.fillRect(drawX - 20, drawY - 26, 6, 20); // left hair
      ctx.fillRect(drawX + 14, drawY - 26, 6, 20); // right hair

      // Megaphone
      const megaphoneX = drawX + (boss.vx > 0 ? 30 : -30);
      const megaphoneY = drawY + 5;
      
      // Body of megaphone
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(drawX, megaphoneY);
      ctx.lineTo(megaphoneX, megaphoneY - 15);
      ctx.lineTo(megaphoneX, megaphoneY + 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Megaphone mouth
      ctx.fillStyle = '#4a5568';
      drawDoodleCircle(ctx, megaphoneX, megaphoneY, 15, '#4a5568', '#000', 2);

      // Landlord Weak spot mouth highlight
      if (boss.state === 'SHOUTING') {
        const mouthX = drawX + (boss.vx > 0 ? 12 : -12);
        const mouthY = drawY + 2;
        // Draw massive flashing red screaming mouth (Weak Spot)
        ctx.fillStyle = (Math.floor(boss.stateTimer / 10) % 2 === 0) ? '#ff5e5b' : '#ff0000';
        drawDoodleCircle(ctx, mouthX, mouthY, boss.weakSpot.radius, ctx.fillStyle, '#000', 3);
        // Weak spot target indicator (Changed to Red)
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, boss.weakSpot.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Grumpy flat mouth
        drawDoodleLine(ctx, drawX - 10, drawY + 6, drawX + 10, drawY + 6, '#000', 2.5);
      }
    }
  } 
  else if (level === 2) {
    // Boss 2: Influencer
    if (spriteCache.influencer) {
      ctx.save();
      // Flip sprite horizontally when moving left
      if (boss.vx < 0) {
        ctx.translate(drawX, 0);
        ctx.scale(-1, 1);
        ctx.translate(-drawX, 0);
      }
      ctx.drawImage(spriteCache.influencer, drawX - 55, drawY - 40, 110, 110);
      ctx.restore();

      // Target reticle over the lens (Changed to Red)
      let stickX = drawX + boss.weakSpot.relX;
      let stickY = drawY + boss.weakSpot.relY;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(stickX, stickY, boss.weakSpot.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Wacky bright hoodie
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(drawX - 22, drawY + 15, 44, 55);
      drawDoodleLine(ctx, drawX - 22, drawY + 15, drawX - 22, drawY + 70, '#000', 3);
      drawDoodleLine(ctx, drawX + 22, drawY + 15, drawX + 22, drawY + 70, '#000', 3);

      // Head
      drawDoodleCircle(ctx, drawX, drawY, 20, '#fff', '#000', 3);
      
      // Cool cap backward
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(drawX - 18, drawY - 24, 30, 8); // visor
      ctx.fillRect(drawX - 14, drawY - 18, 22, 10);
      
      // Selfie stick & camera (Weak Spot)
      let stickX = drawX + boss.weakSpot.relX;
      let stickY = drawY + boss.weakSpot.relY;
      
      // Draw wire connection from hand
      drawDoodleLine(ctx, drawX, drawY + 25, stickX, stickY + 15, '#555', 2);
      // Draw stand pole
      drawDoodleLine(ctx, stickX, stickY + 15, stickX, drawY + 70, '#000', 2.5); // tripod base

      // Phone / camera (WEAK SPOT TARGET)
      ctx.fillStyle = (Math.floor(boss.stateTimer / 10) % 2 === 0) ? '#ffd23f' : '#ffea70';
      drawDoodleCircle(ctx, stickX, stickY, boss.weakSpot.radius, ctx.fillStyle, '#000', 2.5);
      
      // Shiny camera lens glow
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(stickX, stickY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Target reticle over the lens (Changed to Red)
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(stickX, stickY, boss.weakSpot.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      
      // Smile face
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(drawX + (boss.vx > 0 ? 5 : -5), drawY, 2, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(drawX + (boss.vx > 0 ? 5 : -5), drawY + 5, 6, 0, Math.PI);
      ctx.stroke();
    }
  } 
  else if (level === 3) {
    // Boss 3: Cleaning Truck
    // Vehicle body
    ctx.fillStyle = '#3182ce';
    ctx.fillRect(drawX - 80, drawY, 160, 60); // main carriage
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(drawX - 80, drawY, 160, 60);

    // Driver cabin block
    const cabX = boss.vx > 0 ? drawX + 35 : drawX - 75;
    ctx.fillStyle = '#cbd5e0';
    ctx.fillRect(cabX, drawY - 25, 40, 25);
    ctx.strokeRect(cabX, drawY - 25, 40, 25);

    // Wheels
    drawDoodleCircle(ctx, drawX - 50, drawY + 60, 20, '#1a1a2e', '#000', 3);
    drawDoodleCircle(ctx, drawX + 50, drawY + 60, 20, '#1a1a2e', '#000', 3);

    // Water tanks / water nozzles on top
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(drawX - 70, drawY - 15, 80, 15);
    ctx.strokeRect(drawX - 70, drawY - 15, 80, 15);

    // Sprayers nozzles and spray lines (Only draw pipes, column block removed for droplet mode)
    boss.sprayers.forEach(spray => {
      const sx = drawX - 90 + spray.relX;
      // Draw spray nozzle pipe
      drawDoodleLine(ctx, sx, drawY, sx, drawY - 8, '#718096', 3.5);
    });

    // Driver Window (WEAK SPOT)
    let winX = drawX + boss.weakSpot.relX;
    if (boss.vx < 0) {
      winX = drawX - boss.weakSpot.relX; // Mirror window location
    }
    const winY = drawY + boss.weakSpot.relY;
    
    // Draw Weak Spot Window highlighted
    ctx.fillStyle = (Math.floor(boss.stateTimer / 10) % 2 === 0) ? '#ff5e5b' : '#ffea70';
    drawDoodleCircle(ctx, winX, winY, boss.weakSpot.radius, ctx.fillStyle, '#000', 2.5);
    
    // Inside driver figure sketch
    ctx.fillStyle = '#000';
    ctx.font = '12px Fredoka';
    ctx.fillText('👨‍✈️', winX, winY + 4);

    // Target reticle (Changed to Red)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.arc(winX, winY, boss.weakSpot.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  else if (level === 4) {
    // Boss 4: Politician
    // Suit body
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(drawX - 28, drawY + 18, 56, 65); // dark navy suit
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(drawX - 28, drawY + 18, 56, 65);
    // White shirt & tie
    ctx.fillStyle = '#fff';
    ctx.fillRect(drawX - 8, drawY + 18, 16, 40); // shirt
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(drawX - 4, drawY + 18);
    ctx.lineTo(drawX + 4, drawY + 18);
    ctx.lineTo(drawX + 2, drawY + 50);
    ctx.lineTo(drawX - 2, drawY + 50);
    ctx.closePath();
    ctx.fill(); // red tie
    // Legs
    drawDoodleLine(ctx, drawX - 14, drawY + 83, drawX - 14, drawY + 100, '#1e3a5f', 8);
    drawDoodleLine(ctx, drawX + 14, drawY + 83, drawX + 14, drawY + 100, '#1e3a5f', 8);
    // Shoes
    ctx.fillStyle = '#000';
    ctx.fillRect(drawX - 22, drawY + 95, 18, 8);
    ctx.fillRect(drawX + 4, drawY + 95, 18, 8);
    // Head
    drawDoodleCircle(ctx, drawX, drawY, 22, '#fff', '#000', 3);
    // Silver hair (politician side part)
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.ellipse(drawX - 5, drawY - 22, 18, 8, -0.2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(drawX - 7, drawY - 3, 2.5, 0, Math.PI * 2);
    ctx.arc(drawX + 7, drawY - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Microphone & weak spot
    const micDirX = boss.weakSpot.relX;
    const micHandX = drawX + (micDirX > 0 ? 28 : -28);
    const micHandY = drawY + 28;
    drawDoodleLine(ctx, drawX + (micDirX > 0 ? 15 : -15), drawY + 28, micHandX, micHandY - 10, '#000', 3);
    // Mic stick
    drawDoodleLine(ctx, micHandX, micHandY - 10, micHandX, micHandY - 35, '#555', 3);
    // Mic head (WEAK SPOT)
    const micHeadX = micHandX;
    const micHeadY = micHandY - 35;
    if (boss.state === 'SPEECHING') {
      ctx.fillStyle = (Math.floor(boss.stateTimer / 8) % 2 === 0) ? '#8B5CF6' : '#c4b5fd';
    } else {
      ctx.fillStyle = '#718096';
    }
    drawDoodleCircle(ctx, micHeadX, micHeadY, boss.weakSpot.radius, ctx.fillStyle, '#000', 2.5);
    // Target reticle (red, only when speeching)
    if (boss.state === 'SPEECHING') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.arc(micHeadX, micHeadY, boss.weakSpot.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Grumpy mouth
    if (boss.state === 'SPEECHING') {
      // open mouth
      ctx.fillStyle = '#ff3333';
      drawDoodleCircle(ctx, drawX + (micDirX > 0 ? 5 : -5), drawY + 8, 6, '#ff3333', '#000', 1.5);
    } else {
      drawDoodleLine(ctx, drawX - 8, drawY + 8, drawX + 8, drawY + 8, '#000', 2.5);
    }
  }

  ctx.restore();
}

// ----------------- GAME LOOP & ANIMATION -----------------
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Auto-run the drawing loop in start state
gameLoop();
