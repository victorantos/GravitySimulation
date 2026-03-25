export async function initGPU(canvas) {
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported. Use Chrome 113+ or Edge 113+.');
    }

    const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
    });
    if (!adapter) {
        throw new Error('No WebGPU adapter found. Your GPU may not be supported.');
    }

    const device = await adapter.requestDevice();

    device.lost.then((info) => {
        console.error('WebGPU device lost:', info.message);
        if (info.reason !== 'destroyed') {
            document.getElementById('error-overlay').textContent =
                'GPU device lost. Please reload the page.';
            document.getElementById('error-overlay').style.display = 'flex';
        }
    });

    const format = navigator.gpu.getPreferredCanvasFormat();
    const context = canvas.getContext('webgpu');
    context.configure({
        device,
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
        alphaMode: 'premultiplied',
    });

    return { device, context, format, canvas };
}
