// ============================================
// LANDING PAGE MOTION ENGINE
// One scroll listener + one eased frame loop drive every parallax layer by writing
// transforms straight to the DOM. Nothing here goes through React state, so scrolling
// never re-renders the page. Native scrolling is untouched (no scroll-jacking); the
// layers just glide to their position with easing, which is what reads as "smooth".
// Everything is cleaned up when the landing page unmounts.
// ============================================

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Calls onFrame(current, target) on every frame while the eased scroll value is still
// catching up with the real one. Frames are scheduled with rAF and a timer fallback, so
// they still run when the browser throttles animation frames (background panes).
export const createScroller = (onFrame, { ease = 0.11 } = {}) => {
  const reduce = prefersReducedMotion();
  let target = window.scrollY;
  let current = target;
  let pending = false;
  let raf = 0;
  let timer = 0;
  let stopped = false;

  const run = () => {
    if (!pending || stopped) return;
    pending = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    target = window.scrollY;
    current = reduce ? target : current + (target - current) * ease;
    if (Math.abs(target - current) < 0.08) current = target;
    onFrame(current, target);
    if (current !== target) schedule();
  };
  function schedule() {
    if (pending || stopped) return;
    pending = true;
    raf = requestAnimationFrame(run);
    timer = setTimeout(run, 48);
  }

  const poke = () => schedule();
  window.addEventListener('scroll', poke, { passive: true });
  window.addEventListener('resize', poke);
  schedule();

  return {
    poke,
    stop: () => {
      stopped = true;
      window.removeEventListener('scroll', poke);
      window.removeEventListener('resize', poke);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    },
  };
};

// Reads data-* attributes from elements under `root` and applies them every frame:
//   data-speed     translateY factor (0.3 = drifts slower than the page, -0.15 = faster)
//   data-x         translateX factor, same idea
//   data-rot       degrees of rotation per screen height scrolled
//   data-fade-out  fades the element out as it scrolls away (hero copy)
//   data-flatten   starts tilted back and settles flat as it enters the screen
//   data-progress  scaleY 0..1 as its parent section scrolls through the screen (timeline line)
//   data-page-progress  scaleX 0..1 for the whole page (top progress bar)
export const startParallax = (root) => {
  const reduce = prefersReducedMotion();
  let items = [];
  let docHeight = 1;

  const measure = () => {
    docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    items = [...root.querySelectorAll('[data-speed],[data-x],[data-rot],[data-fade-out],[data-flatten],[data-progress],[data-page-progress]')].map((el) => {
      // Position in the document without the transform this engine applied. Tilting and
      // filling elements are measured from their (untransformed) parent instead.
      const viaParent = el.dataset.progress !== undefined || el.dataset.flatten !== undefined;
      const rect = (viaParent ? el.parentElement : el).getBoundingClientRect();
      const base = viaParent ? 0 : el.__ty || 0;
      return {
        el,
        top: rect.top + window.scrollY - base,
        height: rect.height,
        speed: el.dataset.speed !== undefined ? Number(el.dataset.speed) : null,
        x: el.dataset.x !== undefined ? Number(el.dataset.x) : null,
        rot: el.dataset.rot !== undefined ? Number(el.dataset.rot) : null,
        fadeOut: el.dataset.fadeOut !== undefined,
        flatten: el.dataset.flatten !== undefined,
        progress: el.dataset.progress !== undefined,
        page: el.dataset.pageProgress !== undefined,
      };
    });
  };

  const frame = (scroll) => {
    const vh = window.innerHeight;
    for (const it of items) {
      const el = it.el;
      if (it.page) { el.style.transform = `scaleX(${clamp(scroll / docHeight)})`; continue; }
      if (it.progress) {
        el.style.transform = `scaleY(${clamp((scroll + vh * 0.65 - it.top) / (it.height * 0.9))})`;
        continue;
      }
      const center = it.top + it.height / 2;
      const d = scroll + vh / 2 - center; // > 0 once the element is above the middle of the screen
      if (Math.abs(d) > vh * 2 + it.height) continue; // far off screen: skip the work
      let t = '';
      if (it.speed !== null) { const y = d * it.speed; el.__ty = y; t += `translate3d(0,${y.toFixed(2)}px,0) `; }
      if (it.x !== null) t += `translate3d(${(d * it.x).toFixed(2)}px,0,0) `;
      if (it.rot !== null) t += `rotate(${((d / vh) * it.rot).toFixed(3)}deg) `;
      if (it.flatten) {
        const r = clamp((vh - (it.top - scroll)) / (vh * 0.95));
        t += `rotateX(${((1 - r) * 22).toFixed(2)}deg) scale(${(0.88 + r * 0.12).toFixed(4)}) `;
        el.style.opacity = String(0.35 + r * 0.65);
      }
      if (it.fadeOut) el.style.opacity = String(clamp(1 - (scroll - it.top) / (it.height * 0.75)));
      if (t) el.style.transform = t.trim();
    }
  };

  if (reduce) return () => {};

  measure();
  const scroller = createScroller(frame);
  const remeasure = () => { measure(); scroller.poke(); };
  const resizeObserver = new ResizeObserver(remeasure);
  resizeObserver.observe(root);
  window.addEventListener('load', remeasure);
  const settle = setTimeout(remeasure, 400); // fonts and images finishing

  return () => {
    clearTimeout(settle);
    resizeObserver.disconnect();
    window.removeEventListener('load', remeasure);
    scroller.stop();
  };
};
