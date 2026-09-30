import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Crown } from 'lucide-react';
import { baseUrl } from './platform';
import './dragon.css';

export const INTRO_KEY = 'keven2026.dragon-intro.v1';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function shouldOpen() {
  if (reducedMotion()) return false;
  try { return sessionStorage.getItem(INTRO_KEY) !== 'seen'; } catch { return true; }
}

function DragonFire({ running }: { running: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!running || reducedMotion()) return;
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0, frame = 0;
    const resize = () => {
      const box = surface.getBoundingClientRect();
      width = box.width; height = box.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(surface);
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 96;
    const brush = sprite.getContext('2d')!;
    const glow = brush.createRadialGradient(48, 48, 0, 48, 48, 48);
    glow.addColorStop(0, '#fffce8'); glow.addColorStop(.15, '#ffe592');
    glow.addColorStop(.4, '#ff9f29b8'); glow.addColorStop(.65, '#e4480f50'); glow.addColorStop(1, '#aa1e0000');
    brush.fillStyle = glow; brush.fillRect(0, 0, 96, 96);
    type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; seed: number };
    const particles: Particle[] = [];
    const start = performance.now(); let previous = start;
    function draw(now: number) {
      const elapsed = now - start, dt = Math.min((now - previous) / 1000, .04); previous = now;
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = 'screen';
      const scale = width / 1600;
      const mouthX = width * .455, mouthY = height * .36;
      const intensity = Math.min(1, Math.max(0, (elapsed - 750) / 350)) * Math.min(1, Math.max(0, (3100 - elapsed) / 400));
      if (intensity > 0) for (let i = 0; i < Math.ceil(5 * intensity); i++) {
        particles.push({ x: mouthX, y: mouthY + (Math.random() - .5) * 12 * scale, vx: (650 + Math.random() * 700) * scale, vy: (-170 + Math.random() * 190) * scale, age: 0, life: .65 + Math.random() * .55, size: 8 + Math.random() * 16, seed: Math.random() * 8 });
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.age += dt;
        if (p.age > p.life) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        const progress = p.age / p.life;
        const radius = (p.size + progress * 120) * scale;
        const curl = Math.sin(p.seed + progress * 10) * progress * 34 * scale;
        ctx!.globalAlpha = (1 - progress) * .7;
        ctx!.drawImage(sprite, p.x - radius, p.y + curl - radius, radius * 2.8, radius * 2);
      }
      // Quelques braises dérivent au-delà du souffle, sans multiplier les éléments DOM.
      ctx!.globalAlpha = Math.max(0, Math.min(1, (elapsed - 600) / 700, (4400 - elapsed) / 1000));
      ctx!.fillStyle = '#f2b373';
      for (let i = 0; i < 24; i++) {
        const x = (i * 131 + elapsed * (.025 + i % 4 * .01)) % width;
        const y = height - ((i * 59 + elapsed * (.04 + i % 3 * .02)) % height);
        ctx!.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 3 : 1);
      }
      ctx!.globalAlpha = 1;
      if (elapsed < 4600) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [running]);
  return <canvas ref={canvas} className="dragon-fire" aria-hidden="true"/>;
}

export function DragonIntro() {
  const [open, setOpen] = useState(shouldOpen);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useCallback(() => {
    dialog.current?.close();
    setOpen(false); setReady(false); setLeaving(false);
    try { sessionStorage.setItem(INTRO_KEY, 'seen'); } catch { /* La navigation fonctionne sans stockage. */ }
  }, []);
  useEffect(() => {
    const replay = () => { setReady(false); setLeaving(false); setOpen(true); };
    window.addEventListener('replay-dragon', replay);
    return () => window.removeEventListener('replay-dragon', replay);
  }, []);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current!;
    modal.showModal();
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreference = () => { if (preference.matches) dismiss(); };
    preference.addEventListener('change', onPreference);
    // Une image qui ne charge pas ne doit jamais empêcher l’accès au pool.
    const safety = setTimeout(dismiss, 7000);
    return () => { clearTimeout(safety); preference.removeEventListener('change', onPreference); modal.close(); };
  }, [open, dismiss]);
  useEffect(() => {
    if (!open || !ready) return;
    const fade = setTimeout(() => setLeaving(true), reducedMotion() ? 1200 : 4200);
    const end = setTimeout(dismiss, reducedMotion() ? 1600 : 4600);
    return () => { clearTimeout(fade); clearTimeout(end); };
  }, [open, ready, dismiss]);
  useEffect(() => {
    if (!open || ready) return;
    const loading = setTimeout(dismiss, 2500);
    return () => clearTimeout(loading);
  }, [open, ready, dismiss]);
  if (!open) return null;
  return <dialog ref={dialog} className={`dragon-intro ${ready ? 'intro-ready' : ''} ${leaving ? 'intro-leaving' : ''}`} aria-labelledby="dragon-title" aria-describedby="dragon-description" onCancel={e => { e.preventDefault(); dismiss(); }}>
    <div className="intro-seal"><Crown size={22}/><span>LE CONSEIL DES SEPT<small>KEVEN2026</small></span></div>
    <div className="dragon-stage" aria-hidden="true">
      <img className="dragon-image" src={`${baseUrl}dragon.webp`} alt="" width="1536" height="1024" fetchPriority="high" onLoad={() => setReady(true)} onError={dismiss}/>
      <DragonFire running={ready}/>
    </div>
    <div className="intro-vignette" aria-hidden="true"/>
    <div className="intro-flare" aria-hidden="true"/>
    <div className="intro-copy"><p>SEPT MAISONS. UN SEUL TRÔNE.</p><h2 id="dragon-title">Par le feu.<br/><em>Pour le trône.</em></h2><span id="dragon-description">Le royaume vous attend.</span></div>
    <button className="intro-skip" autoFocus onClick={dismiss} onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.focus(); } }}>Entrer dans le royaume <ArrowRight size={17}/></button>
    <div className="intro-progress" aria-hidden="true"><span/></div>
  </dialog>;
}
