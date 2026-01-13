const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// --- Resize canvas to full window ---
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Load images ---
const background = new Image();
background.src = "background.png"; // replace with your background image
const character = new Image();
character.src = "character.png"; // replace with your character image

// --- Physics constants ---
const GRAVITY = 0.6;
const JUMP_FORCE = 16;
const WALL_JUMP_FORCE = 14;

// Horizontal movement tuning
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
  maxJumps: 2
};

// Ground
const groundOffset = 20;
let groundY;

// --- Input ---
const keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// --- Mobile touch controls ---
let touchStartX = 0;
let lastTapTime = 0;

canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const x = touch.clientX;

  // LEFT half for swipe movement
  if (x < canvas.width / 2) {
    touchStartX = x;
  }
  // RIGHT half for jump / double jump
  else {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      keys[" "] = true; // double jump
    } else {
      keys[" "] = true; // single jump
    }
    lastTapTime = now;
  }
}, { passive: false });

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const x = touch.clientX;

  if (x < canvas.width / 2) {
    const dx = x - touchStartX;
    if (dx > 10) {
      keys["ArrowRight"] = true;
      keys["ArrowLeft"] = false;
    } else if (dx < -10) {
      keys["ArrowLeft"] = true;
      keys["ArrowRight"] = false;
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", e => {
  e.preventDefault();
  keys["ArrowLeft"] = false;
  keys["ArrowRight"] = false;
  keys[" "] = false;
}, { passive: false });

// --- Background scaling ---
background.onload = () => {
  bgScale = canvas.height / background.height;
  bgScaledWidth = background.width * bgScale;
};

// --- Update ---
function update() {
  groundY = canvas.height - player.height - groundOffset;
  const onGround = player.y >= groundY;

  // Horizontal movement
  if (keys["ArrowRight"]) player.velocityX += onGround ? MOVE_ACCEL : AIR_ACCEL;
  if (keys["ArrowLeft"]) player.velocityX -= onGround ? MOVE_ACCEL : AIR_ACCEL;

  if (!keys["ArrowLeft"] && !keys["ArrowRight"] && onGround) player.velocityX *= FRICTION;
  player.velocityX = Math.max(-MAX_SPEED, Math.min(player.velocityX, MAX_SPEED));
  player.x += player.velocityX;

  // Wall detection
  const touchingLeftWall = player.x <= 0;
  const touchingRightWall = player.x + player.width >= bgScaledWidth;

  // Jump / Double jump
  if (keys[" "] && player.jumpsLeft > 0) {
    player.velocityY = -JUMP_FORCE;
    player.jumpsLeft--;
    keys[" "] = false;
  }

  // Wall jump
  if (!onGround && keys[" "] && (touchingLeftWall || touchingRightWall)) {
    player.velocityY = -WALL_JUMP_FORCE;
    player.velocityX = touchingLeftWall ? 6 : -6;
    player.jumpsLeft = 1;
    keys[" "] = false;
  }

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
}

// --- Draw ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background
  ctx.drawImage(
    background,
    cameraX / bgScale, 0,
    canvas.width / bgScale, background.height,
    0, 0,
    canvas.width, canvas.height
  );

  // Draw player
  ctx.drawImage(
    character,
    player.x - cameraX, player.y,
    player.width, player.height
  );
}

// --- Game loop ---
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
