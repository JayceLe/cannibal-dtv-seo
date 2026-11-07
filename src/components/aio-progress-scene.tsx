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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(46, host.clientWidth / host.clientHeight, 0.1, 1000);
      camera.position.set(0, 0, 92);

      // Ambient & Directional Lights
      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambient);

      const dirLight = new THREE.DirectionalLight(0x60a5fa, 2.2);
      dirLight.position.set(40, 50, 60);
      scene.add(dirLight);

      const secondaryLight = new THREE.DirectionalLight(0xff7759, 1.8);
      secondaryLight.position.set(-50, -30, 40);
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
      // Texture 1: Central Google AI Overview Synthesis Card (Trích dẫn AIO)
      // -----------------------------------------------------------------------
      const createAioSummaryTexture = (curPhase: number): ThreeTypes.CanvasTexture => {
        const cv = document.createElement("canvas");
        cv.width = 512;
        cv.height = 300;
        const ctx = cv.getContext("2d")!;

        // Background Glass/Card
        const bgGrad = ctx.createLinearGradient(0, 0, 512, 300);
        bgGrad.addColorStop(0, "#081325");
        bgGrad.addColorStop(1, "#0a223f");
        drawRoundRect(ctx, 4, 4, 504, 292, 20);
        ctx.fillStyle = bgGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(96, 165, 250, 0.4)";
        ctx.stroke();

        // Top Banner / Header
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.fillText("✦ Đối chiếu nội dung", 28, 44);

        // Status pill
        drawRoundRect(ctx, 330, 22, 150, 30, 15);
        ctx.fillStyle = curPhase === 3 ? "rgba(16, 185, 129, 0.25)" : "rgba(37, 99, 235, 0.35)";
        ctx.fill();
        ctx.strokeStyle = curPhase === 3 ? "#10b981" : "#60a5fa";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = curPhase === 3 ? "#34d399" : "#93c5fd";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText(curPhase === 3 ? "✔ HOÀN TẤT" : "● ĐANG XỬ LÝ", 345, 42);

        // Subtitle line
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("Từ khóa → đoạn nội dung → so sánh", 28, 76);

        // Passage Snippets with Inline Citation Chips [1], [2], [3]
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("Mở rộng query theo chủ đề đang audit", 28, 118);

        // Inline Citation Badge [1]
        drawRoundRect(ctx, 452, 102, 32, 22, 6);
        ctx.fillStyle = "#1863dc";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("[1]", 460, 118);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("Tìm đoạn trả lời đúng ý định tìm kiếm", 28, 152);

        // Inline Citation Badge [2]
        drawRoundRect(ctx, 420, 136, 32, 22, 6);
        ctx.fillStyle = "#ff7759";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("[2]", 428, 152);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("Tính điểm và đối chiếu bằng chứng", 28, 186);

        // Inline Citation Badge [3]
        drawRoundRect(ctx, 442, 170, 32, 22, 6);
        ctx.fillStyle = "#00a884";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("[3]", 450, 186);

        // Bottom Citation Sources Bar
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        drawRoundRect(ctx, 20, 224, 472, 54, 12);
        ctx.fill();
        ctx.fillStyle = "#93c5fd";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillText("Kết quả hiện khi audit hoàn tất", 36, 256);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // Texture 2: Citation Source Document Snippet (Trích dẫn URL)
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
        cv.width = 384;
        cv.height = 220;
        const ctx = cv.getContext("2d")!;

        // Background
        drawRoundRect(ctx, 4, 4, 376, 212, 16);
        ctx.fillStyle = "#0a192f";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = badgeColor;
        ctx.stroke();

        // Top Header
        drawRoundRect(ctx, 16, 16, 34, 26, 6);
        ctx.fillStyle = badgeColor;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.fillText(badgeNum, 24, 34);

        // Domain Name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText(domain, 60, 35);

        // Badge Pill
        drawRoundRect(ctx, 230, 16, 134, 26, 13);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fill();
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = badgeColor;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText(badgeLabel, 242, 33);

        // Divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 56);
        ctx.lineTo(368, 56);
        ctx.stroke();

        // Snippet Passage Text
        ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText(lineText, 18, 90);
        ctx.fillText("Đọc nội dung của lần audit hiện tại", 18, 114);

        // Score row
        drawRoundRect(ctx, 16, 148, 352, 48, 8);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("ĐỘ TƯƠNG ĐỒNG COSINE", 28, 178);

        ctx.fillStyle = badgeColor;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(scoreText, 275, 179);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // Texture 3: Search Query Fan-out Tag Pill
      // -----------------------------------------------------------------------
      const createQueryTagTexture = (query: string): ThreeTypes.CanvasTexture => {
        const cv = document.createElement("canvas");
        cv.width = 256;
        cv.height = 80;
        const ctx = cv.getContext("2d")!;

        drawRoundRect(ctx, 4, 4, 248, 72, 36);
        ctx.fillStyle = "#0c213d";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#38bdf8";
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 24px system-ui, sans-serif";
        ctx.fillText("⌕", 24, 46);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText(query, 52, 46);

        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.add(tex);
        return tex;
      };

      // -----------------------------------------------------------------------
      // 1. Central AIO Synthesis Plane
      // -----------------------------------------------------------------------
      const summaryGeo = new THREE.PlaneGeometry(36, 21);
      geometries.add(summaryGeo);
      const summaryTex = createAioSummaryTexture(phaseRef.current);
      const summaryMat = new THREE.MeshBasicMaterial({
        map: summaryTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      materials.add(summaryMat);
      const summaryMesh = new THREE.Mesh(summaryGeo, summaryMat);
      summaryMesh.position.set(0, 1.5, 0);
      rootGroup.add(summaryMesh);

      // Glowing Halo around Summary Card
      const haloGeo = new THREE.PlaneGeometry(38, 23);
      geometries.add(haloGeo);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x1863dc,
        transparent: true,
        opacity: 0.28,
        wireframe: true,
      });
      materials.add(haloMat);
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(0, 1.5, -0.5);
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
      }[] = [];

      const cardGeo = new THREE.PlaneGeometry(22, 12.6);
      geometries.add(cardGeo);

      // Citation Card [1]: Trang của bạn (Action Blue #1863dc)
      const c1Tex = createCitationSourceTexture(
        "[1]",
        "Trang mục tiêu",
        "TRANG BẠN",
        "#1863dc",
        "Tìm đoạn trả lời từng query",
        "—",
      );
      const c1Mat = new THREE.MeshBasicMaterial({ map: c1Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c1Mat);
      const c1Mesh = new THREE.Mesh(cardGeo, c1Mat);
      c1Mesh.position.set(-36, 12, 10);
      rootGroup.add(c1Mesh);
      citationCards.push({
        mesh: c1Mesh,
        targetPos: new THREE.Vector3(-36, 12, 10),
        floatSpeed: 1.4,
        floatOffset: 0,
        baseRot: { x: 0.05, y: 0.28, z: -0.04 },
      });

      // Citation Card [2]: Đối thủ #1 (Coral #ff7759)
      const c2Tex = createCitationSourceTexture(
        "[2]",
        "Nguồn đối chiếu",
        "NỘI DUNG",
        "#ff7759",
        "Đọc nội dung từ URL đối thủ",
        "—",
      );
      const c2Mat = new THREE.MeshBasicMaterial({ map: c2Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c2Mat);
      const c2Mesh = new THREE.Mesh(cardGeo, c2Mat);
      c2Mesh.position.set(36, 10, 8);
      rootGroup.add(c2Mesh);
      citationCards.push({
        mesh: c2Mesh,
        targetPos: new THREE.Vector3(36, 10, 8),
        floatSpeed: 1.6,
        floatOffset: 1.8,
        baseRot: { x: 0.06, y: -0.26, z: 0.03 },
      });

      // Citation Card [3]: Đối thủ #2 (Enterprise Green #00a884)
      const c3Tex = createCitationSourceTexture(
        "[3]",
        "Nguồn đối chiếu",
        "BẰNG CHỨNG",
        "#00a884",
        "So sánh các đoạn cùng ý định",
        "—",
      );
      const c3Mat = new THREE.MeshBasicMaterial({ map: c3Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(c3Mat);
      const c3Mesh = new THREE.Mesh(cardGeo, c3Mat);
      c3Mesh.position.set(-32, -14, 6);
      rootGroup.add(c3Mesh);
      citationCards.push({
        mesh: c3Mesh,
        targetPos: new THREE.Vector3(-32, -14, 6),
        floatSpeed: 1.3,
        floatOffset: 3.2,
        baseRot: { x: -0.05, y: 0.24, z: -0.02 },
      });

      // -----------------------------------------------------------------------
      // 3. Search Query Tag Pills Floating in 3D
      // -----------------------------------------------------------------------
      const queryGeo = new THREE.PlaneGeometry(16, 5);
      geometries.add(queryGeo);

      const q1Tex = createQueryTagTexture("Query mục tiêu");
      const q1Mat = new THREE.MeshBasicMaterial({ map: q1Tex, transparent: true, side: THREE.DoubleSide });
      materials.add(q1Mat);
      const q1Mesh = new THREE.Mesh(queryGeo, q1Mat);
      q1Mesh.position.set(32, -15, 12);
      q1Mesh.rotation.set(-0.06, -0.22, 0.02);
      rootGroup.add(q1Mesh);

      // -----------------------------------------------------------------------
      // 4. Citation Beams / Ray Traces (Trích dẫn nối thẻ nguồn vào AIO Overview)
      // -----------------------------------------------------------------------
      const beamMaterials: ThreeTypes.LineBasicMaterial[] = [];
      const beamLines: ThreeTypes.Line[] = [];
      const beamColors = [0x60a5fa, 0xff7759, 0x34d399];

      citationCards.forEach((c, idx) => {
        const lineGeo = new THREE.BufferGeometry();
        const pts = new Float32Array(6); // 2 vertices: from card to summary card
        lineGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        geometries.add(lineGeo);

        const bMat = new THREE.LineBasicMaterial({
          color: beamColors[idx % beamColors.length],
          transparent: true,
          opacity: 0.55,
          linewidth: 2,
        });
        materials.add(bMat);
        beamMaterials.push(bMat);

        const line = new THREE.Line(lineGeo, bMat);
        rootGroup.add(line);
        beamLines.push(line);
      });

      // -----------------------------------------------------------------------
      // 5. Starfield / SEO Keyword Dust Particles
      // -----------------------------------------------------------------------
      const starCount = 50;
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPos[i] = (Math.random() - 0.5) * 160;
        starPos[i + 1] = (Math.random() - 0.5) * 110;
        starPos[i + 2] = (Math.random() - 0.5) * 60;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      geometries.add(starGeo);
      const starMat = new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: 1.8,
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
        const dt = sec - lastTime;
        lastTime = sec;

        if (rootGroup && renderer && scene && camera) {
          const speedMult = busy ? 1.6 : 0.8;

          // Gentle hover on Central AIO Summary Card
          summaryMesh.position.y = 1.5 + Math.sin(sec * 1.5) * 0.8;
          haloMesh.position.y = summaryMesh.position.y;
          haloMesh.scale.setScalar(1 + Math.sin(sec * 2.5) * 0.04);

          // Animate Floating Citation Source Cards
          citationCards.forEach((c, idx) => {
            const floatY = Math.sin(sec * c.floatSpeed + c.floatOffset) * 1.6;
            const floatZ = Math.cos(sec * c.floatSpeed * 0.8 + c.floatOffset) * 1.2;
            c.mesh.position.y = c.targetPos.y + floatY;
            c.mesh.position.z = c.targetPos.z + floatZ;

            c.mesh.rotation.x = c.baseRot.x + Math.sin(sec + idx) * 0.04;
            c.mesh.rotation.y = c.baseRot.y + Math.cos(sec * 0.8 + idx) * 0.04;

            // Update Citation Beam Positions (Connecting Citation Source to Center)
            const line = beamLines[idx];
            if (line) {
              const posAttr = line.geometry.getAttribute("position") as ThreeTypes.BufferAttribute;
              const arr = posAttr.array as Float32Array;

              // Card anchor
              arr[0] = c.mesh.position.x;
              arr[1] = c.mesh.position.y;
              arr[2] = c.mesh.position.z;

              // Target anchor on central summary card
              arr[3] = (idx - 1) * 8;
              arr[4] = summaryMesh.position.y;
              arr[5] = 0;

              posAttr.needsUpdate = true;
            }

            // Beam pulse opacity
            if (beamMaterials[idx]) {
              beamMaterials[idx].opacity = 0.35 + Math.sin(sec * 4 * speedMult + idx) * 0.25;
            }
          });

          // Query Tag Pill subtle float
          q1Mesh.position.y = -15 + Math.sin(sec * 1.8) * 1.2;

          // Subtle Parallax Tilt
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
