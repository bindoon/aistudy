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
  const HIT_IFRAME = 55;
  const MAX_ENEMY_BULLETS = 55;
  const MAX_MOB_BULLETS = 5; // 小兵弹幕软上限，保持稀疏

  const MAX_LIVES = 5;
  const MAX_WEAPON_LEVEL = 5;
  const MAX_BOMBS = 12;
  const START_BOMBS = 6;
  const BOUNCE_DURATION = 60 * 10;
  const BOUNCE_HITS = 2; // 最多撞墙弹射 2 次，避免满屏乱飞
  const MAX_MINIONS = 10;
  const SHOOT_INTERVAL = 7;
  const SHIELD_DURATION = 60 * 5;
  const BOMB_IFRAME = 60 * 1.5;
  const BOMB_FX_FRAMES = 48;
  const LIGHTNING_WARN_FRAMES = 90; // 更长预警，有时间躲开
  const LIGHTNING_STRIKE_FRAMES = 16;
  const LIGHTNING_WIDTH = 48;
  const LIGHTNING_SAFE_GAP = 110; // 闪电落点尽量离玩家当前位置远一点
  const MAX_PARTICLES = 60;
  const MAX_FLOAT_TEXTS = 12;
  const MAX_BULLETS = 90;
  const MAX_BOUNCE_BULLETS = 36; // 弹射期间限制子弹数，保帧率

  /** 同关难度稳定；战斗一段时间后出 Boss，打倒后进下一关 */
  const STAGES = [
    {
      id: 1, name: '雷云入口', waveFrames: 60 * 36, spawnInterval: 58, speedMul: 1.0, hpBonus: 0,
      lightningMin: 360, lightningMax: 520, extraSpawn: 0, enemyBias: 0,
      boss: { emoji: '🛸', name: '雷云母舰', hp: 70, size: 78, speed: 1.35, points: 400, skill: 'drones' },
    },
    {
      id: 2, name: '风暴带', waveFrames: 60 * 42, spawnInterval: 50, speedMul: 1.1, hpBonus: 1,
      lightningMin: 320, lightningMax: 460, extraSpawn: 0.15, enemyBias: 1,
      boss: { emoji: '👾', name: '风暴妖王', hp: 110, size: 84, speed: 1.5, points: 700, skill: 'imps' },
    },
    {
      id: 3, name: '雷电核心', waveFrames: 60 * 46, spawnInterval: 44, speedMul: 1.2, hpBonus: 1,
      lightningMin: 300, lightningMax: 420, extraSpawn: 0.22, enemyBias: 2,
      boss: { emoji: '🌩️', name: '雷霆巨兽', hp: 160, size: 90, speed: 1.6, points: 1000, skill: 'orbs' },
    },
    {
      id: 4, name: '深空战场', waveFrames: 60 * 50, spawnInterval: 40, speedMul: 1.3, hpBonus: 2,
      lightningMin: 280, lightningMax: 400, extraSpawn: 0.28, enemyBias: 3,
      boss: { emoji: '🐉', name: '虚空蛟龙', hp: 220, size: 96, speed: 1.75, points: 1500, skill: 'dragons' },
    },
    {
      id: 5, name: '最终决战', waveFrames: 60 * 54, spawnInterval: 36, speedMul: 1.4, hpBonus: 3,
      lightningMin: 260, lightningMax: 380, extraSpawn: 0.32, enemyBias: 4,
      boss: { emoji: '💀', name: '终焉魔神', hp: 300, size: 104, speed: 1.9, points: 2500, skill: 'reapers' },
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
    { kind: 'heart', emoji: '❤️', weight: 3 },
    { kind: 'shield', emoji: '🛡️', weight: 3 },
    { kind: 'bomb', emoji: '💣', weight: 8 },
    { kind: 'bounce', emoji: '🔮', weight: 5 },
  ];

  const ENEMIES = [
    { kind: 'scout', emoji: '🛸', hp: 1, points: 10, speed: 2.8, size: 30, weight: 40 },
    { kind: 'drone', emoji: '👾', hp: 2, points: 25, speed: 2.0, size: 34, weight: 35 },
    { kind: 'storm', emoji: '☁️', hp: 4, points: 50, speed: 1.2, size: 42, weight: 20 },
    { kind: 'boss', emoji: '🌩️', hp: 6, points: 100, speed: 0.9, size: 48, weight: 5 },
  ];

  /** 小兵稀疏开火；关底 Boss 另有弹幕（会与闪电错开） */
  const ENEMY_FIRE = {
    scout: { interval: 260, speed: 2.5, pattern: 'aim', color: '#ff8866', chance: 0.18 },
    drone: { interval: 240, speed: 2.7, pattern: 'down', color: '#ff6688', chance: 0.22 },
    storm: { interval: 280, speed: 2.4, pattern: 'down', color: '#ffaa44', chance: 0.18 },
    boss: { interval: 220, speed: 2.6, pattern: 'aim', color: '#ff5577', chance: 0.28 },
    stageBoss: { interval: 58, speed: 3.6, pattern: 'boss', color: '#ff44aa', chance: 1 },
  };

  let state = 'start';
  let currentWeapon = 'normal';
  let weaponLevel = 1;
  let score = 0;
  let lives = MAX_LIVES;
  let bombs = START_BOMBS;
  let highScore = parseInt(localStorage.getItem('thunderStrikeHigh') || '0', 10);
  let stageIndex = 0;
  let stagePhase = 'intro'; // intro | wave | bossWarn | boss | clear
  let stageFrame = 0;
  let clearBossName = '';
  let revivesLeft = MAX_REVIVES;
  let reviveQuiz = null;
  let frame = 0;
  let shieldUntil = 0;
  let bounceUntil = 0;
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

  function safeEllipse(x, y, rx, ry) {
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
    }
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
    stagePhase = 'intro';
    stageFrame = 0;
    clearBossName = '';
    revivesLeft = MAX_REVIVES;
    reviveQuiz = null;
    frame = 0;
    shieldUntil = 0;
    bounceUntil = 0;
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
      // 多枚时用数量显示，避免顶栏挤爆
      $bombs.textContent = bombs <= 4 ? '💣'.repeat(Math.max(0, bombs)) : `💣×${bombs}`;
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
      const bounceTag = hasBounce()
        ? `<span class="weapon-tag weapon-bounce">🔮 弹射 ${Math.ceil((bounceUntil - frame) / 60)}s</span>`
        : '';
      $weapons.innerHTML = `<span class="weapon-tag weapon-stage">${s.name}</span>
        <span class="weapon-tag weapon-active" style="--wc:${w.color}">
        <span class="weapon-eagle">🦅</span>
        <span class="weapon-info">${w.name} ${weaponLevel}级${maxed}</span>
        <span class="weapon-bars">${bars}</span>
      </span>${bounceTag}`;
    }
  }

  function hasBounce() {
    return frame < bounceUntil;
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
      addFloatText(player.x, player.y - 30, `🦅 ${w.name} ${weaponLevel}级!`, w.color);
      Sound.upgrade();
    } else {
      const prev = WEAPONS[currentWeapon];
      currentWeapon = type;
      weaponLevel = 1;
      bullets = [];
      addFloatText(player.x, player.y - 40, `${prev.name} → ${w.name}`, '#aaa');
      addFloatText(player.x, player.y - 18, `🦅 ${w.name} 1级重新开始!`, w.color);
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

  function addEnemyBullet(x, y, vx, vy, color = '#ff6644', r = 5, isBoss = false) {
    if (enemyBullets.length >= MAX_ENEMY_BULLETS) enemyBullets.shift();
    enemyBullets.push({ x, y, vx, vy, r, color, isBoss });
  }

  function countMobBullets() {
    let n = 0;
    for (const b of enemyBullets) if (!b.isBoss) n++;
    return n;
  }

  function aimEnemyShots(e, speed, count, color, isBoss) {
    const x = e.x;
    const y = e.y + e.size * 0.35;
    const dx = player.x - x;
    const dy = player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    if (count <= 1) {
      addEnemyBullet(x, y, ux * speed, uy * speed, color, isBoss ? 7 : 5, isBoss);
      return;
    }
    for (let k = 0; k < count; k++) {
      const side = (k - (count - 1) / 2) * 12;
      addEnemyBullet(x + side * uy, y - side * ux * 0.2, ux * speed, uy * speed, color, isBoss ? 7 : 5, isBoss);
    }
  }

  function spreadEnemyShots(e, speed, count, spread, color, isBoss) {
    const x = e.x;
    const y = e.y + e.size * 0.35;
    const mid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const ang = Math.PI / 2 + (i - mid) * spread;
      addEnemyBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, color, isBoss ? 6 : 5, isBoss);
    }
  }

  /** 向下半圆环形弹幕 */
  function ringEnemyShots(e, speed, count, color, angleOffset = 0) {
    const x = e.x;
    const y = e.y + e.size * 0.35;
    for (let i = 0; i < count; i++) {
      const ang = Math.PI * 0.12 + (Math.PI * 0.76) * (i / Math.max(1, count - 1)) + angleOffset;
      addEnemyBullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, color, 6, true);
    }
  }

  function fireEnemyPattern(e, cfg) {
    const speed = cfg.speed * (1 + stageIndex * 0.02);
    const x = e.x;
    const y = e.y + e.size * 0.35;

    if (cfg.pattern === 'down') {
      addEnemyBullet(x, y, 0, speed, cfg.color);
    } else if (cfg.pattern === 'aim') {
      aimEnemyShots(e, speed, 1, cfg.color, false);
    }
  }

  function hasActiveLightning() {
    return lightnings.length > 0;
  }

  function countMinions() {
    return enemies.filter((en) => en.isMinion).length;
  }

  /** Boss 召唤物：蛟龙放小龙、母舰放无人机等 */
  function spawnBossMinions(boss, skill) {
    if (countMinions() >= MAX_MINIONS) return;
    const configs = {
      drones: { emoji: '🛸', name: '护卫机', count: 4, hp: 2, size: 28, speed: 2.4, color: '#88aaff' },
      imps: { emoji: '👾', name: '风暴仔', count: 4, hp: 3, size: 30, speed: 2.6, color: '#ff66aa' },
      orbs: { emoji: '⚡', name: '雷球', count: 5, hp: 2, size: 26, speed: 2.8, color: '#ffe066' },
      dragons: { emoji: '🐲', name: '小蛟龙', count: 4, hp: 4, size: 38, speed: 2.9, color: '#ff8844' },
      reapers: { emoji: '👻', name: '魂魄', count: 5, hp: 3, size: 32, speed: 3.0, color: '#cc88ff' },
    };
    const cfg = configs[skill] || configs.dragons;
    const n = Math.min(cfg.count, MAX_MINIONS - countMinions());
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      enemies.push({
        kind: 'minion',
        isMinion: true,
        summonSkill: skill,
        x: boss.x + side * (36 + row * 28),
        y: boss.y + 10 + (i % 2) * 16,
        size: cfg.size,
        emoji: cfg.emoji,
        hp: cfg.hp + Math.floor(stageIndex / 2),
        maxHp: cfg.hp + Math.floor(stageIndex / 2),
        points: 35,
        speed: cfg.speed,
        wobble: rand(0, Math.PI * 2),
        shootCd: skill === 'orbs' ? 50 : 9999,
        shotIndex: 0,
        diveTimer: 20 + i * 10,
      });
    }
    addFloatText(boss.x, boss.y + boss.size * 0.55, `召唤${cfg.name}!`, cfg.color);
    spawnParticles(boss.x, boss.y + 30, cfg.color, 16);
    if (window.Sound) Sound.levelUp();
  }

  /** 关底大 Boss：弹幕 + 花哨技能；闪电预警期间停火 */
  function bossTryShoot(e) {
    const arrived = e.y >= (e.targetY || 120) - 6;
    if (!arrived) return;
    if (hasActiveLightning()) return;

    const stage = stageCfg().id;
    const skill = e.bossSkill || stageCfg().boss.skill;
    const baseInterval = Math.max(52, 78 - stage * 4);
    e.shootCd = (e.shootCd ?? baseInterval) - 1;
    if (e.shootCd > 0) return;

    e.shootCd = Math.floor(baseInterval * rand(0.9, 1.12));
    e.shotIndex = (e.shotIndex || 0) + 1;
    const speed = 3.2 + stage * 0.16;
    const color = ENEMY_FIRE.stageBoss.color;
    const phase = e.shotIndex;
    const p = phase % 5;

    // 每隔几波施放召唤技（蛟龙放龙最醒目）
    if (p === 0 || (skill === 'dragons' && phase % 3 === 0)) {
      spawnBossMinions(e, skill);
      // 召唤同时补一波弹幕
      if (skill === 'dragons') {
        ringEnemyShots(e, speed * 0.88, 6, '#ff8844', phase * 0.1);
        aimEnemyShots(e, speed * 1.1, 2, color, true);
      } else if (skill === 'orbs') {
        spreadEnemyShots(e, speed, 5, 0.25, '#ffe066', true);
      } else {
        aimEnemyShots(e, speed, 2, color, true);
      }
      return;
    }

    if (stage <= 1) {
      if (p === 2) spreadEnemyShots(e, speed, 4, 0.28, color, true);
      else aimEnemyShots(e, speed * 1.05, 2, color, true);
    } else if (stage === 2) {
      if (p === 1) ringEnemyShots(e, speed * 0.92, 6, color);
      else if (p === 2) spreadEnemyShots(e, speed, 5, 0.24, color, true);
      else aimEnemyShots(e, speed * 1.1, 2, color, true);
    } else if (stage === 3) {
      if (p === 1) ringEnemyShots(e, speed * 0.9, 7, '#ffe066', phase * 0.08);
      else if (p === 2) {
        aimEnemyShots(e, speed * 1.12, 3, color, true);
        spreadEnemyShots(e, speed * 0.9, 4, 0.3, '#ffe066', true);
      } else aimEnemyShots(e, speed, 2, color, true);
    } else if (stage === 4) {
      // 虚空蛟龙：龙息扇形 + 环射
      if (p === 1) {
        spreadEnemyShots(e, speed * 1.05, 7, 0.18, '#ff6644', true);
        addFloatText(e.x, e.y + e.size * 0.5, '龙息!', '#ff6644');
      } else if (p === 2) ringEnemyShots(e, speed * 0.92, 8, '#ff8844', phase * 0.12);
      else if (p === 3) aimEnemyShots(e, speed * 1.15, 3, color, true);
      else spreadEnemyShots(e, speed, 5, 0.26, color, true);
    } else {
      if (p === 1) ringEnemyShots(e, speed * 0.9, 8, color, phase * 0.1);
      else if (p === 2) {
        aimEnemyShots(e, speed * 1.15, 3, color, true);
        spreadEnemyShots(e, speed, 6, 0.22, '#cc88ff', true);
      } else if (p === 3) ringEnemyShots(e, speed * 0.85, 7, '#aa66ff', -phase * 0.1);
      else aimEnemyShots(e, speed * 1.1, 2, color, true);
    }
  }

  function enemyTryShoot(e) {
    if (e.isStageBoss) {
      bossTryShoot(e);
      return;
    }

    if (hasActiveLightning()) return;

    if (e.isMinion) {
      // 小龙 / 雷球会偶尔射击
      if (e.summonSkill !== 'dragons' && e.summonSkill !== 'orbs' && e.summonSkill !== 'reapers') return;
      e.shootCd = (e.shootCd ?? 80) - 1;
      if (e.shootCd > 0) return;
      e.shootCd = e.summonSkill === 'dragons' ? 100 : 75;
      const col = e.summonSkill === 'dragons' ? '#ff8844' : (e.summonSkill === 'orbs' ? '#ffe066' : '#cc88ff');
      aimEnemyShots(e, 3.0, 1, col, false);
      return;
    }

    if (e.y < 60 || e.y > H * 0.55) return;
    const cfg = ENEMY_FIRE[e.kind];
    if (!cfg) return;

    e.shootCd = (e.shootCd ?? cfg.interval) - 1;
    if (e.shootCd > 0) return;

    const intervalMul = Math.max(0.88, 1 - stageIndex * 0.025);
    e.shootCd = Math.floor(cfg.interval * intervalMul * rand(0.95, 1.25));

    if (Math.random() > (cfg.chance ?? 0.2)) return;
    if (countMobBullets() >= MAX_MOB_BULLETS) return;

    fireEnemyPattern(e, cfg);
  }

  function spawnPowerUp(x, y, force = false) {
    killsSinceDrop++;
    const pity = killsSinceDrop >= 4 || framesSinceDrop >= 60 * 7;
    // 普通掉落约 40%；保底必掉，避免后期长时间没胶囊
    if (!force && !pity && Math.random() > 0.4) return;

    killsSinceDrop = 0;
    framesSinceDrop = 0;

    // 炸弹不足时优先掉炸弹；否则道具/武器胶囊
    const needBomb = bombs <= 2;
    const utilityChance = needBomb ? 0.55 : (pity ? 0.22 : 0.3);
    if (needBomb && bombs < MAX_BOMBS && Math.random() < 0.65) {
      powerups.push({ kind: 'bomb', x, y, size: 30, emoji: '💣', speed: 1.2 });
    } else if (Math.random() < utilityChance) {
      let pu = pickWeighted(UTILITY_DROPS);
      if (needBomb && bombs < MAX_BOMBS) pu = { kind: 'bomb', emoji: '💣' };
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

  function pickLightningX() {
    const minX = LIGHTNING_WIDTH / 2 + 20;
    const maxX = W - LIGHTNING_WIDTH / 2 - 20;
    // 优先落在玩家左右外侧，给横向躲避空间，避免正砸脸上
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = player.x + side * rand(LIGHTNING_SAFE_GAP, LIGHTNING_SAFE_GAP + 120);
      if (x >= minX && x <= maxX && Math.abs(x - player.x) >= LIGHTNING_SAFE_GAP * 0.7) {
        return x;
      }
    }
    // 兜底：屏幕另一侧
    return player.x < W / 2
      ? rand(W * 0.55, maxX)
      : rand(minX, W * 0.45);
  }

  function canSpawnLightning() {
    if (hasActiveLightning()) return false;
    // Boss 战少打闪电，专注弹幕
    if (stagePhase === 'boss' && Math.random() < 0.7) return false;
    if (stagePhase !== 'wave' && stagePhase !== 'boss') return false;
    // 场上子弹太多时先别劈，避免没地方躲
    if (enemyBullets.length >= 12) return false;
    // 刚受击 / 丢炸弹无敌中，顺延
    if (frame < hitIFrameUntil || frame < bombIFrameUntil) return false;
    return true;
  }

  function spawnLightningWarning() {
    Sound.lightningWarn();
    lightnings.push({
      x: pickLightningX(),
      phase: 'warn',
      startFrame: frame,
      hitPlayer: false,
      boltPath: null,
    });
    // 预警出现时清掉玩家附近敌弹，留出躲避通道
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (Math.abs(b.x - player.x) < 70 && b.y > player.y - 180 && b.y < player.y + 40) {
        enemyBullets.splice(i, 1);
      }
    }
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
    const ang = b.angle || 0;
    const spd = b.speed || 10;
    const ricochet = hasBounce();
    if (ricochet && bullets.length >= MAX_BOUNCE_BULLETS) return;
    const bullet = {
      pierce: 0,
      phase: rand(0, Math.PI * 2),
      ...b,
      bounce: ricochet ? BOUNCE_HITS : 0,
      _wasBounce: ricochet,
      vx: ricochet || b.angle ? Math.sin(ang) * spd * (ricochet ? 1 : 0.85) : 0,
      vy: -Math.cos(ang) * spd,
    };
    if (!ricochet && !b.angle) {
      bullet.vx = 0;
      bullet.vy = -spd;
    }
    bullets.push(bullet);
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
    const bulletCap = hasBounce() ? MAX_BOUNCE_BULLETS : MAX_BULLETS;
    if (bullets.length >= bulletCap) return;
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
    // 弹射期间粒子减半，避免撞墙刷爆
    const want = hasBounce() ? Math.ceil(count * 0.4) : count;
    const n = Math.min(want, MAX_PARTICLES - particles.length);
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: rand(-3, 3),
        vy: rand(-3, 3),
        life: rand(10, 22),
        maxLife: 22,
        size: rand(2, 4),
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

    if (hasBounce()) {
      const pulse = 0.7 + Math.sin(frame * 0.25) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 140, 255, ${0.55 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = '#e0b0ff';
      ctx.textAlign = 'center';
      ctx.fillText(`🔮${Math.ceil((bounceUntil - frame) / 60)}s`, x, y + w * 0.95);
    }

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
        safeEllipse(0, 0, b.w * 0.55, b.h * 0.45);
        ctx.fill();
        ctx.fillStyle = '#fff8cc';
        ctx.beginPath();
        ctx.arc(0, -b.h * 0.15, b.w * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        safeEllipse(0, b.h * 0.35, b.w * 0.35, b.h * 0.25);
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

    if (e.isMinion && e.summonSkill === 'dragons') {
      ctx.shadowColor = 'rgba(255, 120, 60, 0.8)';
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff6622';
      ctx.beginPath();
      safeEllipse(0, 8, e.size * 0.45, e.size * 0.25);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

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
    ctx.fillText(`首领 ${boss.name}`, x, y + 8);
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
      ctx.fillText(p.isSwitch ? `[换] 1级` : `[升] →${p.label.replace('↑', '')}级`, 0, -18);

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
    spawnParticles(bx, by, bullet?.color || '#aaddff', bullet?.bounce > 0 ? 2 : 4);

    if (bullet?.type === 'chain' && bullet.chainsLeft > 0) {
      const hitSet = new Set([e]);
      chainJumpFrom(e, bullet.dmg, bullet.chainsLeft, bullet.chainRange, hitSet);
    }

    if (e.hp > 0) {
      // 弹射期间降频音效，避免每帧打中都播
      if (!(bullet?.bounce > 0) || frame % 3 === 0) Sound.hit();
      return false;
    }

    killEnemy(e);
    return true;
  }

  function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const ricochet = b.bounce > 0;

      if (ricochet) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.type === 'wave') {
          b.phase += 0.14;
          b.x += Math.sin(b.phase) * (b.waveAmp || 2) * 0.35;
        }
        // 碰墙弹射（同一帧只处理一边，避免角落连环扣次数）
        let bounced = false;
        if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx || 2); bounced = true; }
        else if (b.x > W - 10) { b.x = W - 10; b.vx = -Math.abs(b.vx || 2); bounced = true; }
        else if (b.y < 10) { b.y = 10; b.vy = Math.abs(b.vy || 2); bounced = true; }
        else if (b.y > H - 10) { b.y = H - 10; b.vy = -Math.abs(b.vy || 2); bounced = true; }
        if (bounced) {
          b.bounce--;
          if (b.bounce <= 0) {
            bullets.splice(i, 1);
            continue;
          }
        }
      } else {
        if (b.type === 'spread' && b.angle) {
          b.x += Math.sin(b.angle) * b.speed;
          b.y -= Math.cos(b.angle) * b.speed;
        } else if (b.vx != null && b.vy != null && (b.vx !== 0 || b.vy !== 0) && b._wasBounce) {
          // 弹射耗尽后沿当前速度飞出屏幕
          b.x += b.vx;
          b.y += b.vy;
        } else {
          b.y -= b.speed;
          if (b.angle) b.x += Math.sin(b.angle) * b.speed * 0.85;
        }
        if (b.type === 'wave' && !b._wasBounce) {
          b.phase += 0.14;
          b.x += Math.sin(b.phase) * b.waveAmp;
        }
        if (b.y < -30 || b.y > H + 30 || b.x < -20 || b.x > W + 20) {
          bullets.splice(i, 1);
          continue;
        }
      }

      let bulletRemoved = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        // 弹射弹短时内不重复打同一敌人，避免每帧结算卡死
        if (b.ignoreEnemy === e && frame < (b.ignoreUntil || 0)) continue;

        const hitW = b.w;
        const hitH = b.type === 'plasma' ? b.w : b.h;
        if (!rectsOverlap(b.x, b.y, hitW, hitH, e.x, e.y, e.size * 0.7, e.size * 0.7)) continue;

        const killed = damageEnemy(e, b.dmg, b.x, b.y, b);
        if (killed) enemies.splice(j, 1);

        if (b.type === 'laser' && b.pierce > 1) {
          b.pierce--;
          b.ignoreEnemy = e;
          b.ignoreUntil = frame + 6;
        } else if (ricochet) {
          // 命中后改向继续飞，但不对同一目标连打
          b.vx = (b.vx || 0) + rand(-2, 2);
          b.vy = -Math.abs(b.vy || b.speed || 8);
          b.ignoreEnemy = e;
          b.ignoreUntil = frame + 10;
          b._wasBounce = true;
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
    if (isStageTransition() || stagePhase === 'bossWarn') return;
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
    addFloatText(player.x, player.y - 40, '💣 炸弹!', '#ffee88');
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
    enemies.push({
      kind: 'stageBoss',
      isStageBoss: true,
      bossSkill: b.skill,
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
      vx: b.speed * 1.1,
      targetY: 120,
      shootCd: 50,
      shotIndex: 0,
    });
    addFloatText(W / 2, H * 0.35, `⚠ ${b.name}`, '#ff66ff');
    const skillHint = {
      drones: '护卫机出击!',
      imps: '召唤风暴仔!',
      orbs: '雷球飞舞!',
      dragons: '放出小蛟龙!',
      reapers: '魂魄降临!',
    };
    addFloatText(W / 2, H * 0.35 + 28, skillHint[b.skill] || '首领弹幕来袭!', '#ffaa66');
    if (window.Sound) Sound.levelUp();
  }

  /** 清掉场上所有战斗实体与子弹，用于过关 / 开新关 */
  function clearBattlefield(keepScoreFloats = false) {
    enemies = [];
    bullets = [];
    enemyBullets = [];
    lightnings = [];
    powerups = [];
    bombFx = null;
    chainArcs = [];
    if (!keepScoreFloats) floatTexts = [];
    particles = [];
  }

  function isStageTransition() {
    return stagePhase === 'clear' || stagePhase === 'intro';
  }

  /** 新一关重新开始：清空子弹，战机归位，短暂无敌 */
  function startFreshStage() {
    clearBattlefield(false);
    player.x = W / 2;
    player.y = H - 90;
    player.targetX = W / 2;
    player.targetY = H - 90;
    pointerX = null;
    pointerY = null;
    shootTimer = 0;
    hitIFrameUntil = frame + 90;
    bombIFrameUntil = frame + 90;
    const s = stageCfg();
    nextLightningFrame = frame + rand(s.lightningMin, s.lightningMax);
    stagePhase = 'intro';
    stageFrame = 0;
    updateHUD();
  }

  function onStageBossDefeated(boss) {
    clearBossName = boss.name || '大怪';
    // 立刻清空全部子弹与杂兵，进入过关演出
    clearBattlefield(true);
    stagePhase = 'clear';
    stageFrame = 0;
    bombs = Math.min(MAX_BOMBS, bombs + 3);
    addFloatText(W / 2, H / 2 - 20, `第 ${stageCfg().id} 关 完成!`, '#ffe066');
    addFloatText(W / 2, H / 2 + 10, `${clearBossName} 击破`, '#c88cff');
    addFloatText(W / 2, H / 2 + 36, '💣 +3', '#ffee88');
    if (window.Sound) Sound.levelUp();
    updateHUD();
  }

  function advanceStage() {
    if (stageCfg().endless) {
      bossHpScale *= 1.18;
      bombs = Math.min(MAX_BOMBS, Math.max(bombs + 3, 5));
      startFreshStage();
      addFloatText(W / 2, H / 2 - 10, '最终关 · 下一波', '#ff8866');
      addFloatText(W / 2, H / 2 + 16, '子弹已清空 · 重新开战', '#88ccff');
      if (window.Sound) Sound.levelUp();
      return;
    }
    stageIndex++;
    // 新关补给：至少带 5 枚炸弹
    bombs = Math.min(MAX_BOMBS, Math.max(bombs + 3, 5));
    startFreshStage();
    const s = stageCfg();
    addFloatText(W / 2, H / 2 - 10, `进入第 ${s.id} 关`, '#ffe066');
    addFloatText(W / 2, H / 2 + 16, s.name, '#88ccff');
    addFloatText(W / 2, H / 2 + 40, `💣×${bombs}`, '#ffee88');
    if (window.Sound) Sound.levelUp();
  }

  function drawStageBanner() {
    if (stagePhase !== 'clear' && stagePhase !== 'intro' && stagePhase !== 'bossWarn') return;
    const s = stageCfg();
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 30, 0.55)';
    ctx.fillRect(0, H * 0.32, W, 120);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (stagePhase === 'clear') {
      ctx.font = 'bold 36px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = '#ffe066';
      ctx.fillText(`第 ${s.id} 关 完成!`, W / 2, H * 0.38);
      ctx.font = 'bold 20px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#e6c0ff';
      ctx.fillText(`${clearBossName || '大怪'} 已击破`, W / 2, H * 0.45);
      ctx.font = '16px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#aaccff';
      ctx.fillText(s.endless ? '准备下一波…' : '即将进入下一关 · 子弹清空', W / 2, H * 0.52);
    } else if (stagePhase === 'intro') {
      ctx.font = 'bold 36px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = '#ffe066';
      ctx.fillText(`第 ${s.id} 关`, W / 2, H * 0.38);
      ctx.font = 'bold 22px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#88ccff';
      ctx.fillText(s.name, W / 2, H * 0.46);
      ctx.font = '15px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#ccd8ff';
      ctx.fillText('击败关底大怪兽即可过关', W / 2, H * 0.53);
    } else if (stagePhase === 'bossWarn') {
      ctx.font = 'bold 32px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = '#ff66ff';
      ctx.fillText('⚠ 大怪兽来袭', W / 2, H * 0.4);
      ctx.font = '18px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#ffcc88';
      ctx.fillText(s.boss.name, W / 2, H * 0.48);
    }
    ctx.restore();
  }

  function updateEnemies() {
    const s = stageCfg();

    if (stagePhase === 'wave') {
      if (frame % s.spawnInterval === 0) spawnEnemy();
      if (s.extraSpawn > 0 && frame % (s.spawnInterval + 12) === 0 && Math.random() < s.extraSpawn) {
        spawnEnemy();
      }
    } else if (stagePhase === 'boss' && !hasStageBoss()) {
      // Boss 已死但状态未切时兜底（勿打断已在进行的过关/开场）
      if (!isStageTransition()) {
        onStageBossDefeated({ name: clearBossName || stageCfg().boss.name || '大怪' });
      }
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
      } else if (e.isMinion) {
        // 召唤物朝玩家俯冲
        if (e.diveTimer > 0) {
          e.diveTimer--;
          e.y += e.speed * 0.6;
          e.x += Math.sin(e.wobble + frame * 0.08) * 1.2;
        } else {
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.x += (dx / len) * e.speed;
          e.y += (dy / len) * e.speed * 0.9;
        }
      } else {
        e.y += e.speed;
      }

      enemyTryShoot(e);

      if (rectsOverlap(player.x, player.y, player.w * 0.7, player.h * 0.7, e.x, e.y, e.size * 0.65, e.size * 0.65)) {
        takeDamage(e.x, e.y, e.isMinion ? '💥 被咬!' : (e.isStageBoss ? '💥 首领撞击!' : '💥 撞击!'));
        spawnParticles(e.x, e.y, '#ff6644', 14);
        if (!e.isStageBoss) enemies.splice(i, 1);
        if (state !== 'playing') return;
        continue;
      }

      if (!e.isStageBoss && (e.y - e.size > H + 20 || e.x < -40 || e.x > W + 40)) {
        enemies.splice(i, 1);
      }
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
              const gain = bombs <= 3 ? 2 : 1;
              bombs = Math.min(MAX_BOMBS, bombs + gain);
              addFloatText(p.x, p.y, gain > 1 ? `💣 +${gain}` : '💣 +1', '#ffee88');
            }
            Sound.powerup();
            break;
          case 'bounce':
            bounceUntil = frame + BOUNCE_DURATION;
            addFloatText(p.x, p.y, '🔮 弹射子弹 12s!', '#e0b0ff');
            Sound.upgrade();
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
      if (canSpawnLightning()) {
        spawnLightningWarning();
        nextLightningFrame = frame + rand(s.lightningMin, s.lightningMax);
      } else {
        // 条件不合适就稍后再试，别硬劈
        nextLightningFrame = frame + rand(45, 90);
      }
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

    if (stagePhase === 'intro') {
      // 开场展示关卡名，期间无敌人无子弹
      bullets = [];
      enemyBullets = [];
      if (stageFrame >= 110) {
        stagePhase = 'wave';
        stageFrame = 0;
        addFloatText(W / 2, H * 0.3, '开始!', '#ffe066');
      }
    } else if (stagePhase === 'wave') {
      const s = stageCfg();
      if (stageFrame >= s.waveFrames) {
        stagePhase = 'bossWarn';
        stageFrame = 0;
        // 进入 Boss 预警：先清杂兵子弹
        for (let i = enemies.length - 1; i >= 0; i--) {
          if (!enemies[i].isStageBoss) enemies.splice(i, 1);
        }
        bullets = [];
        enemyBullets = [];
        lightnings = [];
        Sound.lightningWarn();
      }
    } else if (stagePhase === 'bossWarn') {
      bullets = [];
      enemyBullets = enemyBullets.filter((b) => b.isBoss);
      if (stageFrame >= 100) {
        stagePhase = 'boss';
        stageFrame = 0;
        spawnStageBoss();
      }
    } else if (stagePhase === 'clear') {
      // 过关期间保持全场无子弹
      enemies = [];
      bullets = [];
      enemyBullets = [];
      lightnings = [];
      if (stageFrame >= 150) {
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

    try {
      frame++;
      // 每帧实时判断，避免击杀 Boss 后同帧仍走战斗逻辑
      const transitioning = isStageTransition() || stagePhase === 'bossWarn';

      drawBackground();
      updatePlayer();

      if (!transitioning && state === 'playing') {
        shootTimer++;
        const shootEvery = hasBounce() ? SHOOT_INTERVAL + 2 : SHOOT_INTERVAL;
        if (shootTimer >= shootEvery) {
          shootTimer = 0;
          shoot();
        }
        updateBullets();
        // 若本帧刚击破 Boss，阶段已变 clear，不再更新敌人
        if (!isStageTransition() && stagePhase !== 'bossWarn' && state === 'playing') {
          updateEnemies();
        }
        if (state === 'playing' && !isStageTransition()) {
          updateEnemyBullets();
        }
        if (state === 'playing' && !isStageTransition()) {
          updatePowerups();
          updateLightnings();
          updateBombFx();
        }
      } else {
        // 过场：不射击、不刷怪，并持续清空双方子弹
        bullets = [];
        enemyBullets = [];
        shootTimer = 0;
      }

      if (state === 'playing') {
        updateStage();
        if (bounceUntil > 0 && frame <= bounceUntil + 1 && frame % 12 === 0) updateHUD();
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
        drawStageBanner();
      }
    } catch (err) {
      console.error('[雷电风暴] 游戏循环错误:', err);
    }

    // 关键：只要还在玩就必须挂下一帧（中途 return/异常都会导致卡死）
    if (state === 'playing') {
      requestAnimationFrame(gameLoop);
    }
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
