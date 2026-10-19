// One requestAnimationFrame loop for every scroll-linked scene on the page.
// Scenes register a tick; only scenes near the viewport are measured, and a
// tick runs only when its progress actually changed.

type Tick = (p: number) => void;
type Mode = 'pin' | 'pass';

interface Scene {
  el: HTMLElement;
  tick: Tick;
  mode: Mode;
  near: boolean;
  last: number;
  /** Height of the pinned child (100svh). Stable while a phone's address bar moves. */
  stage: number;
}

const scenes = new Map<Element, Scene>();
let vh = window.innerHeight;
let queued = 0;

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function measure(s: Scene): number {
  const r = s.el.getBoundingClientRect();
  if (s.mode === 'pin') {
    // 0 when the scene's top meets the viewport top, 1 when the sticky child
    // stops sticking: exactly the time it is pinned. Measured against the
    // child's own height rather than innerHeight, which jumps on mobile as the
    // address bar slides in and out during a swipe.
    const range = r.height - s.stage;
    return range > 0 ? clamp(-r.top / range) : r.top < 0 ? 1 : 0;
  }
  // 0 as the element enters at the bottom, 1 as it leaves at the top.
  return clamp((vh - r.top) / (vh + r.height));
}

function frame() {
  queued = 0;
  for (const s of scenes.values()) {
    if (!s.near) continue;
    const p = measure(s);
    if (p !== s.last) {
      s.last = p;
      s.tick(p);
    }
  }
}

// How many scenes are near the viewport. With none near (the hero, most of the
// page), scrolling never wakes the main thread at all.
let nearCount = 0;

function request() {
  if (!queued && nearCount > 0) queued = requestAnimationFrame(frame);
}

const nearby = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const s = scenes.get(entry.target);
      if (!s) continue;
      // Leaving still gets one last measurement, so a fast fling lands the
      // scene on its end state instead of freezing mid-way.
      if (!entry.isIntersecting && s.near) {
        const p = measure(s);
        if (p !== s.last) {
          s.last = p;
          s.tick(p);
        }
      }
      if (entry.isIntersecting !== s.near) nearCount += entry.isIntersecting ? 1 : -1;
      s.near = entry.isIntersecting;
    }
    request();
  },
  { rootMargin: '25% 0px 25% 0px' },
);

addEventListener('scroll', request, { passive: true });
addEventListener('resize', () => {
  vh = window.innerHeight;
  request();
});

// Re-measure only when a pinned stage really changes size (rotation, window
// resize), not on every address-bar movement.
const sized = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const s = scenes.get((entry.target as HTMLElement).parentElement!);
    if (s) {
      s.stage = (entry.target as HTMLElement).offsetHeight;
      s.last = -1;
    }
  }
  request();
});

export function onScroll(el: HTMLElement | null, tick: Tick, mode: Mode = 'pin') {
  if (!el) return;
  const child = el.firstElementChild as HTMLElement | null;
  scenes.set(el, { el, tick, mode, near: false, last: -1, stage: child?.offsetHeight ?? vh });
  nearby.observe(el);
  if (mode === 'pin' && child) sized.observe(child);
}

/** Run once when the element first comes into view. */
export function onceVisible(
  el: Element | null,
  run: () => void,
  rootMargin = '0px 0px -18% 0px',
) {
  if (!el) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { rootMargin },
  );
  io.observe(el);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map p from [start, end] onto [0, 1]. */
export const span = (p: number, start: number, end: number) => clamp((p - start) / (end - start));
