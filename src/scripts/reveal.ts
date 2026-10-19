// Prepare reveals before the page opts into enhanced styles. If this module
// cannot initialize, the root never receives `.js` and all content stays
// visible in its unenhanced layout.
export function initReveals() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.setAttribute('data-visible', ''));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-visible', '');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );

  items.forEach((el) => io.observe(el));
}
