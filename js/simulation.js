import { CONFIG } from './constants.js';

export class Simulation {
    constructor() {
        this.device = null;
        this.numParticles = 0;
        this.currentStep = 0;
        this.particleBuffers = [null, null];
        this.paramsBuffer = null;
        this.bindGroups = [null, null];
        this.pipeline = null;
        this.paramsDirty = true;
        this.params = {
            G: CONFIG.G,
            dt: CONFIG.DT,
            softening: CONFIG.SOFTENING,
            damping: CONFIG.DAMPING,
        };
    }

    async init(device, numParticles, presetFn, canvasWidth, canvasHeight) {
        this.device = device;
        this.numParticles = numParticles;
        this.currentStep = 0;

        // Load compute shader
        const shaderCode = await fetch('shaders/nbody.wgsl').then(r => r.text());
        const shaderModule = device.createShaderModule({ code: shaderCode });

        // Check for compile errors
        const info = await shaderModule.getCompilationInfo();
        for (const msg of info.messages) {
            console.warn(`Compute shader ${msg.type}: ${msg.message} (line ${msg.lineNum})`);
        }

        // Pre-allocate buffers for MAX_PARTICLES
        const bufferSize = CONFIG.MAX_PARTICLES * CONFIG.PARTICLE_STRIDE * 4;
        for (let i = 0; i < 2; i++) {
            this.particleBuffers[i] = device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            });
        }

        // Uniform buffer: G, dt, softening, damping, numParticles + 3 padding u32s = 32 bytes
        this.paramsBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Bind group layout
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        // Two bind groups for double buffering: A→B and B→A
        for (let i = 0; i < 2; i++) {
            this.bindGroups[i] = device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[i] } },
                    { binding: 1, resource: { buffer: this.particleBuffers[1 - i] } },
                    { binding: 2, resource: { buffer: this.paramsBuffer } },
                ],
            });
        }

        // Compute pipeline
        this.pipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: 'main' },
        });

        // Generate and upload initial conditions
        this.reset(presetFn, canvasWidth, canvasHeight);
    }

    reset(presetFn, canvasWidth, canvasHeight) {
        const data = presetFn(this.numParticles, canvasWidth, canvasHeight);
        this.device.queue.writeBuffer(this.particleBuffers[0], 0, data);
        this.currentStep = 0;
        this.paramsDirty = true;
    }

    updateParams(newParams) {
        Object.assign(this.params, newParams);
        this.paramsDirty = true;
    }

    writeParams() {
        if (!this.paramsDirty) return;
        this.paramsDirty = false;

        const buf = new ArrayBuffer(32);
        const f32 = new Float32Array(buf);
        const u32 = new Uint32Array(buf);
        f32[0] = this.params.G;
        f32[1] = this.params.dt;
        f32[2] = this.params.softening;
        f32[3] = this.params.damping;
        u32[4] = this.numParticles;
        // u32[5], u32[6], u32[7] = padding (0)
        this.device.queue.writeBuffer(this.paramsBuffer, 0, buf);
    }

    step(commandEncoder) {
        if (this.numParticles === 0) return;
        this.writeParams();

        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroups[this.currentStep]);
        pass.dispatchWorkgroups(Math.ceil(this.numParticles / CONFIG.WORKGROUP_SIZE));
        pass.end();

        this.currentStep = 1 - this.currentStep;
    }

    getCurrentBuffer() {
        // After step(), currentStep was flipped. The compute wrote to
        // particleBuffers[1 - oldStep] = particleBuffers[newStep].
        return this.particleBuffers[this.currentStep];
    }

    spawnParticles(newParticles) {
        const maxNew = CONFIG.MAX_PARTICLES - this.numParticles;
        if (maxNew <= 0) return;
        const count = Math.min(newParticles.length / CONFIG.PARTICLE_STRIDE, maxNew);
        if (count <= 0) return;

        const data = newParticles.slice(0, count * CONFIG.PARTICLE_STRIDE);
        const offset = this.numParticles * CONFIG.PARTICLE_STRIDE * 4;

        // Write to both buffers so neither is stale
        this.device.queue.writeBuffer(this.particleBuffers[0], offset, data);
        this.device.queue.writeBuffer(this.particleBuffers[1], offset, data);
        this.numParticles += count;
        this.paramsDirty = true;
    }
}
