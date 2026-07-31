(() => {
  'use strict';

  let ctx = null;
  let master = null;
  let bgmGain = null;
  let sfxGain = null;
  let bgmNodes = null;
  // 默认关闭，需用户点击一次才会开（并借此解锁浏览器音频策略）
  let enabled = localStorage.getItem('thunderStrikeSound') === 'on';
  let unlocked = false;
  let lastShoot = 0;
  let bgmWanted = false;
  let resumePromise = null;

  function createCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (ctx) return ctx;

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.12;
    bgmGain.connect(master);
    return ctx;
  }

  /** 在用户手势中创建并 resume；返回 Promise，resolve 后才能可靠发声 */
  function ensureAudio() {
    try {
      if (!createCtx()) return Promise.reject(new Error('No AudioContext'));
      applyMasterGain();
      if (ctx.state === 'running') {
        unlocked = true;
        return Promise.resolve(ctx);
      }
      if (!resumePromise) {
        resumePromise = ctx.resume()
          .then(() => {
            unlocked = ctx.state === 'running';
            resumePromise = null;
            return ctx;
          })
          .catch((err) => {
            resumePromise = null;
            console.warn('Audio resume failed:', err);
            throw err;
          });
      }
      return resumePromise;
    } catch (err) {
      console.warn('Audio init failed:', err);
      return Promise.reject(err);
    }
  }

  function applyMasterGain() {
    if (master) master.gain.value = enabled ? 1 : 0;
  }

  function tone(freq, dur, type = 'square', vol = 0.2, detune = 0) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (detune) osc.detune.setValueAtTime(detune, t);
      g.gain.setValueAtTime(Math.max(vol, 0.001), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (_) { /* ignore */ }
  }

  function noise(dur, vol = 0.22, freq = 800) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    try {
      const t = ctx.currentTime;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(vol, 0.001), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(sfxGain);
      src.start(t);
      src.stop(t + dur + 0.05);
    } catch (_) { /* ignore */ }
  }

  function stopBgm() {
    if (!bgmNodes) return;
    if (bgmNodes.timer) clearInterval(bgmNodes.timer);
    bgmNodes = null;
  }

  /** 轻快短促旋律，避免持续低音嗡嗡声 */
  function startBgm() {
    if (!enabled || !ctx || ctx.state !== 'running' || bgmNodes) return;
    bgmWanted = true;
    // C 大调轻快琶音，带休止
    const melody = [
      523, 659, 784, 659, 587, 698, 880, 0,
      523, 659, 784, 1047, 880, 698, 659, 0,
    ];
    let step = 0;
    const playStep = () => {
      if (!enabled || !ctx || ctx.state !== 'running' || !bgmNodes) return;
      const freq = melody[step % melody.length];
      step++;
      if (!freq) return;
      try {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.07, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(t);
        osc.stop(t + 0.25);
      } catch (_) { /* ignore */ }
    };
    playStep();
    const timer = setInterval(playStep, 280);
    bgmNodes = { timer };
  }

  function playBeepPair() {
    tone(523, 0.12, 'square', 0.35);
    setTimeout(() => tone(784, 0.14, 'square', 0.3), 100);
  }

  /** HTML5 Audio 兜底：不依赖 AudioContext 状态 */
  function playHtmlBeep() {
    try {
      // 短促双音 PCM WAV（约 0.2s）
      const sampleRate = 22050;
      const duration = 0.18;
      const numSamples = Math.floor(sampleRate * duration);
      const dataSize = numSamples * 2;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      const writeStr = (off, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = t < 0.09 ? 660 : 880;
        const env = Math.min(1, t * 30) * Math.max(0, 1 - (t - 0.02) / duration);
        const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.55;
        view.setInt16(44 + i * 2, (sample * 32767) | 0, true);
      }
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.85;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (_) {
      return false;
    }
  }

  const Sound = {
    init() {
      ensureAudio().catch(() => {});
      return true;
    },

    isEnabled() {
      return enabled;
    },

    isUnlocked() {
      return unlocked;
    },

    /** 用户点击时调用：立即创建 context，resume 后再发声 */
    unlock() {
      return ensureAudio();
    },

    toggle() {
      // 先在手势栈里创建/resume
      ensureAudio().catch(() => {});
      enabled = !enabled;
      localStorage.setItem('thunderStrikeSound', enabled ? 'on' : 'off');
      applyMasterGain();

      if (enabled) {
        // HTML5 兜底立刻响一下；WebAudio 等 resume 后再响
        playHtmlBeep();
        ensureAudio().then(() => {
          playBeepPair();
          if (bgmWanted) startBgm();
        }).catch(() => {});
      } else {
        stopBgm();
      }
      return enabled;
    },

    setEnabled(on) {
      ensureAudio().catch(() => {});
      enabled = !!on;
      localStorage.setItem('thunderStrikeSound', enabled ? 'on' : 'off');
      applyMasterGain();
      if (enabled) {
        playHtmlBeep();
        ensureAudio().then(() => {
          playBeepPair();
          if (bgmWanted) startBgm();
        }).catch(() => {});
      } else {
        stopBgm();
      }
      return enabled;
    },

    playTest() {
      playHtmlBeep();
      ensureAudio().then(() => playBeepPair()).catch(() => {});
    },

    shoot(weapon) {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastShoot < 45) return;
      lastShoot = now;
      const freqs = {
        normal: 520, laser: 880, spread: 380,
        plasma: 220, wave: 440, chain: 660,
      };
      const f = freqs[weapon] || 520;
      const type = weapon === 'laser' ? 'sawtooth' : 'square';
      if (ctx && ctx.state === 'running') {
        tone(f, 0.05, type, 0.14);
      } else {
        ensureAudio().then(() => tone(f, 0.05, type, 0.14)).catch(() => {});
      }
    },

    hit() { tone(280, 0.04, 'triangle', 0.14); },
    explode() { noise(0.12, 0.25, 600); tone(90, 0.15, 'sine', 0.18); },
    powerup() {
      tone(523, 0.07, 'sine', 0.16);
      setTimeout(() => tone(659, 0.07, 'sine', 0.16), 50);
      setTimeout(() => tone(784, 0.09, 'sine', 0.18), 100);
    },
    switchWeapon() {
      tone(330, 0.06, 'square', 0.16);
      setTimeout(() => tone(440, 0.08, 'square', 0.16), 60);
    },
    upgrade() {
      tone(440, 0.06, 'sine', 0.16);
      setTimeout(() => tone(554, 0.06, 'sine', 0.16), 45);
      setTimeout(() => tone(659, 0.09, 'sine', 0.18), 90);
    },
    damage() { noise(0.18, 0.28, 400); tone(120, 0.2, 'sawtooth', 0.18); },
    shield() { tone(1200, 0.09, 'sine', 0.16); tone(800, 0.11, 'triangle', 0.14, 50); },
    lightningWarn() { tone(220, 0.12, 'triangle', 0.1); tone(180, 0.18, 'sine', 0.08); },
    lightningStrike() { noise(0.2, 0.22, 1400); tone(180, 0.18, 'triangle', 0.12); },
    bomb() {
      noise(0.35, 0.35, 500);
      tone(180, 0.2, 'sawtooth', 0.2);
      setTimeout(() => tone(120, 0.35, 'sine', 0.22), 40);
      setTimeout(() => noise(0.25, 0.2, 900), 80);
      setTimeout(() => tone(90, 0.4, 'triangle', 0.14), 120);
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.1, 'triangle', 0.14), i * 70);
      });
    },
    gameOver() {
      stopBgm();
      bgmWanted = false;
      [440, 370, 311, 262].forEach((f, i) => {
        setTimeout(() => tone(f, 0.15, 'triangle', 0.12), i * 120);
      });
    },
    startGame() {
      bgmWanted = true;
      if (!enabled) return;
      playHtmlBeep();
      ensureAudio().then(() => {
        stopBgm();
        startBgm();
        tone(523, 0.08, 'triangle', 0.14);
        setTimeout(() => tone(659, 0.1, 'triangle', 0.14), 80);
        setTimeout(() => tone(784, 0.12, 'triangle', 0.16), 160);
      }).catch(() => {});
    },
    pauseBgm() {
      if (bgmGain) bgmGain.gain.value = 0;
    },
    resumeBgm() {
      if (bgmGain && enabled) bgmGain.gain.value = 0.12;
    },
  };

  window.Sound = Sound;
})();
