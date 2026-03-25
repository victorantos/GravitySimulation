export const CONFIG = Object.freeze({
    MAX_PARTICLES: 65536,
    DEFAULT_PARTICLES: 4096,
    G: 1.0,
    DT: 0.016,
    SOFTENING: 10.0,
    DAMPING: 0.9995,
    WORKGROUP_SIZE: 256,
    PARTICLE_SCALE: 0.004,
    MAX_SPEED: 300.0,
    PARTICLE_STRIDE: 8, // floats per particle (32 bytes / 4)
    SPAWN_COUNT: 100,
});
