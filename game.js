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

const characterJump = new Image();
characterJump.src = "character_jump.png";

const characterSilhouette = new Image();
characterSilhouette.src = "character_silhouette.png";

const durianImg = new Image();
durianImg.src = "durian.png";

const ballImgs = [new Image(), new Image()];
ballImgs[0].src = "ball1.png";
ballImgs[1].src = "ball2.png";

const healthImgs = [new Image(), new Image(), new Image()];
healthImgs[0].src = "health1.png";
healthImgs[1].src = "health2.png";
healthImgs[2].src = "health3.png";

// --- Physics ---
const GRAVITY = 1;
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
  blinkCount: 0,
  isJumping: false
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

// --- Mobile swipe-to-move + tap-to-jump ---
const ongoingTouches = {};
let swipeActive = false;
let swipeDir = 0;
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

    tapStart = pos;
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
      swipeDir = dx > 0 ? 1 : -1;
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

    if (start && Math.abs(end.x - start.x) < 10 && Math.abs(end.y - start.y) < 10) {
      if (player.jumpsLeft > 0) {
        player.velocityY = -JUMP_FORCE;
        player.jumpsLeft--;
      }
    }
  }

  if (Object.keys(ongoingTouches).length === 0) {
    swipeActive = false;
    swipeDir = 0;
  }
});

// --- Background scaling ---
background.onload = () => {
  bgScale = canvas.height / background.height;
  bgScaledWidth = background.width * bgScale;
};

// --- Durians ---
const durians = [];
const BALLS = [];
const SPAWN_INTERVAL = 120;
const MAX_DURIANS = 3;
const MAX_BALLS = 2;
const DURIAN_SIZE = 90;
const BALL_SIZE = 80;
let spawnTimer = 0;

const GROUND_SPEED = [5, 8];
const BALL_SPEED = [4, 7];
const BOUNCE_FORCE = 10;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

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
  player.isJumping = false;

  durians.length = 0;
  BALLS.length = 0;
  spawnTimer = 0;
  cameraX = 0;
  gameOver = false;
}

// --- Update ---
function update() {
  groundY = canvas.height - player.height - groundOffset;

  // Player dead
  if (!player.alive) {
    player.velocityY += GRAVITY;
    player.y += player.velocityY;
    if (player.y > canvas.height + 200) gameOver = true;
    return;
  }

  const onGround = player.y >= groundY;
  player.isJumping = !onGround;

  // --- Horizontal movement ---
  if (swipeActive) {
    if (swipeDir === 1) player.velocityX += onGround ? MOVE_ACCEL : AIR_ACCEL;
    else if (swipeDir === -1) player.velocityX -= onGround ? MOVE_ACCEL : AIR_ACCEL;
  } else if (!keys["ArrowLeft"] && !keys["ArrowRight"]) {
    if (onGround) player.velocityX *= FRICTION;
  }

  player.velocityX = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.velocityX));
  player.x += player.velocityX;

  // Keyboard fallback
  if (keys["ArrowRight"]) player.velocityX += onGround ? MOVE_ACCEL : AIR_ACCEL;
  if (keys["ArrowLeft"]) player.velocityX -= onGround ? MOVE_ACCEL : AIR_ACCEL;

  // Gravity
  player.velocityY += GRAVITY;
  player.y += player.velocityY;

  // Ground collision
  if (player.y >= groundY) {
    player.y = groundY;
    player.velocityY = 0;
    player.jumpsLeft = player.maxJumps;
  }

  // Clamp horizontal
  player.x = Math.max(0, Math.min(player.x, bgScaledWidth - player.width));

  // Camera follow
  cameraX = player.x + player.width / 2 - canvas.width / 2;
  cameraX = Math.max(0, Math.min(cameraX, bgScaledWidth - canvas.width));

  // --- Spawn durians and balls ---
  spawnTimer++;
  if (spawnTimer >= SPAWN_INTERVAL) {
    // Durians
    if (durians.length < MAX_DURIANS) {
      const fromLeft = Math.random() < 0.5;
      durians.push({
        x: fromLeft ? cameraX - 150 : cameraX + canvas.width + 150,
        y: groundY + player.height - DURIAN_SIZE,
        size: DURIAN_SIZE,
        vx: fromLeft ? rand(GROUND_SPEED[0], GROUND_SPEED[1]) : -rand(GROUND_SPEED[0], GROUND_SPEED[1]),
        rotation: 0,
        type: "roll"
      });
    }

    // Balls
    if (BALLS.length < MAX_BALLS) {
      const fromLeft = Math.random() < 0.5;
      BALLS.push({
        x: fromLeft ? cameraX - 150 : cameraX + canvas.width + 150,
        y: groundY + player.height - BALL_SIZE,
        size: BALL_SIZE,
        vx: fromLeft ? rand(BALL_SPEED[0], BALL_SPEED[1]) : -rand(BALL_SPEED[0], BALL_SPEED[1]),
        vy: -rand(4, 8),
        type: "ball"
      });
    }

    spawnTimer = 0;
  }

  // --- Update durians ---
  for (let i = durians.length - 1; i >= 0; i--) {
    const d = durians[i];
    d.x += d.vx;
    d.rotation += d.vx * 0.05;

    if (!player.invincible && collide(player, d)) {
      player.health--;
      player.invincible = true;
      player.blinkTimer = 10;
      player.blinkCount = 6;

      // Knockback player
      const dir = d.vx > 0 ? -1 : 1;
      player.velocityX = 10 * dir;
      player.velocityY = -8;

      if (player.health <= 0) {
        player.alive = false;
        player.velocityY = -18;
      }
    }

    // Remove off-screen
    if (d.x < cameraX - 400 || d.x > cameraX + canvas.width + 400) {
      durians.splice(i, 1);
    }
  }

  // --- Update balls ---
  for (let i = BALLS.length - 1; i >= 0; i--) {
    const b = BALLS[i];
    b.vy += GRAVITY;
    b.x += b.vx;
    b.y += b.vy;

    // Bounce on ground
    if (b.y + b.size >= groundY + player.height) {
      b.y = groundY + player.height - b.size;
      b.vy = -b.vy * 0.7; // lose some energy
      b.vx *= 0.95; // friction
    }

    // Player collision: balls get knocked back, player gains health
    if (collide(player, b)) {
      b.vx = b.vx > 0 ? rand(4, 8) : -rand(4, 8);
      b.vy = -rand(4, 8);
      player.health = Math.min(player.health + 1, 3);
    }

    if (b.x < cameraX - 400 || b.x > cameraX + canvas.width + 400) {
      BALLS.splice(i, 1);
    }
  }

  // Invincibility blinking
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

  // Draw durians with rotation
  for (const d of durians) {
    ctx.save();
    ctx.translate(d.x - cameraX + d.size / 2, d.y + d.size / 2);
    ctx.rotate(d.rotation);
    ctx.drawImage(durianImg, -d.size / 2, -d.size / 2, d.size, d.size);
    ctx.restore();
  }

  // Draw balls
  for (const b of BALLS) {
    ctx.drawImage(ballImgs[0], b.x - cameraX, b.y, b.size, b.size);
  }

  // Draw player
  const blink = player.invincible && player.blinkCount % 2 === 0;
  let playerSprite = player.isJumping ? characterJump : (blink ? characterSilhouette : character);
  ctx.drawImage(playerSprite, player.x - cameraX, player.y, player.width, player.height);

  // Draw health bar
  if (player.health > 0) ctx.drawImage(healthImgs[player.health - 1], 20, 20, 300, 80);

  // Game over
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
