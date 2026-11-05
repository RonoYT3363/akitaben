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

export function stepBall(ball, bounds, pegs, deltaSeconds, blockers = []) {
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
  // ラッシュ専用の長方形ブロッカー。最も浅い方向へ押し戻して反射させる。
  for (const blocker of blockers) {
    if (!blocker || blocker.enabled === false) continue;
    const nearestX = Math.max(blocker.x, Math.min(ball.x, blocker.x + blocker.width));
    const nearestY = Math.max(blocker.y, Math.min(ball.y, blocker.y + blocker.height));
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= ball.radius * ball.radius) continue;
    if (distanceSquared > 1e-8) {
      const distance = Math.sqrt(distanceSquared);
      const nx = dx / distance;
      const ny = dy / distance;
      ball.x += nx * (ball.radius - distance);
      ball.y += ny * (ball.radius - distance);
      const velocityAlongNormal = ball.vx * nx + ball.vy * ny;
      if (velocityAlongNormal < 0) {
        ball.vx -= (1 + restitution) * velocityAlongNormal * nx;
        ball.vy -= (1 + restitution) * velocityAlongNormal * ny;
      }
    } else {
      const distances = [
        { d: Math.abs(ball.x - blocker.x), nx: -1, ny: 0 },
        { d: Math.abs(blocker.x + blocker.width - ball.x), nx: 1, ny: 0 },
        { d: Math.abs(ball.y - blocker.y), nx: 0, ny: -1 },
        { d: Math.abs(blocker.y + blocker.height - ball.y), nx: 0, ny: 1 }
      ].sort((a, b) => a.d - b.d);
      const side = distances[0];
      ball.x += side.nx * (ball.radius + side.d);
      ball.y += side.ny * (ball.radius + side.d);
      const velocityAlongNormal = ball.vx * side.nx + ball.vy * side.ny;
      if (velocityAlongNormal < 0) {
        ball.vx -= (1 + restitution) * velocityAlongNormal * side.nx;
        ball.vy -= (1 + restitution) * velocityAlongNormal * side.ny;
      }
    }
  }
  return ball.y <= bounds.height + ball.radius;
}

// 玉同士の円形衝突を解決する。玉は同じ質量として扱い、個数は変更しない。
export function resolveBallCollisions(balls) {
  if (balls.length < 2) return;
  // 位置補正を複数回行い、密集時のめり込みを減らす。
  for (let iteration = 0; iteration < 2; iteration++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const minDistance = a.radius + b.radius;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= minDistance * minDistance) continue;

        // 完全に同じ座標になった場合も、決定的な方向で押し分ける。
        if (distanceSquared < 1e-10) {
          dx = 1;
          dy = 0;
          distanceSquared = 1;
        }
        const distance = Math.sqrt(distanceSquared);
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = minDistance - distance;

        // 両方の玉を同じ距離だけ押し戻して、重なりを解消する。
        const correction = overlap * 0.5;
        a.x -= nx * correction;
        a.y -= ny * correction;
        b.x += nx * correction;
        b.y += ny * correction;

        // 接近している場合だけ、同じ質量の玉同士として反発させる。
        const relativeNormalVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relativeNormalVelocity < 0) {
          const impulse = -(1 + restitution) * relativeNormalVelocity * 0.5;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
        }
      }
    }
  }
}
