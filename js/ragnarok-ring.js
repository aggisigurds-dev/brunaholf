/* <ragnarok-ring> — the Jarvis Ragnarök core as a web component.
   <ragnarok-ring size="340" label="KJARNI" mode="core|gauge|tala" value="0.6" active></ragnarok-ring>
   Attributes: size (px), label, sub (small text under label), mode, value (0-1, gauge only),
   active (speeds everything up, e.g. while listening), bearings (show 000-330 marks), density (0.2-2, particle multiplier).
   Fires 'toggle' on click when mode="tala". Set .active = true/false from JS. */
(() => {
  const CSS = `
  :host{display:inline-block;position:relative;contain:layout}
  .w{position:relative;width:100%;height:100%;font-family:'Chakra Petch','JetBrains Mono',monospace;cursor:default}
  :host([mode="tala"]) .w{cursor:pointer}
  .l{position:absolute;border-radius:50%}
  .haze{inset:3%;background:radial-gradient(circle,rgba(255,150,40,.5) 0%,rgba(210,80,20,.22) 32%,transparent 64%);animation:pulse 3s ease-in-out infinite}
  .r1{inset:10%;background:conic-gradient(from 0deg,#ffb347 0 38deg,transparent 38deg 52deg,#c9982f 52deg 70deg,transparent 70deg 74deg,#ff8c2a 74deg 140deg,transparent 140deg 168deg,#e6b04a 168deg 176deg,transparent 176deg 190deg,#ffcf6a 190deg 262deg,transparent 262deg 300deg,#d2691e 300deg 318deg,transparent 318deg 324deg,#ffb347 324deg 360deg);-webkit-mask:radial-gradient(circle,transparent calc(50% - 7px),#000 calc(50% - 6px),#000 calc(50% - 1px),transparent 50%);mask:radial-gradient(circle,transparent calc(50% - 7px),#000 calc(50% - 6px),#000 calc(50% - 1px),transparent 50%);filter:drop-shadow(0 0 8px rgba(255,140,40,.9));animation:spin 140s linear infinite}
  .r2{inset:13%;background:conic-gradient(from 90deg,transparent 0 20deg,#ff9a3a 20deg 30deg,transparent 30deg 95deg,#ffd98a 95deg 160deg,transparent 160deg 200deg,#b5651d 200deg 215deg,transparent 215deg 250deg,#ffb347 250deg 330deg,transparent 330deg);-webkit-mask:radial-gradient(circle,transparent calc(50% - 3px),#000 calc(50% - 2px),#000 50%);mask:radial-gradient(circle,transparent calc(50% - 3px),#000 calc(50% - 2px),#000 50%);filter:drop-shadow(0 0 6px rgba(255,170,60,.9));animation:spinr 110s linear infinite}
  .r3{inset:8%;background:repeating-conic-gradient(from 0deg,#ff8c2a 0deg 1deg,transparent 1deg 5.5deg,#ffcf6a 5.5deg 6deg,transparent 6deg 17deg);-webkit-mask:radial-gradient(circle,transparent calc(50% - 5px),#000 calc(50% - 4px),#000 50%);mask:radial-gradient(circle,transparent calc(50% - 5px),#000 calc(50% - 4px),#000 50%);opacity:.8;animation:spin 300s linear infinite,flicker 8s steps(1) infinite}
  .face{inset:17%;background:radial-gradient(circle at 50% 50%,#050505 55%,rgba(60,20,5,.9) 80%,rgba(120,40,8,.5) 100%);box-shadow:inset 0 0 40px rgba(255,120,30,.35)}
  .comet{inset:13%;border:4px solid transparent;border-top-color:#fff0c0;border-right-color:rgba(255,120,40,.6);animation:spin 18s linear infinite;filter:drop-shadow(0 0 10px rgba(255,140,40,1))}
  .arc{inset:17%;-webkit-mask:radial-gradient(circle,transparent calc(50% - 5px),#000 calc(50% - 4px),#000 50%);mask:radial-gradient(circle,transparent calc(50% - 5px),#000 calc(50% - 4px),#000 50%);filter:drop-shadow(0 0 6px rgba(255,140,40,.9))}
  .needle{position:absolute;left:50%;top:50%;width:2px;height:28%;margin-left:-1px;transform-origin:50% 0;background:linear-gradient(180deg,#fff6d8,#ff9a3a 60%,transparent);box-shadow:0 0 6px rgba(255,160,60,.9)}
  .hub{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:radial-gradient(circle,#fff6d8,#ff8c2a);box-shadow:0 0 10px #ff9a3a}
  canvas{position:absolute;inset:6%;width:100%;height:100%;border-radius:50%}
  .txt{position:absolute;inset:32%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:12%;box-sizing:border-box;gap:4px;text-align:center;pointer-events:none;color:#ffcf6a;text-shadow:0 0 3px #000,0 0 6px #000,0 0 10px rgba(255,140,40,.9);font-weight:600;letter-spacing:.3em}
  .txt small{font-size:max(7px,.6em);letter-spacing:.2em;color:#ffcf6a;font-weight:600;text-shadow:0 0 3px #000,0 0 6px #000}
  .gl{position:absolute;left:-10%;right:-10%;top:100%;margin-top:4px;text-align:center;font-weight:600;letter-spacing:.06em;color:#f3e4bf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  :host([mode="gauge"]){margin-bottom:18px}
  .b{position:absolute;transform:translate(-50%,-50%);font-size:9px;letter-spacing:.14em;color:#ff9a3a;text-shadow:0 0 6px rgba(255,120,30,.8)}
  :host([active]) .r1{animation-duration:30s}:host([active]) .r2{animation-duration:22s}:host([active]) .comet{animation-duration:4s}
  @keyframes spin{to{transform:rotate(360deg)}}@keyframes spinr{to{transform:rotate(-360deg)}}
  @keyframes pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
  @keyframes flicker{0%,92%,100%{opacity:1}93%{opacity:.4}95%{opacity:1}97%{opacity:.6}}`;

  class RagnarokRing extends HTMLElement {
    static get observedAttributes() { return ['size', 'label', 'sub', 'mode', 'value', 'active', 'bearings', 'density']; }
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._active = this.hasAttribute('active'); }
    get active() { return this.hasAttribute('active'); }
    set active(v) { v ? this.setAttribute('active', '') : this.removeAttribute('active'); }
    connectedCallback() { this.render(); this.addEventListener('click', this._click = () => { if (this.getAttribute('mode') === 'tala') { this.active = !this.active; this.dispatchEvent(new CustomEvent('toggle', { detail: { active: this.active }, bubbles: true })); } }); }
    disconnectedCallback() { cancelAnimationFrame(this.raf); this.removeEventListener('click', this._click); }
    attributeChangedCallback(n) { if (n === 'active') return; if (this.isConnected) this.render(); }
    render() {
      cancelAnimationFrame(this.raf);
      const size = +this.getAttribute('size') || 340, mode = this.getAttribute('mode') || 'core';
      const label = this.getAttribute('label') || '', sub = this.getAttribute('sub') || '';
      const value = Math.max(0, Math.min(1, +this.getAttribute('value') || 0));
      const fs = Math.max(mode === "gauge" ? 9 : 11, Math.round(size * 0.04));
      this.style.width = this.style.height = size + 'px';
      let bearings = '';
      if (this.hasAttribute('bearings')) for (let i = 0; i < 12; i++) { const d = i * 30, r = (d - 90) * Math.PI / 180, R = 44; bearings += `<span class="b" style="left:${50 + Math.cos(r) * R}%;top:${50 + Math.sin(r) * R}%">${String(d).padStart(3, '0')}</span>`; }
      const gauge = mode === 'gauge' ? `<div class="l arc" style="background:conic-gradient(from -135deg,#fff0c0 0deg,#ff9a3a ${value * 270}deg,transparent ${value * 270}deg)"></div><div class="needle" style="transform:rotate(${-135 + value * 270}deg)"></div><div class="hub"></div>` : '';
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="w">
        <div class="l haze"></div><div class="l r1"></div><div class="l r2"></div><div class="l r3"></div><div class="l face"></div><div class="l comet"></div>
        <canvas width="${size * 2}" height="${size * 2}"></canvas>${gauge}${bearings}
        ${mode === "gauge" ? `<div class="gl" style="font-size:${fs}px">${label}</div>` : `<div class="txt" style="font-size:${fs}px">${label}${sub ? `<small>${sub}</small>` : ''}</div>`}</div>`;
      this.startCanvas(this.shadowRoot.querySelector('canvas'), +this.getAttribute('density') || (mode === 'core' ? 1 : 0.3));
    }
    startCanvas(cv, k) {
      const ctx = cv.getContext('2d'), W = cv.width, C = W / 2, R = W * 0.35;
      const pts = Array.from({ length: Math.round(700 * k) }, () => ({ a: Math.random() * 6.28, r: Math.sqrt(Math.random()) * R, s: 0.6 + Math.random() * 1.6, w: (Math.random() - 0.5) * 0.004, ph: Math.random() * 6.28 }));
      const arcs = Array.from({ length: Math.round(42 * Math.max(k, 0.6)) }, () => ({ r: R * (0.55 + Math.random() * 0.55), a: Math.random() * 6.28, len: 0.1 + Math.random() * 1.2, w: 1 + Math.random() * 3, sp: (Math.random() - 0.5) * 0.0025, ph: Math.random() * 6.28, hot: Math.random() > 0.6 }));
      const embers = Array.from({ length: Math.round(90 * Math.max(k, 0.5)) }, () => ({ x: Math.random() * W, y: Math.random() * W, vy: 0.3 + Math.random() * 0.9, s: 0.5 + Math.random() * 1.5, ph: Math.random() * 6.28 }));
      const sc = W / 680; let t = 0;
      const draw = () => {
        t += 0.016; ctx.clearRect(0, 0, W, W);
        const sp = this.active ? 3 : 1;
        for (const a of arcs) {
          a.a += a.sp * sp; const fl = 0.5 + 0.5 * Math.sin(t * (0.8 + a.w * 0.3) + a.ph); if (fl < 0.12) continue;
          ctx.beginPath(); ctx.arc(C, C, a.r + Math.sin(t + a.ph) * 2, a.a, a.a + a.len); ctx.lineWidth = a.w * sc;
          ctx.strokeStyle = a.hot ? `rgba(255,${200 + 40 * fl | 0},140,${(0.35 + 0.6 * fl).toFixed(2)})` : `rgba(${230 + 25 * fl | 0},${110 + 60 * fl | 0},30,${(0.25 + 0.5 * fl).toFixed(2)})`;
          ctx.shadowBlur = 14 * sc; ctx.shadowColor = 'rgba(255,140,40,0.9)'; ctx.stroke();
        }
        ctx.shadowBlur = 0;
        for (const e of embers) {
          e.y -= e.vy * sp * sc; e.x += Math.sin(t * 2 + e.ph) * 0.4; if (e.y < 0) { e.y = W; e.x = Math.random() * W; }
          if (Math.hypot(e.x - C, e.y - C) > R * 1.15) continue;
          const q = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + e.ph));
          ctx.fillStyle = `rgba(255,${120 + 100 * q | 0},40,${(0.3 + 0.6 * q).toFixed(2)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s * sc, 0, 6.28); ctx.fill();
        }
        for (const p of pts) {
          p.a += p.w * sp; const x = C + Math.cos(p.a) * p.r, y = C + Math.sin(p.a) * p.r, q = 1 - p.r / R, tw = 0.5 + 0.5 * Math.sin(t * 2 + p.ph);
          ctx.fillStyle = `rgba(255,${Math.round(175 + 60 * q)},${Math.round(70 + 90 * q)},${(0.25 + 0.7 * q * tw).toFixed(2)})`;
          ctx.beginPath(); ctx.arc(x, y, p.s * sc * (this.active ? 1.4 : 1), 0, 6.28); ctx.fill();
        }
        const g = ctx.createRadialGradient(C, C, 0, C, C, (40 + (this.active ? 14 * Math.sin(t * 6) : 6 * Math.sin(t * 2))) * sc);
        g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.3, 'rgba(255,190,80,0.8)'); g.addColorStop(0.7, 'rgba(230,90,20,0.35)'); g.addColorStop(1, 'rgba(200,60,10,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, 90 * sc, 0, 6.28); ctx.fill();
        ctx.lineWidth = 2.5 * sc; ctx.shadowBlur = 18 * sc; ctx.shadowColor = 'rgba(255,200,90,1)';
        for (let i = 0; i < 5; i++) { const rr = (14 + i * 9 + Math.sin(t * 2 + i) * 4) * sc, st = t * (1.2 + i * 0.3) + i; ctx.beginPath(); ctx.arc(C, C, rr, st, st + 1.6 + Math.sin(t + i)); ctx.strokeStyle = `rgba(255,${210 - i * 20},${120 - i * 18},${0.9 - i * 0.12})`; ctx.stroke(); }
        ctx.shadowBlur = 0;
        this.raf = requestAnimationFrame(draw);
      };
      draw();
    }
  }
  if (!customElements.get('ragnarok-ring')) customElements.define('ragnarok-ring', RagnarokRing);
})();
