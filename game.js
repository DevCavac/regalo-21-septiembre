(function () {
    "use strict";

    // ---------- Pantallas ----------
    var screenStart = document.getElementById('screen-start');
    var screenGame  = document.getElementById('screen-game');
    var screenReward = document.getElementById('screen-reward');
    var btnStart    = document.getElementById('btnStart');
    var hudElem     = document.getElementById('hud');
    var scoreEl     = document.getElementById('score');
    var heartsEl    = document.getElementById('hearts');
    var hintEl      = document.getElementById('hint');

    // ---------- Audio ----------
    var audio = document.getElementById('bgMusic');
    var musBtn = document.getElementById('musicToggle');
    var musToast = document.getElementById('musicToast');
    var musicOn = false;
    var toastTimer = null;
    // Si el usuario tocó el botón de música una vez, se respeta su elección
    // y el juego ya no la reinicia por su cuenta a cada rato.
    var userToggled = false;

    function toast(msg) {
        musToast.innerHTML = msg;
        musToast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { musToast.classList.remove('show'); }, 4200);
    }

    function autoStartMusic() {
        // Candado: si la canción ya está sonando, no se vuelve a tocar
        // (play() sobre un elemento en marcha también sería inofensivo).
        if (!audio.paused) { musicOn = true; return; }
        audio.play().then(function () {
            musBtn.textContent = '🎵';
            musicOn = true;
        }).catch(function () {
            musBtn.textContent = '🎵';
            musicOn = false;
            toast('🎵 Para que suene la música, coloca el archivo <b>hot_freaks.mp3</b> junto a esta página.');
        });
    }

    function toggleMusic() {
        userToggled = true;
        if (musicOn) {
            audio.pause();
            musBtn.textContent = '🔇';
            musicOn = false;
            return;
        }
        autoStartMusic();
    }
    musBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); toggleMusic(); });

    // ---------- Canvas / estado ----------
    var area = document.getElementById('game-area');
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    var W = 0, H = 0, DPR = 0;
    var time = 0;
    var last = performance.now();

    // El juego solo avanza una vez que el usuario entra a la cripta (corrige
    // la victoria prematura al cargar con el canvas sin dimensiones reales).
    var started = false;

    function resize() {
        var r = area.getBoundingClientRect();
        W = Math.max(2, r.width);
        H = Math.max(2, r.height);
        if (DPR <= 0) DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildGradients();
        layoutWorld();
    }

    // ---------- Geometría del mundo ----------
    var rodY, chest, rug;

    // Gradientes reutilizables (se recalculan solo al redimensionar)
    var gradBgDark, gradBgWarm, gradKey, gradWood, gradGold;

    function buildGradients() {
        if (W < 2 || H < 2) return;
        gradBgDark = ctx.createLinearGradient(0, 0, 0, H);
        gradBgDark.addColorStop(0, '#0c0a10');
        gradBgDark.addColorStop(0.55, '#120a0d');
        gradBgDark.addColorStop(1, '#1d0a08');
        gradBgWarm = ctx.createLinearGradient(0, 0, 0, H);
        gradBgWarm.addColorStop(0, '#0c0a10');
        gradBgWarm.addColorStop(0.4, '#251109');
        gradBgWarm.addColorStop(1, '#43210f');
        gradKey = ctx.createLinearGradient(-12, 0, 12, 0);
        gradKey.addColorStop(0, '#9aa4b8');
        gradKey.addColorStop(0.5, '#f2f6ff');
        gradKey.addColorStop(1, '#8b93a9');
        gradWood = ctx.createLinearGradient(-40, 0, 40, 0);
        gradWood.addColorStop(0, '#3b2510');
        gradWood.addColorStop(0.5, '#5a3a1c');
        gradWood.addColorStop(1, '#2e1a0a');
        gradGold = ctx.createLinearGradient(0, -34, 0, 0);
        gradGold.addColorStop(0, '#c9a24e');
        gradGold.addColorStop(1, '#7a5c22');
    }

    function pickFrac(min, max) { return min + Math.random() * (max - min); }

    function layoutWorld() {
        if (W < 2 || H < 2) return;
        rodY = Math.round(H * 0.12);
        chest = { x: W * 0.87, y: H * 0.58, r: 50 - (W * 0.005), openT: 0 };
        for (var i = 0; i < obs.length; i++) {
            if (obs[i].type === 'pendulum') obs[i].anchorX = obs[i].fracX * W;
            if (obs[i].type === 'drift') obs[i].bx = obs[i].fracX * W;
        }
        for (var j = 0; j < rug; j++) {
            dust[j].x = Math.random() * W;
            dust[j].y = Math.random() * H;
        }
    }

    // ---------- Elementos del juego ----------
    var bat = { x: 80, y: 100, tx: 80, ty: 100, r: 20, inv: 0 };
    var lives = 3;
    var score = 0;
    // Nivel más alto ya celebrado (para que al morir y volver a juntar
    // flores no se repitan las animaciones de 10, 20, 30… y no se salten fotogramas)
    var tierShown = 0;
    var mode = 'game'; // 'game' | 'win'
    var tWin = 0;
    var showStarted = false;
    var rainTimer = null;

    var obs = [];
    var flowers = [];
    var parts = [];
    var dust = [];

    function makeKeyGroup() {
        var o = { type: 'pendulum', anchorX: 0, fracX: 0.5, L: 90, A: 0.7, w: 0.8, phase: 0, angle: 0 };
        o.fracX = pickFrac(0.22, 0.82);
        o.anchorX = o.fracX * W;
        o.L = Math.max(70, Math.min(H * 0.5, 150));
        o.A = pickFrac(0.45, 0.85);
        o.w = pickFrac(0.55, 1.0);
        o.phase = Math.random() * Math.PI * 2;
        obs.push(o);
    }
    function makeKeyDrift() {
        var o = { type: 'drift', bx: 0, by: 0, fracX: 0.6, fracY: 0.4, sx: 0.06, sy: 0.12, w1: 0.7, w2: 0.9, ph1: 0, ph2: 0, rot: 0, vr: 0.3 };
        o.fracX = pickFrac(0.3, 0.72);
        o.fracY = pickFrac(0.32, 0.68);
        o.bx = o.fracX * W;
        o.by = o.fracY * H;
        o.sx = pickFrac(0.05, 0.09);
        o.sy = pickFrac(0.09, 0.15);
        o.w1 = pickFrac(0.5, 0.9);
        o.w2 = pickFrac(0.7, 1.1);
        o.ph1 = Math.random() * Math.PI * 2;
        o.ph2 = Math.random() * Math.PI * 2;
        o.vr = (Math.random() > 0.5 ? 1 : -1) * pickFrac(0.2, 0.5);
        obs.push(o);
    }
    function initLevel() {
        mode = 'game';
        tWin = 0;
        showStarted = false;
        lives = 3;
        score = 0;
        tierShown = 0;
        updateHud();
        obs = [];
        flowers = [];
        parts = [];
        for (var i = 0; i < 3; i++) makeKeyGroup();
        for (var j = 0; j < 1; j++) makeKeyDrift();
        spawnFlowers(5, true);
        resetBat();
        started = true;
    }

    function resetBat() {
        bat.x = W * 0.10; bat.y = H * 0.72;
        bat.tx = bat.x; bat.ty = bat.y;
        bat.inv = 1.2;
    }

    function flowerCount() { return 5 + Math.floor(score / 8); }

    function spawnFlowers(n, force) {
        while (n-- > 0) {
            var ok = false, tries = 0, fx = 0, fy = 0;
            while (!ok && tries++ < 25) {
                fx = pickFrac(0.06, 0.92) * W;
                fy = pickFrac(0.22, 0.88) * H;
                ok = true;
                if (Math.hypot(fx - chest.x, fy - chest.y) < chest.r + 40) ok = false;
                if (Math.hypot(fx - bat.x, fy - bat.y) < 90) ok = false;
                for (var i = 0; i < obs.length; i++) {
                    var p = pendPos(obs[i]);
                    if (Math.hypot(fx - p.x, fy - p.y) < 80) { ok = false; break; }
                }
            }
            if (ok) flowers.push({ x: fx, y: fy });
        }
    }
    function keepFlowersAt(count) {
        if (flowers.length < count) spawnFlowers(count - flowers.length, false);
    }

    // ---------- HUD ----------
    var tierEl = document.getElementById('tierMsg');
    var tierMessages = [
        '10 flores · la noche sonríe contigo 🌙',
        '20 flores · tu brillo crece ✨',
        '30 flores · un jardín bajo la luna 🌼',
        '40 flores · ¡vas rapidísimo, vampirito! 🦇',
        '50 flores · la mitad del camino 💛',
        '60 flores · casi tan brillante como tus ojos 🌻',
        '70 flores · el cofre ya empieza a temblar ⚜️',
        '80 flores · la cripta se rinde ante ti 🖤',
        '90 flores · ¡muy cerca del tesoro! 🌟',
        '100 flores · pura luz en la oscuridad 🌻💛'
    ];

    // El mensaje queda fijo y cambia en cada nivel de 10 flores
    function showTierMessage(score) {
        var idx = Math.floor(score / 10) - 1;
        if (idx < 0 || idx >= tierMessages.length) return;
        tierEl.textContent = tierMessages[idx];
        tierEl.classList.add('show');
        tierEl.classList.remove('tick');
        void tierEl.offsetWidth; // reinicia la animación
        tierEl.classList.add('tick');
    }

    // Mensajes finales del pergamino, uno por cada nivel de 10 flores (0 = menos de 10)
    var pBody = document.getElementById('pBody');
    var parchmentFinal = [
        'Que la oscuridad de esta noche<br>te traiga un jardín de flores amarillas. <span class="gold">🌻</span>',
        'Tu valentía iluminó la noche<br>esa luz me dará fuerza para seguir. <span class="gold">🌙</span>',
        'Tu brillo creció en la oscuridad:<br>aún cuando nadie mas vio <br>brillaste más cada dia <span class="gold">✨</span>',
        'Flor a flor sembraste un jardín<br>bajo la luna se iluminara cada flor que has dejado <br> en el corazon de cada quien. <span class="gold">🌼</span>',
        'Nadie corta las flores<br>tan bonito como tú <span class="gold">🦇</span>',
        'Los eclipses son los celos de la luna y el sol<br>y aun juntos no son suficente para opacarte <span class="gold">💛</span>',
        'Por las noches las campanas de cada castillo<br>corearan tu nombre. <span class="gold">🌻</span>',
        'Mas alla de las nubes y el cielo, esta el espacio<br>ese espacio que tu presencia llena en la vida de los demas <span class="gold">⚜️</span>',
        'La cripta se rindió<br>ante ti la reina vampiro <span class="gold">🖤</span>',
        'Tanto esfuerzo para darte cuenta que<br>me estoy quedando sin ideas T.T<span class="gold">🌟</span>',
        '100 flores wow…<br>ni 200 o 300 significaran nada comparado contigo <br>de mi parte y de todos los que conoces<br>Gracias. Por ser y por estar (Verbo to be)<br>No dudes de lo que significas para los demas<br>FELIZ DIA DE LAS FLORES AMARILLAS<span class="gold">🌻💛</span>'
    ];

    // El HTML solo llama aquí: muestra el mensaje final según cuántas flores llevabas
    function showFinalMessage() {
        var idx = Math.min(10, Math.max(0, Math.floor(score / 10)));
        pBody.innerHTML = 'Para la mejor vampira que conozco,<br>' + parchmentFinal[idx];
    }

    function updateHud() {
        scoreEl.textContent = '🌼 ' + score;
        var h = '🖤'.repeat(Math.max(0, lives)) + '🤍'.repeat(Math.max(0, 3 - lives));
        heartsEl.textContent = h.length ? h : '🖤';
    }

    // ---------- Perder una vida ----------
    var oopsMsg = document.getElementById('oopsMsg');
    var oopsTimer = null;

    // Al chocar con una cadena: se pierde una vida y el conteo de flores vuelve a 0.
    // En vez de teletransportar al murciélago al origen (que causaba la sensación
    // de que "se teletransportan"), se le da un empujón corto alejándolo del golpe.
    function onLifeLost(o) {
        lives--;
        score = 0;
        updateHud();
        burst(bat.x, bat.y, 12, 'spark');
        tierEl.classList.remove('show');
        oopsMsg.classList.add('show');
        clearTimeout(oopsTimer);
        oopsTimer = setTimeout(function () { oopsMsg.classList.remove('show'); }, 1600);
        if (lives <= 0) { lives = 3; updateHud(); }
        if (o) {
            var pp = pendPos(o);
            var dx = bat.x - pp.x, dy = bat.y - pp.y;
            var d = Math.hypot(dx, dy) || 1;
            bat.x = Math.min(Math.max(bat.x + (dx / d) * 60, 18), W - 18);
            bat.y = Math.min(Math.max(bat.y + (dy / d) * 60, 18), H - 18);
            bat.tx = bat.x; bat.ty = bat.y;
        }
        bat.inv = 1.5;
    }

    // ---------- Control puntero ----------
    function setTarget(clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        bat.tx = Math.min(Math.max(clientX - r.left, 16), W - 16);
        bat.ty = Math.min(Math.max(clientY - r.top, 16), H - 16);
    }
    window.addEventListener('pointermove', function (e) { if (mode === 'game') setTarget(e.clientX, e.clientY); });
    window.addEventListener('pointerdown', function (e) { if (mode === 'game') setTarget(e.clientX, e.clientY); });

    // ---------- Colisiones ----------
    function pendPos(o) {
        if (o.type === 'pendulum') return { x: o.pivotX, y: o.pivotY };
        return { x: o.x, y: o.y };
    }

    function hitByKey(o) {
        var cx = bat.x, cy = bat.y, rr = bat.r + 24;
        if (o.type === 'pendulum') return Math.hypot(cx - o.pivotX, cy - o.pivotY) < rr;
        return Math.hypot(cx - o.x, cy - o.y) < rr;
    }

    // ---------- Dibujo: murciélago ----------
    function drawBatBody(x, y, s, flap, redEye) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        // alas
        ctx.fillStyle = 'rgba(96, 10, 22, 0.95)';
        ctx.beginPath();
        ctx.moveTo(2, -2);
        ctx.quadraticCurveTo(-8 - flap * 14, 12 - flap * 6, -26 - flap * 12, 16 + flap * 10);
        ctx.quadraticCurveTo(-10, 24, 2, 18);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.quadraticCurveTo(8 + flap * 14, 12 - flap * 6, 26 + flap * 12, 16 + flap * 10);
        ctx.quadraticCurveTo(10, 24, -2, 18);
        ctx.fill();
        // cuerpo
        ctx.fillStyle = 'rgba(24, 22, 28, 1)';
        ctx.beginPath();
        ctx.ellipse(0, 4, 13, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(161, 18, 18, 0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // cabeza
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20, 18, 24, 1)';
        ctx.fill();
        // orejas
        ctx.beginPath();
        ctx.moveTo(-5, -13); ctx.lineTo(-9, -22); ctx.lineTo(-1, -15); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, -13); ctx.lineTo(9, -22); ctx.lineTo(1, -15); ctx.fill();
        // ojos
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = redEye || 'rgba(255, 40, 40, 0.75)';
        ctx.beginPath(); ctx.arc(-3, -8, 3.4, 0, Math.PI * 2); ctx.arc(3, -8, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ff2a2a';
        ctx.beginPath(); ctx.arc(-3, -8, 1.8, 0, Math.PI * 2); ctx.arc(3, -8, 1.8, 0, Math.PI * 2); ctx.fill();
        // colmillos
        ctx.fillStyle = '#e8e0d6';
        ctx.beginPath();
        ctx.moveTo(-2, -2); ctx.lineTo(-0.5, 1); ctx.lineTo(0.8, -2);
        ctx.moveTo(2, -2); ctx.lineTo(3.5, 1); ctx.lineTo(4.8, -2);
        ctx.fill();
        ctx.restore();
    }

    // ---------- Dibujo: llave de plata en cadena ----------
    function chainPath(x1, y1, x2, y2) {
        var links = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 11));
        for (var i = 0; i <= links; i++) {
            var t = i / links;
            var wob = Math.sin(i * 2.1 + time * 2.4) * 2.2;
            var cx = x1 + (x2 - x1) * t + wob * Math.sin(Math.PI * t);
            var cy = y1 + (y2 - y1) * t;
            ctx.beginPath();
            ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(215, 222, 236, 0.85)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();
        }
    }

    function drawKey(x, y, rot, glow) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, glow) * 0.5;
        ctx.drawImage(spriteKeyGlow, -28, -28, 56, 56);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = gradKey;
        ctx.fillStyle = gradKey;
        ctx.lineWidth = 3.4;
        // aro
        ctx.beginPath();
        ctx.arc(0, -10, 9, 0, Math.PI * 2);
        ctx.lineWidth = 3.6;
        ctx.stroke();
        // eje
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(0, 20);
        ctx.lineWidth = 4;
        ctx.stroke();
        // dientes
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(10, 15);
        ctx.lineTo(10, 9);
        ctx.moveTo(0, 20);
        ctx.lineTo(7, 20);
        ctx.lineTo(7, 24);
        ctx.lineWidth = 3.6;
        ctx.stroke();
        // detalle aro
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, -10, 9, 0.5, 2.2);
        ctx.stroke();
        // destello
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(-3, 9, 1.2 + Math.sin(time * 3 + x) * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Colgante de plata que cuelga de las cadenas (obstáculo, daña al vampiro)
    function drawPendant(x, y, rot, glow) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * glow;
        ctx.drawImage(spriteGlow, -30, -30, 60, 60);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.rotate(rot);
        // gota de plata
        ctx.fillStyle = gradKey;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.bezierCurveTo(7, -3, 8, 5, 0, 12);
        ctx.bezierCurveTo(-8, 5, -7, -3, 0, -9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        // brillo
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(-2, 0, 1.5, 3.2, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ---------- Dibujo: cofre ----------
    function drawChest(o) {
        var glowNear = 0;
        if (mode === 'game') {
            var d = Math.hypot(bat.x - o.x, bat.y - o.y);
            glowNear = Math.max(0, 1 - d / 230);
        }
        var s = o.r / 50;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(s, s);
        // resplandor dorado (luz + cercanía), con sprite pre-renderizado
        var glowA = (0.16 + glowNear * 0.5) * Math.min(1, o.openT * 3 + 1);
        if (glowA > 0.02) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = glowA * 1.25;
            var gs = (95 + o.openT * 45) * 2.2;
            ctx.drawImage(spriteGlow, -gs / 2, -gs / 2, gs, gs);
            ctx.restore();
        }

        // rayos al abrir (sprite pre-renderizado, gira despacio)
        if (o.openT > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.rotate(time * 0.4);
            ctx.globalAlpha = 0.75 * o.openT;
            var rs = 250 + o.openT * 440 + Math.sin(time * 5) * 14;
            ctx.drawImage(spriteRays, -rs / 2, -rs / 2, rs, rs);
            ctx.restore();
        }

        // tapa (detrás)
        ctx.save();
        ctx.translate(0, -2);
        var lift = o.openT * (-Math.PI * 0.55);
        ctx.rotate(lift);
        ctx.fillStyle = gradGold;
        ctx.strokeStyle = '#4a360f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -18, 44, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(46, 26, 8, 1)';
        ctx.beginPath();
        ctx.ellipse(0, -16, 36, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // base
        ctx.fillStyle = gradWood;
        ctx.strokeStyle = '#c9a24e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-40, -4, 80, 46, 6);
        ctx.fill();
        ctx.stroke();
        // franjas doradas
        ctx.strokeStyle = 'rgba(201, 162, 78, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-40, 14); ctx.lineTo(40, 14);
        ctx.moveTo(-40, 32); ctx.lineTo(40, 32);
        ctx.stroke();
        // cerradura
        ctx.fillStyle = '#e7c873';
        ctx.strokeStyle = '#4a360f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-9, 6, 18, 20, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath();
        ctx.arc(0, 13, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ---------- Partículas de victoria ----------
    function burst(x, y, n, kind) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = pickFrac(60, 420);
            var p = {
                kind: kind,
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                age: 0,
                life: pickFrac(1.0, 2.2),
                size: pickFrac(5, 12),
                rot: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 6,
                g: kind === 'bat' ? 120 : 220
            };
            parts.push(p);
        }
    }
    function updateParts(dt) {
        for (var i = parts.length - 1; i >= 0; i--) {
            var p = parts[i];
            p.age += dt;
            if (p.age > p.life) { parts.splice(i, 1); continue; }
            p.vx *= (1 - dt * 2);
            p.vy -= 90 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt;
        }
    }

    function drawParts() {
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            var a = 1 - p.age / p.life;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.globalCompositeOperation = p.g > 150 ? 'lighter' : 'source-over';
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            if (p.kind === 'bat') {
                drawBatBody(0, 0, p.size / 11, Math.sin(p.age * 16), 'rgba(255, 60, 60, 0.9)');
            } else if (p.kind === 'petal') {
                ctx.scale(1, 1.6);
                for (var ppi = 0; ppi < 5; ppi++) {
                    ctx.rotate(Math.PI * 2 / 5);
                    ctx.fillStyle = 'rgba(255, 209, 90, 0.95)';
                    ctx.beginPath();
                    ctx.ellipse(0, -p.size / 2, p.size * 0.32, p.size * 0.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = 'rgba(255, 170, 30, 1)';
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.16, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.globalAlpha = a * 0.85;
                ctx.drawImage(spriteSpark, -p.size, -p.size, p.size * 2, p.size * 2);
                ctx.globalAlpha = a;
                ctx.fillStyle = 'rgba(255, 243, 192, 0.98)';
                ctx.beginPath();
                ctx.arc(0, 0, p.size * 0.32, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // ---------- Fondo ----------
    var stars = [];
    function buildStars() {
        stars = [];
        for (var i = 0; i < 50; i++) {
            stars.push({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.4 + 0.3, p: Math.random() * 7 });
        }
    }

    function drawBackground() {
        var warmT = mode === 'game' ? 0 : Math.min(1, tWin / 1.5);
        ctx.fillStyle = warmT < 0.01 ? gradBgDark : gradBgWarm;
        ctx.fillRect(0, 0, W, H);

        // estrellas
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + s.p));
            ctx.globalAlpha = 0.35 * tw * (1 - warmT * 0.4);
            ctx.fillStyle = '#cfd6e6';
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.r * (1 + (1 - warmT) * 0.4), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // luna
        ctx.save();
        ctx.globalAlpha = 1 - warmT * 0.5;
        var mx = W * 0.88, my = H * 0.12, mr = Math.min(W, H) * 0.07;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(spriteMoonGlow, mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#c8cdde';
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0c0a10';
        ctx.beginPath();
        ctx.arc(mx + mr * 0.4, my - mr * 0.15, mr * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // polvo flotante
        for (var d = 0; d < rug; d++) {
            var du = dust[d];
            du.y += du.vy * 0.016;
            du.x += Math.sin(time + du.p) * 0.12;
            if (du.y > H) du.y = -4;
            ctx.globalAlpha = 0.12 + 0.12 * Math.sin(time * 2 + du.p);
            ctx.fillStyle = '#8a93a8';
            ctx.beginPath();
            ctx.arc(du.x, du.y, du.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawRod() {
        ctx.save();
        ctx.strokeStyle = 'rgba(161, 18, 18, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, rodY);
        ctx.lineTo(W, rodY);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(224, 178, 84, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rodY + 5);
        ctx.lineTo(W, rodY + 5);
        ctx.stroke();
        // remates
        ctx.fillStyle = 'rgba(161, 18, 18, 0.9)';
        ctx.beginPath(); ctx.arc(6, rodY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(W - 6, rodY, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    function drawFlowers() {
        for (var i = 0; i < flowers.length; i++) {
            var f = flowers[i];
            var bob = Math.sin(time * 2.4 + i) * 4;
            ctx.save();
            ctx.translate(f.x, f.y + bob);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(spriteGlow, -22, -22, 44, 44);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = Math.max(20, Math.min(30, W * 0.03)) + 'px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffd75e';
            ctx.fillText('🌼', 0, 0);
            ctx.restore();
        }
    }

    // ---------- Sprites pre-renderizados (rendimiento) ----------
    // Se dibujan una sola vez y se reutilizan cada fotograma en vez de
    // crear gradientes/shadowBlur por frame.
    var spriteGlow, spriteRays, spriteSpark, spriteKeyGlow, spriteMoonGlow;
    function buildSprites() {
        spriteGlow = document.createElement('canvas');
        spriteGlow.width = spriteGlow.height = 128;
        var c = spriteGlow.getContext('2d');
        var gr = c.createRadialGradient(64, 64, 3, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255, 206, 104, 0.8)');
        gr.addColorStop(0.45, 'rgba(255, 176, 62, 0.26)');
        gr.addColorStop(1, 'rgba(255, 176, 62, 0)');
        c.fillStyle = gr;
        c.fillRect(0, 0, 128, 128);

        spriteSpark = document.createElement('canvas');
        spriteSpark.width = spriteSpark.height = 64;
        var cs = spriteSpark.getContext('2d');
        var gs = cs.createRadialGradient(32, 32, 1, 32, 32, 32);
        gs.addColorStop(0, 'rgba(255, 251, 214, 0.95)');
        gs.addColorStop(0.35, 'rgba(255, 224, 130, 0.55)');
        gs.addColorStop(1, 'rgba(255, 215, 92, 0)');
        cs.fillStyle = gs;
        cs.fillRect(0, 0, 64, 64);

        spriteKeyGlow = document.createElement('canvas');
        spriteKeyGlow.width = spriteKeyGlow.height = 96;
        var ck = spriteKeyGlow.getContext('2d');
        var gk = ck.createRadialGradient(48, 48, 4, 48, 48, 48);
        gk.addColorStop(0, 'rgba(214, 226, 255, 0.85)');
        gk.addColorStop(0.5, 'rgba(214, 226, 255, 0.3)');
        gk.addColorStop(1, 'rgba(214, 226, 255, 0)');
        ck.fillStyle = gk;
        ck.fillRect(0, 0, 96, 96);

        spriteMoonGlow = document.createElement('canvas');
        spriteMoonGlow.width = spriteMoonGlow.height = 128;
        var cm = spriteMoonGlow.getContext('2d');
        var gm = cm.createRadialGradient(64, 64, 10, 64, 64, 64);
        gm.addColorStop(0, 'rgba(200, 205, 225, 0.55)');
        gm.addColorStop(0.6, 'rgba(200, 205, 225, 0.18)');
        gm.addColorStop(1, 'rgba(200, 205, 225, 0)');
        cm.fillStyle = gm;
        cm.fillRect(0, 0, 128, 128);

        spriteRays = document.createElement('canvas');
        spriteRays.width = spriteRays.height = 256;
        var cr = spriteRays.getContext('2d');
        cr.translate(128, 128);
        for (var i = 0; i < 7; i++) {
            var a = (i / 7) * Math.PI * 2;
            var rg = cr.createRadialGradient(0, 0, 4, 0, 0, 112);
            rg.addColorStop(0, 'rgba(255, 214, 90, 0.55)');
            rg.addColorStop(1, 'rgba(255, 214, 90, 0)');
            cr.fillStyle = rg;
            cr.beginPath();
            cr.moveTo(0, 0);
            cr.arc(0, 0, 112, a - 0.4, a + 0.4);
            cr.closePath();
            cr.fill();
        }
    }

    var vigGrad = null, vigW = 0, vigH = 0;
    function vignette() {
        if (!vigGrad || vigW !== W || vigH !== H) {
            vigGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
            vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
            vigW = W; vigH = H;
        }
        var warmT = mode === 'game' ? 0 : Math.min(1, tWin / 1.5);
        ctx.globalAlpha = 1 - warmT * 0.6;
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }

    // ---------- Actualización ----------
    function update(dt) {
        time += dt;
        if (!started) return;

        if (mode === 'win') {
            tWin += dt;
            chest.openT = Math.min(1, tWin / 0.9);
            // seguir sembrando explosión por un rato
            if (tWin < 1.6) {
                burst(chest.x, chest.y - 14 * chest.openT, 1, 'bat');
                burst(chest.x, chest.y - 14 * chest.openT, 3, 'petal');
                burst(chest.x, chest.y - 14 * chest.openT, 2, 'spark');
            }
            updateParts(dt);
            if (!showStarted && tWin > 1.35) {
                showStarted = true;
                revealReward();
            }
            return;
        }

        // --- modo juego ---
        var k = 1 - Math.pow(1 - 0.22, dt * 60);
        bat.x += (bat.tx - bat.x) * k;
        bat.y += (bat.ty - bat.y) * k;
        bat.x = Math.min(Math.max(bat.x, 18), W - 18);
        bat.y = Math.min(Math.max(bat.y, 18), H - 18);
        bat.inv = Math.max(0, bat.inv - dt);

        var pace = 1 + Math.min(1, score / 14) * 0.55;

        // obstáculos
        for (var i = 0; i < obs.length; i++) {
            var o = obs[i];
            if (o.type === 'pendulum') {
                o.angle = o.A * Math.sin(time * o.w * pace + o.phase);
                o.pivotX = o.anchorX + Math.sin(o.angle) * o.L;
                o.pivotY = rodY + Math.cos(o.angle) * o.L + 4;
            } else {
                o.x = o.bx + Math.sin(time * o.w1 * pace + o.ph1) * o.sx * W;
                o.y = o.by + Math.sin(time * o.w2 * pace + o.ph2) * o.sy * H;
                o.y = Math.max(50, Math.min(H - 20, o.y));
                o.rot += o.vr * dt;
            }
        }

        // mantener flores según puntaje
        keepFlowersAt(flowerCount());

        // colisión con flores
        for (var f = flowers.length - 1; f >= 0; f--) {
            var fl = flowers[f];
            if (Math.hypot(bat.x - fl.x, bat.y - fl.y) < bat.r + 26) {
                score++;
                flowers.splice(f, 1);
                parts.push({ kind: 'spark', x: fl.x, y: fl.y, vx: 0, vy: 0, age: 0, life: 0.7, size: 8, rot: 0, vr: 0, g: 200 });
                burst(fl.x, fl.y, 8, 'spark');
                updateHud();
                maybeAddDrift();
                if (score % 10 === 0) {
                    // Cada nivel se celebra una sola vez por partida:
                    // si ya lo mostraste (antes de morir), no se repite.
                    if (score / 10 > tierShown) {
                        tierShown = score / 10;
                        showTierMessage(score);
                        if (score >= 100) {
                            burst(bat.x, bat.y, 26, 'spark');
                            burst(bat.x, bat.y, 10, 'petal');
                        }
                    }
                }
            }
        }

        // colisión con llaves
        if (bat.inv <= 0) {
            for (var oi = 0; oi < obs.length; oi++) {
                if (hitByKey(obs[oi])) {
                    onLifeLost(obs[oi]);
                    break;
                }
            }
        }

        // victoria (llegar al cofre). Se requiere un área real de juego.
        if (W > 40 && H > 40 && Math.hypot(bat.x - chest.x, bat.y - chest.y) < chest.r + bat.r - 4) {
            startWin();
        }

        updateParts(dt);
    }

    function maybeAddDrift() {
        var want = 1 + Math.floor(score / 6);
        if (want > 3) want = 3;
        var drifts = 0;
        for (var i = 0; i < obs.length; i++) if (obs[i].type === 'drift') drifts++;
        if (drifts < want) { makeKeyDrift(); hintEl.textContent = '¡Más cadenas sueltas! Ten cuidado 👀'; }
    }

    function startWin() {
        mode = 'win';
        tWin = 0;
        hudElem.style.opacity = '0';
        chest.openT = 0;
        burst(chest.x, chest.y, 20, 'bat');
        burst(chest.x, chest.y, 30, 'petal');
        burst(chest.x, chest.y, 16, 'spark');
    }

    function revealReward() {
        showFinalMessage();
        screenGame.classList.remove('active');
        document.body.classList.add('warm');
        screenReward.classList.add('active');
        setTimeout(function () { screenReward.classList.add('show'); }, 60);
        // lluvia de flores
        var emojis = ['🌻', '🌼', '💛', '✨', '🦋', '🌕'];
        var count = window.innerWidth < 600 ? 18 : 30;
        for (var i = 0; i < count; i++) {
            (function (i) {
                rainTimeouts.push(setTimeout(function () {
                    var el = document.createElement('div');
                    el.className = 'fl-em';
                    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                    el.style.left = (Math.random() * 98) + 'vw';
                    el.style.animationDuration = (5 + Math.random() * 6) + 's';
                    el.style.animationDelay = (Math.random() * 2) + 's';
                    el.style.setProperty('--spin', (Math.round(Math.random()) ? '' : '-') + (200 + Math.random() * 260) + 'deg');
                    document.getElementById('rain').appendChild(el);
                    (function (e2) { setTimeout(function () { e2.remove(); }, 13500); })(el);
                }, Math.random() * 2500 + i * 700));
            })(i);
        }
        // La música no se toca ni se reinicia aquí: solo empieza la primera
        // vez que entras (o si pulsas el botón 🎵) y sigue de corrido.
    }

    // ---------- Render ----------
    function render() {
        if (!started) return;
        drawBackground();
        drawRod();
        var warmT = mode === 'game' ? 0 : Math.min(1, tWin / 1.5);
        // cadenas de plata (obstáculos)
        for (var i = 0; i < obs.length; i++) {
            var o = obs[i];
            if (o.type === 'pendulum') {
                ctx.save();
                ctx.globalAlpha = 1 - warmT * 0.4;
                chainPath(o.anchorX, rodY, o.pivotX, o.pivotY);
                drawPendant(o.pivotX, o.pivotY, o.angle * 0.4 + 0.5, 0.65);
                ctx.restore();
            } else {
                ctx.save();
                ctx.globalAlpha = 1 - warmT * 0.4;
                drawPendant(o.x, o.y, o.rot, 0.8);
                ctx.restore();
            }
        }
        drawFlowers();
        ctx.save();
        ctx.globalAlpha = 1 - warmT * 0.7;
        drawChest(chest);
        ctx.restore();
        // murciélago
        if (mode === 'game' || tWin < 0.35) {
            if (bat.inv > 0 && mode === 'game') ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 22);
            var s = 1 + Math.sin(time * 3.1) * 0.05;
            drawBatBody(bat.x, bat.y, s, Math.sin(time * 12), null);
            ctx.globalAlpha = 1;
        }
        // la llave de plata que lleva el murciélago
        if (mode === 'game') {
            var kx = bat.x - 4, ky = bat.y + 30 + Math.sin(time * 2.6) * 2;
            chainPath(bat.x - 4, bat.y + 8, kx, ky);
            drawKey(kx, ky, 0.5 + Math.sin(time * 2.2) * 0.35, 0.9);
        }
        drawParts();
        vignette();
    }

    // ---------- Bucle ----------
    // DPR adaptativo: baja la resolución solo si el juego va lento de forma
    // sostenida, la sube solo si va sobrado bastante rato, y espera un respiro
    // entre cambios para no provocar una lluvia de resize() (que era la causa
    // de que "se teletransportaran" los objetos y no recuperara la fluidez).
    var baseDPR = Math.min(window.devicePixelRatio || 1, 2);
    var fpsT = 0, frames = 0, dprWait = 0, lowStreak = 0, highStreak = 0;
    function monitorFps(dt) {
        if (dt <= 0) return;
        fpsT += dt; frames++;
        if (fpsT < 4) return;
        var fps = frames / fpsT;
        frames = 0; fpsT = 0;
        if (dprWait > 0) { dprWait -= 4; return; }
        if (fps < 42) { lowStreak++; highStreak = 0; }
        else if (fps > 57) { highStreak++; lowStreak = 0; }
        else { lowStreak = 0; highStreak = 0; }
        if (lowStreak >= 2 && DPR > 1) {
            dprWait = 8;
            DPR = Math.max(1, Math.round((DPR - 0.25) * 4) / 4);
            resize();
        } else if (highStreak >= 3 && DPR < baseDPR) {
            dprWait = 12;
            DPR = Math.min(baseDPR, Math.round((DPR + 0.25) * 4) / 4);
            resize();
        }
    }

function frame(now) {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        // En inicio y en la pantalla final el canvas no se usa: se pausa el
        // bucle de dibujo para ahorrar CPU (la lluvia ya es CSS).
        if (!screenGame.classList.contains('active')) {
            return requestAnimationFrame(frame);
        }
        monitorFps(dt);
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    // ---------- Reiniciar ----------
    var rainTimeouts = [];

    function clearRain() {
        for (var i = 0; i < rainTimeouts.length; i++) clearTimeout(rainTimeouts[i]);
        rainTimeouts = [];
        var rn = document.getElementById('rain');
        while (rn.firstChild) rn.removeChild(rn.firstChild);
    }

    function restartGame() {
        clearTimeout(oopsTimer);
        oopsMsg.classList.remove('show');
        tierEl.classList.remove('show');
        clearRain();
        screenReward.classList.remove('active', 'show');
        document.body.classList.remove('warm');
        hudElem.style.opacity = '';
        resize();
        initLevel();
        screenGame.classList.add('active');
    }

    var restartBtn = document.getElementById('restartBtn');
    restartBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    restartBtn.addEventListener('click', restartGame);

    // ---------- Arranque ----------
    function startGame() {
        screenStart.classList.remove('active');
        hudElem.style.opacity = '';
        // Solo intenta arrancar la música si aún no suena y el usuario
        // no la apagó; nunca se reinicia desde cero si ya está sonando.
        if (!userToggled && musicOn !== true) autoStartMusic();
        setTimeout(function () {
            screenGame.classList.add('active');
            resize();
            initLevel();
        }, 120);
    }
    btnStart.addEventListener('click', startGame);

    // polvo flotante
    rug = 18;
    dust = [];
    for (var di = 0; di < rug; di++) dust.push({ x: 0, y: 0, r: 1 + Math.random() * 2, p: Math.random() * 7, vy: 4 + Math.random() * 7 });

    buildStars();
    buildSprites();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });
    requestAnimationFrame(function (n) { last = n; requestAnimationFrame(frame); });
})();