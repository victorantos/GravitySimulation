import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/constants.js';
import { galaxySpiral, randomCloud, twoGalaxies, PRESETS } from '../js/initial-conditions.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const N = 512;
const STRIDE = CONFIG.PARTICLE_STRIDE;

function getParticle(data, i) {
    const off = i * STRIDE;
    return {
        x: data[off], y: data[off + 1],
        vx: data[off + 2], vy: data[off + 3],
        mass: data[off + 4],
    };
}

function allParticlesValid(data, n) {
    for (let i = 0; i < n; i++) {
        const p = getParticle(data, i);
        assert.ok(Number.isFinite(p.x), `particle ${i} x is not finite: ${p.x}`);
        assert.ok(Number.isFinite(p.y), `particle ${i} y is not finite: ${p.y}`);
        assert.ok(Number.isFinite(p.vx), `particle ${i} vx is not finite: ${p.vx}`);
        assert.ok(Number.isFinite(p.vy), `particle ${i} vy is not finite: ${p.vy}`);
        assert.ok(Number.isFinite(p.mass) && p.mass > 0, `particle ${i} mass invalid: ${p.mass}`);
    }
}

describe('PRESETS', () => {
    it('exports all three presets', () => {
        assert.ok('galaxySpiral' in PRESETS);
        assert.ok('randomCloud' in PRESETS);
        assert.ok('twoGalaxies' in PRESETS);
    });
});

describe('galaxySpiral', () => {
    it('returns Float32Array of correct length', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        assert.ok(data instanceof Float32Array);
        assert.strictEqual(data.length, N * STRIDE);
    });

    it('produces finite positions, velocities, and positive masses', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        allParticlesValid(data, N);
    });

    it('positions are roughly centered on the canvas', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        let sumX = 0, sumY = 0;
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            sumX += p.x;
            sumY += p.y;
        }
        const avgX = sumX / N;
        const avgY = sumY / N;
        // Center of mass should be within 20% of canvas center
        assert.ok(Math.abs(avgX - WIDTH / 2) < WIDTH * 0.2, `avg X too far from center: ${avgX}`);
        assert.ok(Math.abs(avgY - HEIGHT / 2) < HEIGHT * 0.2, `avg Y too far from center: ${avgY}`);
    });

    it('particles have non-zero velocities (orbital motion)', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        let movingCount = 0;
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            if (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01) movingCount++;
        }
        assert.ok(movingCount > N * 0.9, `too few particles have velocity: ${movingCount}/${N}`);
    });

    it('masses are in expected range [1.0, 1.5]', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            assert.ok(p.mass >= 1.0 && p.mass <= 1.5, `mass out of range: ${p.mass}`);
        }
    });

    it('positions stay within canvas bounds', () => {
        const data = galaxySpiral(N, WIDTH, HEIGHT);
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            assert.ok(p.x >= 0 && p.x <= WIDTH, `x out of bounds: ${p.x}`);
            assert.ok(p.y >= 0 && p.y <= HEIGHT, `y out of bounds: ${p.y}`);
        }
    });

    it('handles edge case n=1', () => {
        const data = galaxySpiral(1, WIDTH, HEIGHT);
        assert.strictEqual(data.length, STRIDE);
        allParticlesValid(data, 1);
    });

    it('handles edge case n=0', () => {
        const data = galaxySpiral(0, WIDTH, HEIGHT);
        assert.strictEqual(data.length, 0);
    });
});

describe('randomCloud', () => {
    it('returns Float32Array of correct length', () => {
        const data = randomCloud(N, WIDTH, HEIGHT);
        assert.ok(data instanceof Float32Array);
        assert.strictEqual(data.length, N * STRIDE);
    });

    it('produces finite positions and positive masses', () => {
        const data = randomCloud(N, WIDTH, HEIGHT);
        allParticlesValid(data, N);
    });

    it('all velocities are zero (cold collapse)', () => {
        const data = randomCloud(N, WIDTH, HEIGHT);
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            assert.strictEqual(p.vx, 0);
            assert.strictEqual(p.vy, 0);
        }
    });

    it('all masses are exactly 1.0', () => {
        const data = randomCloud(N, WIDTH, HEIGHT);
        for (let i = 0; i < N; i++) {
            assert.strictEqual(getParticle(data, i).mass, 1.0);
        }
    });

    it('positions are within the cloud radius', () => {
        const data = randomCloud(N, WIDTH, HEIGHT);
        const cx = WIDTH / 2;
        const cy = HEIGHT / 2;
        const maxR = Math.min(WIDTH, HEIGHT) * 0.3;
        for (let i = 0; i < N; i++) {
            const p = getParticle(data, i);
            const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
            assert.ok(dist <= maxR + 1, `particle ${i} outside cloud radius: dist=${dist}, maxR=${maxR}`);
        }
    });
});

describe('twoGalaxies', () => {
    it('returns Float32Array of correct length', () => {
        const data = twoGalaxies(N, WIDTH, HEIGHT);
        assert.ok(data instanceof Float32Array);
        assert.strictEqual(data.length, N * STRIDE);
    });

    it('produces finite positions, velocities, and positive masses', () => {
        const data = twoGalaxies(N, WIDTH, HEIGHT);
        allParticlesValid(data, N);
    });

    it('two clusters are offset from each other', () => {
        const data = twoGalaxies(N, WIDTH, HEIGHT);
        const half = Math.floor(N / 2);

        // Compute center of mass for each galaxy
        let ax = 0, ay = 0, bx = 0, by = 0;
        for (let i = 0; i < half; i++) {
            const p = getParticle(data, i);
            ax += p.x; ay += p.y;
        }
        for (let i = half; i < N; i++) {
            const p = getParticle(data, i);
            bx += p.x; by += p.y;
        }
        ax /= half; ay /= half;
        bx /= (N - half); by /= (N - half);

        const separation = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
        assert.ok(separation > 50, `galaxies too close together: ${separation}`);
    });

    it('galaxies have opposing approach velocities', () => {
        const data = twoGalaxies(N, WIDTH, HEIGHT);
        const half = Math.floor(N / 2);

        // Average x-velocity of each galaxy
        let vxA = 0, vxB = 0;
        for (let i = 0; i < half; i++) vxA += getParticle(data, i).vx;
        for (let i = half; i < N; i++) vxB += getParticle(data, i).vx;
        vxA /= half;
        vxB /= (N - half);

        // Galaxies should have opposing mean velocities (approaching each other)
        // Galaxy A has APPROACH_SPEED * -sign(0) = -30, Galaxy B has +30
        assert.ok(vxA * vxB < 0, `galaxies not moving in opposite directions: vxA=${vxA}, vxB=${vxB}`);
    });
});
