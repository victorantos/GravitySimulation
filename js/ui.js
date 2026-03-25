import { CONFIG } from './constants.js';

export function initUI(callbacks) {
    const fpsEl = document.getElementById('fps');
    const countEl = document.getElementById('particle-count');
    const canvas = document.getElementById('canvas');

    // FPS tracking
    const frameTimes = [];
    let lastTime = performance.now();

    function updateFPS() {
        const now = performance.now();
        frameTimes.push(now - lastTime);
        lastTime = now;
        if (frameTimes.length > 60) frameTimes.shift();
        const avg = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
        fpsEl.textContent = `${Math.round(1000 / avg)} FPS`;
    }

    function updateCount(n) {
        countEl.textContent = `${n.toLocaleString()} particles`;
    }

    // Sliders
    function bindSlider(id, callback, transform = v => v) {
        const slider = document.getElementById(id);
        const label = document.getElementById(id + '-val');
        slider.addEventListener('input', () => {
            const val = transform(parseFloat(slider.value));
            if (label) label.textContent = val.toFixed(4);
            callback(val);
        });
        // Set initial display
        const val = transform(parseFloat(slider.value));
        if (label) label.textContent = val.toFixed(4);
    }

    bindSlider('gravity', v => callbacks.onGravityChange(v), v => Math.pow(10, v));
    bindSlider('softening', v => callbacks.onSofteningChange(v));
    bindSlider('damping', v => callbacks.onDampingChange(v));
    bindSlider('timestep', v => callbacks.onTimestepChange(v));
    bindSlider('particle-size', v => callbacks.onParticleSizeChange(v));
    bindSlider('trail', v => callbacks.onTrailChange(v));

    // Preset selector
    document.getElementById('preset').addEventListener('change', (e) => {
        callbacks.onPresetChange(e.target.value);
    });

    // Pause / Play
    document.getElementById('pause-btn').addEventListener('click', () => {
        const btn = document.getElementById('pause-btn');
        const paused = callbacks.onPauseToggle();
        btn.textContent = paused ? 'Play' : 'Pause';
    });

    // Reset
    document.getElementById('reset-btn').addEventListener('click', () => {
        callbacks.onReset();
    });

    // Mouse interaction
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let rightDown = false;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            dragStart = { x: e.offsetX, y: e.offsetY };
        } else if (e.button === 2) {
            rightDown = true;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (rightDown) {
            callbacks.onAttractor(e.offsetX, e.offsetY);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && isDragging) {
            isDragging = false;
            const vx = (e.offsetX - dragStart.x) * 2;
            const vy = (e.offsetY - dragStart.y) * 2;
            callbacks.onSpawnParticles(dragStart.x, dragStart.y, vx, vy);
        } else if (e.button === 2) {
            rightDown = false;
            callbacks.onAttractorEnd();
        }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    return { updateFPS, updateCount };
}
