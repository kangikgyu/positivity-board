const canvas = document.getElementById("characterCanvas");
const ctx = canvas.getContext("2d");
const characters = [];
const palette = [
  { body: "#ffe27a", cheek: "#ff9bb0", accent: "#f59e0b" },
  { body: "#9ee7ff", cheek: "#ffb4c4", accent: "#0ea5e9" },
  { body: "#b8f7b0", cheek: "#ffa7a7", accent: "#22c55e" },
  { body: "#ffd1f3", cheek: "#ff93c7", accent: "#ec4899" },
  { body: "#d8c7ff", cheek: "#ffb3bf", accent: "#8b5cf6" }
];

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createCharacters() {
  characters.length = 0;
  const count = Math.min(14, Math.max(8, Math.floor(window.innerWidth / 120)));

  for (let i = 0; i < count; i += 1) {
    const radius = randomBetween(18, 30);
    const color = palette[i % palette.length];
    characters.push({
      x: randomBetween(radius, window.innerWidth - radius),
      y: randomBetween(radius, window.innerHeight - radius),
      vx: randomBetween(-0.55, 0.55) || 0.35,
      vy: randomBetween(-0.45, 0.45) || -0.3,
      radius,
      mass: radius * radius,
      rotation: randomBetween(-0.25, 0.25),
      spin: randomBetween(-0.006, 0.006),
      body: color.body,
      cheek: color.cheek,
      accent: color.accent,
      smile: randomBetween(0.8, 1.2)
    });
  }
}

function drawCharacter(character) {
  const { x, y, radius } = character;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(character.rotation);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = character.body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(79, 120, 130, 0.35)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-radius * 0.35, -radius * 0.08, radius * 0.09, 0, Math.PI * 2);
  ctx.arc(radius * 0.35, -radius * 0.08, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "#234047";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-radius * 0.48, radius * 0.18, radius * 0.14, 0, Math.PI * 2);
  ctx.arc(radius * 0.48, radius * 0.18, radius * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = character.cheek;
  ctx.globalAlpha = 0.78;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(0, radius * 0.04, radius * 0.43 * character.smile, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.strokeStyle = "#234047";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(radius * 0.18, -radius * 0.72, radius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = character.accent;
  ctx.fill();

  ctx.restore();
}

function resolveWallCollision(character) {
  const { radius } = character;

  if (character.x - radius < 0) {
    character.x = radius;
    character.vx *= -1;
  } else if (character.x + radius > window.innerWidth) {
    character.x = window.innerWidth - radius;
    character.vx *= -1;
  }

  if (character.y - radius < 0) {
    character.y = radius;
    character.vy *= -1;
  } else if (character.y + radius > window.innerHeight) {
    character.y = window.innerHeight - radius;
    character.vy *= -1;
  }
}

function resolveCharacterCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const minDistance = a.radius + b.radius;

  if (distance === 0 || distance >= minDistance) return;

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const totalMass = a.mass + b.mass;

  a.x -= nx * overlap * (b.mass / totalMass);
  a.y -= ny * overlap * (b.mass / totalMass);
  b.x += nx * overlap * (a.mass / totalMass);
  b.y += ny * overlap * (a.mass / totalMass);

  const dvx = b.vx - a.vx;
  const dvy = b.vy - a.vy;
  const velocityAlongNormal = dvx * nx + dvy * ny;

  if (velocityAlongNormal > 0) return;

  const impulse = -(1.0 + 0.96) * velocityAlongNormal / (1 / a.mass + 1 / b.mass);
  const impulseX = impulse * nx;
  const impulseY = impulse * ny;

  a.vx -= impulseX / a.mass;
  a.vy -= impulseY / a.mass;
  b.vx += impulseX / b.mass;
  b.vy += impulseY / b.mass;

  a.spin += randomBetween(-0.004, 0.004);
  b.spin += randomBetween(-0.004, 0.004);
}

function animate() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  for (let i = 0; i < 28; i += 1) {
    const x = (i * 97 + performance.now() * 0.012) % window.innerWidth;
    const y = (i * 53) % window.innerHeight;
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  characters.forEach((character) => {
    character.x += character.vx;
    character.y += character.vy;
    character.rotation += character.spin;
    resolveWallCollision(character);
  });

  for (let i = 0; i < characters.length; i += 1) {
    for (let j = i + 1; j < characters.length; j += 1) {
      resolveCharacterCollision(characters[i], characters[j]);
    }
  }

  characters.forEach(drawCharacter);
  requestAnimationFrame(animate);
}

resizeCanvas();
createCharacters();
animate();

window.addEventListener("resize", () => {
  resizeCanvas();
  createCharacters();
});


let scrollOrbFrame = null;

function updateScrollOrbs() {
  scrollOrbFrame = null;
  const rotation = `${window.scrollY * 0.18}deg`;
  document.documentElement.style.setProperty("--scroll-rotate", rotation);
}

function requestScrollOrbUpdate() {
  if (scrollOrbFrame) return;
  scrollOrbFrame = requestAnimationFrame(updateScrollOrbs);
}

updateScrollOrbs();
window.addEventListener("scroll", requestScrollOrbUpdate, { passive: true });
