import { CONFIG } from './constants.js';

const STRIDE = CONFIG.PARTICLE_STRIDE;

function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function galaxySpiral(n, width, height) {
    const data = new Float32Array(n * STRIDE);
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.35;
    const NUM_ARMS = 3;
    const SPIRAL_TIGHTNESS = 0.7;
    const SPREAD = 0.15;
    const SPEED_FACTOR = 1.8;

    for (let i = 0; i < n; i++) {
        const off = i * STRIDE;
        const r = maxRadius * Math.sqrt(Math.random());
        const armIndex = i % NUM_ARMS;
        const baseAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
        const spiralAngle = baseAngle + SPIRAL_TIGHTNESS * Math.log(r + 1);
        const angle = spiralAngle + gaussianRandom() * SPREAD;

        data[off + 0] = cx + r * Math.cos(angle);
        data[off + 1] = cy + r * Math.sin(angle);

        const speed = SPEED_FACTOR * Math.sqrt(r);
        data[off + 2] = -speed * Math.sin(angle);
        data[off + 3] = speed * Math.cos(angle);

        data[off + 4] = 1.0 + Math.random() * 0.5;
        // padding: off+5, off+6, off+7 = 0
    }
    return data;
}

export function randomCloud(n, width, height) {
    const data = new Float32Array(n * STRIDE);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.3;

    for (let i = 0; i < n; i++) {
        const off = i * STRIDE;
        const r = radius * Math.sqrt(Math.random());
        const angle = Math.random() * 2 * Math.PI;

        data[off + 0] = cx + r * Math.cos(angle);
        data[off + 1] = cy + r * Math.sin(angle);
        data[off + 2] = 0;
        data[off + 3] = 0;
        data[off + 4] = 1.0;
    }
    return data;
}

export function twoGalaxies(n, width, height) {
    const data = new Float32Array(n * STRIDE);
    const cx = width / 2;
    const cy = height / 2;
    const offset = Math.min(width, height) * 0.2;
    const maxRadius = Math.min(width, height) * 0.18;
    const NUM_ARMS = 2;
    const SPIRAL_TIGHTNESS = 0.6;
    const SPREAD = 0.2;
    const SPEED_FACTOR = 1.5;
    const APPROACH_SPEED = 30;

    const half = Math.floor(n / 2);

    for (let g = 0; g < 2; g++) {
        const gcx = cx + (g === 0 ? -offset : offset);
        const gcy = cy + (g === 0 ? -offset * 0.3 : offset * 0.3);
        const sign = g === 0 ? 1 : -1;
        const count = g === 0 ? half : n - half;
        const start = g === 0 ? 0 : half;

        for (let i = 0; i < count; i++) {
            const off = (start + i) * STRIDE;
            const r = maxRadius * Math.sqrt(Math.random());
            const armIndex = i % NUM_ARMS;
            const baseAngle = (armIndex / NUM_ARMS) * 2 * Math.PI;
            const spiralAngle = baseAngle + SPIRAL_TIGHTNESS * Math.log(r + 1);
            const angle = spiralAngle + gaussianRandom() * SPREAD;

            data[off + 0] = gcx + r * Math.cos(angle);
            data[off + 1] = gcy + r * Math.sin(angle);

            const speed = SPEED_FACTOR * Math.sqrt(r);
            data[off + 2] = -speed * Math.sin(angle) * sign + APPROACH_SPEED * -sign;
            data[off + 3] = speed * Math.cos(angle) * sign;

            data[off + 4] = 1.0 + Math.random() * 0.5;
        }
    }
    return data;
}

export const PRESETS = { galaxySpiral, randomCloud, twoGalaxies };
