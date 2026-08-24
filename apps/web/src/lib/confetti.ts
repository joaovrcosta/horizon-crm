import confetti from "canvas-confetti";

const COLORS = ["#4f46e5", "#635bff", "#7a73ff", "#9b96ff", "#c4c0ff", "#22d3ee"];

export function fireConfetti() {
  const count = 160;
  const defaults = {
    origin: { y: 0.65 },
    colors: COLORS,
    disableForReducedMotion: true,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    void confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
