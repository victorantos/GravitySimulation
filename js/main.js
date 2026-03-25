import { CONFIG } from './constants.js';
import { initGPU } from './gpu-context.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { galaxySpiral, PRESETS } from './initial-conditions.js';
import { initUI } from './ui.js';

async function main() {
    const canvas = document.getElementById('canvas');
    const errorOverlay = document.getElementById('error-overlay');

    function resize() {
        canvas.width = window.innerWidth * devicePixelRatio;
        canvas.height = window.innerHeight * devicePixelRatio;
    }
    resize();

    let gpu;
    try {
        gpu = await initGPU(canvas);
    } catch (e) {
        errorOverlay.textContent = e.message;
        errorOverlay.style.display = 'flex';
        return;
    }

    const sim = new Simulation();
    await sim.init(gpu.device, CONFIG.DEFAULT_PARTICLES, galaxySpiral, canvas.width, canvas.height);

    const renderer = new Renderer();
    await renderer.init(gpu.device, gpu.format);
    renderer.updateSize(canvas.width, canvas.height);

    let paused = false;
    let currentPreset = 'galaxySpiral';
    let useTrails = true;
    let attractorActive = false;
    let attractorPos = { x: 0, y: 0 };

    // Attractor particle data — a massive invisible particle
    const attractorData = new Float32Array(CONFIG.PARTICLE_STRIDE);
    attractorData[4] = 5000.0; // large mass

    const ui = initUI({
        onGravityChange: (G) => sim.updateParams({ G }),
        onSofteningChange: (s) => sim.updateParams({ softening: s }),
        onDampingChange: (d) => sim.updateParams({ damping: d }),
        onTimestepChange: (dt) => sim.updateParams({ dt }),
        onParticleSizeChange: (s) => renderer.updateRenderParams({ particleScale: s }),
        onTrailChange: (a) => {
            renderer.updateRenderParams({ trailAlpha: a });
            useTrails = a > 0.001;
            if (!useTrails) renderer.markClear();
        },
        onPresetChange: (name) => {
            currentPreset = name;
            const fn = PRESETS[name];
            if (fn) {
                sim.numParticles = CONFIG.DEFAULT_PARTICLES;
                sim.reset(fn, canvas.width, canvas.height);
                renderer.markClear();
            }
        },
        onPauseToggle: () => {
            paused = !paused;
            return paused;
        },
        onReset: () => {
            const fn = PRESETS[currentPreset] || galaxySpiral;
            sim.numParticles = CONFIG.DEFAULT_PARTICLES;
            sim.reset(fn, canvas.width, canvas.height);
            renderer.markClear();
        },
        onSpawnParticles: (x, y, vx, vy) => {
            const count = CONFIG.SPAWN_COUNT;
            const data = new Float32Array(count * CONFIG.PARTICLE_STRIDE);
            const dpr = devicePixelRatio;
            for (let i = 0; i < count; i++) {
                const off = i * CONFIG.PARTICLE_STRIDE;
                const angle = Math.random() * Math.PI * 2;
                const spread = Math.random() * 20 * dpr;
                data[off + 0] = x * dpr + Math.cos(angle) * spread;
                data[off + 1] = y * dpr + Math.sin(angle) * spread;
                data[off + 2] = vx * dpr + (Math.random() - 0.5) * 40;
                data[off + 3] = vy * dpr + (Math.random() - 0.5) * 40;
                data[off + 4] = 1.0;
            }
            sim.spawnParticles(data);
        },
        onAttractor: (x, y) => {
            attractorActive = true;
            attractorPos = { x: x * devicePixelRatio, y: y * devicePixelRatio };
        },
        onAttractorEnd: () => {
            attractorActive = false;
        },
    });

    window.addEventListener('resize', () => {
        resize();
        renderer.updateSize(canvas.width, canvas.height);
        renderer.markClear();
    });

    function frame() {
        const encoder = gpu.device.createCommandEncoder();

        // Handle attractor: temporarily add a massive particle, simulate, then remove it
        if (attractorActive && !paused) {
            attractorData[0] = attractorPos.x;
            attractorData[1] = attractorPos.y;
            attractorData[2] = 0;
            attractorData[3] = 0;
            attractorData[4] = 5000.0;
            // Temporarily increase particle count to include attractor
            const origCount = sim.numParticles;
            const offset = origCount * CONFIG.PARTICLE_STRIDE * 4;
            const buf = sim.particleBuffers[sim.currentStep];
            gpu.device.queue.writeBuffer(buf, offset, attractorData);
            sim.numParticles = origCount + 1;
            sim.paramsDirty = true;
            sim.step(encoder);
            sim.numParticles = origCount;
            sim.paramsDirty = true;
        } else if (!paused) {
            sim.step(encoder);
        }

        const swapChainTexture = gpu.context.getCurrentTexture();
        renderer.render(encoder, swapChainTexture, sim.getCurrentBuffer(), sim.numParticles, useTrails);

        gpu.device.queue.submit([encoder.finish()]);

        ui.updateFPS();
        ui.updateCount(sim.numParticles);

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

main().catch(e => {
    console.error(e);
    const overlay = document.getElementById('error-overlay');
    if (overlay) {
        overlay.textContent = e.message;
        overlay.style.display = 'flex';
    }
});
