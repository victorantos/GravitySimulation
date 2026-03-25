// Particle Render Shader — Instanced Billboard Quads with Glow
//
// Each particle is a screen-facing quad (2 triangles, 6 vertices).
// The fragment shader draws a smooth circle with gaussian glow.
// Additive blending makes overlapping particles create bright clusters.

struct Particle {
    pos:  vec2<f32>,
    vel:  vec2<f32>,
    mass: f32,
    _pad1: f32,
    _pad2: f32,
    _pad3: f32,
};

struct RenderParams {
    canvasWidth:  f32,
    canvasHeight: f32,
    particleScale: f32,
    maxSpeed:     f32,
    trailAlpha:   f32,
    _pad1:        f32,
    _pad2:        f32,
    _pad3:        f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0)       uv:       vec2<f32>,
    @location(1)       color:    vec3<f32>,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform>       rp:        RenderParams;

// Quad vertices: 2 triangles forming a [-1,1] square
const QUAD = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0,  1.0), vec2(1.0, -1.0), vec2( 1.0, 1.0),
);

fn velocityToColor(t: f32) -> vec3<f32> {
    // Blue (slow) → Cyan → White → Yellow → Red (fast)
    if (t < 0.25) {
        let s = t / 0.25;
        return mix(vec3(0.1, 0.2, 0.8), vec3(0.0, 0.8, 1.0), s);
    } else if (t < 0.5) {
        let s = (t - 0.25) / 0.25;
        return mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 1.0, 1.0), s);
    } else if (t < 0.75) {
        let s = (t - 0.5) / 0.25;
        return mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.9, 0.2), s);
    } else {
        let s = (t - 0.75) / 0.25;
        return mix(vec3(1.0, 0.9, 0.2), vec3(1.0, 0.2, 0.1), s);
    }
}

@vertex
fn vs_main(
    @builtin(vertex_index)   vertIdx:     u32,
    @builtin(instance_index) instanceIdx: u32,
) -> VertexOutput {
    let p = particles[instanceIdx];
    let uv = QUAD[vertIdx];

    // Convert particle position to clip space [-1, 1]
    let clipPos = vec2<f32>(
        (p.pos.x / rp.canvasWidth)  * 2.0 - 1.0,
        -((p.pos.y / rp.canvasHeight) * 2.0 - 1.0),
    );

    let aspect = rp.canvasWidth / rp.canvasHeight;
    let size = rp.particleScale * (0.5 + sqrt(p.mass) * 0.5);

    var out: VertexOutput;
    out.position = vec4<f32>(
        clipPos.x + uv.x * size / aspect,
        clipPos.y + uv.y * size,
        0.0, 1.0,
    );
    out.uv = uv;

    let speed = length(p.vel);
    let t = clamp(speed / rp.maxSpeed, 0.0, 1.0);
    out.color = velocityToColor(t);

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let dist = length(in.uv);
    if (dist > 1.0) {
        discard;
    }

    // Bright core + gaussian glow
    let core = smoothstep(1.0, 0.0, dist);
    let glow = exp(-dist * dist * 3.0);
    let brightness = core * 0.3 + glow * 0.7;

    return vec4<f32>(in.color * brightness, brightness);
}

// === Trail fade shader ===
// Draws a fullscreen quad that darkens the previous frame

struct TrailVertexOutput {
    @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_trail(@builtin(vertex_index) vertIdx: u32) -> TrailVertexOutput {
    let pos = QUAD[vertIdx];
    var out: TrailVertexOutput;
    out.position = vec4<f32>(pos, 0.0, 1.0);
    return out;
}

@fragment
fn fs_trail() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 0.0, 0.02, rp.trailAlpha);
}
