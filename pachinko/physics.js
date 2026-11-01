// 盤面の玉の物理演算を担当するモジュール。
// エディターから重力・反発係数を変更できます。
let gravity = 520;
let restitution = 0.72;

export function setPhysicsConfig(config = {}) {
  if (Number.isFinite(config.gravity)) gravity = Math.max(0, Math.min(2000, config.gravity));
  if (Number.isFinite(config.restitution)) restitution = Math.max(0, Math.min(1, config.restitution));
}

export function createBall(x, y, vx = 0, vy = 1) {
  return { x, y, vx, vy, radius: 5 };
}

export function stepBall(ball, bounds, pegs, deltaSeconds) {
  const dt = Math.min(deltaSeconds, 1 / 30);
  ball.vy += gravity * dt;
  if (ball.y > 245 && ball.x < 132) ball.vx += 145 * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < ball.radius || ball.x > bounds.width - ball.radius) {
    ball.x = Math.max(ball.radius, Math.min(bounds.width - ball.radius, ball.x));
    ball.vx *= -0.78;
  }
  if (ball.y < ball.radius) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.65;
  }

  for (const peg of pegs) {
    const dx = ball.x - peg.x;
    const dy = ball.y - peg.y;
    const minDistance = ball.radius + peg.radius;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared === 0 || distanceSquared >= minDistance * minDistance) continue;
    const distance = Math.sqrt(distanceSquared);
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minDistance - distance;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
    if (velocityAlongNormal < 0) {
      ball.vx -= (1 + restitution) * velocityAlongNormal * nx;
      ball.vy -= (1 + restitution) * velocityAlongNormal * ny;
    }
  }
  return ball.y <= bounds.height + ball.radius;
}
