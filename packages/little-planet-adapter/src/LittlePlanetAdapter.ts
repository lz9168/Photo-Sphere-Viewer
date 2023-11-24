import type { EquirectangularAdapterConfig, Position, Size, TextureData, Viewer } from '@photo-sphere-viewer/core';
import { EquirectangularAdapter, events } from '@photo-sphere-viewer/core';
import { BufferGeometry, Euler, Material, MathUtils, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Texture } from 'three';
import littlePlanetFragment from './shaders/littlePlanet.fragment.glsl';
import littlePlanetVertex from './shaders/littlePlanet.vertex.glsl';

type EquirectangularMesh = Mesh<BufferGeometry, Material>;
type EquirectangularTexture = TextureData<Texture, string>;

type ShaderUniforms = {
    panorama: { value: Texture },
    resolution: { value: number },
    transform: { value: Matrix4 },
    zoom: { value: number },
    opacity: { value: number },
};

const euler = new Euler();

/**
 * Adapter for equirectangular panoramas displayed with little planet effect
 */
export class LittlePlanetAdapter extends EquirectangularAdapter {
    static override readonly id = 'little-planet';
    static override readonly VERSION = PKG_VERSION;
    static override readonly supportsDownload = true;

    private uniforms: ShaderUniforms;

    constructor(viewer: Viewer, config?: EquirectangularAdapterConfig) {
        super(viewer, config);

        this.viewer.state.littlePlanet = true;
    }

    override init() {
        super.init();

        this.viewer.addEventListener(events.SizeUpdatedEvent.type, this);
        this.viewer.addEventListener(events.ZoomUpdatedEvent.type, this);
        this.viewer.addEventListener(events.PositionUpdatedEvent.type, this);
    }

    override destroy(): void {
        this.viewer.removeEventListener(events.SizeUpdatedEvent.type, this);
        this.viewer.removeEventListener(events.ZoomUpdatedEvent.type, this);
        this.viewer.removeEventListener(events.PositionUpdatedEvent.type, this);

        super.destroy();
    }

    override supportsTransition() {
        return false;
    }

    override supportsPreload() {
        return true;
    }

    /**
     * @internal
     */
    handleEvent(e: Event) {
        if (e instanceof events.SizeUpdatedEvent) {
            this.__setResolution(e.size);
        } else if (e instanceof events.ZoomUpdatedEvent) {
            this.__setZoom();
        } else if (e instanceof events.PositionUpdatedEvent) {
            this.__setPosition(e.position);
        }
    }

    override createMesh(): EquirectangularMesh {
        const geometry = new PlaneGeometry(20, 10).translate(0, 0, -1) as PlaneGeometry;

        const material = new ShaderMaterial({
            uniforms: {
                panorama: { value: new Texture() },
                resolution: { value: 2.0 },
                transform: { value: new Matrix4() },
                zoom: { value: 10.0 },
                opacity: { value: 1.0 },
            } as ShaderUniforms,
            vertexShader: littlePlanetVertex,
            fragmentShader: littlePlanetFragment,
        });

        this.uniforms = material.uniforms as ShaderUniforms;

        return new Mesh(geometry, material);
    }

    override setTexture(mesh: EquirectangularMesh, textureData: EquirectangularTexture) {
        const material = mesh.material as ShaderMaterial;
        material.uniforms.panorama.value.dispose();
        material.uniforms.panorama.value = textureData.texture;
    }

    private __setResolution(size: Size) {
        this.uniforms.resolution.value = size.width / size.height;
    }

    private __setZoom() {
        // mapping values are empirical
        this.uniforms.zoom.value = Math.max(0.1, MathUtils.mapLinear(this.viewer.state.vFov, 90, 30, 50, 2));
    }

    private __setPosition(position: Position) {
        euler.set(Math.PI / 2 + position.pitch, 0, -Math.PI / 2 - position.yaw, 'ZYX');

        this.uniforms.transform.value.makeRotationFromEuler(euler);
    }
}
