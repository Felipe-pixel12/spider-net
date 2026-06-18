/* ═══════════════════════════════════════════════════════════════
   SPIDER-MAN LOGIN — js/index.js
   Módulos:
     1. WebCanvas      — teias animadas em background
     2. CaptchaGame    — minigame de lançar teia
     3. FormValidation — validação em tempo real
     4. LoginFlow      — sequência de login / erro
     5. ThrowAnim      — animação de teia no overlay
     6. Dashboard      — contadores, canvas, logout
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   1. WEB CANVAS — teias de aranha no fundo
───────────────────────────────────────────── */
class WebCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx    = this.canvas.getContext('2d');
    this.nodes  = [];
    this.mouse  = { x: -9999, y: -9999 };
    this.raf    = null;

    this._resize();
    this._initNodes();
    this._bindEvents();
    this._loop();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _initNodes(count = 55) {
    this.nodes = [];
    for (let i = 0; i < count; i++) {
      this.nodes.push({
        x:  Math.random() * this.canvas.width,
        y:  Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r:  Math.random() * 2 + 1,
      });
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this._resize();
      this._initNodes();
    });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('touchmove', e => {
      this.mouse.x = e.touches[0].clientX;
      this.mouse.y = e.touches[0].clientY;
    }, { passive: true });
  }

  _loop() {
    this.raf = requestAnimationFrame(() => this._loop());
    this._draw();
  }

  _draw() {
    const { ctx, canvas, nodes, mouse } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const LINK_DIST  = 140;
    const MOUSE_DIST = 160;

    // Mover nós
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

      // Repulsão suave do mouse
      const dx = n.x - mouse.x;
      const dy = n.y - mouse.y;
      const d  = Math.hypot(dx, dy);
      if (d < MOUSE_DIST) {
        const f = (MOUSE_DIST - d) / MOUSE_DIST * 0.02;
        n.vx += dx * f;
        n.vy += dy * f;
      }
      // Limitar velocidade
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > 1.2) { n.vx /= speed; n.vy /= speed; }
    });

    // Desenhar conexões (teias)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a  = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d  = Math.hypot(dx, dy);
        if (d < LINK_DIST) {
          const alpha = (1 - d / LINK_DIST) * 0.35;
          ctx.strokeStyle = `rgba(192, 200, 255, ${alpha})`;
          ctx.lineWidth   = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Desenhar nós
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(227, 28, 28, 0.5)';
      ctx.fill();
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }
}


/* ─────────────────────────────────────────────
   2. CAPTCHA GAME — minigame de lançar teia
───────────────────────────────────────────── */
class CaptchaGame {
  constructor(canvasId, onSuccess) {
    this.canvas    = document.getElementById(canvasId);
    this.ctx       = this.canvas.getContext('2d');
    this.onSuccess = onSuccess;
    this.solved    = false;

    // Prédios fonte e destino
    this.buildingA = { x: 30,  y: 20, w: 44, h: 100 };
    this.buildingB = { x: 266, y: 15, w: 44, h: 105 };

    // Ponto de início da teia (topo do prédio A)
    this.startPt = {
      x: this.buildingA.x + this.buildingA.w / 2,
      y: this.buildingA.y
    };

    // Zona alvo no topo do prédio B
    this.targetZone = {
      x: this.buildingB.x + this.buildingB.w / 2,
      y: this.buildingB.y,
      r: 26
    };

    this.dragging    = false;
    this.dragPt      = null;
    this.webPath     = null;   // pontos do caminho de teia
    this.webProgress = 0;      // animação de teia estendida
    this.pulseAnim   = 0;

    this._bindEvents();
    this._loop();
  }

  _bindEvents() {
    const el = this.canvas;

    const getPos = (e) => {
      const rect = el.getBoundingClientRect();
      const scaleX = el.width  / rect.width;
      const scaleY = el.height / rect.height;
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top)  * scaleY
      };
    };

    const onStart = (e) => {
      if (this.solved) return;
      const p = getPos(e);
      // Iniciar apenas se clicou perto do prédio A
      const dx = p.x - this.startPt.x;
      const dy = p.y - this.startPt.y;
      if (Math.hypot(dx, dy) < 32) {
        this.dragging = true;
        this.dragPt   = p;
        this.webPath  = [{ ...this.startPt }];
      }
    };

    const onMove = (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.dragPt = getPos(e);
      this.webPath.push({ ...this.dragPt });
      // Manter apenas últimos 60 pontos para performance
      if (this.webPath.length > 60) this.webPath.shift();
    };

    const onEnd = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this._checkSuccess();
    };

    el.addEventListener('mousedown',  onStart);
    el.addEventListener('mousemove',  onMove, { passive: false });
    el.addEventListener('mouseup',    onEnd);
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove, { passive: false });
    el.addEventListener('touchend',   onEnd);
  }

  _checkSuccess() {
    if (!this.dragPt) return;
    const t   = this.targetZone;
    const dx  = this.dragPt.x - t.x;
    const dy  = this.dragPt.y - t.y;
    const hit = Math.hypot(dx, dy) < t.r;

    if (hit) {
      this.solved = true;
      // Animação de teia chegando
      this.webProgress = 0;
      this._animateSuccess();
    } else {
      // Feedback de erro — pisca
      this.webPath = null;
      this.dragPt  = null;
    }
  }

  _animateSuccess() {
    const step = () => {
      this.webProgress += 0.06;
      if (this.webProgress < 1) {
        requestAnimationFrame(step);
      } else {
        this.webProgress = 1;
        setTimeout(() => this.onSuccess(), 400);
      }
    };
    requestAnimationFrame(step);
  }

  _loop() {
    if (this.solved && this.webProgress >= 1) return;
    requestAnimationFrame(() => this._loop());
    this.pulseAnim = (this.pulseAnim + 0.05) % (Math.PI * 2);
    this._draw();
  }

  _draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bA = this.buildingA;
    const bB = this.buildingB;

    // ── Céu / fundo ─────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#060A1A');
    sky.addColorStop(1, '#0D1535');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Brilho entre os prédios
    const glow = ctx.createRadialGradient(
      canvas.width / 2, canvas.height * 0.4, 5,
      canvas.width / 2, canvas.height * 0.4, 100
    );
    glow.addColorStop(0, 'rgba(227,28,28,0.08)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── Prédio A ─────────────────────────────────
    this._drawBuilding(bA, '#1A2560', '#0F1640');
    // Label A
    ctx.fillStyle = 'rgba(192,200,255,0.8)';
    ctx.font      = 'bold 11px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('A', bA.x + bA.w / 2, bA.y - 8);

    // ── Prédio B ─────────────────────────────────
    this._drawBuilding(bB, '#1A2560', '#0F1640');
    // Label B
    ctx.fillStyle = 'rgba(192,200,255,0.8)';
    ctx.fillText('B', bB.x + bB.w / 2, bB.y - 8);

    // ── Zona alvo (pulsante) ──────────────────────
    if (!this.solved) {
      const pulse = 1 + Math.sin(this.pulseAnim) * 0.15;
      const tz    = this.targetZone;

      ctx.save();
      ctx.translate(tz.x, tz.y);
      ctx.scale(pulse, pulse);

      // Círculo externo
      ctx.beginPath();
      ctx.arc(0, 0, tz.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(227,28,28,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Círculo interno
      ctx.beginPath();
      ctx.arc(0, 0, tz.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(227,28,28,0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(227,28,28,0.7)';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.restore();
    }

    // ── Ponto de início da teia ───────────────────
    if (!this.solved) {
      const pulse = 1 + Math.sin(this.pulseAnim + 1) * 0.2;
      ctx.beginPath();
      ctx.arc(this.startPt.x, this.startPt.y, 7 * pulse, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(227,28,28,0.8)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // ── Teia sendo arrastada ──────────────────────
    if (this.webPath && this.webPath.length > 1) {
      // Teia de Bézier suavizada
      ctx.beginPath();
      ctx.moveTo(this.webPath[0].x, this.webPath[0].y);

      if (this.solved) {
        // Animar extensão até prédio B
        const totalPts = this.webPath.length;
        const showPts  = Math.floor(totalPts * this.webProgress);
        for (let i = 1; i < showPts; i++) {
          ctx.lineTo(this.webPath[i].x, this.webPath[i].y);
        }
        ctx.strokeStyle = 'rgba(200,220,255,0.9)';
        ctx.lineWidth   = 2;
        ctx.shadowColor = 'rgba(227,28,28,0.8)';
        ctx.shadowBlur  = 8;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Brilho de sucesso
        if (this.webProgress > 0.8) {
          const alpha = (this.webProgress - 0.8) / 0.2;
          ctx.fillStyle = `rgba(74,222,128,${alpha * 0.3})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else {
        for (let i = 1; i < this.webPath.length; i++) {
          ctx.lineTo(this.webPath[i].x, this.webPath[i].y);
        }
        // Linha até cursor atual
        if (this.dragPt) ctx.lineTo(this.dragPt.x, this.dragPt.y);

        ctx.strokeStyle = 'rgba(200,220,255,0.7)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Instrução de arrastar ─────────────────────
    if (!this.solved && !this.dragging && !this.webPath) {
      ctx.fillStyle = 'rgba(192,200,255,0.3)';
      ctx.font      = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('← arraste a partir do ponto vermelho', canvas.width / 2, canvas.height - 10);
    }
  }

  _drawBuilding(b, color1, color2) {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Borda sutil
    ctx.strokeStyle = 'rgba(192,200,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // Janelas
    ctx.fillStyle = 'rgba(255,220,100,0.6)';
    const cols = 3, rows = 5;
    const pw = 6, ph = 5;
    const gx = (b.w - cols * pw - (cols - 1) * 4) / 2;
    const gy = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.35 || r === 0) { // aleatoriedade fixa por sorte
          ctx.fillRect(
            b.x + gx + c * (pw + 4),
            b.y + gy + r * (ph + 6),
            pw, ph
          );
        }
      }
    }
  }
}


/* ─────────────────────────────────────────────
   3. FORM VALIDATION — validação em tempo real
───────────────────────────────────────────── */
class FormValidation {
  constructor() {
    this.userInput = document.getElementById('username');
    this.passInput = document.getElementById('password');
    this.toggleBtn = document.getElementById('toggle-pass');
    this.errUser   = document.getElementById('error-user');
    this.errPass   = document.getElementById('error-pass');

    this._bindEvents();
  }

  _bindEvents() {
    // Validar ao sair do campo
    this.userInput.addEventListener('blur',  () => this.validateUser());
    this.passInput.addEventListener('blur',  () => this.validatePass());

    // Feedback em tempo real ao digitar
    this.userInput.addEventListener('input', () => {
      if (this.userInput.value.length > 1) this.validateUser(true);
      else this._clearField('field-user');
    });
    this.passInput.addEventListener('input', () => {
      if (this.passInput.value.length > 1) this.validatePass(true);
      else this._clearField('field-pass');
    });

    // Toggle mostrar/ocultar senha
    this.toggleBtn.addEventListener('click', () => {
      const isPass = this.passInput.type === 'password';
      this.passInput.type = isPass ? 'text' : 'password';
      this.toggleBtn.querySelector('.eye-open').style.display  = isPass ? 'none'  : 'block';
      this.toggleBtn.querySelector('.eye-closed').style.display = isPass ? 'block' : 'none';
    });
  }

  validateUser(silent = false) {
    const v = this.userInput.value.trim();
    const fg = document.getElementById('field-user');

    if (!v) {
      this._setField(fg, 'invalid', 'Usuário é obrigatório.', this.errUser);
      return false;
    }
    if (v.length < 3) {
      this._setField(fg, 'invalid', 'Mínimo 3 caracteres.', this.errUser);
      return false;
    }
    this._setField(fg, 'valid', '', this.errUser);
    return true;
  }

  validatePass(silent = false) {
    const v = this.passInput.value;
    const fg = document.getElementById('field-pass');

    if (!v) {
      this._setField(fg, 'invalid', 'Senha é obrigatória.', this.errPass);
      return false;
    }
    if (v.length < 4) {
      this._setField(fg, 'invalid', 'Mínimo 4 caracteres.', this.errPass);
      return false;
    }
    this._setField(fg, 'valid', '', this.errPass);
    return true;
  }

  validate() {
    const u = this.validateUser();
    const p = this.validatePass();
    return u && p;
  }

  _setField(fg, state, msg, errEl) {
    fg.classList.remove('valid', 'invalid');
    if (state) fg.classList.add(state);
    errEl.textContent = msg;
  }

  _clearField(id) {
    const fg = document.getElementById(id);
    fg.classList.remove('valid', 'invalid');
  }

  getCredentials() {
    return {
      user: this.userInput.value.trim(),
      pass: this.passInput.value,
    };
  }
}


/* ─────────────────────────────────────────────
   4. THROW ANIMATION — teia no overlay
───────────────────────────────────────────── */
class ThrowAnimation {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.t      = 0;
    this.raf    = null;
  }

  start() {
    this.t = 0;
    this._loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  _loop() {
    this.t += 0.015;
    this._draw();
    if (this.t < 4) {
      this.raf = requestAnimationFrame(() => this._loop());
    }
  }

  _draw() {
    const { ctx, canvas, t } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Spider-man mini (silhueta)
    ctx.save();
    ctx.translate(cx - 60, cy + 20);
    // Corpo
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#E31C1C';
    ctx.fill();
    // Cabeça
    ctx.beginPath();
    ctx.arc(0, -24, 12, 0, Math.PI * 2);
    ctx.fill();
    // Braço lançando (animado)
    const armAngle = -Math.PI / 3 + Math.sin(t * 3) * 0.3;
    ctx.save();
    ctx.translate(10, -8);
    ctx.rotate(armAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(28, 0);
    ctx.strokeStyle = '#E31C1C';
    ctx.lineWidth   = 6;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Teia sendo lançada
    const webLen   = Math.min(t / 2, 1) * 90;
    const startX   = cx - 25;
    const startY   = cy + 5;
    const endX     = startX + webLen;
    const endY     = startY - webLen * 0.6;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + webLen * 0.5, startY - webLen * 0.8,
      endX, endY
    );
    ctx.strokeStyle = `rgba(200, 220, 255, ${Math.min(t, 1)})`;
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 3]);
    ctx.shadowColor = 'rgba(227,28,28,0.8)';
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur  = 0;

    // Partículas ao redor da teia
    if (t > 0.5) {
      for (let i = 0; i < 5; i++) {
        const prog  = (t * 0.4 + i * 0.15) % 1;
        const px    = startX + (endX - startX) * prog;
        const py    = startY + (endY - startY) * prog - Math.sin(prog * Math.PI) * 20;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(227,28,28,${1 - prog})`;
        ctx.fill();
      }
    }

    // Ondas de energia
    const waves = 3;
    for (let w = 0; w < waves; w++) {
      const wt    = (t * 1.5 - w * 0.4) % 2;
      const alpha = Math.max(0, 1 - wt / 2) * 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, wt * 50, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(227,28,28,${alpha})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }
}


/* ─────────────────────────────────────────────
   5. LOGIN FLOW — sequência principal
───────────────────────────────────────────── */
class LoginFlow {
  constructor(validation, captcha, throwAnim) {
    this.validation = validation;
    this.captcha    = captcha;
    this.throwAnim  = throwAnim;
    this.processing = false;

    this.form         = document.getElementById('login-form');
    this.btn          = document.getElementById('btn-login');
    this.btnText      = this.btn.querySelector('.btn-text');
    this.btnLoader    = this.btn.querySelector('.btn-loader');
    this.spiderSense  = document.getElementById('spider-sense');
    this.verifyOverlay= document.getElementById('verify-overlay');
    this.verifyMsg    = document.getElementById('verify-msg');

    this._bindEvents();
  }

  _bindEvents() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });
  }

  _handleSubmit() {
    if (this.processing) return;

    // Validar campos
    if (!this.validation.validate()) {
      this._shakeCard();
      return;
    }

    // Verificar captcha
    if (!this.captcha.solved) {
      this._highlightCaptcha();
      return;
    }

    const { user, pass } = this.validation.getCredentials();
    this.processing = true;
    this._startLoadingAnim();

    // Simular delay de autenticação
    setTimeout(() => {
      const ok = (user === 'spider' && pass === '12345')
              || (user === 'peter.parker' && pass === '12345');

      if (ok) {
        this._handleSuccess(user);
      } else {
        this._handleError();
      }
    }, 2200);
  }

  /* ── Botão vira círculo + loader ─────────── */
  _startLoadingAnim() {
    this.btn.classList.add('loading');
    this.btnText.style.display   = 'none';
    this.btnLoader.style.display = 'flex';

    // Mostrar overlay de verificação após 0.6s
    setTimeout(() => {
      this.verifyOverlay.style.display = 'flex';
      this.throwAnim.start();
    }, 600);
  }

  /* ── Sucesso ─────────────────────────────── */
  _handleSuccess(user) {
    this.verifyMsg.textContent = '✓ Acesso autorizado. Bem-vindo, Aranha.';
    this.verifyMsg.style.color = '#4ADE80';
    this.throwAnim.stop();

    setTimeout(() => {
      // Flash cinematográfico
      const flash = document.createElement('div');
      flash.className = 'success-flash';
      document.body.appendChild(flash);

      setTimeout(() => {
        this.verifyOverlay.style.display = 'none';
        this._transitionToDashboard(user);
        flash.remove();
      }, 900);
    }, 800);
  }

  /* ── Erro ────────────────────────────────── */
  _handleError() {
    this.verifyOverlay.style.display = 'none';
    this.throwAnim.stop();
    this._resetBtn();
    this._triggerSpiderSense();
    this.processing = false;
  }

  /* ── Spider-Sense (ondas de erro) ────────── */
  _triggerSpiderSense() {
    const el = this.spiderSense;
    el.classList.remove('active');
    void el.offsetWidth; // reflow para reiniciar animação
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 2300);
  }

  /* ── Resetar botão ───────────────────────── */
  _resetBtn() {
    this.btn.classList.remove('loading');
    this.btnText.style.display   = '';
    this.btnLoader.style.display = 'none';
  }

  /* ── Sacudir card ────────────────────────── */
  _shakeCard() {
    const card = document.getElementById('login-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'shake 0.5s ease';
    setTimeout(() => card.style.animation = '', 500);
  }

  /* ── Destacar captcha ────────────────────── */
  _highlightCaptcha() {
    const zone = document.getElementById('captcha-zone');
    zone.style.borderColor = 'rgba(227,28,28,0.6)';
    zone.style.boxShadow   = '0 0 0 3px rgba(227,28,28,0.12)';
    setTimeout(() => {
      zone.style.borderColor = '';
      zone.style.boxShadow   = '';
    }, 1200);
    this._shakeCard();
  }

  /* ── Ir para dashboard ───────────────────── */
  _transitionToDashboard(user) {
    const loginScreen = document.getElementById('login-screen');
    const dashScreen  = document.getElementById('dashboard-screen');

    loginScreen.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    loginScreen.style.opacity    = '0';
    loginScreen.style.transform  = 'scale(1.05)';

    setTimeout(() => {
      loginScreen.classList.remove('active');
      dashScreen.classList.add('active');
      dashScreen.style.opacity   = '0';
      dashScreen.style.transform = 'scale(0.97)';
      dashScreen.style.transition= 'opacity 0.7s ease, transform 0.7s ease';

      // Atualizar nome no dashboard
      const displayName = user === 'spider' ? 'Peter Parker' : user;
      document.getElementById('welcome-name').textContent = displayName;
      document.getElementById('dash-username').textContent = user;

      requestAnimationFrame(() => {
        dashScreen.style.opacity   = '1';
        dashScreen.style.transform = 'scale(1)';
        setTimeout(() => initDashboard(), 300);
      });
    }, 700);
  }
}


/* ─────────────────────────────────────────────
   6. DASHBOARD — contadores e canvas
───────────────────────────────────────────── */
function initDashboard() {
  // Canvas de teias no dashboard
  new WebCanvas('dash-canvas');

  // Animar contadores
  document.querySelectorAll('.stat-value').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    animateCounter(el, 0, target, 1800);
  });

  // Botão logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    const dash  = document.getElementById('dashboard-screen');
    const login = document.getElementById('login-screen');

    dash.style.transition  = 'opacity 0.5s ease';
    dash.style.opacity     = '0';

    setTimeout(() => {
      dash.classList.remove('active');
      login.classList.add('active');
      login.style.opacity   = '';
      login.style.transform = '';
      // Resetar form
      document.getElementById('login-form').reset();
      document.querySelectorAll('.field-group').forEach(fg => {
        fg.classList.remove('valid', 'invalid');
      });
    }, 500);
  });
}

/* Animação de contador numérico */
function animateCounter(el, from, to, duration) {
  const start = performance.now();
  const update = (now) => {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Easing out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}


/* ─────────────────────────────────────────────
   ANIMAÇÃO: shake (injetada via CSS-in-JS)
───────────────────────────────────────────── */
(function injectShakeKeyframe() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      15%      { transform: translateX(-8px); }
      30%      { transform: translateX(8px); }
      45%      { transform: translateX(-6px); }
      60%      { transform: translateX(6px); }
      75%      { transform: translateX(-3px); }
      90%      { transform: translateX(3px); }
    }
  `;
  document.head.appendChild(style);
})();


/* ─────────────────────────────────────────────
   INICIALIZAÇÃO PRINCIPAL
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // 1. Canvas de teias no login
  const webCanvas = new WebCanvas('web-canvas');

  // 2. Validação do formulário
  const formValidation = new FormValidation();

  // 3. Animação de lançamento de teia
  const throwAnim = new ThrowAnimation('throw-canvas');

  // 4. Minigame captcha
  const captchaGame = new CaptchaGame('game-canvas', () => {
    // Captcha resolvido — mostrar feedback
    document.getElementById('captcha-game').style.display = 'none';
    document.getElementById('captcha-done').style.display = 'flex';
    // Remover estado desabilitado do botão
    document.getElementById('btn-login').classList.remove('disabled-cap');
  });

  // Deixar botão levemente inativo até captcha ser resolvido
  document.getElementById('btn-login').classList.add('disabled-cap');

  // 5. Fluxo de login
  const loginFlow = new LoginFlow(formValidation, captchaGame, throwAnim);

  // Pequena animação de entrada da figura do Homem-Aranha
  const figure = document.getElementById('spiderman-hero');
  figure.style.opacity   = '0';
  figure.style.transform = 'translateY(-50%) translateX(40px)';
  figure.style.transition= 'opacity 1s ease 0.5s, transform 1s ease 0.5s';
  requestAnimationFrame(() => {
    figure.style.opacity   = '1';
    figure.style.transform = 'translateY(-50%) translateX(0)';
  });

});