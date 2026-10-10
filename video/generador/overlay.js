// Capa de presentación inyectada en la página: cursor visible, subtítulos,
// placas de título y resaltado. Todo pointer-events:none, no interfiere con la app.
() => {
  if (window.__ov) return;
  const css = `
  #ov-root,#ov-root *{box-sizing:border-box;font-family:Inter,system-ui,sans-serif}
  #ov-cursor{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);transition:opacity .2s}
  #ov-ripple{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:999px;border:3px solid #a06f24;z-index:2147483646;pointer-events:none;opacity:0}
  #ov-ripple.go{animation:ovr .5s ease-out}
  @keyframes ovr{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(1.6)}}
  #ov-cap{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);max-width:880px;width:calc(100% - 520px);min-width:560px;z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;
    background:rgba(29,27,27,.93);color:#fff;border-radius:14px;padding:16px 22px 17px;box-shadow:0 12px 32px rgba(0,0,0,.28);border-left:5px solid #c08a3a}
  #ov-cap.on{opacity:1;transform:translate(-50%,0)}
  #ov-cap .k{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#e2b56d;font-weight:700;margin-bottom:5px}
  #ov-cap .t{font-size:21px;font-weight:700;line-height:1.25}
  #ov-cap .d{font-size:16px;line-height:1.4;color:#e9e4e4;margin-top:5px}
  #ov-card{position:fixed;inset:0;z-index:2147483644;pointer-events:none;opacity:0;transition:opacity .5s;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(1200px 600px at 30% 20%,rgba(192,138,58,.22),transparent 60%),#1d1b1b;color:#fff;text-align:center}
  #ov-card.on{opacity:1}
  #ov-card img{width:96px;height:96px;margin:0 auto 26px;display:block}
  #ov-card .b{font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;color:#e2b56d;font-weight:700}
  #ov-card .h{font-size:52px;font-weight:800;letter-spacing:-.02em;margin-top:6px}
  #ov-card .s{font-size:21px;color:#cfc8c8;margin-top:14px;max-width:760px;line-height:1.45}
  #ov-card .n{display:inline-block;margin-top:26px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#9b9393;border:1px solid #4a4545;border-radius:999px;padding:6px 14px}
  #ov-ring{position:fixed;z-index:2147483643;pointer-events:none;border:3px solid #c08a3a;border-radius:12px;box-shadow:0 0 0 9999px rgba(29,27,27,.28);opacity:0;transition:all .35s}
  #ov-ring.on{opacity:1}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'ov-root';
  root.innerHTML = `
    <div id="ov-ring"></div>
    <div id="ov-card"><div><img src="/logo-mark-blanco.png" alt=""><div class="b">Estudio Bonta</div><div class="h"></div><div class="s"></div><div class="n"></div></div></div>
    <div id="ov-cap"><div class="k"></div><div class="t"></div><div class="d"></div></div>
    <div id="ov-ripple"></div>
    <svg id="ov-cursor" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#1d1b1b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(root);
  const $ = (id) => document.getElementById(id);
  const cur = $('ov-cursor'), rip = $('ov-ripple');
  document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', (e) => { rip.style.left = e.clientX + 'px'; rip.style.top = e.clientY + 'px'; rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go'); }, true);
  window.__ov = {
    caption(k, t, d) { const c = $('ov-cap'); c.querySelector('.k').textContent = k || ''; c.querySelector('.t').textContent = t || ''; c.querySelector('.d').textContent = d || ''; c.classList.add('on'); },
    hideCaption() { $('ov-cap').classList.remove('on'); },
    card(h, s, n) { const c = $('ov-card'); c.querySelector('.h').textContent = h; c.querySelector('.s').textContent = s || ''; const nn = c.querySelector('.n'); nn.textContent = n || ''; nn.style.display = n ? 'inline-block' : 'none'; c.classList.add('on'); cur.style.opacity = 0; },
    hideCard() { $('ov-card').classList.remove('on'); cur.style.opacity = 1; },
    ring(r) { const g = $('ov-ring'); const p = 8; Object.assign(g.style, { left: r.x - p + 'px', top: r.y - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' }); g.classList.add('on'); },
    hideRing() { $('ov-ring').classList.remove('on'); },
    cursor(show) { cur.style.opacity = show ? 1 : 0; },
  };
}
