import { AbstractComponent, events, Position, utils, type Viewer } from '@photo-sphere-viewer/core';
import { MathUtils, PerspectiveCamera, Scene } from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { type VirtualTourPlugin } from './VirtualTourPlugin';
import { DEFAULT_ARROW } from './constants';
import { VirtualTourArrowStyle, VirtualTourLink, VirtualTourPluginConfig } from './model';

export class ArrowsRenderer extends AbstractComponent {

    renderer: CSS3DRenderer;
    scene: Scene;
    camera: PerspectiveCamera;

    get config(): VirtualTourPluginConfig {
        return this.plugin.config;
    }

    constructor(parent: Viewer, private plugin: VirtualTourPlugin) {
        super(parent, {
            className: 'psv-virtual-tour-arrows',
        });

        this.renderer = new CSS3DRenderer({
            element: this.container,
        });
        this.renderer.setSize(600, 400);

        this.camera = new PerspectiveCamera(40, 1);
        this.scene = new Scene();

        this.viewer.addEventListener(events.PositionUpdatedEvent.type, this);
        this.viewer.addEventListener(events.SizeUpdatedEvent.type, this);
        this.viewer.addEventListener(events.ReadyEvent.type, this, { once: true });
        this.viewer.addEventListener(events.RenderEvent.type, this);
    }

    override destroy(): void {

        this.viewer.removeEventListener(events.PositionUpdatedEvent.type, this);
        this.viewer.removeEventListener(events.SizeUpdatedEvent.type, this);
        this.viewer.removeEventListener(events.ReadyEvent.type, this);
        this.viewer.removeEventListener(events.RenderEvent.type, this);

        super.destroy();
    }

    handleEvent(e: Event) {
        switch(e.type) {
            case events.ReadyEvent.type:
            case events.SizeUpdatedEvent.type:
            case events.PositionUpdatedEvent.type:
                this.__updateCamera();
                break;
            case events.RenderEvent.type:
                this.render()
                break;
        }
    }

    private __updateCamera() {
        const size = this.viewer.getSize();
        const width = this.renderer.getSize().width;
        this.renderer.domElement.style.transform = `translate(${(size.width - width) / 2}px, 0px)`;

        const position = this.viewer.getPosition();
        position.pitch = MathUtils.clamp(position.pitch, - this.config.arrowsPosition.maxAngle, -this.config.arrowsPosition.minAngle);

        this.viewer.dataHelper.sphericalCoordsToVector3(
            position,
            this.camera.position,
            500
        ).negate();

        this.camera.lookAt(0, 0, 0);

        this.camera.updateProjectionMatrix();

        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    private __buildArrowElement(link: VirtualTourLink, style?: VirtualTourArrowStyle): HTMLElement {
        if (style?.image) {
            const image = document.createElement('img');
            image.src = style.image;
            return image;
        } else if (style?.element) {
            if (typeof style.element === 'function') {
                return style.element(link);
            } else {
                return style.element;
            }
        }
    }

    addArrow(link: VirtualTourLink, position: Position, depth: number) {
        let element = this.__buildArrowElement(link, link.arrowStyle);
        if (!element) {
            element = this.__buildArrowElement(link, this.config.arrowStyle);
        }
        if (!element) {
            element = (DEFAULT_ARROW.element as any)(link);
        }

        const conf = {
            ...this.config.arrowStyle,
            ...link.arrowStyle,
        };

        element.style.width = conf.size.width + 'px';
        element.style.height = conf.size.height + 'px';
        if (conf.className) {
            utils.addClasses(element, conf.className);
        }

        const object = new CSS3DObject(element);

        object.rotation.set(-Math.PI / 2, 0, Math.PI - position.yaw);

        this.viewer.dataHelper.sphericalCoordsToVector3(
            { yaw: position.yaw, pitch: 0 },
            object.position,
            depth * 100
        );

        this.scene.add(object);

        element.addEventListener('click', () => this.plugin.setCurrentNode(link.nodeId, null, link));
        element.addEventListener('mouseenter', (e) => this.plugin.__onEnterObject(link, e));
        element.addEventListener('mousemove', (e) => this.plugin.__onHoverObject(e));
        element.addEventListener('mouseleave', () => this.plugin.__onLeaveObject(link));
    }

    clearArrows() {
        this.scene.clear();
    }

}
