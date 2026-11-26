const pending = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function stop(target: Element) {
  pending.delete(target);
  observer?.unobserve(target);
  if (!pending.size) {
    observer?.disconnect();
    observer = undefined;
  }
}

export function observeFavicon(target: Element, load: () => void) {
  if (typeof IntersectionObserver === 'undefined') {
    load();
    return;
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const callback = pending.get(entry.target);
      if (!callback) continue;
      stop(entry.target);
      callback();
    }
  });
  pending.set(target, load);
  observer.observe(target);
  return () => stop(target);
}
