const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const hudSpeed = document.getElementById("speed");
const hudGear = document.getElementById("gear");
const hudGrip = document.getElementById("grip");
const hudBiome = document.getElementById("biome");

const input = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
};

const world = {
  seed: 1337,
  tileSize: 140,
  tileRadius: 6,
};

const car = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  heading: 0,
  wheelBase: 2.7,
  mass: 1350,
  engineForce: 8200,
  brakeForce: 11000,
  drag: 0.42,
  rollingResistance: 12,
  maxSteer: 0.6,
  gear: 1,
};

const gears = [
  { ratio: 2.8, max: 60 },
  { ratio: 2.1, max: 110 },
  { ratio: 1.6, max: 160 },
  { ratio: 1.2, max: 220 },
  { ratio: 1.0, max: 280 },
];

const biomes = [
  { name: "Coastal", color: [42, 86, 120] },
  { name: "Highlands", color: [50, 86, 54] },
  { name: "Desert", color: [130, 104, 58] },
  { name: "Forest", color: [38, 69, 48] },
  { name: "Tundra", color: [120, 130, 150] },
];

const camera = {
  height: 4.8,
  distance: 7.6,
  tilt: 0.85,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + world.seed) * 43758.5453;
  return s - Math.floor(s);
};

const smoothNoise = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const n00 = hash(xi, yi);
  const n10 = hash(xi + 1, yi);
  const n01 = hash(xi, yi + 1);
  const n11 = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const x1 = n00 + (n10 - n00) * u;
  const x2 = n01 + (n11 - n01) * u;
  return x1 + (x2 - x1) * v;
};

const terrainHeight = (x, y) => {
  const scale = 0.02;
  const n = smoothNoise(x * scale, y * scale);
  return n * 2.4;
};

const biomeAt = (x, y) => {
  const n = smoothNoise(x * 0.006, y * 0.006);
  return biomes[Math.floor(n * biomes.length) % biomes.length];
};

const updateInput = (key, isDown) => {
  switch (key) {
    case "KeyW":
      input.throttle = isDown ? 1 : 0;
      break;
    case "KeyS":
      input.brake = isDown ? 1 : 0;
      break;
    case "KeyA":
      input.steer = isDown ? -1 : input.steer === -1 ? 0 : input.steer;
      break;
    case "KeyD":
      input.steer = isDown ? 1 : input.steer === 1 ? 0 : input.steer;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      input.handbrake = isDown;
      break;
    case "KeyR":
      if (isDown) resetCar();
      break;
    default:
      break;
  }
};

const resetCar = () => {
  car.position = { x: 0, y: 0 };
  car.velocity = { x: 0, y: 0 };
  car.heading = 0;
};

window.addEventListener("keydown", (event) => updateInput(event.code, true));
window.addEventListener("keyup", (event) => updateInput(event.code, false));

const resize = () => {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
};

window.addEventListener("resize", resize);
resize();

const updatePhysics = (dt) => {
  const speed = Math.hypot(car.velocity.x, car.velocity.y);
  const forward = {
    x: Math.cos(car.heading),
    y: Math.sin(car.heading),
  };
  const lateral = {
    x: -forward.y,
    y: forward.x,
  };

  const steerAngle = input.steer * car.maxSteer;
  const traction = input.throttle * car.engineForce;
  const braking = input.brake * car.brakeForce;
  const drag = car.drag * speed * speed;
  const rolling = car.rollingResistance * speed;

  const gripBase = clamp(1 - speed / 85, 0.35, 1.05);
  const handbrakeGrip = input.handbrake ? 0.35 : 1;
  const grip = gripBase * handbrakeGrip;

  const driveForce = traction - braking - drag - rolling;
  const accel = driveForce / car.mass;

  car.velocity.x += forward.x * accel * dt;
  car.velocity.y += forward.y * accel * dt;

  const lateralSpeed = car.velocity.x * lateral.x + car.velocity.y * lateral.y;
  const lateralFriction = -lateralSpeed * grip * 4.2;

  car.velocity.x += lateral.x * lateralFriction * dt;
  car.velocity.y += lateral.y * lateralFriction * dt;

  const turnRadius = car.wheelBase / Math.max(0.05, Math.abs(Math.sin(steerAngle)));
  const yawRate = (speed / turnRadius) * Math.sign(steerAngle) * grip;

  car.heading += yawRate * dt;

  car.position.x += car.velocity.x * dt;
  car.position.y += car.velocity.y * dt;

  updateGear(speed * 3.6);

  hudSpeed.textContent = Math.max(0, Math.round(speed * 3.6));
  hudGear.textContent = car.gear;
  hudGrip.textContent = grip.toFixed(2);
  hudBiome.textContent = biomeAt(car.position.x, car.position.y).name;
};

const updateGear = (speedKmh) => {
  let gear = car.gear;
  if (gear < gears.length && speedKmh > gears[gear - 1].max) {
    gear += 1;
  } else if (gear > 1 && speedKmh < gears[gear - 2].max * 0.7) {
    gear -= 1;
  }
  car.gear = gear;
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = window.innerWidth;
  const height = window.innerHeight;

  ctx.save();
  ctx.translate(width / 2, height * 0.58);
  ctx.scale(1, camera.tilt);

  drawHorizon(width, height);
  drawGround(width, height);
  drawRoad(width, height);
  drawCar(width, height);

  ctx.restore();
};

const drawHorizon = (width, height) => {
  const gradient = ctx.createLinearGradient(0, -height, 0, height * 0.4);
  gradient.addColorStop(0, "#92c5f9");
  gradient.addColorStop(0.55, "#3a4761");
  gradient.addColorStop(1, "#1a1f2f");
  ctx.fillStyle = gradient;
  ctx.fillRect(-width, -height, width * 2, height);
};

const drawGround = (width, height) => {
  const tileSize = world.tileSize;
  const offsetX = car.position.x % tileSize;
  const offsetY = car.position.y % tileSize;

  for (let gx = -world.tileRadius; gx <= world.tileRadius; gx += 1) {
    for (let gy = -world.tileRadius; gy <= world.tileRadius; gy += 1) {
      const worldX = car.position.x + gx * tileSize - offsetX;
      const worldY = car.position.y + gy * tileSize - offsetY;
      const biome = biomeAt(worldX, worldY);
      const heightSample = terrainHeight(worldX, worldY);
      const shade = clamp(0.7 + heightSample * 0.1, 0.5, 0.9);
      ctx.fillStyle = `rgba(${biome.color[0]}, ${biome.color[1]}, ${biome.color[2]}, ${shade})`;

      const screenX = (worldX - car.position.x) * 1.4;
      const screenY = (worldY - car.position.y) * 1.4;
      ctx.fillRect(screenX - tileSize, screenY - tileSize, tileSize, tileSize);
    }
  }
};

const drawRoad = (width, height) => {
  ctx.save();
  ctx.translate(0, 0);
  ctx.rotate(-car.heading);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-width, 0);
  ctx.lineTo(width, 0);
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(-width, -22, width * 2, 44);
  ctx.restore();
};

const drawCar = () => {
  ctx.save();
  ctx.translate(0, 22);
  ctx.fillStyle = "#f0544f";
  ctx.strokeStyle = "#2f1b1b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-22, -14, 44, 28, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#11151f";
  ctx.fillRect(-18, -10, 36, 12);
  ctx.restore();
};

let lastTime = 0;
const loop = (time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  updatePhysics(dt);
  render();

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);
