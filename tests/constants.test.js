import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/constants.js';

describe('CONFIG', () => {
    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(CONFIG));
    });

    it('has all required fields', () => {
        const required = [
            'MAX_PARTICLES', 'DEFAULT_PARTICLES', 'G', 'DT',
            'SOFTENING', 'DAMPING', 'WORKGROUP_SIZE', 'PARTICLE_SCALE',
            'MAX_SPEED', 'PARTICLE_STRIDE', 'SPAWN_COUNT',
        ];
        for (const key of required) {
            assert.ok(key in CONFIG, `missing CONFIG.${key}`);
        }
    });

    it('MAX_PARTICLES is a power of 2', () => {
        const n = CONFIG.MAX_PARTICLES;
        assert.ok(n > 0 && (n & (n - 1)) === 0, `${n} is not a power of 2`);
    });

    it('DEFAULT_PARTICLES <= MAX_PARTICLES', () => {
        assert.ok(CONFIG.DEFAULT_PARTICLES <= CONFIG.MAX_PARTICLES);
    });

    it('DEFAULT_PARTICLES is a multiple of WORKGROUP_SIZE', () => {
        assert.strictEqual(CONFIG.DEFAULT_PARTICLES % CONFIG.WORKGROUP_SIZE, 0);
    });

    it('PARTICLE_STRIDE matches 32-byte struct (8 floats)', () => {
        assert.strictEqual(CONFIG.PARTICLE_STRIDE, 8);
    });

    it('physics constants are positive', () => {
        assert.ok(CONFIG.G > 0);
        assert.ok(CONFIG.DT > 0);
        assert.ok(CONFIG.SOFTENING > 0);
        assert.ok(CONFIG.DAMPING > 0 && CONFIG.DAMPING <= 1.0);
    });

    it('WORKGROUP_SIZE is <= 256 (WebGPU minimum guarantee)', () => {
        assert.ok(CONFIG.WORKGROUP_SIZE <= 256);
    });
});
