export interface ColorVal {
  h: number;
  s: number;
  b: number;
  c: number;
}

export interface FurniturePlacement {
  type: string;
  col: number;
  row: number;
}

export interface RoomRect {
  name: string;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
  doorCol: number;
  floor: ColorVal;
  stations: [number, number][];
}

export interface OfficeLayout {
  cols: number;
  rows: number;
  tiles: number[];
  tileColors: (ColorVal | null)[];
  furniture: FurniturePlacement[];
  rooms: RoomRect[];
  corridorRow: number;
}

const WALL: ColorVal = { h: 214, s: 30, b: -100, c: -55 };
const FLOOR_WARM: ColorVal = { h: 25, s: 48, b: -43, c: -88 };
const FLOOR_COOL: ColorVal = { h: 209, s: 39, b: -25, c: -80 };
const FLOOR_BEIGE: ColorVal = { h: 35, s: 28, b: -25, c: -55 };
const FLOOR_KITCHEN: ColorVal = { h: 200, s: 8, b: -8, c: -5 };
const FLOOR_RUG: ColorVal = { h: 350, s: 40, b: -30, c: -50 };
const CORRIDOR: ColorVal = { h: 209, s: 0, b: -22, c: -8 };

const COLS = 60;
const ROWS = 17;
const ROOM_TOP = 1;
const ROOM_BOTTOM_INCLUSIVE = 11;
const SOUTH_WALL_ROW = 12;
const CORRIDOR_TOP_ROW = 13;
const CORRIDOR_BOTTOM_ROW = 15;
const ROOM_HEIGHT = ROOM_BOTTOM_INCLUSIVE - ROOM_TOP + 1;

interface FloorRegion {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  tile: number;
  color: ColorVal;
}

interface RoomSpec {
  name: string;
  label: string;
  startCol: number;
  endCol: number;
  floor: ColorVal;
  floorTile: number;
  regions?: FloorRegion[];
  furniture: FurniturePlacement[];
  stations: [number, number][];
}

const ROOM_SPECS: RoomSpec[] = [
  {
    name: "alex",
    label: "Alex's Office",
    startCol: 1,
    endCol: 17,
    floor: FLOOR_WARM,
    floorTile: 7,
    regions: [
      { startCol: 9, endCol: 14, startRow: 7, endRow: 10, tile: 8, color: FLOOR_RUG },
    ],
    furniture: [
      { type: "SMALL_PAINTING", col: 3, row: 0 },
      { type: "DOUBLE_BOOKSHELF", col: 5, row: 0 },
      { type: "CLOCK", col: 8, row: 0 },
      { type: "HANGING_PLANT", col: 10, row: 0 },
      { type: "SMALL_PAINTING_2", col: 12, row: 0 },
      { type: "BOOKSHELF", col: 14, row: 0 },
      { type: "DESK_FRONT", col: 3, row: 4 },
      { type: "PC_FRONT_OFF", col: 4, row: 3 },
      { type: "WOODEN_CHAIR_BACK", col: 4, row: 6 },
      { type: "SOFA_BACK", col: 10, row: 6 },
      { type: "SOFA_SIDE", col: 9, row: 6 },
      { type: "SOFA_SIDE:left", col: 13, row: 6 },
      { type: "COFFEE_TABLE", col: 11, row: 8 },
      { type: "COFFEE", col: 11, row: 7 },
      { type: "SOFA_FRONT", col: 10, row: 10 },
      { type: "PLANT", col: 16, row: 10 },
      { type: "CACTUS", col: 2, row: 10 },
      { type: "BIN", col: 16, row: 6 },
      { type: "LARGE_PLANT", col: 1, row: 5 },
    ],
    stations: [
      [4, 6],
      [11, 9],
      [2, 6],
      [15, 9],
      [7, 8],
    ],
  },
  {
    name: "service",
    label: "ENS / KeeperHub Hub",
    startCol: 19,
    endCol: 39,
    floor: FLOOR_COOL,
    floorTile: 1,
    regions: [
      { startCol: 25, endCol: 33, startRow: 8, endRow: 11, tile: 9, color: CORRIDOR },
    ],
    furniture: [
      { type: "WHITEBOARD", col: 21, row: 0 },
      { type: "LARGE_PAINTING", col: 24, row: 0 },
      { type: "HANGING_PLANT", col: 27, row: 0 },
      { type: "CLOCK", col: 29, row: 0 },
      { type: "LARGE_PAINTING", col: 31, row: 0 },
      { type: "HANGING_PLANT", col: 34, row: 0 },
      { type: "SMALL_PAINTING", col: 36, row: 0 },
      { type: "DESK_FRONT", col: 21, row: 4 },
      { type: "PC_FRONT_OFF", col: 22, row: 3 },
      { type: "WOODEN_CHAIR_BACK", col: 22, row: 6 },
      { type: "DESK_FRONT", col: 30, row: 4 },
      { type: "PC_FRONT_OFF", col: 31, row: 3 },
      { type: "WOODEN_CHAIR_BACK", col: 31, row: 6 },
      { type: "DESK_FRONT", col: 35, row: 4 },
      { type: "PC_FRONT_OFF", col: 36, row: 3 },
      { type: "WOODEN_CHAIR_BACK", col: 36, row: 6 },
      { type: "CUSHIONED_BENCH", col: 26, row: 9 },
      { type: "CUSHIONED_BENCH", col: 27, row: 9 },
      { type: "CUSHIONED_BENCH", col: 28, row: 9 },
      { type: "CUSHIONED_BENCH", col: 30, row: 9 },
      { type: "CUSHIONED_BENCH", col: 31, row: 9 },
      { type: "CUSHIONED_BENCH", col: 32, row: 9 },
      { type: "COFFEE_TABLE", col: 28, row: 10 },
      { type: "PLANT_2", col: 20, row: 10 },
      { type: "PLANT_2", col: 38, row: 10 },
      { type: "POT", col: 25, row: 1 },
      { type: "BIN", col: 38, row: 1 },
    ],
    stations: [
      [22, 6],
      [31, 6],
      [36, 6],
      [29, 10],
      [21, 10],
      [37, 10],
    ],
  },
  {
    name: "bella",
    label: "Bella's Restaurant",
    startCol: 41,
    endCol: 58,
    floor: FLOOR_BEIGE,
    floorTile: 6,
    regions: [
      { startCol: 41, endCol: 58, startRow: 7, endRow: 11, tile: 1, color: FLOOR_KITCHEN },
    ],
    furniture: [
      { type: "LARGE_PAINTING", col: 43, row: 0 },
      { type: "SMALL_PAINTING", col: 46, row: 0 },
      { type: "HANGING_PLANT", col: 48, row: 0 },
      { type: "SMALL_PAINTING_2", col: 50, row: 0 },
      { type: "HANGING_PLANT", col: 53, row: 0 },
      { type: "CLOCK", col: 55, row: 0 },
      { type: "TABLE_FRONT", col: 43, row: 2 },
      { type: "WOODEN_CHAIR_FRONT", col: 44, row: 6 },
      { type: "WOODEN_CHAIR_SIDE", col: 42, row: 3 },
      { type: "WOODEN_CHAIR_SIDE:left", col: 46, row: 3 },
      { type: "COFFEE", col: 44, row: 3 },
      { type: "TABLE_FRONT", col: 51, row: 2 },
      { type: "WOODEN_CHAIR_FRONT", col: 52, row: 6 },
      { type: "WOODEN_CHAIR_SIDE", col: 50, row: 3 },
      { type: "WOODEN_CHAIR_SIDE:left", col: 54, row: 3 },
      { type: "COFFEE", col: 52, row: 3 },
      { type: "DESK_FRONT", col: 43, row: 8 },
      { type: "DESK_FRONT", col: 47, row: 8 },
      { type: "DESK_FRONT", col: 51, row: 8 },
      { type: "COFFEE", col: 44, row: 7 },
      { type: "COFFEE", col: 48, row: 7 },
      { type: "COFFEE", col: 52, row: 7 },
      { type: "DOUBLE_BOOKSHELF", col: 55, row: 7 },
      { type: "POT", col: 54, row: 9 },
      { type: "PLANT_2", col: 41, row: 11 },
      { type: "BIN", col: 57, row: 11 },
      { type: "CACTUS", col: 41, row: 1 },
    ],
    stations: [
      [44, 7],
      [52, 7],
      [44, 10],
      [48, 10],
      [52, 10],
      [56, 10],
      [42, 5],
    ],
  },
];

function buildLayout(): OfficeLayout {
  const tiles = new Array(COLS * ROWS).fill(255);
  const tileColors: (ColorVal | null)[] = new Array(COLS * ROWS).fill(null);

  const setTile = (c: number, r: number, value: number, color: ColorVal | null) => {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    const idx = r * COLS + c;
    tiles[idx] = value;
    tileColors[idx] = color;
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        setTile(c, r, 0, WALL);
      }
    }
  }

  for (const spec of ROOM_SPECS) {
    for (let r = ROOM_TOP; r <= ROOM_BOTTOM_INCLUSIVE; r++) {
      for (let c = spec.startCol; c <= spec.endCol; c++) {
        setTile(c, r, spec.floorTile, spec.floor);
      }
    }
    if (spec.regions) {
      for (const region of spec.regions) {
        for (let r = region.startRow; r <= region.endRow; r++) {
          for (let c = region.startCol; c <= region.endCol; c++) {
            setTile(c, r, region.tile, region.color);
          }
        }
      }
    }
  }

  for (let i = 0; i < ROOM_SPECS.length - 1; i++) {
    const a = ROOM_SPECS[i];
    const b = ROOM_SPECS[i + 1];
    const wallCol = Math.floor((a.endCol + b.startCol) / 2);
    for (let r = ROOM_TOP; r <= ROOM_BOTTOM_INCLUSIVE; r++) {
      setTile(wallCol, r, 0, WALL);
    }
  }

  for (const spec of ROOM_SPECS) {
    const doorCol = Math.floor((spec.startCol + spec.endCol) / 2);
    for (let c = spec.startCol; c <= spec.endCol; c++) {
      const isDoor = Math.abs(c - doorCol) <= 1;
      if (isDoor) {
        setTile(c, SOUTH_WALL_ROW, spec.floorTile, spec.floor);
      } else {
        setTile(c, SOUTH_WALL_ROW, 0, WALL);
      }
    }
  }

  for (let r = CORRIDOR_TOP_ROW; r <= CORRIDOR_BOTTOM_ROW; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      setTile(c, r, 9, CORRIDOR);
    }
  }

  const furniture: FurniturePlacement[] = [];
  const rooms: RoomRect[] = [];
  for (const spec of ROOM_SPECS) {
    for (const f of spec.furniture) {
      furniture.push(f);
    }
    rooms.push({
      name: spec.name,
      label: spec.label,
      col: spec.startCol,
      row: ROOM_TOP,
      w: spec.endCol - spec.startCol + 1,
      h: ROOM_HEIGHT,
      doorCol: Math.floor((spec.startCol + spec.endCol) / 2),
      floor: spec.floor,
      stations: spec.stations,
    });
  }

  return {
    cols: COLS,
    rows: ROWS,
    tiles,
    tileColors,
    furniture,
    rooms,
    corridorRow: 14,
  };
}

export const layout: OfficeLayout = buildLayout();

export function roomFor(col: number, row: number): RoomRect | null {
  for (const r of layout.rooms) {
    if (col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h) {
      return r;
    }
  }
  return null;
}

export function planRoute(
  start: [number, number],
  end: [number, number],
): [number, number][] {
  const startRoom = roomFor(start[0], start[1]);
  const endRoom = roomFor(end[0], end[1]);
  if (startRoom && endRoom && startRoom.name === endRoom.name) {
    return [end];
  }
  const corridorRow = layout.corridorRow;
  const waypoints: [number, number][] = [];
  if (startRoom) {
    waypoints.push([startRoom.doorCol, corridorRow]);
  } else {
    waypoints.push([start[0], corridorRow]);
  }
  if (endRoom) {
    waypoints.push([endRoom.doorCol, corridorRow]);
  } else {
    waypoints.push([end[0], corridorRow]);
  }
  waypoints.push(end);
  return waypoints;
}
