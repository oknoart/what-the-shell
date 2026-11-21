/**
 * Raup (1966) coiled-shell parametric surface.
 *
 * Pure module: no Three.js dependency. Returns flat typed arrays that the
 * scene layer wraps in a BufferGeometry.
 *
 * Parameters
 *   W  whorl expansion rate per revolution (1.1 .. 10)
 *   D  normalized distance of the generating curve from the axis (0 .. 0.85)
 *   T  vertical translation rate (0 .. 6), z_c = T * r_c
 *
 * Conventions
 *   k        = W^(1 / 2π)          growth factor per radian
 *   a(θ)     = a0 * k^θ            generating-curve radius
 *   r_c(θ)   = a(θ) * (1 + D)/(1 - D)
 *   z_c(θ)   = T * r_c(θ)
 *
 * Surface (θ = coiling angle, φ = angle around the generating curve):
 *   R = r_c + a cos φ
 *   Z = z_c + a sin φ
 *   X = R cos θ,  Y = R sin θ
 *
 * The result is centered and uniformly scaled to a unit bounding sphere so
 * that every preset is framed consistently by the viewer.
 */

const TWO_PI = Math.PI * 2;

export function generateShell({
  W = 2.0,
  D = 0.25,
  T = 1.5,
  turns = 5,
  thetaSegments = 512,
  phiSegments = 64,
  growthCap = 40,
  a0 = 1,
} = {}) {
  const k = Math.pow(W, 1 / TWO_PI);
  const lnK = Math.log(k);
  const c = (1 + D) / (1 - D);

  // Adaptive turn cap: never let the radius grow past `growthCap` (relative to
  // a0), otherwise high-W shells explode numerically. Always keep >= 1 turn.
  const thetaByCap = lnK > 1e-9 ? Math.log(growthCap) / lnK : turns * TWO_PI;
  const thetaMax = Math.max(TWO_PI, Math.min(turns * TWO_PI, thetaByCap));

  const nTheta = thetaSegments + 1;
  const nPhi = phiSegments + 1;
  const vertexCount = nTheta * nPhi;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  for (let i = 0; i < nTheta; i++) {
    const theta = (i / thetaSegments) * thetaMax;

    const a = a0 * Math.exp(lnK * theta);
    const aPrime = a * lnK;

    const rc = a * c;
    const rcPrime = aPrime * c;

    const zc = T * rc;
    const zcPrime = T * rcPrime;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j < nPhi; j++) {
      const phi = (j / phiSegments) * TWO_PI;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const R = rc + a * cosP;
      const Z = zc + a * sinP;
      const X = R * cosT;
      const Y = R * sinT;

      // ∂P/∂θ
      const dR_dTheta = rcPrime + aPrime * cosP;
      const dZ_dTheta = zcPrime + aPrime * sinP;
      const dX_dTheta = dR_dTheta * cosT - R * sinT;
      const dY_dTheta = dR_dTheta * sinT + R * cosT;

      // ∂P/∂φ
      const dR_dPhi = -a * sinP;
      const dZ_dPhi = a * cosP;
      const dX_dPhi = dR_dPhi * cosT;
      const dY_dPhi = dR_dPhi * sinT;

      // n = ∂P/∂θ × ∂P/∂φ (points outward)
      let nx = dY_dTheta * dZ_dPhi - dZ_dTheta * dY_dPhi;
      let ny = dZ_dTheta * dX_dPhi - dX_dTheta * dZ_dPhi;
      let nz = dX_dTheta * dY_dPhi - dY_dTheta * dX_dPhi;

      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const o = (i * nPhi + j) * 3;
      positions[o] = X;
      positions[o + 1] = Y;
      positions[o + 2] = Z;
      normals[o] = nx;
      normals[o + 1] = ny;
      normals[o + 2] = nz;
    }
  }

  // Indices: consistent CCW winding matching the outward normals above.
  const indices = new Uint32Array(thetaSegments * phiSegments * 6);
  let p = 0;
  for (let i = 0; i < thetaSegments; i++) {
    for (let j = 0; j < phiSegments; j++) {
      const v00 = i * nPhi + j;
      const v10 = (i + 1) * nPhi + j;
      const v11 = (i + 1) * nPhi + j + 1;
      const v01 = i * nPhi + j + 1;

      indices[p++] = v00;
      indices[p++] = v10;
      indices[p++] = v01;

      indices[p++] = v10;
      indices[p++] = v11;
      indices[p++] = v01;
    }
  }

  normalizeToUnitSphere(positions);

  return {
    positions,
    normals,
    indices,
    thetaMax,
    turns: thetaMax / TWO_PI,
  };
}

/**
 * Center the mesh on its bounding-box center and uniformly scale it so its
 * bounding-sphere radius is 1. Uniform scale leaves normals unchanged.
 */
function normalizeToUnitSphere(positions) {
  const count = positions.length / 3;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;

  let maxR2 = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - cx;
    const dy = positions[i + 1] - cy;
    const dz = positions[i + 2] - cz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > maxR2) maxR2 = r2;
  }

  const scale = maxR2 > 0 ? 1 / Math.sqrt(maxR2) : 1;

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - cx) * scale;
    positions[i + 1] = (positions[i + 1] - cy) * scale;
    positions[i + 2] = (positions[i + 2] - cz) * scale;
  }

  return count;
}
