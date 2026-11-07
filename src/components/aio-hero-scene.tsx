"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import "./aio-hero-scene.css";

type ThreeModule = typeof import("three");
type GsapModule = typeof import("gsap");

type Sticker = {
  group: ThreeTypes.Group;
  baseX: number;
  baseY: number;
  scale: number;
  tilt: number;
  phase: number;
};

/** Cohere-inspired 3D tactile media constellation scene with physics-based float and parallax. */
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
  const camera = new THREE.OrthographicCamera(-320, 320, 140, -140, 1, 1000);
  camera.position.z = 500;

  const constellation = new THREE.Group();
  scene.add(constellation);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.85);
  mainLight.position.set(-150, 220, 320);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffad9b, 0.45); // Soft coral specular fill
  fillLight.position.set(180, -100, 200);
  scene.add(fillLight);

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

  // Cohere Palette Materials
  const white = material(0xffffff);
  const stone = material(0xeeece7);
  const darkNavy = material(0x071829);
  const deepGreen = material(0x003c33);
  const actionBlue = material(0x1863dc);
  const coral = material(0xff7759);
  const softCoral = material(0xffad9b);
  const paleGreen = material(0xedfce9);
  const paleBlue = material(0xf1f5ff);
  const softShadow = material(0x00121d, 0.22);
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffad9b, side: THREE.DoubleSide });
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
      bevelSize: 1.2,
      bevelThickness: 1.2,
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
    const shadowMesh = new THREE.Mesh(geometry, softShadow);
    shadowMesh.position.set(6, -9, -5);
    group.add(shadowMesh);
    group.add(new THREE.Mesh(geometry, fill));
  };

  const stickers: Sticker[] = [];

  const addDocument = (
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    scale: number,
    tilt: number,
    phase: number,
    style: "answer" | "source",
  ) => {
    const group = new THREE.Group();
    addBacking(group, 156, 114, fill, 15);
    addPlane(group, style === "answer" ? darkNavy : white, -41, 30, 52, 7);
    addPlane(group, style === "answer" ? paleGreen : white, -2, 10, 130, 5);
    addPlane(group, style === "answer" ? paleGreen : white, -16, -4, 102, 5);
    addPlane(group, style === "answer" ? paleGreen : white, -27, -18, 80, 5);
    if (style === "source") {
      addPlane(group, actionBlue, -44, -36, 46, 5);
    } else {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(9, 20), paleGreen);
      geometries.add(dot.geometry);
      dot.position.set(52, -34, 7);
      group.add(dot);
    }
    constellation.add(group);
    stickers.push({ group, baseX: x, baseY: y, scale, tilt, phase });
  };

  const addQuery = (
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    scale: number,
    tilt: number,
    phase: number,
  ) => {
    const group = new THREE.Group();
    addBacking(group, 164, 46, fill, 23);
    const search = new THREE.Mesh(new THREE.RingGeometry(7, 9.5, 24), white);
    geometries.add(search.geometry);
    search.position.set(-57, 0, 7);
    group.add(search);
    addPlane(group, white, -46, -9, 14, 3.5, 7);
    addPlane(group, white, 8, 4, 92, 5);
    addPlane(group, white, -8, -7, 60, 4);
    constellation.add(group);
    stickers.push({ group, baseX: x, baseY: y, scale, tilt, phase });
  };

  const addTag = (
    fill: ThreeTypes.Material,
    x: number,
    y: number,
    scale: number,
    tilt: number,
    phase: number,
  ) => {
    const group = new THREE.Group();
    addBacking(group, 118, 36, fill, 18);
    addPlane(group, white, -24, 0, 14, 4, 7);
    addPlane(group, white, 14, 0, 56, 4.5, 7);
    constellation.add(group);
    stickers.push({ group, baseX: x, baseY: y, scale, tilt, phase });
  };

  // Cohere signature composition: Coral + Blue + Deep Green + Stone
  addDocument(coral, -0.29, 0.21, 0.88, -0.12, 0.2, "source");
  addDocument(actionBlue, 0.24, 0.03, 1, 0.10, 1.8, "answer");
  addQuery(deepGreen, -0.20, -0.27, 0.94, 0.07, 3.1);
  addQuery(darkNavy, 0.31, 0.31, 0.72, -0.08, 4.2);
  addTag(stone, 0.18, -0.32, 0.82, 0.05, 5.0);

  // Star shapes
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * i) / 4;
    const radius = i % 2 === 0 ? 14 : 5.5;
    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ShapeGeometry(starShape);
  geometries.add(starGeometry);

  const stars = [
    { x: -0.38, y: 0.39, scale: 0.65, phase: 0.4 },
    { x: 0.39, y: -0.28, scale: 0.95, phase: 1.7 },
    { x: 0.06, y: 0.42, scale: 0.52, phase: 3.2 },
    { x: -0.08, y: -0.38, scale: 0.45, phase: 4.5 },
  ].map((point) => {
    const mesh = new THREE.Mesh(starGeometry, starMaterial);
    constellation.add(mesh);
    return { mesh, ...point };
  });

  // Constellation connecting lines
  const linePoints = [
    new THREE.Vector3(-140, 60, -2),
    new THREE.Vector3(120, 10, -2),
    new THREE.Vector3(-90, -75, -2),
    new THREE.Vector3(150, 90, -2),
    new THREE.Vector3(90, -90, -2),
  ];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  geometries.add(lineGeometry);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.22,
  });
  materials.add(lineMat);
  const constellationLines = new THREE.Line(lineGeometry, lineMat);
  constellation.add(constellationLines);

  let disposed = false;
  let animId: number | null = null;
  let lastTime = 0;

  const render = () => {
    if (!disposed && !document.hidden) {
      renderer.render(scene, camera);
    }
  };

  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const scale = Math.min(1.05, Math.max(0.58, width / 580, height / 275));
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();

    stickers.forEach((s) => {
      s.group.position.x = s.baseX * width;
      s.group.position.y = s.baseY * height;
      s.group.scale.setScalar(scale * s.scale);
      s.group.rotation.z = s.tilt;
    });

    stars.forEach((st) => {
      st.mesh.position.set(st.x * width, st.y * height, 3);
      st.mesh.scale.setScalar(scale * st.scale);
    });

    renderer.setSize(width, height, false);
    render();
  };

  // Sinusoidal floating animation loop
  const animate = (time: number) => {
    if (disposed) return;
    const sec = time * 0.001;
    if (sec - lastTime > 0.02) {
      lastTime = sec;
      const { height } = host.getBoundingClientRect();
      stickers.forEach((s) => {
        const floatOffset = Math.sin(sec * 1.35 + s.phase) * 6;
        s.group.position.y = s.baseY * height + floatOffset;
        s.group.rotation.z = s.tilt + Math.cos(sec * 1.1 + s.phase) * 0.018;
      });

      stars.forEach((st) => {
        st.mesh.rotation.z = sec * 0.15;
      });

      render();
    }
    animId = requestAnimationFrame(animate);
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
    toX(((event.clientX - bounds.left) / bounds.width - 0.5) * 0.14);
    toY(((event.clientY - bounds.top) / bounds.height - 0.5) * -0.09);
  };

  const onPointerLeave = () => {
    toX(0);
    toY(0);
  };

  const intro = gsap.fromTo(
    constellation.position,
    { y: -16, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.75, ease: "power3.out", onUpdate: render },
  );

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  hero.addEventListener("pointermove", onPointerMove, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave);

  let contextLost = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (animId !== null) cancelAnimationFrame(animId);
    observer.disconnect();
    intro.kill();
    toX.tween.kill();
    toY.tween.kill();
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
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
    animId = requestAnimationFrame(animate);
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
      const allowed =
        active && desktop.matches && !reducedMotion.matches && visible && !document.hidden;
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
          loading = false;
        });
    };

    const observer =
      typeof IntersectionObserver === "undefined"
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
        <span className="aio-scene-sticker aio-scene-document aio-scene-document-coral">
          <div className="sticker-header" />
          <i />
          <i />
          <i />
        </span>
        <span className="aio-scene-sticker aio-scene-document aio-scene-document-blue">
          <div className="sticker-header" />
          <i />
          <i />
          <i />
        </span>
        <span className="aio-scene-sticker aio-scene-query aio-scene-query-green">
          <i />
          <i />
        </span>
        <span className="aio-scene-sticker aio-scene-query aio-scene-query-navy">
          <i />
          <i />
        </span>
        <span className="aio-scene-badge-stone">COHERE AIO</span>
        <span className="aio-scene-star aio-scene-star-one">✦</span>
        <span className="aio-scene-star aio-scene-star-two">✦</span>
        <span className="aio-scene-star aio-scene-star-three">✦</span>
      </div>
    </div>
  );
}
