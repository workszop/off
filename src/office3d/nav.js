// ---- Navigation grid ----
// A walkability grid over the room floor (0.2 m cells). Furniture footprints
// are stamped in, inflated by the character radius; A* finds a path and a
// line-of-sight pass trims it to a few straight legs.

export class NavGrid {
  constructor({ x0, z0, x1, z1, cell = 0.2 }) {
    Object.assign(this, { x0, z0, x1, z1, cell });
    this.cols = Math.ceil((x1 - x0) / cell);
    this.rows = Math.ceil((z1 - z0) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  // Block a world-space polygon's bounding box, inflated by `pad`.
  blockRect(x0, z0, x1, z1, pad = 0) {
    const [c0, r0] = this.toCell(x0 - pad, z0 - pad);
    const [c1, r1] = this.toCell(x1 + pad, z1 + pad);
    for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) this.blocked[r * this.cols + c] = 1;
    }
  }

  toCell(x, z) {
    return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)];
  }
  toWorld(c, r) {
    return [this.x0 + (c + 0.5) * this.cell, this.z0 + (r + 0.5) * this.cell];
  }
  inside(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  free(c, r) { return this.inside(c, r) && !this.blocked[r * this.cols + c]; }
  freeAt(x, z) { return this.free(...this.toCell(x, z)); }

  // Nearest free cell to a point (spiral search).
  nearestFree(x, z) {
    const [c, r] = this.toCell(x, z);
    if (this.free(c, r)) return [c, r];
    for (let rad = 1; rad < 20; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) === rad && this.free(c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
    return null;
  }

  randomFree(random = Math.random) {
    for (let i = 0; i < 200; i++) {
      const c = Math.floor(random() * this.cols), r = Math.floor(random() * this.rows);
      if (this.free(c, r)) return this.toWorld(c, r);
    }
    return this.toWorld(this.cols >> 1, this.rows >> 1);
  }

  lineOfSight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cell * 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.freeAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  // A* with 8-way moves (no corner cutting). Returns world waypoints.
  path(ax, az, bx, bz) {
    const start = this.nearestFree(ax, az), goal = this.nearestFree(bx, bz);
    if (!start || !goal) return null;
    const N = this.cols * this.rows;
    const idx = (c, r) => r * this.cols + c;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const h = (c, r) => {
      const dx = Math.abs(c - goal[0]), dz = Math.abs(r - goal[1]);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    const open = [[h(...start), ...start]];
    g[idx(...start)] = 0;
    const goalI = idx(...goal);
    while (open.length) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[best][0]) best = i;
      const [, c, r] = open.splice(best, 1)[0];
      const ci = idx(c, r);
      if (ci === goalI) break;
      if (closed[ci]) continue;
      closed[ci] = 1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (!this.free(nc, nr)) continue;
        if (dc && dr && (!this.free(c + dc, r) || !this.free(c, r + dr))) continue;
        const ni = idx(nc, nr);
        const cost = g[ci] + (dc && dr ? Math.SQRT2 : 1);
        if (cost < g[ni]) {
          g[ni] = cost;
          came[ni] = ci;
          open.push([cost + h(nc, nr), nc, nr]);
        }
      }
    }
    if (came[goalI] === -1 && idx(...start) !== goalI) return null;
    const cells = [];
    for (let i = goalI; i !== -1; i = came[i]) cells.push(this.toWorld(i % this.cols, Math.floor(i / this.cols)));
    cells.reverse();
    cells[cells.length - 1] = this.freeAt(bx, bz) ? [bx, bz] : cells[cells.length - 1];
    // String-pull: keep only waypoints needed to stay in the clear.
    const out = [];
    let from = [ax, az];
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineOfSight(from[0], from[1], cells[j][0], cells[j][1])) j--;
      out.push(cells[j]);
      from = cells[j];
      i = j + 1;
    }
    return out;
  }
}
