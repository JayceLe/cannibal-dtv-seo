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
    const textures = new Set<ThreeTypes.Texture>();

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 1000);
      camera.position.set(0, 0, 52); // Close cinematic camera view

      // Ambient & Directional Lights
      const ambient = new THREE.AmbientLight(0xffffff, 1.4);
      scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0x60a5fa, 2.4);
      dirLight.position.set(35, 45, 50);
      scene.add(dirLight);

      const secondaryLight = new THREE.DirectionalLight(0xff7759, 1.8);
      secondaryLight.position.set(-45, -25, 35);
      scene.add(secondaryLight);

      // Root Group for 3D Citations Network
      const rootGroup = new THREE.Group();
      scene.add(rootGroup);

      // Helper: Draw Rounded Rectangle on Canvas 2D
      const drawRoundRect = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      // -----------------------------------------------------------------------
      // Texture 1: Central Google AI Overview Synthesis Card (1024x560 Retina)
      // -----------------------------------------------------------------------
      const createAioSummaryTexture = (curPhase: number): ThreeTypes.CanvasTexture => {
        const cv = document.createElement("canvas");
        cv.width = 1024;
        cv.height = 560;
        const ctx = cv.getContext("2d")!;

        // Background Glass/Card
        const bgGrad = ctx.createLinearGradient(0, 0, 1024, 560);
        bgGrad.addColorStop(0, "#08162b");
        bgGrad.addColorStop(0.5, "#0b2545");
        bgGrad.addColorStop(1, "#07172c");

        drawRoundRect(ctx, 8, 8, 1008, 544, 32);
        ctx.fillStyle = bgGrad;
        ctx.fill();

        // Multi-color Google Spark Accent Border
        const borderGrad = ctx.createLinearGradient(0, 0, 1024, 560);
        borderGrad.addColorStop(0, "#4285f4");
        borderGrad.addColorStop(0.33, "#ea4335");
        borderGrad.addColorStop(0.66, "#fbbc05");
        borderGrad.addColorStop(1, "#34a853");
        ctx.lineWidth = 4;
        ctx.strokeStyle = borderGrad;
        ctx.stroke();

        // Top Header: Sparkle + Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
        ctx.fillText("✦ Google AI Overview · Trích dẫn đối chiếu", 44, 68);

        // Status pill
        drawRoundRect(ctx, 760, 36, 216, 46, 23);
        ctx.fillStyle = curPhase === 3 ? "rgba(16, 185, 129, 0.28)" : "rgba(37, 99, 235, 0.4)";
        ctx.fill();
        ctx.strokeStyle = curPhase === 3 ? "#10b981" : "#60a5fa";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = curPhase === 3 ? "#34d399" : "#93c5fd";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(curPhase === 3 ? "✔ HOÀN TẤT" : "● ĐANG XỬ LÝ", 800, 66);

        // Subtitle line
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillText("Tổng hợp câu trả lời theo ngữ nghĩa và đối chiếu bằng chứng", 44, 116);

        // Divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(44, 140);
        ctx.lineTo(980, 140);
        ctx.stroke();

        // Passage Snippets with Inline Citation Chips [1], [2], [3]
        // Line 1 + [1]
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 23px system-ui, sans-serif";
        ctx.fillText("Mở rộng truy vấn và phân tích đối chiếu bằng chứng", 44, 195);
        drawRoundRect(ctx, 620, 168, 54, 34, 10);
        ctx.fillStyle = "#1863dc";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px system-ui, sans-serif";
        ctx.fillText("[1]", 633, 193);

        // Line 2 + [2]
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 23px system-ui, sans-serif";
        ctx.fillText("Trích xuất đoạn văn bản trả lời đúng ý định tìm kiếm", 44, 255);
        drawRoundRect(ctx, 615, 228, 54, 34, 10);
        ctx.fillStyle = "#ff7759";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px system-ui, sans-serif";
        ctx.fillText("[2]", 628, 253);

        // Line 3 + [3]
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 23px system-ui, sans-serif";
        ctx.fillText("Đo lường khoảng trống ngữ nghĩa và xác định xếp hạng", 44, 315);
        drawRoundRect(ctx, 630, 288, 54, 34, 10);
        ctx.fillStyle = "#00a884";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px system-ui, sans-serif";
        ctx.fillText("[3]", 643, 313);

        // Bottom Citation Sources Bar
        ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
        drawRoundRect(ctx, 40, 390, 944, 120, 20);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#60a5fa";
        ctx.font = "bold 21px system-ui, sans-serif";
        ctx.fillText("Nguồn trích dẫn SERP & Vector Embedding", 68, 436);

        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "18px system-ui, sans-serif";
        ctx.fillText("Centering vector đối chiếu và trích xuất độ tương đồng cosine đa chiều", 68, 474);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // Texture 2: Citation Source Document Snippet (768x420 Retina)
      // -----------------------------------------------------------------------
      const createCitationSourceTexture = (
        badgeNum: string,
        domain: string,
        badgeLabel: string,
        badgeColor: string,
        lineText: string,
        scoreText: string,
      ): ThreeTypes.CanvasTexture => {
        const cv = document.createElement("canvas");
        cv.width = 768;
        cv.height = 420;
        const ctx = cv.getContext("2d")!;

        // Background
        drawRoundRect(ctx, 8, 8, 752, 404, 26);
        ctx.fillStyle = "#091a32";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = badgeColor;
        ctx.stroke();

        // Top Header Chip [1] / [2] / [3]
        drawRoundRect(ctx, 28, 28, 64, 46, 12);
        ctx.fillStyle = badgeColor;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px system-ui, sans-serif";
        ctx.fillText(badgeNum, 40, 62);

        // Domain Name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.fillText(domain, 110, 62);

        // Badge Pill
        drawRoundRect(ctx, 470, 28, 268, 46, 23);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fill();
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = badgeColor;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(badgeLabel, 492, 58);

        // Divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(28, 98);
        ctx.lineTo(740, 98);
        ctx.stroke();

        // Snippet Passage Text
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "24px system-ui, sans-serif";
        ctx.fillText(lineText, 32, 155);
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "20px system-ui, sans-serif";
        ctx.fillText("Bóc tách đoạn văn bản đối chiếu theo ý định tìm kiếm", 32, 196);

        // Score row
        drawRoundRect(ctx, 28, 250, 712, 130, 18);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText("ĐỘ TƯƠNG ĐỒNG COSINE", 50, 305);

        ctx.fillStyle = badgeColor;
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.fillText(scoreText, 50, 354);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // Texture 3: Search Query Fan-out Tag Pill (512x160 Retina)
      // -----------------------------------------------------------------------
      const createQueryTagTexture = (query: string): ThreeTypes.CanvasTexture => {
        const cv = document.createElement("canvas");
        cv.width = 512;
        cv.height = 160;
        const ctx = cv.getContext("2d")!;

        drawRoundRect(ctx, 8, 8, 496, 144, 72);
        ctx.fillStyle = "#0c2342";
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "#38bdf8";
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 44px system-ui, sans-serif";
        ctx.fillText("⌕", 40, 96);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.fillText(query, 95, 94);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // 1. Central Google AI Overview Synthesis Plane (Prominent & Clear)
      // -----------------------------------------------------------------------
      const summaryGeo = new THREE.PlaneGeometry(42, 23);
      geometries.add(summaryGeo);
      const summaryTex = createAioSummaryTexture(phaseRef.current);
      const summaryMat = new THREE.MeshBasicMaterial({
        map: summaryTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      materials.add(summaryMat);
      const summaryMesh = new THREE.Mesh(summaryGeo, summaryMat);
      summaryMesh.position.set(0, 1.2, 0);
      rootGroup.add(summaryMesh);

      // Glowing Halo around Summary Card
      const haloGeo = new THREE.PlaneGeometry(44.5, 25.5);
      geometries.add(haloGeo);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x1863dc,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
      });
      materials.add(haloMat);
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(0, 1.2, -0.6);
      rootGroup.add(haloMesh);

      // -----------------------------------------------------------------------
      // 2. Three Citation Source Cards (Trích dẫn [1], [2], [3])
      // -----------------------------------------------------------------------
      const citationCards: {
        mesh: ThreeTypes.Mesh;
        targetPos: ThreeTypes.Vector3;
        floatSpeed: number;
        floatOffset: number;
        baseRot: { x: number; y: number; z: number };
        anchorCentralOffset: ThreeTypes.Vector3;
      }[] = [];

      const cardGeo = new THREE.PlaneGeometry(28, 15.3);
      geometries.add(cardGeo);

      // Citation Card [1]: Trang của bạn (Action Blue #1863dc)
      const c1Tex = createCitationSourceTexture(
        "[1]",
        "Trang mục tiêu",
        "TRANG BẠN · TOP 1",
        "#1863dc",
        "Đoạn nội dung tối ưu trả lời đúng ý định",
        "0,88 · DẪN ĐẦU",
      );
      const c1Mat = new THREE.MeshBasicMaterial({ map: c1Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c1Mat);
      const c1Mesh = new THREE.Mesh(cardGeo, c1Mat);
      c1Mesh.position.set(-36, 5, 4);
      rootGroup.add(c1Mesh);
      citationCards.push({
        mesh: c1Mesh,
        targetPos: new THREE.Vector3(-36, 5, 4),
        floatSpeed: 1.4,
        floatOffset: 0,
        baseRot: { x: 0.06, y: 0.26, z: -0.03 },
        anchorCentralOffset: new THREE.Vector3(-8, 3.8, 0),
      });

      // Citation Card [2]: Đối thủ #1 (Coral #ff7759)
      const c2Tex = createCitationSourceTexture(
        "[2]",
        "Nguồn đối chiếu",
        "ĐỐI THỦ #1",
        "#ff7759",
        "Đoạn văn bản trích xuất từ SERP đối thủ",
        "0,79 · CẠNH TRANH",
      );
      const c2Mat = new THREE.MeshBasicMaterial({ map: c2Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c2Mat);
      const c2Mesh = new THREE.Mesh(cardGeo, c2Mat);
      c2Mesh.position.set(36, 6, 2);
      rootGroup.add(c2Mesh);
      citationCards.push({
        mesh: c2Mesh,
        targetPos: new THREE.Vector3(36, 6, 2),
        floatSpeed: 1.6,
        floatOffset: 1.8,
        baseRot: { x: 0.06, y: -0.26, z: 0.03 },
        anchorCentralOffset: new THREE.Vector3(8, 1.2, 0),
      });

      // Citation Card [3]: Đối thủ #2 / Bằng chứng (Enterprise Teal #00a884)
      const cardGeo3 = new THREE.PlaneGeometry(25, 13.6);
      geometries.add(cardGeo3);
      const c3Tex = createCitationSourceTexture(
        "[3]",
        "Bằng chứng đối chiếu",
        "ĐỐI THỦ #2",
        "#00a884",
        "So sánh độ bao phủ thực thể & ngữ cảnh",
        "0,74 · THAM KHẢO",
      );
      const c3Mat = new THREE.MeshBasicMaterial({ map: c3Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c3Mat);
      const c3Mesh = new THREE.Mesh(cardGeo3, c3Mat);
      c3Mesh.position.set(-24, -13, 6);
      rootGroup.add(c3Mesh);
      citationCards.push({
        mesh: c3Mesh,
        targetPos: new THREE.Vector3(-24, -13, 6),
        floatSpeed: 1.3,
        floatOffset: 3.2,
        baseRot: { x: -0.05, y: 0.22, z: -0.02 },
        anchorCentralOffset: new THREE.Vector3(-6, -1.8, 0),
      });

      // -----------------------------------------------------------------------
      // 3. Search Query Tag Pill Floating in 3D
      // -----------------------------------------------------------------------
      const queryGeo = new THREE.PlaneGeometry(22, 7);
      geometries.add(queryGeo);

      const q1Tex = createQueryTagTexture("Query mục tiêu & fan-out");
      const q1Mat = new THREE.MeshBasicMaterial({ map: q1Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(q1Mat);
      const q1Mesh = new THREE.Mesh(queryGeo, q1Mat);
      q1Mesh.position.set(24, -13, 7);
      q1Mesh.rotation.set(-0.06, -0.22, 0.02);
      rootGroup.add(q1Mesh);

      // -----------------------------------------------------------------------
      // 4. Citation Beams & Dynamic Flowing Pulse Particles
      // -----------------------------------------------------------------------
      const beamMaterials: ThreeTypes.LineBasicMaterial[] = [];
      const beamLines: ThreeTypes.Line[] = [];
      const beamColors = [0x60a5fa, 0xff7759, 0x34d399];

      // Traveling pulse particles along the laser beams
      const pulseGeo = new THREE.SphereGeometry(0.7, 8, 8);
      geometries.add(pulseGeo);

      type BeamPulse = {
        mesh: ThreeTypes.Mesh;
        beamIndex: number;
        progress: number;
        speed: number;
      };
      const pulses: BeamPulse[] = [];

      citationCards.forEach((c, idx) => {
        const lineGeo = new THREE.BufferGeometry();
        const pts = new Float32Array(6);
        lineGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        geometries.add(lineGeo);

        const bMat = new THREE.LineBasicMaterial({
          color: beamColors[idx % beamColors.length],
          transparent: true,
          opacity: 0.6,
        });
        materials.add(bMat);
        beamMaterials.push(bMat);

        const line = new THREE.Line(lineGeo, bMat);
        rootGroup.add(line);
        beamLines.push(line);

        // Create 2 traveling pulse particles per beam
        for (let p = 0; p < 2; p++) {
          const pMat = new THREE.MeshBasicMaterial({
            color: beamColors[idx % beamColors.length],
            transparent: true,
            opacity: 0.9,
          });
          materials.add(pMat);
          const pMesh = new THREE.Mesh(pulseGeo, pMat);
          rootGroup.add(pMesh);
          pulses.push({
            mesh: pMesh,
            beamIndex: idx,
            progress: (p * 0.5 + idx * 0.25) % 1.0,
            speed: 0.35 + idx * 0.05,
          });
        }
      });

      // -----------------------------------------------------------------------
      // 5. Starfield / SEO Vector Embedding Dust Particles
      // -----------------------------------------------------------------------
      const starCount = 55;
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPos[i] = (Math.random() - 0.5) * 160;
        starPos[i + 1] = (Math.random() - 0.5) * 110;
        starPos[i + 2] = (Math.random() - 0.5) * 50;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      geometries.add(starGeo);
      const starMat = new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: 2,
        transparent: true,
        opacity: 0.65,
      });
      materials.add(starMat);
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      host.appendChild(canvas);

      const resize = () => {
        if (!host || !renderer || !camera) return;
        const width = host.clientWidth || 300;
        const height = host.clientHeight || 250;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize();

      const observer = new ResizeObserver(resize);
      observer.observe(host);

      // Pointer Parallax with GSAP quickTo
      const motion = { x: 0, y: 0 };
      const toX = gsap.quickTo(motion, "x", { duration: 0.6, ease: "power2.out" });
      const toY = gsap.quickTo(motion, "y", { duration: 0.6, ease: "power2.out" });

      const onPointerMove = (e: PointerEvent) => {
        const bounds = host.getBoundingClientRect();
        const nx = (e.clientX - bounds.left) / bounds.width - 0.5;
        const ny = (e.clientY - bounds.top) / bounds.height - 0.5;
        toX(nx * 0.35);
        toY(ny * -0.25);
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
        const dt = Math.min(sec - lastTime, 0.1);
        lastTime = sec;

        if (rootGroup && renderer && scene && camera) {
          const speedMult = busy ? 1.6 : 0.9;

          // Gentle hover on Central AIO Summary Card
          summaryMesh.position.y = 1.2 + Math.sin(sec * 1.5) * 0.7;
          haloMesh.position.y = summaryMesh.position.y;
          haloMesh.scale.setScalar(1 + Math.sin(sec * 2.5) * 0.035);

          // Animate Floating Citation Source Cards
          citationCards.forEach((c, idx) => {
            const floatY = Math.sin(sec * c.floatSpeed + c.floatOffset) * 1.5;
            const floatZ = Math.cos(sec * c.floatSpeed * 0.8 + c.floatOffset) * 1.1;
            c.mesh.position.y = c.targetPos.y + floatY;
            c.mesh.position.z = c.targetPos.z + floatZ;

            c.mesh.rotation.x = c.baseRot.x + Math.sin(sec + idx) * 0.035;
            c.mesh.rotation.y = c.baseRot.y + Math.cos(sec * 0.8 + idx) * 0.035;

            // Update Citation Beam Positions
            const line = beamLines[idx];
            if (line) {
              const posAttr = line.geometry.getAttribute("position") as ThreeTypes.BufferAttribute;
              const arr = posAttr.array as Float32Array;

              // Card anchor
              arr[0] = c.mesh.position.x;
              arr[1] = c.mesh.position.y;
              arr[2] = c.mesh.position.z;

              // Target anchor on central summary card
              arr[3] = summaryMesh.position.x + c.anchorCentralOffset.x;
              arr[4] = summaryMesh.position.y + c.anchorCentralOffset.y;
              arr[5] = summaryMesh.position.z + c.anchorCentralOffset.z;

              posAttr.needsUpdate = true;
            }

            // Beam pulse opacity
            if (beamMaterials[idx]) {
              beamMaterials[idx].opacity = 0.35 + Math.sin(sec * 4 * speedMult + idx) * 0.25;
            }
          });

          // Animate Traveling Pulse Particles along Citation Beams
          pulses.forEach((p) => {
            p.progress = (p.progress + dt * p.speed * speedMult) % 1.0;
            const c = citationCards[p.beamIndex];
            if (c) {
              const startX = c.mesh.position.x;
              const startY = c.mesh.position.y;
              const startZ = c.mesh.position.z;

              const endX = summaryMesh.position.x + c.anchorCentralOffset.x;
              const endY = summaryMesh.position.y + c.anchorCentralOffset.y;
              const endZ = summaryMesh.position.z + c.anchorCentralOffset.z;

              p.mesh.position.x = startX + (endX - startX) * p.progress;
              p.mesh.position.y = startY + (endY - startY) * p.progress;
              p.mesh.position.z = startZ + (endZ - startZ) * p.progress;

              // Fade in and out at ends
              const fade = Math.sin(p.progress * Math.PI);
              (p.mesh.material as ThreeTypes.MeshBasicMaterial).opacity = fade * 0.85;
            }
          });

          // Query Tag Pill subtle float
          q1Mesh.position.y = -13 + Math.sin(sec * 1.8) * 1.1;

          // Parallax Tilt
          rootGroup.rotation.y = motion.x;
          rootGroup.rotation.x = motion.y;

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
        textures.forEach((t) => t.dispose());
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
      textures.forEach((t) => t.dispose());
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
