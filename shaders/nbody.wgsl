// N-Body Gravity Compute Shader — Shared Memory Tiling
//
// GPU Concept: Each workgroup cooperatively loads a TILE of particles into
// fast shared memory, then every thread computes forces against that tile.
// This reduces global memory reads from O(N²) to O(N²/TILE_SIZE).
//
// CUDA equivalent: var<workgroup> → __shared__, workgroupBarrier() → __syncthreads()

struct Particle {
    pos:  vec2<f32>,
    vel:  vec2<f32>,
    mass: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
};

struct SimParams {
    G:             f32,
    dt:            f32,
    softening:     f32,
    damping:       f32,
    numParticles:  u32,
    _pad1:         u32,
    _pad2:         u32,
    _pad3:         u32,
};

const TILE_SIZE: u32 = 256u;

@group(0) @binding(0) var<storage, read>       particlesIn:  array<Particle>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<Particle>;
@group(0) @binding(2) var<uniform>             params:       SimParams;

// Shared memory tile — the key optimization
var<workgroup> tile: array<Particle, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(
    @builtin(global_invocation_id)  gid: vec3<u32>,
    @builtin(local_invocation_id)   lid: vec3<u32>,
) {
    let idx = gid.x;

    // IMPORTANT: No early return here! All threads in the workgroup must
    // reach every workgroupBarrier(). We use a flag instead.
    // (CUDA equivalent: all threads in a block must hit __syncthreads())
    let isValid = idx < params.numParticles;

    // Load this thread's particle (or defaults if out of bounds)
    var myPos  = vec2<f32>(0.0, 0.0);
    var myVel  = vec2<f32>(0.0, 0.0);
    var myMass = 0.0;
    if (isValid) {
        myPos  = particlesIn[idx].pos;
        myVel  = particlesIn[idx].vel;
        myMass = particlesIn[idx].mass;
    }
    var force = vec2<f32>(0.0, 0.0);

    // Loop over tiles of particles
    let numTiles = (params.numParticles + TILE_SIZE - 1u) / TILE_SIZE;

    for (var t = 0u; t < numTiles; t++) {
        // Step 1: ALL threads cooperatively load one tile into shared memory
        let loadIdx = t * TILE_SIZE + lid.x;
        if (loadIdx < params.numParticles) {
            tile[lid.x] = particlesIn[loadIdx];
        }

        // Step 2: Barrier — wait for all threads to finish loading
        workgroupBarrier();

        // Step 3: Only valid threads accumulate forces
        if (isValid) {
            let tileCount = min(TILE_SIZE, params.numParticles - t * TILE_SIZE);
            for (var j = 0u; j < tileCount; j++) {
                let diff = tile[j].pos - myPos;
                let distSq = dot(diff, diff) + params.softening;
                let invDist = inverseSqrt(distSq);
                let invDist3 = invDist * invDist * invDist;
                force += diff * (params.G * tile[j].mass * invDist3);
            }
        }

        // Step 4: Barrier — don't overwrite shared memory until all threads done reading
        workgroupBarrier();
    }

    // Integrate and write only for valid threads
    if (isValid) {
        myVel += force * params.dt;
        myVel *= params.damping;
        myPos += myVel * params.dt;

        particlesOut[idx].pos  = myPos;
        particlesOut[idx].vel  = myVel;
        particlesOut[idx].mass = myMass;
    }
}
