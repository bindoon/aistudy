(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const $score = document.getElementById('score');
  const $lives = document.getElementById('lives');
  const $bombs = document.getElementById('bombs');
  const $stage = document.getElementById('stage');
  const $highscore = document.getElementById('highscore');
  const $finalScore = document.getElementById('final-score');
  const $newRecord = document.getElementById('new-record');
  const $overlayStart = document.getElementById('overlay-start');
  const $overlayPause = document.getElementById('overlay-pause');
  const $overlayRevive = document.getElementById('overlay-revive');
  const $overlayGameover = document.getElementById('overlay-gameover');
  const $reviveExpr = document.getElementById('revive-expr');
  const $reviveAnswer = document.getElementById('revive-answer');
  const $reviveFeedback = document.getElementById('revive-feedback');
  const $reviveForm = document.getElementById('revive-form');
  const $weapons = document.getElementById('weapons');
  const $btnMute = document.getElementById('btn-mute');
  const $btnBomb = document.getElementById('btn-bomb');

  const REVIVE_LIVES = 2;
  const REVIVE_IFRAME = 60 * 3;
  const MAX_REVIVES = 3;
  const HIT_IFRAME = 45;
  const MAX_ENEMY_BULLETS = 120;

  const MAX_LIVES = 5;
  const MAX_WEAPON_LEVEL = 5;
  const MAX_BOMBS = 6;
  const START_BOMBS = 3;
  const SHOOT_INTERVAL = 7;
  const SHIELD_DURATION = 60 * 5;
  const BOMB_IFRAME = 60 * 1.5;
  const BOMB_FX_FRAMES = 48;
  const LIGHTNING_WARN_FRAMES = 55;
  const LIGHTNING_STRIKE_FRAMES = 18;
  const LIGHTNING_WIDTH = 64;
  const MAX_PARTICLES = 100;
  const MAX_FLOAT_TEXTS = 12;
  const MAX_BULLETS = 90;

  /** 同关难度稳定；战斗一段时间后出 Boss，打倒后进下一关 */
  const STAGES = [
    {
      id: 1, name: '雷云入口', waveFrames: 60 * 22, spawnInterval: 52, speedMul: 1.0, hpBonus: 0,
      lightningMin: 220, lightningMax: 340, extraSpawn: 0, enemyBias: 0,
      boss: { emoji: '🛸', name: '雷云母舰', hp: 70, size: 78, speed: 1.35, points: 400 },
    },
    {
      id: 2, name: '风暴带', waveFrames: 60 * 26, spawnInterval: 44, speedMul: 1.12, hpBonus: 1,
      lightningMin: 180, lightningMax: 280, extraSpawn: 0.2, enemyBias: 1,
      boss: { emoji: '👾', name: '风暴妖王', hp: 110, size: 84, speed: 1.5, points: 700 },
    },
    {
      id: 3, name: '雷电核心', waveFrames: 60 * 28, spawnInterval: 38, speedMul: 1.25, hpBonus: 1,
      lightningMin: 150, lightningMax: 240, extraSpawn: 0.3, enemyBias: 2,
      boss: { emoji: '🌩️', name: '雷霆巨兽', hp: 160, size: 90, speed: 1.6, points: 1000 },
    },
    {
      id: 4, name: '深空战场', waveFrames: 60 * 30, spawnInterval: 32, speedMul: 1.4, hpBonus: 2,
      lightningMin: 130, lightningMax: 210, extraSpawn: 0.35, enemyBias: 3,
      boss: { emoji: '🐉', name: '虚空蛟龙', hp: 220, size: 96, speed: 1.75, points: 1500 },
    },
    {
      id: 5, name: '最终决战', waveFrames: 60 * 32, spawnInterval: 28, speedMul: 1.55, hpBonus: 3,
      lightningMin: 110, lightningMax: 180, extraSpawn: 0.4, enemyBias: 4,
      boss: { emoji: '💀', name: '终焉魔神', hp: 300, size: 104, speed: 1.9, points: 2500 },
      endless: true,
    },
  ];

  const WEAPONS = {
    normal: { name: '标准弹', letter: 'N', color: '#88ddff', accent: '#3399ff' },
    laser: { name: '激光', letter: 'L', color: '#ff5577', accent: '#ff1144' },
    spread: { name: '散射', letter: 'S', color: '#ffe066', accent: '#ff9900' },
    plasma: { name: '等离子', letter: 'P', color: '#dd99ff', accent: '#aa44ff' },
    wave: { name: '波动', letter: 'W', color: '#55bbff', accent: '#0088ff' },
    chain: { name: '链弹', letter: 'C', color: '#c88cff', accent: '#9933ff' },
  };

  const BULLET_DROPS = [
    { weapon: 'laser', weight: 5 },
    { weapon: 'spread', weight: 5 },
    { weapon: 'plasma', weight: 4 },
    { weapon: 'wave', weight: 4 },
    { weapon: 'chain', weight: 4 },
    { weapon: 'normal', weight: 3 },
  ];

  const UTILITY_DROPS = [
    { kind: 'heart', emoji: '❤️', weight: 4 },
    { kind: 'shield', emoji: '🛡️', weight: 4 },
    { kind: 'bomb', emoji: '💣', weight: 3 },
  ];

  const ENEMIES = [
    { kind: 'scout', emoji: '🛸', hp: 1, points: 10, speed: 2.8, size: 30, weight: 40 },
    { kind: 'drone', emoji: '👾', hp: 2, points: 25, speed: 2.0, size: 34, weight: 35 },
    { kind: 'storm', emoji: '☁️', hp: 4, points: 50, speed: 1.2, size: 42, weight: 20 },
    { kind: 'boss', emoji: '🌩️', hp: 6, points: 100, speed: 0.9, size: 48, weight: 5 },
  ];

  /** 敌机火力：间隔（帧）、弹速、弹幕样式 */
  const ENEMY_FIRE = {
    scout: { interval: 95, speed: 4.2, pattern: 'aim', color: '#ff8866' },
    drone: { interval: 72, speed: 4.6, pattern: 'down', color: '#ff6688' },
    storm: { interval: 88, speed: 3.9, pattern: 'spread3', color: '#ffaa44' },
    boss: { interval: 58, speed: 4.3, pattern: 'spread5', color: '#ff5577' },
    stageBoss: { interval: 36, speed: 4.8, pattern: 'boss', color: '#ff44aa' },
  };

  let state = 'start';
  let currentWeapon = 'normal';
  let weaponLevel = 1;
  let score = 0;
  let lives = MAX_LIVES;
  let bombs = START_BOMBS;
  let highScore = parseInt(localStorage.getItem('thunderStrikeHigh') || '0', 10);
  let stageIndex = 0;
  let stagePhase = 'wave'; // wave | bossWarn | boss | clear
  let stageFrame = 0;
  let revivesLeft = MAX_REVIVES;
  let reviveQuiz = null;
  let frame = 0;
  let shieldUntil = 0;
  let bombIFrameUntil = 0;
  let hitIFrameUntil = 0;
  let shootTimer = 0;
  let nextLightningFrame = 120;
  let bombCooldownUntil = 0;
  let killsSinceDrop = 0;
  let framesSinceDrop = 0;
  let bossHpScale = 1;

  let player = { x: W / 2, y: H - 90, w: 44, h: 44, targetX: W / 2, targetY: H - 90 };
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let powerups = [];
  let lightnings = [];
  let particles = [];
  let floatTexts = [];
  let stormClouds = [];
  let bombFx = null;
  let chainArcs = [];
  let keys = {};
  let pointerX = null;
  let pointerY = null;

  function stageCfg() {
    return STAGES[Math.min(stageIndex, STAGES.length - 1)];
  }

  function hasStageBoss() {
    return enemies.some((e) => e.isStageBoss);
  }

  $highscore.textContent = highScore;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pickWeighted(entries) {
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return entries[entries.length - 1];
  }

  function initStormClouds() {
    stormClouds = Array.from({ length: 6 }, () => ({
      x: rand(0, W),
      y: rand(20, 200),
      w: rand(80, 160),
      speed: rand(0.1, 0.35),
      opacity: rand(0.15, 0.35),
    }));
  }

  function resetGame() {
    score = 0;
    lives = MAX_LIVES;
    bombs = START_BOMBS;
    stageIndex = 0;
    stagePhase = 'wave';
    stageFrame = 0;
    revivesLeft = MAX_REVIVES;
    reviveQuiz = null;
    frame = 0;
    shieldUntil = 0;
    bombIFrameUntil = 0;
    hitIFrameUntil = 0;
    bombCooldownUntil = 0;
    bombFx = null;
    killsSinceDrop = 0;
    framesSinceDrop = 0;
    bossHpScale = 1;
    currentWeapon = 'normal';
    weaponLevel = 1;
    shootTimer = 0;
    const s = stageCfg();
    nextLightningFrame = frame + rand(s.lightningMin, s.lightningMax);
    player = { x: W / 2, y: H - 90, w: 44, h: 44, targetX: W / 2, targetY: H - 90 };
    bullets = [];
    enemyBullets = [];
    enemies = [];
    powerups = [];
    lightnings = [];
    particles = [];
    floatTexts = [];
    chainArcs = [];
    updateHUD();
  }

  function updateMuteBtn() {
    if (!$btnMute) return;
    const on = window.Sound ? Sound.isEnabled() : true;
    $btnMute.textContent = on ? '🔊 有声' : '🔇 静音';
    $btnMute.title = on ? '点击静音' : '点击开启音效';
    $btnMute.setAttribute('aria-label', on ? '关闭音效' : '开启音效');
    $btnMute.classList.toggle('muted', !on);
    $btnMute.classList.toggle('sound-on', on);
  }

  function showSoundToast(msg) {
    let el = document.getElementById('sound-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sound-toast';
      el.className = 'sound-toast';
      document.getElementById('app').appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showSoundToast._t);
    showSoundToast._t = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function handleMuteClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    $btnMute.classList.add('btn-mute--tap');
    setTimeout(() => $btnMute.classList.remove('btn-mute--tap'), 180);

    if (!window.Sound) {
      $btnMute.textContent = '⚠️ 无模块';
      $btnMute.title = '音效模块未加载，请刷新页面';
      showSoundToast('音效模块未加载，请刷新');
      return;
    }

    // 手势内立刻解锁，再切换
    Sound.unlock();
    const on = Sound.toggle();
    updateMuteBtn();
    showSoundToast(on ? '音效已开启' : '已静音');
    if (on && state === 'playing') {
      Sound.startGame();
    }
  }

  function updateHUD() {
    $score.textContent = score;
    $lives.textContent = lives <= 8 ? '❤️'.repeat(lives) : `❤️×${lives}`;
    if ($bombs) {
      $bombs.textContent = bombs <= 6 ? '💣'.repeat(bombs) : `💣×${bombs}`;
    }
    if ($stage) {
      const s = stageCfg();
      $stage.textContent = `第${s.id}关`;
      $stage.title = s.name;
    }
    if ($btnBomb) {
      const canBomb = state === 'playing' && bombs > 0;
      $btnBomb.disabled = !canBomb;
      $btnBomb.hidden = state === 'start' || state === 'gameover' || state === 'revive';
      $btnBomb.textContent = bombs > 0 ? `💣 ${bombs}` : '💣 0';
    }
    if ($weapons) {
      const w = WEAPONS[currentWeapon];
      const s = stageCfg();
      const maxed = weaponLevel >= MAX_WEAPON_LEVEL ? ' ★' : '';
      const bars = '▮'.repeat(weaponLevel) + '▯'.repeat(MAX_WEAPON_LEVEL - weaponLevel);
      $weapons.innerHTML = `<span class="weapon-tag weapon-stage">${s.name}</span>
        <span class="weapon-tag weapon-active" style="--wc:${w.color}">
        <span class="weapon-eagle">🦅</span>
        <span class="weapon-info">${w.name} Lv.${weaponLevel}${maxed}</span>
        <span class="weapon-bars">${bars}</span>
      </span>`;
    }
  }

  function upgradeWeapon(type) {
    const w = WEAPONS[type];

    if (type === currentWeapon) {
      if (weaponLevel >= MAX_WEAPON_LEVEL) {
        score += 30;
        addFloatText(player.x, player.y - 30, `🦅 已满级 +30`, w.color);
        Sound.powerup();
        updateHUD();
        return;
      }
      weaponLevel++;
      addFloatText(player.x, player.y - 30, `🦅 ${w.name} Lv.${weaponLevel}!`, w.color);
      Sound.upgrade();
    } else {
      const prev = WEAPONS[currentWeapon];
      currentWeapon = type;
      weaponLevel = 1;
      bullets = [];
      addFloatText(player.x, player.y - 40, `${prev.name} → ${w.name}`, '#aaa');
      addFloatText(player.x, player.y - 18, `🦅 ${w.name} Lv.1 重新开始!`, w.color);
      Sound.switchWeapon();
    }

    spawnParticles(player.x, player.y, w.color, 14);
    updateHUD();
  }

  function hasShield() {
    return frame < shieldUntil || frame < bombIFrameUntil;
  }

  function pickEnemyDef() {
    const bias = stageCfg().enemyBias;
    const weighted = ENEMIES.map((e, i) => ({
      ...e,
      weight: Math.max(1, e.weight + (i >= 2 ? bias * 6 : -bias * 3)),
    }));
    return pickWeighted(weighted);
  }

  function spawnEnemy() {
    const def = pickEnemyDef();
    const s = stageCfg();
    const hp = def.hp + s.hpBonus;
    const fire = ENEMY_FIRE[def.kind];
    enemies.push({
      kind: def.kind,
      x: rand(35, W - 35),
      y: -def.size,
      size: def.size,
      emoji: def.emoji,
      hp,
      maxHp: hp,
      points: def.points + s.hpBonus * 5,
      speed: def.speed * s.speedMul,
      wobble: rand(0, Math.PI * 2),
      shootCd: fire ? randInt(20, fire.interval) : 9999,
      shotIndex: 0,
    });
  }

  function addEnemyBullet(x, y, vx, vy, color = '#ff6644', r = 5) {
    if (enemyBullets.length >= MAX_ENEMY_BULLETS) enemyBullets.shift();
    enemyBullets.push({ x, y, vx, vy, r, color });
  }

  function fireEnemyPattern(e, cfg) {
    const speed = cfg.speed * (1 + stageIndex * 0.06);
    const x = e.x;
    const y = e.y + e.size * 0.35;

    if (cfg.pattern === 'down') {
      addEnemyBullet(x, y, 0, speed, cfg.color);
    } else if (cfg.pattern === 'aim') {
      const dx = player.x - x;
      const dy = player.y - y;
      const len = Math.hypot(dx, dy) || 1;
      addEnemyBullet(x, y, (dx / len) * speed, (dy / len) * speed, cfg.color);
    } else if (cfg.pattern === 'spread3') {
      for (let i = -1; i <= 1; i++) {
        const ang = Math.PI / 2 + i * 0.28;
        addEnemyBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, cfg.color, 5);
      }
    } else if (cfg.pattern === 'spread5') {
      for (let i = -2; i <= 2; i++) {
        const ang = Math.PI / 2 + i * 0.22;
        addEnemyBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, cfg.color, 5);
      }
    } else if (cfg.pattern === 'boss') {
      e.shotIndex = (e.shotIndex || 0) + 1;
      if (e.shotIndex % 3 === 0) {
        // 瞄准三连
        const dx = player.x - x;
        const dy = player.y - y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        for (let k = 0; k < 3; k++) {
          addEnemyBullet(x + (k - 1) * 10, y, ux * speed, uy * speed, cfg.color, 6);
        }
      } else {
        // 扇形弹幕
        const n = 7;
        for (let i = 0; i < n; i++) {
          const ang = Math.PI * 0.2 + (Math.PI * 0.6) * (i / (n - 1));
          addEnemyBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, cfg.color, 6);
        }
      }
    }
  }

  function enemyTryShoot(e) {
    if (e.y < 10 || e.y > H * 0.82) return;
    const key = e.isStageBoss ? 'stageBoss' : e.kind;
    const cfg = ENEMY_FIRE[key];
    if (!cfg) return;
    e.shootCd = (e.shootCd ?? cfg.interval) - 1;
    if (e.shootCd > 0) return;
    const intervalMul = Math.max(0.55, 1 - stageIndex * 0.08);
    e.shootCd = Math.floor(cfg.interval * intervalMul * rand(0.85, 1.1));
    fireEnemyPattern(e, cfg);
  }

  function spawnPowerUp(x, y, force = false) {
    killsSinceDrop++;
    const pity = killsSinceDrop >= 4 || framesSinceDrop >= 60 * 7;
    // 普通掉落约 40%；保底必掉，避免后期长时间没胶囊
    if (!force && !pity && Math.random() > 0.4) return;

    killsSinceDrop = 0;
    framesSinceDrop = 0;

    // 武器胶囊更常见；保底时优先武器
    const utilityChance = pity ? 0.18 : 0.28;
    if (Math.random() < utilityChance) {
      const pu = pickWeighted(UTILITY_DROPS);
      powerups.push({ kind: pu.kind, x, y, size: 30, emoji: pu.emoji, speed: 1.25 });
    } else {
      const drop = pickWeighted(BULLET_DROPS);
      const w = WEAPONS[drop.weapon];
      const sameType = drop.weapon === currentWeapon;
      const nextLv = sameType ? Math.min(MAX_WEAPON_LEVEL, weaponLevel + 1) : 1;
      powerups.push({
        kind: 'bullet',
        weapon: drop.weapon,
        x,
        y,
        size: 34,
        color: w.color,
        accent: w.accent,
        letter: w.letter,
        label: sameType ? `↑${nextLv}` : '换',
        isSwitch: !sameType,
        speed: 1.3,
        bob: rand(0, Math.PI * 2),
      });
    }
  }

  function spawnLightningWarning() {
    Sound.lightningWarn();
    lightnings.push({
      x: rand(LIGHTNING_WIDTH / 2 + 20, W - LIGHTNING_WIDTH / 2 - 20),
      phase: 'warn',
      startFrame: frame,
      hitPlayer: false,
      boltPath: null,
    });
  }

  function buildBoltPath(x, width) {
    const points = [{ x, y: 0 }];
    let px = x;
    let y = 0;
    while (y < H) {
      y += rand(20, 32);
      px = x + rand(-width / 3, width / 3);
      points.push({ x: px, y: Math.min(y, H) });
    }
    points.push({ x: x + rand(-8, 8), y: H });
    return points;
  }

  function addBullet(b) {
    bullets.push({
      pierce: 0,
      phase: rand(0, Math.PI * 2),
      ...b,
    });
  }

  function shootNormal(px, py) {
    const lv = weaponLevel;
    const count = lv <= 1 ? 1 : lv <= 3 ? 2 : 3;
    const spacing = 14 + lv * 2;
    const dmg = 1 + Math.floor((lv - 1) / 2);
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      addBullet({
        type: 'normal',
        x: px + (start + i) * spacing,
        y: py,
        w: 4 + Math.floor(lv / 3),
        h: 12 + lv,
        speed: 11 + lv * 0.5,
        dmg,
        color: WEAPONS.normal.color,
        accent: WEAPONS.normal.accent,
      });
    }
  }

  function shootLaser(px, py) {
    const lv = weaponLevel;
    addBullet({
      type: 'laser',
      x: px,
      y: py,
      w: 4 + lv * 1.6,
      h: 22 + lv * 6,
      speed: 15 + lv,
      dmg: 1 + Math.floor(lv / 2) + 1,
      pierce: lv + 1,
        color: WEAPONS.laser.color,
        accent: WEAPONS.laser.accent,
    });
  }

  function shootSpread(px, py) {
    const lv = weaponLevel;
    const count = 2 + lv;
    const maxAngle = 0.15 + lv * 0.12;
    const dmg = 1 + Math.floor(lv / 3);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const angle = t * maxAngle;
      addBullet({
        type: 'spread',
        x: px,
        y: py,
        w: 5,
        h: 10,
        speed: 9 + lv * 0.4,
        dmg,
        angle,
        color: WEAPONS.spread.color,
        accent: WEAPONS.spread.accent,
      });
    }
  }

  function shootPlasma(px, py) {
    const lv = weaponLevel;
    const count = lv <= 2 ? 1 : lv <= 4 ? 2 : 3;
    const spacing = 22;
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      addBullet({
        type: 'plasma',
        x: px + (start + i) * spacing,
        y: py,
        w: 14 + lv * 2.5,
        h: 14 + lv * 2.5,
        speed: 6.5 + lv * 0.35,
        dmg: 3 + lv,
        color: WEAPONS.plasma.color,
        accent: WEAPONS.plasma.accent,
      });
    }
  }

  function shootWave(px, py) {
    const lv = weaponLevel;
    const count = Math.min(lv, 3);
    const spacing = 16;
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      addBullet({
        type: 'wave',
        x: px + (start + i) * spacing,
        y: py,
        w: 6,
        h: 6,
        speed: 8 + lv * 0.5,
        dmg: 1 + Math.floor(lv / 2),
        waveAmp: 2 + lv * 0.8,
        phase: i * 1.2,
        color: WEAPONS.wave.color,
        accent: WEAPONS.wave.accent,
      });
    }
  }

  function shootChain(px, py) {
    const lv = weaponLevel;
    const count = lv >= 4 ? 2 : 1;
    const spacing = 16;
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      addBullet({
        type: 'chain',
        x: px + (start + i) * spacing,
        y: py,
        w: 10 + lv,
        h: 18 + lv * 2,
        speed: 13 + lv * 0.4,
        dmg: 3 + lv,
        chainsLeft: 2 + lv,
        chainRange: 130 + lv * 28,
        color: WEAPONS.chain.color,
        accent: WEAPONS.chain.accent,
      });
    }
  }

  function shoot() {
    if (bullets.length >= MAX_BULLETS) return;
    const px = player.x;
    const py = player.y - player.h / 2;
    switch (currentWeapon) {
      case 'normal': shootNormal(px, py); break;
      case 'laser': shootLaser(px, py); break;
      case 'spread': shootSpread(px, py); break;
      case 'plasma': shootPlasma(px, py); break;
      case 'wave': shootWave(px, py); break;
      case 'chain': shootChain(px, py); break;
      default: break;
    }
    Sound.shoot(currentWeapon);
  }

  function spawnParticles(x, y, color, count = 8) {
    if (particles.length >= MAX_PARTICLES) return;
    const n = Math.min(count, MAX_PARTICLES - particles.length);
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-4, 4),
        vy: rand(-4, 4),
        life: rand(15, 35),
        maxLife: 35,
        size: rand(2, 6),
        color,
      });
    }
  }

  function addFloatText(x, y, text, color = '#ffe066') {
    if (floatTexts.length >= MAX_FLOAT_TEXTS) floatTexts.shift();
    floatTexts.push({ x, y, text, color, life: 50, maxLife: 50 });
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0e27');
    grad.addColorStop(0.45, '#141b3d');
    grad.addColorStop(1, '#1a1040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const c of stormClouds) {
      ctx.save();
      ctx.globalAlpha = c.opacity;
      const cg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.w);
      cg.addColorStop(0, '#3a4a7a');
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.w * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      c.x += c.speed;
      if (c.x - c.w > W) {
        c.x = -c.w;
        c.y = rand(20, 200);
      }
    }

    ctx.strokeStyle = 'rgba(100, 140, 255, 0.04)';
    ctx.lineWidth = 1;
    const scroll = (frame * 0.5) % 40;
    for (let y = -scroll; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawLightningBolt(path, width, alpha) {
    if (!path || path.length < 2) return;
    ctx.save();
    ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cx = path[0].x;
    ctx.fillStyle = `rgba(120, 180, 255, ${alpha * 0.22})`;
    ctx.fillRect(cx - width / 2, 0, width, H);
    ctx.restore();
  }

  function drawLightnings() {
    for (const lt of lightnings) {
      const elapsed = frame - lt.startFrame;

      if (lt.phase === 'warn') {
        const pulse = 0.35 + Math.sin(frame * 0.3) * 0.25;
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 100, ${0.08 + pulse * 0.12})`;
        ctx.fillRect(lt.x - LIGHTNING_WIDTH / 2, 0, LIGHTNING_WIDTH, H);
        ctx.strokeStyle = `rgba(255, 240, 80, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(lt.x - LIGHTNING_WIDTH / 2 + 2, 2, LIGHTNING_WIDTH - 4, H - 4);
        ctx.setLineDash([]);
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', lt.x, 36);
        ctx.font = 'bold 13px "Noto Sans SC", sans-serif';
        ctx.fillStyle = '#ffe066';
        ctx.fillText('闪电!', lt.x, 58);
        ctx.restore();
      } else {
        const strikeElapsed = elapsed - LIGHTNING_WARN_FRAMES;
        const alpha = Math.max(0, 1 - strikeElapsed / LIGHTNING_STRIKE_FRAMES);
        drawLightningBolt(lt.boltPath, LIGHTNING_WIDTH, alpha);
      }
    }
  }

  function drawPlayer() {
    const { x, y, w, h } = player;
    ctx.save();

    if (hasShield()) {
      const pulse = Math.sin(frame * 0.2) * 0.1 + 0.9;
      const bombProt = frame < bombIFrameUntil;
      const remaining = bombProt ? (bombIFrameUntil - frame) : (shieldUntil - frame);
      ctx.beginPath();
      ctx.arc(x, y, w * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = bombProt
        ? `rgba(255, 220, 100, ${0.18 * pulse})`
        : `rgba(100, 200, 255, ${0.15 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = bombProt
        ? `rgba(255, 230, 120, ${0.8 * pulse})`
        : `rgba(120, 220, 255, ${0.7 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = bombProt ? '#ffe066' : '#88ccff';
      ctx.textAlign = 'center';
      ctx.fillText(
        bombProt ? `💣${Math.ceil(remaining / 60)}s` : `🛡️${Math.ceil(remaining / 60)}s`,
        x,
        y - w * 0.9
      );
    }

    ctx.translate(x, y);

    const wp = WEAPONS[currentWeapon];
    ctx.shadowColor = wp.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = wp.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 4, h / 4);
    ctx.lineTo(-w / 2 - 10, h / 2);
    ctx.lineTo(-w / 2, h / 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 + 4, h / 4);
    ctx.lineTo(w / 2 + 10, h / 2);
    ctx.lineTo(w / 2, h / 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#2244aa';
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(0, h / 3);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#88aaff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 12;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✈️', 0, 0);

    ctx.restore();
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.type === 'laser') {
        const rot = b.angle || 0;
        if (rot) ctx.rotate(rot);
        const hw = b.w / 2;
        const hh = b.h / 2;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 22;
        const outer = ctx.createLinearGradient(0, hh, 0, -hh);
        outer.addColorStop(0, 'rgba(255,255,255,0.95)');
        outer.addColorStop(0.35, b.color);
        outer.addColorStop(1, 'rgba(255,50,80,0.15)');
        ctx.fillStyle = outer;
        ctx.fillRect(-hw, -hh, b.w, b.h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(-Math.max(1, b.w * 0.15), -hh, Math.max(2, b.w * 0.3), b.h);
      } else if (b.type === 'spread') {
        const rot = b.angle ? -b.angle : 0;
        ctx.rotate(rot);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.w * 0.55, b.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8cc';
        ctx.beginPath();
        ctx.arc(0, -b.h * 0.15, b.w * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, b.h * 0.35, b.w * 0.35, b.h * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'plasma') {
        const r = b.w / 2;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 24;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.35, b.color);
        g.addColorStop(1, 'rgba(100,0,200,0.1)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.2 + b.phase) * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
        ctx.stroke();
      } else if (b.type === 'wave') {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        for (let t = 0; t < 4; t++) {
          ctx.arc(0, t * 7, b.w * 0.35, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, b.w * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(0, 0, b.w * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'chain') {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        const pulse = 0.75 + Math.sin(frame * 0.4 + b.phase) * 0.25;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.moveTo(0, b.h / 2);
        ctx.lineTo(-5, b.h * 0.1);
        ctx.lineTo(4, -b.h * 0.15);
        ctx.lineTo(-3, -b.h * 0.4);
        ctx.lineTo(0, -b.h / 2);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, b.h / 3);
        ctx.lineTo(2, -b.h * 0.1);
        ctx.lineTo(-1, -b.h / 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e6c0ff';
        ctx.beginPath();
        ctx.arc(0, -b.h / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(0, -b.h / 2);
        ctx.lineTo(b.w / 2, b.h / 2);
        ctx.lineTo(-b.w / 2, b.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(-b.w * 0.15, -b.h * 0.3, b.w * 0.3, b.h * 0.5);
      }

      ctx.restore();
    }
  }

  function drawEnemy(e) {
    ctx.save();
    const sway = e.isStageBoss ? Math.sin(frame * 0.04) * 4 : Math.sin(e.wobble + frame * 0.05) * 8;
    ctx.translate(e.x + sway, e.y);

    if (e.isStageBoss) {
      ctx.shadowColor = 'rgba(200, 80, 255, 0.7)';
      ctx.shadowBlur = 22;
      const aura = e.size * 0.7;
      const grd = ctx.createRadialGradient(0, 0, 8, 0, 0, aura);
      grd.addColorStop(0, 'rgba(200, 120, 255, 0.35)');
      grd.addColorStop(1, 'rgba(80, 40, 160, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, aura, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `${e.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = e.isStageBoss ? 'rgba(220, 100, 255, 0.8)' : 'rgba(150, 100, 255, 0.5)';
    ctx.shadowBlur = e.isStageBoss ? 16 : 10;
    ctx.fillText(e.emoji, 0, 0);

    if (e.maxHp > 1 && !e.isStageBoss) {
      const barW = e.size * 0.8;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-barW / 2, -e.size / 2 - 10, barW, 4);
      ctx.fillStyle = '#ff6644';
      ctx.fillRect(-barW / 2, -e.size / 2 - 10, barW * (e.hp / e.maxHp), 4);
    }
    ctx.restore();
  }

  function drawChainArcs() {
    for (const a of chainArcs) {
      const t = a.life / a.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = WEAPONS.chain.color;
      ctx.shadowColor = WEAPONS.chain.accent;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const mx = (a.x1 + a.x2) / 2 + Math.sin(frame * 0.8) * 10;
      const my = (a.y1 + a.y2) / 2 + Math.cos(frame * 0.7) * 8;
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = t * 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(mx, my);
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBossHud() {
    const boss = enemies.find((e) => e.isStageBoss);
    if (!boss) return;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const barW = W - 48;
    const x = 24;
    const y = 16;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - 4, y - 4, barW + 8, 28);
    ctx.fillStyle = '#2a1040';
    ctx.fillRect(x, y + 10, barW, 10);
    const grd = ctx.createLinearGradient(x, 0, x + barW, 0);
    grd.addColorStop(0, '#ff66aa');
    grd.addColorStop(0.5, '#cc66ff');
    grd.addColorStop(1, '#8866ff');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y + 10, barW * ratio, 10);
    ctx.strokeStyle = '#e6c0ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y + 10, barW, 10);
    ctx.font = 'bold 13px "ZCOOL KuaiLe", cursive';
    ctx.fillStyle = '#ffe066';
    ctx.textAlign = 'left';
    ctx.fillText(`BOSS ${boss.name}`, x, y + 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, x + barW, y + 8);
    ctx.restore();
  }

  function drawPowerUp(p) {
    ctx.save();
    const bob = Math.sin(frame * 0.08 + (p.bob || 0)) * 3;
    ctx.translate(p.x, p.y + bob);

    if (p.kind === 'bullet') {
      const w = WEAPONS[p.weapon];
      const pulse = 0.7 + Math.sin(frame * 0.12 + (p.bob || 0)) * 0.3;

      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.fillRect(-18, -14, 36, 28);
      ctx.strokeRect(-18, -14, 36, 28);

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16 * pulse;
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🦅', 0, -3);

      ctx.shadowBlur = 0;
      ctx.font = 'bold 12px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = p.color;
      ctx.fillText(w.name, 0, 14);

      ctx.font = 'bold 10px "Noto Sans SC", sans-serif';
      ctx.fillStyle = p.isSwitch ? '#ff8866' : p.color;
      ctx.fillText(p.isSwitch ? `[换] Lv.1` : `[升] →${p.label.replace('↑', '')}`, 0, -18);

      const lvPreview = p.isSwitch ? 1 : parseInt(String(p.label).replace('↑', ''), 10) || 1;
      ctx.fillStyle = p.accent || p.color;
      ctx.fillRect(-14, 16, 28, 3);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-14, 16, 28 * (lvPreview / MAX_WEAPON_LEVEL), 3);
    } else {
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 220, 100, 0.7)';
      ctx.shadowBlur = 14;
      ctx.fillText(p.emoji, 0, 0);
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    for (const t of floatTexts) {
      ctx.globalAlpha = t.life / t.maxLife;
      ctx.font = 'bold 20px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y - (t.maxLife - t.life) * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function updatePlayer() {
    const speed = 6;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.targetX -= speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.targetX += speed;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) player.targetY -= speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) player.targetY += speed;

    if (pointerX !== null) player.targetX = pointerX;
    if (pointerY !== null) player.targetY = pointerY;

    const margin = player.w / 2 + 4;
    player.targetX = Math.max(margin, Math.min(W - margin, player.targetX));
    player.targetY = Math.max(H * 0.35, Math.min(H - margin - 10, player.targetY));
    player.x += (player.targetX - player.x) * 0.3;
    player.y += (player.targetY - player.y) * 0.3;
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
  }

  function takeDamage(x, y, label) {
    if (frame < hitIFrameUntil) return;
    if (hasShield()) {
      spawnParticles(x, y, '#88ccff', 14);
      addFloatText(x, y - 20, '🛡️ 护盾!', '#66bbff');
      Sound.shield();
      hitIFrameUntil = frame + 12;
      return;
    }
    lives--;
    hitIFrameUntil = frame + HIT_IFRAME;
    spawnParticles(x, y, '#ff4400', 16);
    addFloatText(x, y - 20, label, '#ff6644');
    Sound.damage();
    canvas.parentElement.classList.add('shake');
    setTimeout(() => canvas.parentElement.classList.remove('shake'), 350);
    updateHUD();
    if (lives <= 0) offerReviveOrGameOver();
  }

  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  /** 连加连减：如 8 + 3 - 5 + 2 */
  function generateReviveQuiz() {
    let value = randInt(4, 12);
    let expr = String(value);
    const steps = randInt(3, 4);
    for (let i = 0; i < steps; i++) {
      const n = randInt(1, 9);
      let op;
      if (value - n >= 0 && (value + n > 24 || Math.random() < 0.48)) op = '-';
      else op = '+';
      if (op === '+' && value + n > 24 && value - n >= 0) op = '-';
      if (op === '+') value += n;
      else value -= n;
      expr += ` ${op} ${n}`;
    }
    return { expression: `${expr} = ?`, answer: value };
  }

  function offerReviveOrGameOver() {
    if (revivesLeft > 0) {
      showReviveQuiz();
    } else {
      gameOver();
    }
  }

  function showReviveQuiz() {
    state = 'revive';
    reviveQuiz = generateReviveQuiz();
    if ($reviveExpr) $reviveExpr.textContent = reviveQuiz.expression;
    if ($reviveAnswer) {
      $reviveAnswer.value = '';
      $reviveAnswer.classList.remove('wrong');
    }
    if ($reviveFeedback) {
      $reviveFeedback.textContent = '';
      $reviveFeedback.classList.remove('ok');
    }
    const $hint = document.querySelector('.revive-hint');
    if ($hint) {
      $hint.textContent = `答对连加连减题即可复活（本局还剩 ${revivesLeft} 次机会）`;
    }
    $overlayPause.classList.add('hidden');
    $overlayGameover.classList.add('hidden');
    $overlayRevive.classList.remove('hidden');
    if (window.Sound) Sound.pauseBgm();
    updateHUD();
    setTimeout(() => $reviveAnswer && $reviveAnswer.focus(), 80);
  }

  function hideReviveQuiz() {
    $overlayRevive.classList.add('hidden');
    reviveQuiz = null;
  }

  function revivePlayer() {
    revivesLeft = Math.max(0, revivesLeft - 1);
    hideReviveQuiz();
    lives = REVIVE_LIVES;
    bombIFrameUntil = frame + REVIVE_IFRAME;
    hitIFrameUntil = frame + REVIVE_IFRAME;
    // 清掉贴身威胁与敌弹，给喘息空间
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.isStageBoss) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) < 180) {
        enemies.splice(i, 1);
      }
    }
    enemyBullets = [];
    lightnings = [];
    spawnParticles(player.x, player.y, '#88ffaa', 20);
    addFloatText(player.x, player.y - 40, '复活成功!', '#66ff99');
    addFloatText(player.x, player.y - 18, `❤️×${REVIVE_LIVES} · 剩${revivesLeft}次`, '#ff6688');
    state = 'playing';
    updateHUD();
    if (window.Sound) {
      Sound.resumeBgm();
      Sound.levelUp();
    }
    requestAnimationFrame(gameLoop);
  }

  function failRevive(msg) {
    if ($reviveFeedback) {
      $reviveFeedback.textContent = msg || '回答错误';
      $reviveFeedback.classList.remove('ok');
    }
    revivesLeft = 0;
    setTimeout(() => {
      hideReviveQuiz();
      gameOver();
    }, 650);
  }

  function killEnemy(e, drop = true) {
    Sound.explode();
    score += e.points;
    spawnParticles(e.x, e.y, e.isStageBoss ? '#ff66ff' : '#ffaa44', e.isStageBoss ? 28 : 12);
    addFloatText(e.x, e.y, `+${e.points}`, '#ffe066');
    if (drop) spawnPowerUp(e.x, e.y, e.isStageBoss);
    if (e.isStageBoss) {
      onStageBossDefeated(e);
    }
    updateHUD();
  }

  function addChainArc(x1, y1, x2, y2) {
    chainArcs.push({ x1, y1, x2, y2, life: 14, maxLife: 14 });
  }

  /** 紫色链弹：命中后向附近敌人跳跃传导 */
  function chainJumpFrom(from, dmg, chainsLeft, range, hitSet) {
    if (chainsLeft <= 0) return;
    let nearest = null;
    let nearestDist = range;
    for (const other of enemies) {
      if (hitSet.has(other) || other.hp <= 0) continue;
      const d = Math.hypot(other.x - from.x, other.y - from.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = other;
      }
    }
    if (!nearest) return;

    hitSet.add(nearest);
    addChainArc(from.x, from.y, nearest.x, nearest.y);
    nearest.hp -= dmg;
    spawnParticles(nearest.x, nearest.y, WEAPONS.chain.color, 10);
    addFloatText(nearest.x, nearest.y - 8, '⚡链!', WEAPONS.chain.color);

    if (nearest.hp <= 0) {
      killEnemy(nearest);
      const idx = enemies.indexOf(nearest);
      if (idx >= 0) enemies.splice(idx, 1);
    } else {
      Sound.hit();
    }
    chainJumpFrom(nearest, Math.max(2, dmg - 1), chainsLeft - 1, range, hitSet);
  }

  function damageEnemy(e, dmg, bx, by, bullet) {
    e.hp -= dmg;
    spawnParticles(bx, by, bullet?.color || '#aaddff', 4);

    if (bullet?.type === 'chain' && bullet.chainsLeft > 0) {
      const hitSet = new Set([e]);
      chainJumpFrom(e, bullet.dmg, bullet.chainsLeft, bullet.chainRange, hitSet);
    }

    if (e.hp > 0) {
      Sound.hit();
      return false;
    }

    killEnemy(e);
    return true;
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.type === 'spread' && b.angle) {
        b.x += Math.sin(b.angle) * b.speed;
        b.y -= Math.cos(b.angle) * b.speed;
      } else {
        b.y -= b.speed;
        if (b.angle) {
          b.x += Math.sin(b.angle) * b.speed * 0.85;
        }
      }
      if (b.type === 'wave') {
        b.phase += 0.14;
        b.x += Math.sin(b.phase) * b.waveAmp;
      }

      if (b.y < -30 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
        continue;
      }

      let bulletRemoved = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const hitW = b.type === 'plasma' ? b.w : b.w;
        const hitH = b.type === 'plasma' ? b.w : b.h;
        if (!rectsOverlap(b.x, b.y, hitW, hitH, e.x, e.y, e.size * 0.7, e.size * 0.7)) continue;

        const killed = damageEnemy(e, b.dmg, b.x, b.y, b);
        if (killed) enemies.splice(j, 1);

        if (b.type === 'laser' && b.pierce > 1) {
          b.pierce--;
        } else {
          bullets.splice(i, 1);
          bulletRemoved = true;
        }
        break;
      }
      if (bulletRemoved) continue;
    }
  }

  function fireBomb() {
    if (state !== 'playing') return;
    if (bombs <= 0 || frame < bombCooldownUntil) return;

    bombs--;
    bombCooldownUntil = frame + 40;
    bombIFrameUntil = frame + BOMB_IFRAME;
    bombFx = {
      x: player.x,
      y: player.y,
      startFrame: frame,
      cleared: false,
    };
    Sound.bomb();
    addFloatText(player.x, player.y - 40, '💣 BOMB!', '#ffee88');
    updateHUD();
  }

  function updateBombFx() {
    if (!bombFx) return;
    const elapsed = frame - bombFx.startFrame;
    const progress = elapsed / BOMB_FX_FRAMES;

    // 雷电式全屏清场；关卡 Boss 只削大血，不秒杀
    if (!bombFx.cleared && progress >= 0.15) {
      bombFx.cleared = true;
      let cleared = 0;
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.isStageBoss) {
          const dmg = Math.max(12, Math.floor(e.maxHp * 0.28));
          e.hp -= dmg;
          spawnParticles(e.x, e.y, '#ffee88', 16);
          addFloatText(e.x, e.y - 20, `💣 -${dmg}`, '#ffee88');
          if (e.hp <= 0) {
            killEnemy(e, true);
            enemies.splice(i, 1);
          }
          continue;
        }
        score += e.points;
        cleared += e.points;
        spawnParticles(e.x, e.y, '#ffee88', 10);
        spawnPowerUp(e.x, e.y);
        enemies.splice(i, 1);
      }
      lightnings = [];
      enemyBullets = [];
      if (cleared > 0) {
        addFloatText(W / 2, H * 0.4, `清场 +${cleared}`, '#ffe066');
      }
      updateHUD();
    }

    if (elapsed >= BOMB_FX_FRAMES) bombFx = null;
  }

  function drawBombFx() {
    if (!bombFx) return;
    const elapsed = frame - bombFx.startFrame;
    const t = elapsed / BOMB_FX_FRAMES;
    const maxR = Math.hypot(W, H) * 0.75;
    const r = maxR * Math.min(1, t * 1.35);

    ctx.save();
    // 全屏闪白
    const flash = t < 0.2 ? (1 - t / 0.2) * 0.55 : Math.max(0, 0.2 - t) * 0.4;
    if (flash > 0) {
      ctx.fillStyle = `rgba(200, 230, 255, ${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 扩散光环（雷电经典多层环）
    for (let i = 0; i < 4; i++) {
      const rr = r * (0.55 + i * 0.15);
      const alpha = Math.max(0, 0.7 - t - i * 0.1);
      ctx.beginPath();
      ctx.arc(bombFx.x, bombFx.y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120, 200, 255, ${alpha})`;
      ctx.lineWidth = 10 - i * 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bombFx.x, bombFx.y, rr * 0.92, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 220, ${alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 中心能量球
    const core = Math.max(0, 1 - t * 1.5);
    if (core > 0) {
      const grd = ctx.createRadialGradient(bombFx.x, bombFx.y, 0, bombFx.x, bombFx.y, 80 * core);
      grd.addColorStop(0, `rgba(255, 255, 255, ${0.9 * core})`);
      grd.addColorStop(0.4, `rgba(120, 200, 255, ${0.5 * core})`);
      grd.addColorStop(1, 'rgba(80, 140, 255, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(bombFx.x, bombFx.y, 80 * core, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function spawnStageBoss() {
    const s = stageCfg();
    const b = s.boss;
    const hp = Math.floor(b.hp * bossHpScale);
    const fire = ENEMY_FIRE.stageBoss;
    enemies.push({
      kind: 'stageBoss',
      isStageBoss: true,
      name: b.name,
      x: W / 2,
      y: -b.size,
      size: b.size,
      emoji: b.emoji,
      hp,
      maxHp: hp,
      points: Math.floor(b.points * bossHpScale),
      speed: b.speed,
      wobble: 0,
      vx: b.speed * 1.2,
      targetY: 120,
      shootCd: Math.floor(fire.interval * 0.8),
      shotIndex: 0,
    });
    addFloatText(W / 2, H * 0.35, `⚠ ${b.name}`, '#ff66ff');
    Sound.levelUp();
  }

  function onStageBossDefeated(boss) {
    stagePhase = 'clear';
    stageFrame = 0;
    addFloatText(W / 2, H / 2 - 16, '关卡完成!', '#ffe066');
    addFloatText(W / 2, H / 2 + 14, `${boss.name || 'Boss'} 击破`, '#c88cff');
    if (bombs < MAX_BOMBS) bombs++;
    spawnPowerUp(boss.x, boss.y, true);
    spawnPowerUp(boss.x - 30, boss.y + 20, true);
    updateHUD();
  }

  function advanceStage() {
    if (stageCfg().endless) {
      // 最终关循环加强：再来一轮更硬的 Boss
      stagePhase = 'wave';
      stageFrame = 0;
      bossHpScale *= 1.18;
      addFloatText(W / 2, H / 2, '最终关 · 下一波!', '#ff8866');
      Sound.levelUp();
      updateHUD();
      return;
    }
    stageIndex++;
    stagePhase = 'wave';
    stageFrame = 0;
    const s = stageCfg();
    nextLightningFrame = frame + rand(s.lightningMin, s.lightningMax);
    addFloatText(W / 2, H / 2 - 10, `第 ${s.id} 关`, '#ffe066');
    addFloatText(W / 2, H / 2 + 18, s.name, '#88ccff');
    Sound.levelUp();
    if (bombs < MAX_BOMBS) bombs++;
    updateHUD();
  }

  function updateEnemies() {
    const s = stageCfg();

    if (stagePhase === 'wave') {
      if (frame % s.spawnInterval === 0) spawnEnemy();
      if (s.extraSpawn > 0 && frame % (s.spawnInterval + 12) === 0 && Math.random() < s.extraSpawn) {
        spawnEnemy();
      }
    } else if (stagePhase === 'boss' && !hasStageBoss()) {
      // Boss 已死但状态未切时兜底
      stagePhase = 'clear';
      stageFrame = 0;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.wobble += 0.04;

      if (e.isStageBoss) {
        if (e.y < e.targetY) e.y += Math.min(e.speed * 1.5, e.targetY - e.y);
        else {
          e.x += e.vx;
          if (e.x < e.size * 0.6 || e.x > W - e.size * 0.6) e.vx *= -1;
          e.y = e.targetY + Math.sin(frame * 0.04) * 18;
        }
      } else {
        e.y += e.speed;
      }

      enemyTryShoot(e);

      if (rectsOverlap(player.x, player.y, player.w * 0.7, player.h * 0.7, e.x, e.y, e.size * 0.65, e.size * 0.65)) {
        takeDamage(e.x, e.y, e.isStageBoss ? '💥 Boss撞击!' : '💥 撞击!');
        spawnParticles(e.x, e.y, '#ff6644', 14);
        if (!e.isStageBoss) enemies.splice(i, 1);
        if (state !== 'playing') return;
        continue;
      }

      if (!e.isStageBoss && e.y - e.size > H + 20) enemies.splice(i, 1);
    }
  }

  function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) {
        enemyBullets.splice(i, 1);
        continue;
      }
      if (rectsOverlap(player.x, player.y, player.w * 0.55, player.h * 0.55, b.x, b.y, b.r * 2, b.r * 2)) {
        enemyBullets.splice(i, 1);
        takeDamage(b.x, b.y, '💥 中弹!');
        if (state !== 'playing') return;
      }
    }
  }

  function drawEnemyBullets() {
    for (const b of enemyBullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(-b.r * 0.2, -b.r * 0.2, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function updatePowerups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.speed;

      if (rectsOverlap(player.x, player.y, player.w * 0.8, player.h * 0.8, p.x, p.y, p.size, p.size)) {
        if (p.kind === 'bullet') {
          upgradeWeapon(p.weapon);
        } else switch (p.kind) {
          case 'heart':
            lives++;
            addFloatText(p.x, p.y, '+1 ❤️', '#ff4757');
            Sound.powerup();
            break;
          case 'shield':
            shieldUntil = frame + SHIELD_DURATION;
            addFloatText(p.x, p.y, '🛡️ 护盾 5s!', '#66bbff');
            Sound.shield();
            break;
          case 'bomb':
            if (bombs >= MAX_BOMBS) {
              score += 20;
              addFloatText(p.x, p.y, '炸弹已满 +20', '#ffee88');
            } else {
              bombs++;
              addFloatText(p.x, p.y, '💣 +1', '#ffee88');
            }
            Sound.powerup();
            break;
        }
        spawnParticles(p.x, p.y, p.color || '#ffe066', 10);
        powerups.splice(i, 1);
        updateHUD();
        continue;
      }

      if (p.y - p.size > H + 20) powerups.splice(i, 1);
    }
  }

  function updateLightnings() {
    const s = stageCfg();
    if (frame >= nextLightningFrame) {
      spawnLightningWarning();
      nextLightningFrame = frame + rand(s.lightningMin, s.lightningMax);
    }

    for (let i = lightnings.length - 1; i >= 0; i--) {
      const lt = lightnings[i];
      const elapsed = frame - lt.startFrame;

      if (lt.phase === 'warn' && elapsed >= LIGHTNING_WARN_FRAMES) {
        lt.phase = 'strike';
        lt.startFrame = frame;
        lt.boltPath = buildBoltPath(lt.x, LIGHTNING_WIDTH);
        Sound.lightningStrike();
      }

      if (lt.phase === 'strike') {
        const strikeElapsed = frame - lt.startFrame;
        if (!lt.hitPlayer && strikeElapsed < LIGHTNING_STRIKE_FRAMES) {
          if (Math.abs(player.x - lt.x) < (LIGHTNING_WIDTH + player.w) / 2) {
            lt.hitPlayer = true;
            takeDamage(player.x, player.y, '⚡ 闪电!');
            if (state !== 'playing') return;
          }
        }
        if (strikeElapsed >= LIGHTNING_STRIKE_FRAMES) {
          lightnings.splice(i, 1);
        }
      } else if (lt.phase === 'warn' && elapsed > LIGHTNING_WARN_FRAMES + LIGHTNING_STRIKE_FRAMES + 30) {
        lightnings.splice(i, 1);
      }
    }
  }

  function updateStage() {
    stageFrame++;
    framesSinceDrop++;

    if (stagePhase === 'wave') {
      const s = stageCfg();
      if (stageFrame >= s.waveFrames) {
        stagePhase = 'bossWarn';
        stageFrame = 0;
        addFloatText(W / 2, H / 2, '⚠ BOSS 来袭!', '#ff66ff');
        Sound.lightningWarn();
      }
    } else if (stagePhase === 'bossWarn') {
      if (stageFrame >= 90) {
        // 清掉杂兵，专注 Boss
        for (let i = enemies.length - 1; i >= 0; i--) {
          if (!enemies[i].isStageBoss) enemies.splice(i, 1);
        }
        stagePhase = 'boss';
        stageFrame = 0;
        spawnStageBoss();
      }
    } else if (stagePhase === 'clear') {
      if (stageFrame >= 120) {
        advanceStage();
      }
    }
  }

  function gameOver() {
    state = 'gameover';
    hideReviveQuiz();
    Sound.gameOver();
    $finalScore.textContent = score;
    const isNew = score > highScore;
    if (isNew) {
      highScore = score;
      localStorage.setItem('thunderStrikeHigh', String(highScore));
      $highscore.textContent = highScore;
      $newRecord.classList.remove('hidden');
    } else {
      $newRecord.classList.add('hidden');
    }
    $overlayGameover.classList.remove('hidden');
    updateHUD();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateFloatTexts() {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      floatTexts[i].life--;
      if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
    }
  }

  function gameLoop() {
    if (state !== 'playing') return;

    frame++;
    shootTimer++;
    if (shootTimer >= SHOOT_INTERVAL) {
      shootTimer = 0;
      shoot();
    }

    drawBackground();
    updatePlayer();
    updateBullets();
    updateEnemies();
    if (state !== 'playing') return;
    updateEnemyBullets();
    if (state !== 'playing') return;
    updatePowerups();
    updateLightnings();
    if (state !== 'playing') return;
    updateBombFx();
    updateStage();
    updateParticles();
    updateFloatTexts();
    for (let i = chainArcs.length - 1; i >= 0; i--) {
      chainArcs[i].life--;
      if (chainArcs[i].life <= 0) chainArcs.splice(i, 1);
    }

    drawLightnings();
    for (const e of enemies) drawEnemy(e);
    for (const p of powerups) drawPowerUp(p);
    drawBullets();
    drawEnemyBullets();
    drawChainArcs();
    drawPlayer();
    drawBombFx();
    drawParticles();
    drawFloatTexts();
    drawBossHud();

    requestAnimationFrame(gameLoop);
  }

  function startGame() {
    resetGame();
    initStormClouds();
    state = 'playing';
    $overlayStart.classList.add('hidden');
    $overlayGameover.classList.add('hidden');
    $overlayPause.classList.add('hidden');
    hideReviveQuiz();
    if (window.Sound) {
      // 「出击」手势：解锁并默认打开音效（除非用户明确静音过）
      Sound.unlock();
      if (localStorage.getItem('thunderStrikeSound') !== 'off') {
        Sound.setEnabled(true);
      }
      if (Sound.isEnabled()) Sound.startGame();
    }
    updateMuteBtn();
    requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (state === 'revive') return;
    if (state === 'playing') {
      state = 'paused';
      if (window.Sound) Sound.pauseBgm();
      $overlayPause.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      if (window.Sound) Sound.resumeBgm();
      $overlayPause.classList.add('hidden');
      requestAnimationFrame(gameLoop);
    }
  }

  function submitReviveAnswer(e) {
    if (e) e.preventDefault();
    if (state !== 'revive' || !reviveQuiz) return;
    const raw = ($reviveAnswer && $reviveAnswer.value || '').trim();
    if (raw === '') {
      if ($reviveFeedback) $reviveFeedback.textContent = '请输入答案';
      return;
    }
    const guess = Number(raw);
    if (!Number.isFinite(guess)) {
      if ($reviveFeedback) $reviveFeedback.textContent = '请输入数字';
      return;
    }
    if (guess === reviveQuiz.answer) {
      if ($reviveFeedback) {
        $reviveFeedback.textContent = '答对了！复活中…';
        $reviveFeedback.classList.add('ok');
      }
      setTimeout(revivePlayer, 280);
    } else {
      failRevive(`答错了，正确答案是 ${reviveQuiz.answer}`);
    }
  }

  if ($btnMute) {
    $btnMute.addEventListener('click', handleMuteClick);
  }

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', togglePause);

  if ($reviveForm) {
    $reviveForm.addEventListener('submit', submitReviveAnswer);
  }
  const $btnReviveSkip = document.getElementById('btn-revive-skip');
  if ($btnReviveSkip) {
    $btnReviveSkip.addEventListener('click', () => {
      if (state !== 'revive') return;
      failRevive('已放弃复活');
    });
  }

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (state !== 'start') {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (e.key === ' ' || e.key === 'b' || e.key === 'B' || e.key === 'z' || e.key === 'Z'
        || e.key === 'Shift') {
      if (state === 'playing') {
        e.preventDefault();
        fireBomb();
      }
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  if ($btnBomb) {
    $btnBomb.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fireBomb();
    });
    $btnBomb.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fireBomb();
    });
  }

  const rect = () => canvas.getBoundingClientRect();
  function setPointer(clientX, clientY) {
    const r = rect();
    pointerX = (clientX - r.left) * (W / r.width);
    pointerY = (clientY - r.top) * (H / r.height);
  }

  canvas.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', () => { pointerX = null; pointerY = null; });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    setPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pointerX = null; pointerY = null; });

  initStormClouds();
  updateHUD();
  updateMuteBtn();
  drawBackground();
  drawPlayer();
})();
