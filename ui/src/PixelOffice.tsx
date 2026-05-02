import { useEffect, useRef } from "react";
import { layout, planRoute, roomFor } from "./officeLayout";
import type { ColorVal, OfficeLayout, RoomRect } from "./officeLayout";

const TILE = 16;
const SCALE = 2;
const CHAR_W = 16;
const CHAR_H = 32;
const CHAR_FRAMES_PER_ROW = 7;
const WALL_W = 16;
const WALL_H = 32;
const WALL_GRID_COLS = 4;
const WALK_SPEED_TILES_PER_SEC = 3.2;
const WALK_FRAME_DUR_MS = 140;
const WANDER_MIN_SEC = 4;
const WANDER_MAX_SEC = 9;

const ASSET_BASE = "/pixel-agents-assets/assets";

const FURNITURE_FOLDERS = [
  "COFFEE_TABLE",
  "CUSHIONED_BENCH",
  "CUSHIONED_CHAIR",
  "DOUBLE_BOOKSHELF",
  "HANGING_PLANT",
  "LARGE_PAINTING",
  "LARGE_PLANT",
  "PLANT_2",
  "SMALL_PAINTING_2",
  "SMALL_PAINTING",
  "SMALL_TABLE",
  "TABLE_FRONT",
  "WHITEBOARD",
  "WOODEN_BENCH",
  "WOODEN_CHAIR",
  "BOOKSHELF",
  "BIN",
  "CACTUS",
  "CLOCK",
  "COFFEE",
  "DESK",
  "PLANT",
  "POT",
  "SOFA",
  "PC",
].sort((a, b) => b.length - a.length);

function folderForType(type: string): string {
  const base = type.split(":")[0];
  for (const f of FURNITURE_FOLDERS) {
    if (base === f || base.startsWith(f + "_")) return f;
  }
  return base;
}

function isMirrored(type: string): boolean {
  return type.split(":")[1] === "left";
}

const Dir = { DOWN: 0, UP: 1, RIGHT: 2, LEFT: 3 } as const;
type Direction = (typeof Dir)[keyof typeof Dir];

interface Character {
  name: string;
  spriteIdx: number;
  homeRoom: RoomRect;
  homeCell: [number, number];
  px: number;
  py: number;
  path: [number, number][];
  dir: Direction;
  walking: boolean;
  frameIdx: number;
  frameTimer: number;
  bobUntil: number;
  pulseUntil: number;
  wanderTimer: number;
  busyUntil: number;
}

interface SceneState {
  layout: OfficeLayout;
  floorImgs: (HTMLImageElement | null)[];
  floorCache: Map<string, HTMLCanvasElement>;
  wallSheet: HTMLCanvasElement | null;
  charSheets: HTMLImageElement[];
  furniture: Map<string, HTMLImageElement>;
  characters: Character[];
  flashUntil: number;
  flashColor: [number, number, number];
  lastTs: number;
  ready: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

function hslToRgb(h: number, sFrac: number, l: number): [number, number, number] {
  const ch = (1 - Math.abs(2 * l - 1)) * sFrac;
  const hp = h / 60;
  const x = ch * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = ch;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = ch;
  } else if (hp < 3) {
    g1 = ch;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = ch;
  } else if (hp < 5) {
    r1 = x;
    b1 = ch;
  } else {
    r1 = ch;
    b1 = x;
  }
  const m = l - ch / 2;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return [clamp(r1), clamp(g1), clamp(b1)];
}

function colorizeImage(img: HTMLImageElement, color: ColorVal): HTMLCanvasElement {
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const satFrac = color.s / 100;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    let lightness = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    if (color.c !== 0) {
      const factor = (100 + color.c) / 100;
      lightness = 0.5 + (lightness - 0.5) * factor;
    }
    if (color.b !== 0) lightness = lightness + color.b / 200;
    lightness = Math.max(0, Math.min(1, lightness));
    const [r, g, b] = hslToRgb(color.h, satFrac, lightness);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function floorCacheKey(tile: number, c: ColorVal): string {
  return `${tile}|${c.h},${c.s},${c.b},${c.c}`;
}

function getFloorTile(s: SceneState, tile: number, color: ColorVal): HTMLCanvasElement | null {
  const key = floorCacheKey(tile, color);
  let cached = s.floorCache.get(key);
  if (!cached) {
    const idx = Math.max(0, Math.min(s.floorImgs.length - 1, tile - 1));
    const img = s.floorImgs[idx];
    if (!img) return null;
    cached = colorizeImage(img, color);
    s.floorCache.set(key, cached);
  }
  return cached;
}

function buildWallMask(col: number, row: number, layout: OfficeLayout): number {
  const t = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows) return false;
    return layout.tiles[r * layout.cols + c] === 0;
  };
  let mask = 0;
  if (t(col, row - 1)) mask |= 1;
  if (t(col + 1, row)) mask |= 2;
  if (t(col, row + 1)) mask |= 4;
  if (t(col - 1, row)) mask |= 8;
  return mask;
}

function makeCharacter(
  name: string,
  spriteIdx: number,
  homeRoom: RoomRect,
  homeCell: [number, number],
): Character {
  return {
    name,
    spriteIdx,
    homeRoom,
    homeCell,
    px: homeCell[0] * TILE + TILE / 2,
    py: homeCell[1] * TILE + TILE,
    path: [],
    dir: Dir.DOWN,
    walking: false,
    frameIdx: 0,
    frameTimer: 0,
    bobUntil: 0,
    pulseUntil: 0,
    wanderTimer: WANDER_MIN_SEC + Math.random() * (WANDER_MAX_SEC - WANDER_MIN_SEC),
    busyUntil: 0,
  };
}

function characterCell(c: Character): [number, number] {
  return [Math.round((c.px - TILE / 2) / TILE), Math.round((c.py - TILE) / TILE)];
}

function bob(c: Character, dur: number, now: number) {
  c.bobUntil = now + dur;
}

function walkTo(c: Character, dest: [number, number]) {
  const start = characterCell(c);
  if (start[0] === dest[0] && start[1] === dest[1]) return;
  const route = planRoute(start, dest);
  const steps: [number, number][] = [];
  let cursor: [number, number] = start;
  for (const wp of route) {
    let col = cursor[0];
    let row = cursor[1];
    while (col !== wp[0]) {
      col += col < wp[0] ? 1 : -1;
      steps.push([col, row]);
    }
    while (row !== wp[1]) {
      row += row < wp[1] ? 1 : -1;
      steps.push([col, row]);
    }
    cursor = wp;
  }
  c.path = steps;
  c.walking = steps.length > 0;
  c.frameTimer = 0;
  c.frameIdx = 0;
}

function updateCharacter(c: Character, dt: number, now: number) {
  if (c.walking && c.path.length > 0) {
    const [tc, tr] = c.path[0];
    const tx = tc * TILE + TILE / 2;
    const ty = tr * TILE + TILE;
    const dx = tx - c.px;
    const dy = ty - c.py;
    const dist = Math.hypot(dx, dy);
    const speed = WALK_SPEED_TILES_PER_SEC * TILE;
    const step = speed * dt;
    if (dist <= step) {
      c.px = tx;
      c.py = ty;
      c.path.shift();
      if (c.path.length === 0) {
        c.walking = false;
        c.frameIdx = 0;
      }
    } else {
      c.px += (dx / dist) * step;
      c.py += (dy / dist) * step;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      c.dir = dx > 0 ? Dir.RIGHT : Dir.LEFT;
    } else if (dy !== 0) {
      c.dir = dy > 0 ? Dir.DOWN : Dir.UP;
    }
    c.frameTimer += dt * 1000;
    if (c.frameTimer >= WALK_FRAME_DUR_MS) {
      c.frameTimer = 0;
      c.frameIdx = (c.frameIdx + 1) % 4;
    }
    return;
  }

  c.frameTimer = 0;
  c.frameIdx = 0;

  if (c.busyUntil > now) return;
  c.wanderTimer -= dt;
  if (c.wanderTimer > 0) return;

  const stations = c.homeRoom.stations;
  const next = stations[Math.floor(Math.random() * stations.length)];
  walkTo(c, next);
  c.wanderTimer = WANDER_MIN_SEC + Math.random() * (WANDER_MAX_SEC - WANDER_MIN_SEC);
}

export function PixelOffice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const alexRoom = layout.rooms.find((r) => r.name === "alex")!;
    const serviceRoom = layout.rooms.find((r) => r.name === "service")!;
    const bellaRoom = layout.rooms.find((r) => r.name === "bella")!;

    const characters: Character[] = [
      makeCharacter("Alex", 0, alexRoom, [alexRoom.col + 4, alexRoom.row + 6]),
      makeCharacter("Resolver", 2, serviceRoom, [serviceRoom.col + 4, serviceRoom.row + 6]),
      makeCharacter("Keeper", 4, serviceRoom, [serviceRoom.col + 12, serviceRoom.row + 6]),
      makeCharacter("Bella", 3, bellaRoom, [bellaRoom.col + 3, bellaRoom.row + 9]),
    ];

    const state: SceneState = {
      layout,
      floorImgs: [],
      floorCache: new Map(),
      wallSheet: null,
      charSheets: [],
      furniture: new Map(),
      characters,
      flashUntil: 0,
      flashColor: [139, 92, 246],
      lastTs: performance.now(),
      ready: false,
    };
    stateRef.current = state;

    let cancelled = false;
    let raf = 0;

    async function init() {
      try {
        const wallImg = await loadImage(`${ASSET_BASE}/walls/wall_0.png`).catch(() => null);
        if (wallImg) {
          const wallColor: ColorVal = { h: 214, s: 30, b: -100, c: -55 };
          state.wallSheet = colorizeImage(wallImg, wallColor);
        }

        const floorImgs = await Promise.all(
          Array.from({ length: 9 }, (_, i) =>
            loadImage(`${ASSET_BASE}/floors/floor_${i}.png`).catch(() => null),
          ),
        );
        state.floorImgs = floorImgs;

        const idxs = [0, 2, 3, 4];
        const sheets = await Promise.all(
          idxs.map((i) => loadImage(`${ASSET_BASE}/characters/char_${i}.png`)),
        );
        state.charSheets = sheets;
        state.characters[0].spriteIdx = 0;
        state.characters[1].spriteIdx = 1;
        state.characters[2].spriteIdx = 3;
        state.characters[3].spriteIdx = 2;

        const uniqueTypes = new Set(layout.furniture.map((f) => f.type.split(":")[0]));
        await Promise.all(
          Array.from(uniqueTypes).map(async (type) => {
            const folder = folderForType(type);
            try {
              const img = await loadImage(`${ASSET_BASE}/furniture/${folder}/${type}.png`);
              state.furniture.set(type, img);
            } catch {
              // missing — skip
            }
          }),
        );

        state.ready = true;
        state.lastTs = performance.now();
        if (!cancelled) loop(state.lastTs);
      } catch (err) {
        console.error("[PixelOffice] init failed:", err);
      }
    }

    function loop(now: number) {
      if (cancelled) return;
      const dt = Math.min(0.1, (now - state.lastTs) / 1000);
      state.lastTs = now;
      if (state.ready) {
        for (const ch of state.characters) updateCharacter(ch, dt, now);
      }
      drawFrame(ctx!, state, now);
      raf = requestAnimationFrame(loop);
    }

    function findCharacter(name: string): Character | undefined {
      return state.characters.find((c) => c.name === name);
    }

    function sendOnJob(c: Character, dest: [number, number], busyMs = 1500) {
      walkTo(c, dest);
      c.busyUntil = performance.now() + busyMs;
      c.wanderTimer = 6 + Math.random() * 6;
    }

    function onEvent(e: Event) {
      if (!state.ready) return;
      const detail = (e as CustomEvent).detail as Record<string, unknown> | undefined;
      const event = (detail?.event as string) ?? "";
      const now = performance.now();
      const alex = findCharacter("Alex");
      const bella = findCharacter("Bella");
      const keeper = findCharacter("Keeper");
      const resolver = findCharacter("Resolver");

      if (event === "ens_resolving") {
        if (resolver) sendOnJob(resolver, [serviceRoom.col + 4, serviceRoom.row + 5], 2000);
        if (alex) sendOnJob(alex, [alexRoom.col + 8, alexRoom.row + 11], 2500);
      } else if (event === "ens_resolved") {
        if (resolver) bob(resolver, 400, now);
      } else if (event === "toll_paying") {
        if (alex) sendOnJob(alex, [serviceRoom.doorCol - 2, serviceRoom.row + 11], 1500);
        if (keeper) sendOnJob(keeper, [serviceRoom.col + 12, serviceRoom.row + 5], 2000);
      } else if (event === "toll_paid") {
        state.flashColor = [16, 185, 129];
        state.flashUntil = now + 600;
        if (keeper) sendOnJob(keeper, [bellaRoom.doorCol, bellaRoom.row + 11], 3000);
        if (alex) sendOnJob(alex, [serviceRoom.col + 12, serviceRoom.row + 11], 1500);
        if (bella) sendOnJob(bella, [bellaRoom.col + 3, bellaRoom.row + 9], 1500);
      } else if (event === "handshake_sweep") {
        state.flashColor = [139, 92, 246];
        state.flashUntil = now + 1400;
        if (alex) sendOnJob(alex, [bellaRoom.col + 6, bellaRoom.row + 8], 2000);
      } else if (event === "chirp" || isMessageType(event)) {
        if (alex) {
          bob(alex, 250, now);
          alex.pulseUntil = now + 250;
        }
        if (bella) {
          bob(bella, 250, now);
          bella.pulseUntil = now + 250;
        }
        if (keeper && (event === "ACCEPT" || event === "CONFIRM")) {
          bob(keeper, 250, now);
        }
      } else if (event === "settlement_executing") {
        if (keeper) sendOnJob(keeper, [serviceRoom.col + 4, serviceRoom.row + 5], 2000);
      } else if (event === "settlement_done") {
        state.flashColor = [245, 158, 11];
        state.flashUntil = now + 800;
        if (alex) sendOnJob(alex, alex.homeCell, 3000);
        if (bella) sendOnJob(bella, bella.homeCell, 3000);
        if (keeper) sendOnJob(keeper, keeper.homeCell, 3000);
        if (resolver) sendOnJob(resolver, resolver.homeCell, 3000);
      }
    }

    init();
    window.addEventListener("tollgate:event", onEvent);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("tollgate:event", onEvent);
    };
  }, []);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <canvas
        ref={canvasRef}
        width={layout.cols * TILE * SCALE}
        height={layout.rows * TILE * SCALE}
        style={{
          imageRendering: "pixelated",
          background: "#0F172A",
          borderRadius: 8,
          display: "block",
          margin: "0 auto",
          maxWidth: "100%",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
}

function isMessageType(s: string): boolean {
  return s === "PROPOSE" || s === "COUNTER" || s === "ACCEPT" || s === "REJECT" || s === "CONFIRM";
}

function drawFrame(ctx: CanvasRenderingContext2D, s: SceneState, now: number) {
  const layout = s.layout;
  const W = layout.cols * TILE;
  const H = layout.rows * TILE;

  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.clearRect(0, 0, W, H);

  if (!s.ready) {
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "8px monospace";
    ctx.fillText("loading pixel office...", 8, 16);
    ctx.restore();
    return;
  }

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const idx = r * layout.cols + c;
      const v = layout.tiles[idx];
      if (v === 255 || v === 0) continue;
      const color = layout.tileColors[idx];
      if (!color) continue;
      const sprite = getFloorTile(s, v, color);
      if (sprite) ctx.drawImage(sprite, c * TILE, r * TILE);
    }
  }

  for (const room of layout.rooms) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    const labelW = room.label.length * 5 + 8;
    const labelX = room.col * TILE + 4;
    const labelY = room.row * TILE + 2;
    ctx.fillRect(labelX, labelY, labelW, 9);
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(room.label, labelX + 4, labelY + 1);
  }

  type Drawable = { zY: number; draw: () => void };
  const drawables: Drawable[] = [];

  if (s.wallSheet) {
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        if (layout.tiles[r * layout.cols + c] !== 0) continue;
        const mask = buildWallMask(c, r, layout);
        const sx = (mask % WALL_GRID_COLS) * WALL_W;
        const sy = Math.floor(mask / WALL_GRID_COLS) * WALL_H;
        const dx = c * TILE;
        const dy = r * TILE - (WALL_H - TILE);
        const zY = (r + 1) * TILE;
        drawables.push({
          zY,
          draw: () => {
            ctx.drawImage(s.wallSheet!, sx, sy, WALL_W, WALL_H, dx, dy, WALL_W, WALL_H);
          },
        });
      }
    }
  }

  for (const f of layout.furniture) {
    const sprite = s.furniture.get(f.type.split(":")[0]);
    if (!sprite) continue;
    const x = f.col * TILE;
    const y = f.row * TILE;
    const zY = y + sprite.height;
    if (isMirrored(f.type)) {
      drawables.push({
        zY,
        draw: () => {
          ctx.save();
          ctx.translate(x + sprite.width, y);
          ctx.scale(-1, 1);
          ctx.drawImage(sprite, 0, 0);
          ctx.restore();
        },
      });
    } else {
      drawables.push({
        zY,
        draw: () => {
          ctx.drawImage(sprite, x, y);
        },
      });
    }
  }

  for (const ch of s.characters) {
    const img = s.charSheets[ch.spriteIdx];
    if (!img) continue;

    let mirrored = false;
    let spriteRow = 0;
    switch (ch.dir) {
      case Dir.DOWN:
        spriteRow = 0;
        break;
      case Dir.UP:
        spriteRow = 1;
        break;
      case Dir.RIGHT:
        spriteRow = 2;
        break;
      case Dir.LEFT:
        spriteRow = 2;
        mirrored = true;
        break;
    }

    let frameCol = 0;
    if (ch.walking) {
      const cycle = [0, 1, 2, 1];
      frameCol = cycle[ch.frameIdx % cycle.length];
    } else if (ch.bobUntil > now) {
      const cycle = [0, 1];
      frameCol = cycle[Math.floor((now / 100) % cycle.length)];
    }
    if (frameCol >= CHAR_FRAMES_PER_ROW) frameCol = 0;

    const sx = frameCol * CHAR_W;
    const sy = spriteRow * CHAR_H;
    const drawX = Math.round(ch.px - CHAR_W / 2);
    const drawY = Math.round(ch.py - CHAR_H);
    const zY = ch.py + 0.5;
    const isPulsing = ch.pulseUntil > now;

    drawables.push({
      zY,
      draw: () => {
        ctx.save();
        if (isPulsing) {
          const remaining = ch.pulseUntil - now;
          const alpha = Math.min(0.7, remaining / 250);
          ctx.shadowColor = `rgba(56, 189, 248, ${alpha})`;
          ctx.shadowBlur = 6;
        }
        if (mirrored) {
          ctx.translate(drawX + CHAR_W, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, CHAR_W, CHAR_H, 0, 0, CHAR_W, CHAR_H);
        } else {
          ctx.drawImage(img, sx, sy, CHAR_W, CHAR_H, drawX, drawY, CHAR_W, CHAR_H);
        }
        ctx.restore();

        const labelW = ch.name.length * 5 + 6;
        const labelX = drawX + (CHAR_W - labelW) / 2;
        const labelY = drawY - 11;
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(labelX, labelY, labelW, 9);
        ctx.fillStyle = "#F1F5F9";
        ctx.font = "8px monospace";
        ctx.textBaseline = "top";
        ctx.fillText(ch.name, labelX + 3, labelY + 1);
      },
    });
  }

  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw();

  if (s.flashUntil > now) {
    const remaining = s.flashUntil - now;
    const alpha = Math.min(0.45, remaining / 1400);
    const [r, g, b] = s.flashColor;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}
