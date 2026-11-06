export function callGrid(width: number, height: number, count: number) {
  const gap = 12,
    ratio = 16 / 9;
  let best = {
    columns: 1,
    rows: Math.max(1, count),
    width: Math.max(1, width),
    height: 80,
    area: 0,
  };
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.ceil(Math.max(1, count) / columns),
      tileWidth = Math.max(1, (width - gap * (columns - 1)) / columns),
      tileHeight = Math.min(
        tileWidth / ratio,
        Math.max(80, (height - gap * (rows - 1)) / rows),
      );
    const fittedWidth = Math.min(tileWidth, tileHeight * ratio),
      area = fittedWidth * tileHeight;
    if (area > best.area)
      best = { columns, rows, width: fittedWidth, height: tileHeight, area };
  }
  return best;
}
