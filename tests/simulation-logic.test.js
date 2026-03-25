import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/constants.js';

describe('uniform buffer encoding', () => {
    // Reproduce the encoding logic from Simulation.writeParams()
    function encodeParams(G, dt, softening, damping, numParticles) {
        const buf = new ArrayBuffer(32);
        const f32 = new Float32Array(buf);
        const u32 = new Uint32Array(buf);
        f32[0] = G;
        f32[1] = dt;
        f32[2] = softening;
        f32[3] = damping;
        u32[4] = numParticles;
        return { f32, u32 };
    }

    it('encodes float params at correct offsets', () => {
        const { f32 } = encodeParams(2.5, 0.016, 10.0, 0.999, 1000);
        assert.strictEqual(f32[0], 2.5);                              // G (exact in f32)
        assert.ok(Math.abs(f32[1] - 0.016) < 1e-6, `dt: ${f32[1]}`); // dt (f32 rounding)
        assert.strictEqual(f32[2], 10.0);                              // softening
        assert.ok(Math.abs(f32[3] - 0.999) < 1e-6, `damping: ${f32[3]}`); // damping
    });

    it('encodes numParticles as u32 at offset 16', () => {
        const { u32 } = encodeParams(1.0, 0.016, 10.0, 0.999, 4096);
        assert.strictEqual(u32[4], 4096);
    });

    it('buffer is exactly 32 bytes', () => {
        const { f32 } = encodeParams(1.0, 0.016, 10.0, 0.999, 100);
        assert.strictEqual(f32.buffer.byteLength, 32);
    });

    it('padding bytes are zero', () => {
        const { u32 } = encodeParams(1.0, 0.016, 10.0, 0.999, 100);
        assert.strictEqual(u32[5], 0);
        assert.strictEqual(u32[6], 0);
        assert.strictEqual(u32[7], 0);
    });
});

describe('double buffer index logic', () => {
    // Reproduce the step/getCurrentBuffer logic
    it('getCurrentBuffer returns the output buffer after one step', () => {
        let currentStep = 0;

        // step(): use bindGroups[currentStep] which reads [currentStep], writes [1-currentStep]
        // then flip
        currentStep = 1 - currentStep; // now 1

        // getCurrentBuffer() returns particleBuffers[currentStep]
        const readFrom = currentStep; // 1
        assert.strictEqual(readFrom, 1, 'should read from buffer 1 after first step');
    });

    it('alternates correctly over multiple steps', () => {
        let currentStep = 0;
        const outputs = [];

        for (let i = 0; i < 6; i++) {
            // step writes to buffer (1 - currentStep), then flips
            const writtenTo = 1 - currentStep;
            currentStep = 1 - currentStep;

            // getCurrentBuffer returns particleBuffers[currentStep]
            outputs.push(currentStep);
            assert.strictEqual(currentStep, writtenTo, `step ${i}: getCurrentBuffer should match written buffer`);
        }

        assert.deepStrictEqual(outputs, [1, 0, 1, 0, 1, 0]);
    });
});

describe('workgroup dispatch calculation', () => {
    it('dispatches correct number of workgroups', () => {
        const cases = [
            { particles: 256, expected: 1 },
            { particles: 257, expected: 2 },
            { particles: 512, expected: 2 },
            { particles: 1000, expected: 4 },
            { particles: 4096, expected: 16 },
            { particles: 65536, expected: 256 },
        ];
        for (const { particles, expected } of cases) {
            const dispatched = Math.ceil(particles / CONFIG.WORKGROUP_SIZE);
            assert.strictEqual(dispatched, expected, `${particles} particles -> ${dispatched} workgroups, expected ${expected}`);
        }
    });

    it('never dispatches 0 workgroups for non-zero particles', () => {
        for (let n = 1; n <= 512; n++) {
            assert.ok(Math.ceil(n / CONFIG.WORKGROUP_SIZE) >= 1);
        }
    });
});

describe('spawn particle offset calculation', () => {
    it('computes correct byte offset for appending', () => {
        const numParticles = 4096;
        const offset = numParticles * CONFIG.PARTICLE_STRIDE * 4; // bytes
        assert.strictEqual(offset, 4096 * 8 * 4); // 131072 bytes
        assert.strictEqual(offset, 131072);
    });

    it('clamps to MAX_PARTICLES', () => {
        const numParticles = CONFIG.MAX_PARTICLES;
        const maxNew = CONFIG.MAX_PARTICLES - numParticles;
        assert.strictEqual(maxNew, 0, 'should not allow spawning when at max');
    });

    it('limits spawn count when near max', () => {
        const numParticles = CONFIG.MAX_PARTICLES - 50;
        const requestedCount = 100;
        const maxNew = CONFIG.MAX_PARTICLES - numParticles;
        const actualCount = Math.min(requestedCount, maxNew);
        assert.strictEqual(actualCount, 50);
    });
});
