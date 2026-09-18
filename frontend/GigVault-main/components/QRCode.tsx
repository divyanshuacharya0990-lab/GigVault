interface QRCodeProps {
  seed: string;
  size?: number;
}

// Deterministic pseudo-random module grid so the same seed always renders
// the same pattern. This is a visual stand-in for a real QR payload.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h;
}

export default function QRCode({ seed, size = 200 }: QRCodeProps) {
  const grid = 21;
  const rand = mulberry32(seedToInt(seed));
  const cells: boolean[][] = Array.from({ length: grid }, () =>
    Array.from({ length: grid }, () => rand() > 0.52)
  );

  const finder = (row: number, col: number) => {
    for (let r = row; r < row + 7; r++) {
      for (let c = col; c < col + 7; c++) {
        const inRing =
          r === row || r === row + 6 || c === col || c === col + 6;
        const inCore = r >= row + 2 && r <= row + 4 && c >= col + 2 && c <= col + 4;
        cells[r][c] = inRing || inCore;
      }
    }
  };
  finder(0, 0);
  finder(0, grid - 7);
  finder(grid - 7, 0);

  const cellSize = size / grid;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-[6px]"
      role="img"
      aria-label="Passport verification QR code"
    >
      <rect width={size} height={size} fill="#F8FAFC" rx={8} />
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#08080D"
            />
          ) : null
        )
      )}
    </svg>
  );
}
