"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import "./aio-hero-scene.css";

type ThreeModule = typeof import("three");
type GsapModule = typeof import("gsap");

type Sticker = {
  group: ThreeTypes.Group;
  x: number;
  y: number;
  scale: number;
  tilt: number;
};

/** A decorative scene. It renders only when its pose or size changes. */
function createScene(
  host: HTMLElement,
  hero: HTMLElement,
  THREE: ThreeModule,
  gsap: GsapModule["gsap"],
) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) return () => {};

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-300, 300, 130, -130, 1, 1000);
  camera.position.z = 500;
  const constellation = new THREE.Group();
  scene.add(constellation);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(-120, 200, 300);
  scene.add(light);

  const geometries = new Set<ThreeTypes.BufferGeometry>();
  const materials = new Set<ThreeTypes.Material>();
  const material = (color: number, opacity = 1) => {
    const value = new THREE.MeshLambertMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
    });
    materials.add(value);
    return value;
  };
  const white = material(0xffffff);
  const paper = material(0xf8f7ff);
  const ink = material(0x213183);
  const paleInk = material(0x8f9dd6);
  const sky = material(0x62aef0);
  const purple = material(0xd6b6f6);
  const pink = material(0xff64c8);
  const teal = material(0x2a9d99);
  const green = material(0x1aae39);
  const shadow = material(0x07143a, 0.19);
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffd5ee, side: THREE.DoubleSide });
  materials.add(starMaterial);
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  geometries.add(unitPlane);

  const rounded = (width: number, height: number, radius: number) => {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 2,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 1.4,
      bevelThickness: 1.4,
      curveSegments: 5,
      steps: 1,
    });
    geometries.add(geometry);
    return geometry;
  };
  const addPlane = (
    group: ThreeTypes.Group,
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    width: number,
    height: number,
    z = 6,
  ) => {
    const mesh = new THREE.Mesh(unitPlane, fill);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, 1);
    group.add(mesh);
  };
  const addBacking = (
    group: ThreeTypes.Group,
    width: number,
    height: number,
    fill: ThreeTypes.Material,
    radius = 16,
  ) => {
    const geometry = rounded(width, height, radius);
    const softShadow = new THREE.Mesh(geometry, shadow);
    softShadow.position.set(7, -8, -5);
    group.add(softShadow);
    group.add(new THREE.Mesh(geometry, fill));
  };
  const stickers: Sticker[] = [];
  const addDocument = (
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    scale: number,
    tilt: number,
    style: "answer" | "source",
  ) => {
    const group = new THREE.Group();
    addBacking(group, 156, 114, fill);
    addPlane(group, style === "answer" ? ink : white, -41, 30, 52, 7);
    addPlane(group, style === "answer" ? paper : white, -2, 10, 130, 5);
    addPlane(group, style === "answer" ? paper : white, -16, -4, 102, 5);
    addPlane(group, style === "answer" ? paper : white, -27, -18, 80, 5);
    if (style === "source") {
      addPlane(group, paleInk, -44, -37, 46, 5);
    } else {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(10, 20), green);
      geometries.add(dot.geometry);
      dot.position.set(52, -34, 7);
      group.add(dot);
    }
    constellation.add(group);
    stickers.push({ group, x, y, scale, tilt });
  };
  const addQuery = (
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    scale: number,
    tilt: number,
  ) => {
    const group = new THREE.Group();
    addBacking(group, 164, 48, fill, 22);
    const search = new THREE.Mesh(new THREE.RingGeometry(8, 10, 24), white);
    geometries.add(search.geometry);
    search.position.set(-57, 0, 7);
    group.add(search);
    addPlane(group, white, -45, -10, 15, 4, 7);
    addPlane(group, white, 8, 5, 93, 5);
    addPlane(group, white, -7, -7, 63, 4);
    constellation.add(group);
    stickers.push({ group, x, y, scale, tilt });
  };

  addDocument(purple, -0.28, 0.20, 0.88, -0.13, "source");
  addDocument(sky, 0.24, 0.02, 1, 0.11, "answer");
  addQuery(pink, -0.20, -0.27, 0.94, 0.08);
  addQuery(teal, 0.30, 0.30, 0.70, -0.09);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * i) / 4;
    const radius = i % 2 === 0 ? 14 : 5;
    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ShapeGeometry(starShape);
  geometries.add(starGeometry);
  const stars = [
    { x: -0.38, y: 0.39, scale: 0.65 },
    { x: 0.39, y: -0.30, scale: 1 },
    { x: 0.05, y: 0.41, scale: 0.5 },
  ].map((point) => {
    const mesh = new THREE.Mesh(starGeometry, starMaterial);
    constellation.add(mesh);
    return { mesh, ...point };
  });

  let disposed = false;
  const render = () => {
    if (!disposed && !document.hidden) renderer.render(scene, camera);
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const scale = Math.min(1.04, Math.max(0.58, width / 580, height / 275));
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    stickers.forEach(({ group, x, y, scale: stickerScale, tilt }) => {
      group.position.set(x * width, y * height, 0);
      group.scale.setScalar(scale * stickerScale);
      group.rotation.z = tilt;
    });
    stars.forEach(({ mesh, x, y, scale: starScale }) => {
      mesh.position.set(x * width, y * height, 3);
      mesh.scale.setScalar(scale * starScale);
    });
    renderer.setSize(width, height, false);
    render();
  };

  const motion = { x: 0, y: 0 };
  const toX = gsap.quickTo(motion, "x", {
    duration: 0.65,
    ease: "power2.out",
    onUpdate: () => {
      constellation.rotation.y = motion.x;
      render();
    },
  });
  const toY = gsap.quickTo(motion, "y", {
    duration: 0.65,
    ease: "power2.out",
    onUpdate: () => {
      constellation.rotation.x = motion.y;
      render();
    },
  });
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const bounds = hero.getBoundingClientRect();
    toX(((event.clientX - bounds.left) / bounds.width - 0.5) * 0.12);
    toY(((event.clientY - bounds.top) / bounds.height - 0.5) * -0.08);
  };
  const onPointerLeave = () => {
    toX(0);
    toY(0);
  };
  const intro = gsap.fromTo(
    constellation.position,
    { y: -12 },
    { y: 0, duration: 0.72, ease: "power3.out", onUpdate: render },
  );

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  hero.addEventListener("pointermove", onPointerMove, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave);
  let contextLost = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    intro.kill();
    toX.tween.kill();
    toY.tween.kill();
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((item) => item.dispose());
    renderer.dispose();
    if (!contextLost) renderer.forceContextLoss();
    canvas.remove();
    host.removeAttribute("data-webgl");
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    dispose();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  try {
    host.append(canvas);
    resize();
    host.dataset.webgl = "true";
  } catch {
    dispose();
  }
  return dispose;
}

export default function AioHeroScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const hero = host?.closest<HTMLElement>(".aio-page-head");
    if (!host || !hero) return;

    const desktop = matchMedia("(min-width: 1024px)");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    let visible = typeof IntersectionObserver === "undefined";
    let generation = 0;
    let loading = false;
    let disposeScene: (() => void) | undefined;
    const reconcile = () => {
      const allowed = active && desktop.matches && !reducedMotion.matches && visible && !document.hidden;
      if (!allowed) {
        generation += 1;
        loading = false;
        disposeScene?.();
        disposeScene = undefined;
        return;
      }
      if (loading || disposeScene) return;
      loading = true;
      const version = ++generation;
      void Promise.all([import("three"), import("gsap")])
        .then(([THREE, { gsap }]) => {
          if (!active || version !== generation) return;
          disposeScene = createScene(host, hero, THREE, gsap);
          loading = false;
        })
        .catch(() => {
          // The static stickers remain visible when WebGL cannot start.
          loading = false;
        });
    };
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          const next = entry?.isIntersecting ?? false;
          if (visible === next) return;
          visible = next;
          reconcile();
        });
    observer?.observe(hero);
    desktop.addEventListener("change", reconcile);
    reducedMotion.addEventListener("change", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    reconcile();
    return () => {
      active = false;
      generation += 1;
      observer?.disconnect();
      desktop.removeEventListener("change", reconcile);
      reducedMotion.removeEventListener("change", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
      disposeScene?.();
    };
  }, []);

  return (
    <div ref={hostRef} className="aio-hero-scene" aria-hidden="true">
      <div className="aio-hero-static">
        <span className="aio-scene-sticker aio-scene-document aio-scene-document-purple"><i /><i /><i /></span>
        <span className="aio-scene-sticker aio-scene-document aio-scene-document-sky"><i /><i /><i /></span>
        <span className="aio-scene-sticker aio-scene-query aio-scene-query-pink"><i /><i /></span>
        <span className="aio-scene-sticker aio-scene-query aio-scene-query-teal"><i /><i /></span>
        <span className="aio-scene-star aio-scene-star-one">✦</span>
        <span className="aio-scene-star aio-scene-star-two">✦</span>
      </div>
    </div>
  );
}
