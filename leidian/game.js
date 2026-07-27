(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const $score = document.getElementById('score');
  const $lives = document.getElementById('lives');
  const $highscore = document.getElementById('highscore');
  const $finalScore = document.getElementById('final-score');
  const $newRecord = document.getElementById('new-record');
  const $overlayStart = document.getElementById('overlay-start');
  const $overlayPause = document.getElementById('overlay-pause');
  const $overlayGameover = document.getElementById('overlay-gameover');
  const $weapons = document.getElementById('weapons');

  const MAX_LIVES = 5;
  const MAX_WEAPON_LEVEL = 5;
  const SHOOT_INTERVAL = 7;
  const SHIELD_DURATION = 60 * 5;
  const LIGHTNING_WARN_FRAMES = 55;
  const LIGHTNING_STRIKE_FRAMES = 18;
  const LIGHTNING_WIDTH = 64;

  const WEAPONS = {
    normal: { name: '标准弹', letter: 'N', color: '#88ddff', accent: '#3399ff' },
    laser: { name: '激光', letter: 'L', color: '#ff5577', accent: '#ff1144' },
    spread: { name: '散射', letter: 'S', color: '#ffe066', accent: '#ff9900' },
    plasma: { name: '等离子', letter: 'P', color: '#cc88ff', accent: '#9933ff' },
    wave: { name: '波动', letter: 'W', color: '#55bbff', accent: '#0088ff' },
    chain: { name: '链弹', letter: 'C', color: '#aaff66', accent: '#66dd22' },
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
  ];

  const ENEMIES = [
    { kind: 'scout', emoji: '🛸', hp: 1, points: 10, speed: 2.8, size: 30, weight: 40 },
    { kind: 'drone', emoji: '👾', hp: 2, points: 25, speed: 2.0, size: 34, weight: 35 },
    { kind: 'storm', emoji: '☁️', hp: 4, points: 50, speed: 1.2, size: 42, weight: 20 },
    { kind: 'boss', emoji: '🌩️', hp: 6, points: 100, speed: 0.9, size: 48, weight: 5 },
  ];

  let state = 'start';
  let currentWeapon = 'normal';
  let weaponLevel = 1;
  let score = 0;
  let lives = MAX_LIVES;
  let highScore = parseInt(localStorage.getItem('thunderStrikeHigh') || '0', 10);
  let level = 1;
  let frame = 0;
  let shieldUntil = 0;
  let shootTimer = 0;
  let nextLightningFrame = 120;

  let player = { x: W / 2, y: H - 90, w: 44, h: 44, targetX: W / 2, targetY: H - 90 };
  let bullets = [];
  let enemies = [];
  let powerups = [];
  let lightnings = [];
  let particles = [];
  let floatTexts = [];
  let stormClouds = [];
  let keys = {};
  let pointerX = null;
  let pointerY = null;

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
    level = 1;
    frame = 0;
    shieldUntil = 0;
    currentWeapon = 'normal';
    weaponLevel = 1;
    shootTimer = 0;
    nextLightningFrame = frame + rand(180, 300);
    player = { x: W / 2, y: H - 90, w: 44, h: 44, targetX: W / 2, targetY: H - 90 };
    bullets = [];
    enemies = [];
    powerups = [];
    lightnings = [];
    particles = [];
    floatTexts = [];
    updateHUD();
  }

  function updateHUD() {
    $score.textContent = score;
    $lives.textContent = lives <= 8 ? '❤️'.repeat(lives) : `❤️×${lives}`;
    if ($weapons) {
      const w = WEAPONS[currentWeapon];
      const maxed = weaponLevel >= MAX_WEAPON_LEVEL ? ' ★' : '';
      const bars = '▮'.repeat(weaponLevel) + '▯'.repeat(MAX_WEAPON_LEVEL - weaponLevel);
      $weapons.innerHTML = `<span class="weapon-tag weapon-active" style="--wc:${w.color}">
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
        updateHUD();
        return;
      }
      weaponLevel++;
      addFloatText(player.x, player.y - 30, `🦅 ${w.name} Lv.${weaponLevel}!`, w.color);
    } else {
      const prev = WEAPONS[currentWeapon];
      currentWeapon = type;
      weaponLevel = 1;
      bullets = [];
      addFloatText(player.x, player.y - 40, `${prev.name} → ${w.name}`, '#aaa');
      addFloatText(player.x, player.y - 18, `🦅 ${w.name} Lv.1 重新开始!`, w.color);
    }

    spawnParticles(player.x, player.y, w.color, 14);
    updateHUD();
  }

  function hasShield() {
    return frame < shieldUntil;
  }

  function spawnEnemy() {
    const def = pickWeighted(ENEMIES);
    const speedMul = 1 + level * 0.06;
    enemies.push({
      kind: def.kind,
      x: rand(35, W - 35),
      y: -def.size,
      size: def.size,
      emoji: def.emoji,
      hp: def.hp + Math.floor(level / 3),
      maxHp: def.hp + Math.floor(level / 3),
      points: def.points,
      speed: def.speed * speedMul,
      wobble: rand(0, Math.PI * 2),
    });
  }

  function spawnPowerUp(x, y) {
    if (Math.random() > 0.28) return;
    if (Math.random() < 0.35) {
      const pu = pickWeighted(UTILITY_DROPS);
      powerups.push({ kind: pu.kind, x, y, size: 30, emoji: pu.emoji, speed: 1.5 });
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
        speed: 1.6,
        bob: rand(0, Math.PI * 2),
      });
    }
  }

  function spawnLightningWarning() {
    lightnings.push({
      x: rand(LIGHTNING_WIDTH / 2 + 20, W - LIGHTNING_WIDTH / 2 - 20),
      phase: 'warn',
      startFrame: frame,
      hitPlayer: false,
    });
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
    if (frame % 14 !== 0) return;
    const count = lv <= 2 ? 1 : lv <= 4 ? 2 : 3;
    const spacing = 20;
    const start = -(count - 1) / 2;
    for (let i = 0; i < count; i++) {
      addBullet({
        type: 'plasma',
        x: px + (start + i) * spacing,
        y: py,
        w: 10 + lv * 2,
        h: 10 + lv * 2,
        speed: 5 + lv * 0.3,
        dmg: 2 + lv,
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
    if (frame % 10 !== 0) return;
    addBullet({
      type: 'chain',
      x: px,
      y: py,
      w: 7,
      h: 14,
      speed: 12,
      dmg: 2 + Math.floor(lv / 2),
      chainsLeft: lv,
      chainRange: 90 + lv * 15,
      color: WEAPONS.chain.color,
      accent: WEAPONS.chain.accent,
    });
  }

  function shoot() {
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
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
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
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, (y + frame * 0.5) % H);
      ctx.lineTo(W, (y + frame * 0.5) % H);
      ctx.stroke();
    }
  }

  function drawLightningBolt(x, width, alpha) {
    ctx.save();
    ctx.strokeStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 20;

    let px = x;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    for (let y = 0; y < H; y += rand(18, 35)) {
      px = x + rand(-width / 3, width / 3);
      ctx.lineTo(px, y);
    }
    ctx.lineTo(x + rand(-10, 10), H);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = `rgba(120, 180, 255, ${alpha * 0.25})`;
    ctx.fillRect(x - width / 2, 0, width, H);
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
        drawLightningBolt(lt.x, LIGHTNING_WIDTH, alpha);
      }
    }
  }

  function drawPlayer() {
    const { x, y, w, h } = player;
    ctx.save();

    if (hasShield()) {
      const pulse = Math.sin(frame * 0.2) * 0.1 + 0.9;
      const remaining = shieldUntil - frame;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 200, 255, ${0.15 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(120, 220, 255, ${0.7 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px "ZCOOL KuaiLe", cursive';
      ctx.fillStyle = '#88ccff';
      ctx.textAlign = 'center';
      ctx.fillText(`🛡️${Math.ceil(remaining / 60)}s`, x, y - w * 0.9);
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
        ctx.shadowBlur = 14;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, b.h / 2);
        ctx.lineTo(-4, 0);
        ctx.lineTo(3, -b.h * 0.2);
        ctx.lineTo(-2, -b.h * 0.45);
        ctx.lineTo(0, -b.h / 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -b.h / 2, 2.5, 0, Math.PI * 2);
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
    ctx.translate(e.x + Math.sin(e.wobble + frame * 0.05) * 8, e.y);
    ctx.font = `${e.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(150, 100, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(e.emoji, 0, 0);

    if (e.maxHp > 1) {
      const barW = e.size * 0.8;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-barW / 2, -e.size / 2 - 10, barW, 4);
      ctx.fillStyle = '#ff6644';
      ctx.fillRect(-barW / 2, -e.size / 2 - 10, barW * (e.hp / e.maxHp), 4);
    }
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
    if (hasShield()) {
      spawnParticles(x, y, '#88ccff', 14);
      addFloatText(x, y - 20, '🛡️ 护盾!', '#66bbff');
      return;
    }
    lives--;
    spawnParticles(x, y, '#ff4400', 16);
    addFloatText(x, y - 20, label, '#ff6644');
    canvas.parentElement.classList.add('shake');
    setTimeout(() => canvas.parentElement.classList.remove('shake'), 350);
    updateHUD();
    if (lives <= 0) gameOver();
  }

  function damageEnemy(e, dmg, bx, by, bullet) {
    e.hp -= dmg;
    spawnParticles(bx, by, bullet?.color || '#aaddff', 4);
    if (e.hp > 0) return false;

    score += e.points;
    spawnParticles(e.x, e.y, '#ffaa44', 12);
    addFloatText(e.x, e.y, `+${e.points}`, '#ffe066');
    spawnPowerUp(e.x, e.y);

    if (bullet?.type === 'chain' && bullet.chainsLeft > 0 && currentWeapon === 'chain') {
      let nearest = null;
      let nearestDist = bullet.chainRange;
      for (const other of enemies) {
        if (other === e || other.hp <= 0) continue;
        const d = Math.hypot(other.x - e.x, other.y - e.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = other;
        }
      }
      if (nearest) {
        bullet.chainsLeft--;
        nearest.hp -= bullet.dmg;
        spawnParticles(nearest.x, nearest.y, WEAPONS.chain.color, 8);
        addFloatText(nearest.x, nearest.y, '⚡链!', WEAPONS.chain.color);
        if (nearest.hp <= 0) {
          score += nearest.points;
          spawnParticles(nearest.x, nearest.y, '#ffaa44', 10);
          addFloatText(nearest.x, nearest.y - 16, `+${nearest.points}`, '#ffe066');
          spawnPowerUp(nearest.x, nearest.y);
          enemies.splice(enemies.indexOf(nearest), 1);
        }
      }
    }

    updateHUD();
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

  function updateEnemies() {
    const spawnRate = Math.max(28, 55 - level * 3);
    if (frame % spawnRate === 0) spawnEnemy();
    if (level >= 3 && frame % (spawnRate + 10) === 0 && Math.random() < 0.3) spawnEnemy();

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.speed;
      e.wobble += 0.04;

      if (rectsOverlap(player.x, player.y, player.w * 0.7, player.h * 0.7, e.x, e.y, e.size * 0.65, e.size * 0.65)) {
        takeDamage(e.x, e.y, '💥 撞击!');
        spawnParticles(e.x, e.y, '#ff6644', 14);
        enemies.splice(i, 1);
        if (state !== 'playing') return;
        continue;
      }

      if (e.y - e.size > H + 20) enemies.splice(i, 1);
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
            break;
          case 'shield':
            shieldUntil = frame + SHIELD_DURATION;
            addFloatText(p.x, p.y, '🛡️ 护盾 5s!', '#66bbff');
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
    if (frame >= nextLightningFrame) {
      spawnLightningWarning();
      nextLightningFrame = frame + rand(150, 280) - level * 8;
    }

    for (let i = lightnings.length - 1; i >= 0; i--) {
      const lt = lightnings[i];
      const elapsed = frame - lt.startFrame;

      if (lt.phase === 'warn' && elapsed >= LIGHTNING_WARN_FRAMES) {
        lt.phase = 'strike';
        lt.startFrame = frame;
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

  function updateLevel() {
    const newLevel = Math.floor(score / 200) + 1;
    if (newLevel > level) {
      level = newLevel;
      addFloatText(W / 2, H / 2, `Level ${level}!`, '#ffe066');
    }
  }

  function gameOver() {
    state = 'gameover';
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
    updatePowerups();
    updateLightnings();
    if (state !== 'playing') return;
    updateLevel();
    updateParticles();
    updateFloatTexts();

    drawLightnings();
    for (const e of enemies) drawEnemy(e);
    for (const p of powerups) drawPowerUp(p);
    drawBullets();
    drawPlayer();
    drawParticles();
    drawFloatTexts();

    requestAnimationFrame(gameLoop);
  }

  function startGame() {
    resetGame();
    initStormClouds();
    state = 'playing';
    $overlayStart.classList.add('hidden');
    $overlayGameover.classList.add('hidden');
    $overlayPause.classList.add('hidden');
    requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      $overlayPause.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      $overlayPause.classList.add('hidden');
      requestAnimationFrame(gameLoop);
    }
  }

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', togglePause);

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' && state !== 'start') {
      e.preventDefault();
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

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
  drawBackground();
  drawPlayer();
})();
