# N-Body Gravity Simulation

A real-time N-body gravity simulation running entirely on the GPU via WebGPU compute shaders. Thousands of particles interact gravitationally, forming galaxies, clusters, and orbital structures.

**[Try it live](https://victorantos.github.io/GravitySimulation/)**

## Features

- GPU-accelerated N-body physics via WebGPU compute shaders
- Shared memory tiling optimization (O(N²) force calculation, bandwidth-efficient)
- Interactive — click to spawn particles, drag to fling, right-click to attract
- Three presets: Galaxy Spiral, Random Cloud Collapse, Two Colliding Galaxies
- Real-time parameter tuning: gravity, softening, damping, timestep
- Additive blending with glow and velocity-based coloring
- Particle trail effect with adjustable fade

## Getting Started

Serve the directory with any static file server and open in Chrome or Edge:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

> **Note:** Requires a browser with WebGPU support (Chrome 113+, Edge 113+, Safari 18+).

## Controls

| Action | Input |
|--------|-------|
| Spawn particles | Click |
| Fling particles | Click + drag |
| Gravitational attractor | Right-click + hold |

**Sliders:** Gravity (G), Softening, Damping, Timestep, Particle Size, Trail Fade

**Presets:** Galaxy Spiral, Random Cloud, Two Galaxies

## How It Works

The simulation uses the classic **shared memory tiling** pattern — the same algorithm used in NVIDIA's CUDA N-Body sample:

1. Particles are split into tiles of 256
2. Each workgroup cooperatively loads a tile into fast shared memory
3. Every thread computes gravitational forces against the tile
4. Repeat for all tiles — reduces global memory reads by 256×

This maps directly to CUDA concepts:

| WebGPU (WGSL) | CUDA |
|----------------|------|
| `@workgroup_size(256)` | `<<<blocks, 256>>>` |
| `var<workgroup>` | `__shared__` |
| `workgroupBarrier()` | `__syncthreads()` |
| `global_invocation_id.x` | `blockIdx.x * blockDim.x + threadIdx.x` |

## Author

**Victor Antofica** — [victorantos.com](https://victorantos.com)

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
