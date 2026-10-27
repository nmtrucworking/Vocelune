// Lightweight canvas confetti generator for session milestones
export function triggerConfetti(): void {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = ['#5949E8', '#D8F7F1', '#EAE8FF', '#1B786E', '#F59E0B', '#EC4899', '#3B82F6'];
  const particleCount = 75;

  interface Particle {
    x: number;
    y: number;
    color: string;
    size: number;
    vx: number;
    vy: number;
    rotation: number;
    vrot: number;
    opacity: number;
  }

  const particles: Particle[] = Array.from({ length: particleCount }, () => ({
    x: width * (0.3 + Math.random() * 0.4),
    y: height * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 6 + Math.random() * 6,
    vx: (Math.random() - 0.5) * 14,
    vy: -10 - Math.random() * 12,
    rotation: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 12,
    opacity: 1,
  }));

  const startTime = Date.now();
  const duration = 2400; // 2.4 seconds

  function animate() {
    if (!ctx) return;
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
      return;
    }

    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.vrot;
      p.opacity = Math.max(0, 1 - elapsed / duration);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}
