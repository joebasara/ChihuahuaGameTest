const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// --- Resize canvas ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Images ---
const background = new Image();
background.src = "background.png";

const character = new Image();
character.src = "character.png";

const characterSilhouette = new Image();
characterSilhouette.src = "character_silhouette.png";

const durianImg = new Image();
durianImg.src = "durian.png";

const healthImgs = [new Image(), new Image(), new Image()];
healthImgs[0].src = "health1.png";
healthImgs[1].src = "health2.png";
healthImgs[2].src = "health3.png";

// --- Physics ---
const GRAVITY = 0.6;
const JUMP_FORCE = 16;
const MOVE_ACCEL = 0.6;
const AIR_ACCEL = 0.4;
const MAX_SPEED = 7;
const FRICTION = 0.8;

// --- Camera ---
let cameraX = 0;
let bgScale = 1;
let bgScaledWidth = 0;

// --- Player ---
const player = {
  x: 50,
  y: 200,
  width: 100,
  height: 150,
  velocityX: 0,
  velocityY: 0,
  jumpsLeft: 2,
  maxJumps: 2,
  health: 3,
  alive: true,
  invincible: false,
  blinkTimer: 0,
  blinkCount: 0
};

// --- Game state ---
let gameOver = false;

// --- Ground ---
const groundOffset = 20;
let groundY;

// --- Input ---
const keys = {};
document.addEventListener("keydown", e => {
  if (gameOver) resetGame();
  keys[e.key] = true;
});
document.addEventListener("keyup", e => keys[e.key] = false);

// --- Full-screen mobile swipe-to-move + tap-to-jump ---
const ongoingTouches = {};
let swipeActive = false;
let swipeDir = 0; // -1 left, 1 right
let tapStart = null;

function getTouchPos(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (canvas.width / rect.width),
    y: (touch.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    const pos = getTouchPos(touch);
    ongoingTouches[touch.identifier] = pos;

    if (gameOver) {
      resetGame();
      return;
    }

    tapStart = pos; // start position for tap detection
    swipeActive = true;
    swipeDir = 0;
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  for (let touch of e.touches) {
    const prev = ongoingTouches[touch.identifier];
    const pos = getTouchPos(touch);
    if (!prev) continue;

    const dx = pos.x - prev.x;

    if (Math.abs(dx) > 10) {
      swipeDir = dx > 0 ? 1 : -1; // detect swipe direction
    }

    ongoingTouches[touch.identifier] = pos;
  }
}, { passive: false });

canvas.addEventListener("touchend", e => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    const start = tapStart;
    const end = getTouchPos(touch);
    delete ongoingTouches[touch.identifier];

    // Tap detection: small movement
    if (start && Math.abs(end.x - start.x) < 10 && Math.abs(end.y - start.y) < 10) {
      if (player.jumpsLeft > 0) {
        player.velocityY = -JUMP_FORCE;
        player.jumpsLeft--;
      }
    }
  }

  // Stop movement if no fingers remain
  if (Object.keys(ongoingTouches).length === 0) {
    swipeActive = false;
    swipeDir = 0;
  }
});

// --- Background scale ---
background.onload = () => {
  bgScale = canvas.height / background.height;
  bgScaledWidth = background.width * bgScale;
};

// --- Durians ---
const durians = [];
const SPAWN_INTERVAL = 85;
const MAX_DURIANS = 5;
const DURIAN_SIZE = 90;
let spawnTimer = 0;

const GROUND_SPEED = [5, 8];
const DROP_SPEED = [6, 9];
const BOUNCE_FORCE = 10;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// --- Collision ---
function collide(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + a.width > b.x &&
    a.y < b.y + b.size &&
    a.y + a.height > b.y
  );
}

// --- Reset ---
function resetGame() {
  player.x = 50;
  player.y = 200;
  player.velocityX = 0;
  player.velocityY = 0;
  player.health = 3;
  player.alive = true;
  player.invincible = false;
  player.blinkTimer = 0;
  player.blinkCount = 0;
  player.jumpsLeft = player.maxJumps;

  durians.length = 0;
  spawnTimer = 0;
  cameraX = 0;
  gameOver = false;
}

// --- Update ---
function update() {
  groundY = canvas.height - player.height - groundOffset;

  if (!player.alive) {
    player.velocityY += GRAVITY;
    player.y += player.velocityY;
    if (player.y > canvas.height + 200) gameOver = true;
    return;
  }

  const onGround = player.y >= groundY;

  // --- Horizontal movement ---
  if (swipeActive) {
    if (swipeDir === 1) player.velocityX += onGround ? MOVE_ACCEL : AIR_ACCEL;
    else if (swipeDir === -1) player.velocityX -= onGround ? MOVE_ACCEL : AIR_ACCEL;
  } else if (!keys["ArrowLeft"] && !keys["ArrowRight"]) {
    if (onGround) player.velocityX *= FRICTION;
  }

  player.velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.velocityX));
  player.x += player.velocityX;

  // --- Keyboard fallback ---
  if (keys["ArrowRight"]) player.velocityX += onGround ? MOVE_ACCEL : AIR_ACCEL;
  if (keys["ArrowLeft"]) player.velocityX -= onGround ? MOVE_ACCEL : AIR_ACCEL;

  // --- Gravity ---
  player.velocityY += GRAVITY;
  player.y += player.velocityY;

  // --- Ground collision ---
  if (player.y >= groundY) {
    player.y = groundY;
    player.velocityY = 0;
    player.jumpsLeft = player.maxJumps;
  }

  // --- Clamp horizontal ---
  player.x = Math.max(0, Math.min(player.x, bgScaledWidth - player.width));

  // --- Camera follow ---
  cameraX = player.x + player.width / 2 - canvas.width / 2;
  cameraX = Math.max(0, Math.min(cameraX, bgScaledWidth - canvas.width));

  // --- Spawn durians ---
  spawnTimer++;
  if (spawnTimer >= SPAWN_INTERVAL && durians.length < MAX_DURIANS) {
    const fromTop = Math.random() < 0.45;
    if (fromTop) {
      durians.push({
        x: cameraX + Math.random() * canvas.width,
        y: -DURIAN_SIZE,
        size: DURIAN_SIZE,
        vy: rand(DROP_SPEED[0], DROP_SPEED[1]) * 0.5, // slower fall
        bounced: false,
        type: "drop"
      });
    } else {
      const fromLeft = Math.random() < 0.5;
      durians.push({
        x: fromLeft ? cameraX - 150 : cameraX + canvas.width + 150,
        y: groundY + player.height - DURIAN_SIZE,
        size: DURIAN_SIZE,
        vx: fromLeft ? rand(GROUND_SPEED[0], GROUND_SPEED[1]) : -rand(GROUND_SPEED[0], GROUND_SPEED[1]),
        type: "ground"
      });
    }
    spawnTimer = 0;
  }

  // --- Update durians ---
  for (let i = durians.length - 1; i >= 0; i--) {
    const d = durians[i];
    if (d.type === "ground") {
      d.x += d.vx;
    } else {
      d.vy += GRAVITY * 0.5; // slower gravity
      d.y += d.vy;
      if (!d.bounced && d.y + d.size >= groundY + player.height) {
        d.y = groundY + player.height - d.size;
        d.vy = -BOUNCE_FORCE * 0.5; // slower bounce
        d.bounced = true;
      }
    }

    // --- Collision with player ---
    if (!player.invincible && collide(player, d)) {
      player.health--;
      player.invincible = true;
      player.blinkTimer = 10;
      player.blinkCount = 6;

      const dir = d.vx ? (d.vx > 0 ? 1 : -1) : (player.x < d.x ? -1 : 1);
      player.velocityX = 10 * dir;
      player.velocityY = -8;

      durians.splice(i, 1);

      if (player.health <= 0) {
        player.alive = false;
        player.velocityY = -18;
      }
      continue;
    }

    if (d.x < cameraX - 400 || d.x > cameraX + canvas.width + 400 || d.y > canvas.height + 300) {
      durians.splice(i, 1);
    }
  }

  if (player.invincible) {
    player.blinkTimer--;
    if (player.blinkTimer <= 0) {
      player.blinkCount--;
      player.blinkTimer = 10;
      if (player.blinkCount <= 0) player.invincible = false;
    }
  }
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(background, cameraX / bgScale, 0, canvas.width / bgScale, background.height, 0, 0, canvas.width, canvas.height);

  for (const d of durians) {
    ctx.drawImage(durianImg, d.x - cameraX, d.y, d.size, d.size);
  }

  const blink = player.invincible && player.blinkCount % 2 === 0;
  ctx.drawImage(blink ? characterSilhouette : character, player.x - cameraX, player.y, player.width, player.height);

  if (player.health > 0) ctx.drawImage(healthImgs[player.health - 1], 20, 20, 300, 80);

  if (gameOver) {
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.font = "22px Arial";
    ctx.fillText("Press any key or tap to restart", canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = "left";
  }
}

// --- Loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
