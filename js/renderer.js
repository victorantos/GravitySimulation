import { CONFIG } from './constants.js';

export class Renderer {
    constructor() {
        this.device = null;
        this.format = null;
        this.particlePipeline = null;
        this.trailPipeline = null;
        this.renderParamsBuffer = null;
        this.bindGroupLayout = null;
        this.accumTexture = null;
        this.accumWidth = 0;
        this.accumHeight = 0;
        this.accumNeedsClear = true;
        this.renderParams = {
            canvasWidth: 0,
            canvasHeight: 0,
            particleScale: CONFIG.PARTICLE_SCALE,
            maxSpeed: CONFIG.MAX_SPEED,
            trailAlpha: 0.05,
        };
        this.renderParamsDirty = true;
    }

    async init(device, format) {
        this.device = device;
        this.format = format;

        const shaderCode = await fetch('shaders/particle.wgsl').then(r => r.text());
        const shaderModule = device.createShaderModule({ code: shaderCode });

        // Check for compile errors
        const info = await shaderModule.getCompilationInfo();
        for (const msg of info.messages) {
            if (msg.type === 'error') {
                console.error(`Shader error: ${msg.message} (line ${msg.lineNum})`);
            }
        }

        this.renderParamsBuffer = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });

        // Particle pipeline: additive blending for glow
        this.particlePipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: 'vs_main' },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                    },
                }],
            },
            primitive: { topology: 'triangle-list' },
        });

        // Trail pipeline: standard alpha blending to fade previous frame
        this.trailPipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: { module: shaderModule, entryPoint: 'vs_trail' },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_trail',
                targets: [{
                    format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                    },
                }],
            },
            primitive: { topology: 'triangle-list' },
        });
    }

    ensureAccumTexture(width, height) {
        if (this.accumTexture && this.accumWidth === width && this.accumHeight === height) return;
        if (this.accumTexture) this.accumTexture.destroy();
        this.accumTexture = this.device.createTexture({
            size: [width, height],
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        this.accumWidth = width;
        this.accumHeight = height;
        this.accumNeedsClear = true;
    }

    updateSize(width, height) {
        if (this.renderParams.canvasWidth !== width || this.renderParams.canvasHeight !== height) {
            this.renderParams.canvasWidth = width;
            this.renderParams.canvasHeight = height;
            this.renderParamsDirty = true;
        }
    }

    updateRenderParams(newParams) {
        Object.assign(this.renderParams, newParams);
        this.renderParamsDirty = true;
    }

    writeRenderParams() {
        if (!this.renderParamsDirty) return;
        this.renderParamsDirty = false;

        const buf = new Float32Array(8);
        buf[0] = this.renderParams.canvasWidth;
        buf[1] = this.renderParams.canvasHeight;
        buf[2] = this.renderParams.particleScale;
        buf[3] = this.renderParams.maxSpeed;
        buf[4] = this.renderParams.trailAlpha;
        this.device.queue.writeBuffer(this.renderParamsBuffer, 0, buf);
    }

    markClear() {
        this.accumNeedsClear = true;
    }

    render(commandEncoder, swapChainTexture, particleBuffer, numParticles, useTrails) {
        const width = swapChainTexture.width;
        const height = swapChainTexture.height;
        this.ensureAccumTexture(width, height);
        this.writeRenderParams();

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: particleBuffer } },
                { binding: 1, resource: { buffer: this.renderParamsBuffer } },
            ],
        });

        const accumView = this.accumTexture.createView();

        if (!useTrails || this.accumNeedsClear) {
            // Clear the accumulation texture
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: accumView,
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0.01, a: 1 },
                    storeOp: 'store',
                }],
            });
            if (numParticles > 0) {
                pass.setPipeline(this.particlePipeline);
                pass.setBindGroup(0, bindGroup);
                pass.draw(6, numParticles);
            }
            pass.end();
            this.accumNeedsClear = false;
        } else {
            // Trail mode: load previous frame, fade, draw new particles
            const pass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: accumView,
                    loadOp: 'load',
                    storeOp: 'store',
                }],
            });
            // Draw trail fade quad
            pass.setPipeline(this.trailPipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(6);
            // Draw particles
            if (numParticles > 0) {
                pass.setPipeline(this.particlePipeline);
                pass.setBindGroup(0, bindGroup);
                pass.draw(6, numParticles);
            }
            pass.end();
        }

        // Copy accumulation texture to swap chain
        commandEncoder.copyTextureToTexture(
            { texture: this.accumTexture },
            { texture: swapChainTexture },
            [width, height],
        );
    }
}
