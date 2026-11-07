"use client";

import { useEffect, useRef } from "react";
import type * as ThreeTypes from "three";
import { gsap } from "gsap";

type ThreeModule = typeof import("three");

interface AioProgressSceneProps {
  phase: number; // 0: fan-out, 1: pages, 2: score, 3: done
  busy: boolean;
}

export default function AioProgressScene({ phase, busy }: AioProgressSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let disposed = false;
    let animId: number | null = null;
    let renderer: ThreeTypes.WebGLRenderer | null = null;
    let scene: ThreeTypes.Scene | null = null;
    let camera: ThreeTypes.PerspectiveCamera | null = null;

    const geometries = new Set<ThreeTypes.BufferGeometry>();
    const materials = new Set<ThreeTypes.Material>();

    void import("three").then((THREE: ThreeModule) => {
      if (disposed || !host) return;

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      if (!context) return;

      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 1000);
      camera.position.set(0, 0, 85);

      // Lights (Cohere palette)
      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0x1863dc, 2.0); // Action Blue
      dirLight.position.set(50, 60, 50);
      scene.add(dirLight);

      const secondaryLight = new THREE.DirectionalLight(0xff7759, 1.6); // Coral
      secondaryLight.position.set(-50, -40, 40);
      scene.add(secondaryLight);

      // Core System Group
      const coreGroup = new THREE.Group();
      scene.add(coreGroup);

      // 1. Central Icosahedron Nucleus (Semantic Anchor)
      const nucleusGeo = new THREE.IcosahedronGeometry(12, 1);
      geometries.add(nucleusGeo);
      const nucleusMat = new THREE.MeshStandardMaterial({
        color: 0x1863dc,
        roughness: 0.2,
        metalness: 0.5,
        wireframe: true,
      });
      materials.add(nucleusMat);
      const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
      coreGroup.add(nucleus);

      // Inner glowing core
      const innerGeo = new THREE.SphereGeometry(7, 16, 16);
      geometries.add(innerGeo);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
      });
      materials.add(innerMat);
      const innerGlow = new THREE.Mesh(innerGeo, innerMat);
      coreGroup.add(innerGlow);

      // 2. Orbital Rings in Cohere Colors (Stage 1: Blue, Stage 2: Coral, Stage 3: Deep Green)
      const ringGeos = [
        new THREE.TorusGeometry(22, 0.55, 12, 64),
        new THREE.TorusGeometry(32, 0.55, 12, 64),
        new THREE.TorusGeometry(40, 0.55, 12, 64),
      ];
      const ringColors = [0x1863dc, 0xff7759, 0x00a884];
      const rings: ThreeTypes.Mesh[] = [];

      ringGeos.forEach((geo, i) => {
        geometries.add(geo);
        const mat = new THREE.MeshStandardMaterial({
          color: ringColors[i],
          emissive: ringColors[i],
          emissiveIntensity: 0.45,
          roughness: 0.25,
          transparent: true,
          opacity: 0.8,
        });
        materials.add(mat);
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = (Math.PI / 3) * (i + 1);
        ring.rotation.y = (Math.PI / 5) * i;
        coreGroup.add(ring);
        rings.push(ring);
      });

      // 3. Floating Node Satellites in Cohere Palette
      const nodeGeo = new THREE.SphereGeometry(2.3, 12, 12);
      geometries.add(nodeGeo);
      const nodeColors = [
        0x1863dc, // Action Blue
        0xff7759, // Coral
        0x003c33, // Deep Green
        0xffad9b, // Soft Coral
        0x4c6ee6, // Focus Blue
        0x9b60aa, // Focus Violet
        0xeeece7, // Soft Stone
        0x071829, // Dark Navy
      ];
      const nodes: { mesh: ThreeTypes.Mesh; radius: number; speed: number; angle: number; yOffset: number }[] = [];

      for (let i = 0; i < 14; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: nodeColors[i % nodeColors.length],
          emissive: nodeColors[i % nodeColors.length],
          emissiveIntensity: 0.5,
          roughness: 0.2,
        });
        materials.add(mat);
        const mesh = new THREE.Mesh(nodeGeo, mat);
        const radius = 18 + (i % 3) * 11;
        const speed = (0.42 + (i % 4) * 0.16) * (i % 2 === 0 ? 1 : -1);
        const angle = (i * Math.PI * 2) / 14;
        const yOffset = (i % 5 - 2) * 4;
        coreGroup.add(mesh);
        nodes.push({ mesh, radius, speed, angle, yOffset });
      }

      // 4. Connecting Vector Lines (Dynamic Laser Lattice)
      const linePositions = new Float32Array(nodes.length * 2 * 3);
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      geometries.add(lineGeo);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.38,
      });
      materials.add(lineMat);
      const latticeLines = new THREE.LineSegments(lineGeo, lineMat);
      coreGroup.add(latticeLines);

      // 5. Ambient Starfield / Dust Particles
      const starCount = 60;
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPos[i] = (Math.random() - 0.5) * 160;
        starPos[i + 1] = (Math.random() - 0.5) * 120;
        starPos[i + 2] = (Math.random() - 0.5) * 80;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      geometries.add(starGeo);
      const starMat = new THREE.PointsMaterial({
        color: 0xffad9b,
        size: 2.2,
        transparent: true,
        opacity: 0.6,
      });
      materials.add(starMat);
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      host.appendChild(canvas);

      const resize = () => {
        if (!host || !renderer || !camera) return;
        const width = host.clientWidth || 300;
        const height = host.clientHeight || 220;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize();

      const observer = new ResizeObserver(resize);
      observer.observe(host);

      // Pointer Parallax
      const motion = { x: 0, y: 0 };
      const toX = gsap.quickTo(motion, "x", { duration: 0.6, ease: "power2.out" });
      const toY = gsap.quickTo(motion, "y", { duration: 0.6, ease: "power2.out" });

      const onPointerMove = (e: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        const nx = (e.clientX - bounds.left) / bounds.width - 0.5;
        const ny = (e.clientY - bounds.top) / bounds.height - 0.5;
        toX(nx * 0.45);
        toY(ny * -0.35);
      };

      const onPointerLeave = () => {
        toX(0);
        toY(0);
      };

      host.addEventListener("pointermove", onPointerMove, { passive: true });
      host.addEventListener("pointerleave", onPointerLeave);

      // Render Loop
      let lastTime = 0;
      const animate = (time: number) => {
        if (disposed) return;
        const sec = time * 0.001;
        const dt = sec - lastTime;
        lastTime = sec;

        if (coreGroup && renderer && scene && camera) {
          const currentP = phaseRef.current;
          const speedMultiplier = busy ? 1.8 : 0.8;

          nucleus.rotation.x += dt * 0.45 * speedMultiplier;
          nucleus.rotation.y += dt * 0.65 * speedMultiplier;

          // Pulse inner glow
          innerGlow.scale.setScalar(1 + Math.sin(sec * 3.5) * 0.14);

          // Rotate rings
          rings.forEach((r, idx) => {
            r.rotation.z += dt * (0.35 + idx * 0.16) * speedMultiplier * (idx % 2 === 0 ? 1 : -1);
          });

          // Orbit nodes and update lattice lines
          const posAttr = lineGeo.getAttribute("position") as ThreeTypes.BufferAttribute;
          const posArray = posAttr.array as Float32Array;

          nodes.forEach((n, idx) => {
            const curAngle = n.angle + sec * n.speed * speedMultiplier;
            const x = Math.cos(curAngle) * n.radius;
            const z = Math.sin(curAngle) * n.radius;
            const y = n.yOffset + Math.sin(sec * 2 + idx) * 3;
            n.mesh.position.set(x, y, z);

            const pIdx = idx * 6;
            posArray[pIdx] = 0;
            posArray[pIdx + 1] = 0;
            posArray[pIdx + 2] = 0;
            posArray[pIdx + 3] = x;
            posArray[pIdx + 4] = y;
            posArray[pIdx + 5] = z;
          });
          posAttr.needsUpdate = true;

          // Stage color shifts in Cohere palette
          if (currentP === 0) {
            dirLight.color.setHex(0x1863dc); // Action Blue
            secondaryLight.color.setHex(0xff7759); // Coral
            nucleusMat.color.setHex(0x1863dc);
          } else if (currentP === 1) {
            dirLight.color.setHex(0xff7759); // Coral
            secondaryLight.color.setHex(0xffad9b); // Soft Coral
            nucleusMat.color.setHex(0xff7759);
          } else if (currentP === 2) {
            dirLight.color.setHex(0x00a884); // Enterprise Green
            secondaryLight.color.setHex(0x1863dc); // Action Blue
            nucleusMat.color.setHex(0x003c33);
          } else {
            dirLight.color.setHex(0x1863dc); // Action Blue
            secondaryLight.color.setHex(0x00a884); // Green
            nucleusMat.color.setHex(0x071829); // Dark Navy
          }

          // Pointer parallax
          coreGroup.rotation.y = motion.x;
          coreGroup.rotation.x = motion.y;

          renderer.render(scene, camera);
        }

        animId = requestAnimationFrame(animate);
      };

      animId = requestAnimationFrame(animate);

      // Cleanup
      const disposeAll = () => {
        if (disposed) return;
        disposed = true;
        if (animId !== null) cancelAnimationFrame(animId);
        observer.disconnect();
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        renderer?.dispose();
        renderer?.forceContextLoss();
        canvas.remove();
      };

      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        disposeAll();
      });

      return disposeAll;
    });

    return () => {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer?.dispose();
    };
  }, [busy]);

  return (
    <div
      ref={containerRef}
      className="aio-progress-scene"
      aria-hidden="true"
    />
  );
}
