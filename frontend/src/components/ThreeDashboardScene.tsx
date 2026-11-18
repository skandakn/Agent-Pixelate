"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type CameraFocusTarget = "overview" | "orchestrator" | "visual" | "copy";

interface ThreeDashboardSceneProps {
  focusTarget: CameraFocusTarget;
  onSelectNode?: (node: CameraFocusTarget) => void;
  geminiEnabled?: boolean;
}

interface FloatingPanelSpec {
  title: string;
  badge: string;
  accent: string;
  lines: string[];
  metrics: { label: string; value: string }[];
}

function createHologramTexture(spec: FloatingPanelSpec): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Deep translucent glass card background
    const grad = ctx.createLinearGradient(0, 0, 512, 300);
    grad.addColorStop(0, "rgba(15, 23, 42, 0.90)");
    grad.addColorStop(1, "rgba(9, 13, 28, 0.78)");
    ctx.fillStyle = grad;

    const r = 24;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(512 - r, 0);
    ctx.quadraticCurveTo(512, 0, 512, r);
    ctx.lineTo(512, 300 - r);
    ctx.quadraticCurveTo(512, 300, 512 - r, 300);
    ctx.lineTo(r, 300);
    ctx.quadraticCurveTo(0, 300, 0, 300 - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Glowing border
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top accent bar
    ctx.fillStyle = spec.accent;
    ctx.fillRect(28, 26, 48, 4);

    // Badge
    ctx.font = "600 15px monospace";
    ctx.fillStyle = spec.accent;
    ctx.fillText(spec.badge.toUpperCase(), 28, 56);

    // Title
    ctx.font = "700 26px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(spec.title, 28, 92);

    // Body lines
    ctx.font = "400 16px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94A3B8";
    spec.lines.forEach((line, idx) => {
      ctx.fillText(line, 28, 128 + idx * 24);
    });

    // Divider
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 206);
    ctx.lineTo(484, 206);
    ctx.stroke();

    // Metrics strip
    spec.metrics.forEach((m, idx) => {
      const x = 28 + idx * 155;
      ctx.font = "600 12px monospace";
      ctx.fillStyle = "#64748B";
      ctx.fillText(m.label, x, 234);

      ctx.font = "700 22px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(m.value, x, 266);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(167,139,250,0.85)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const FOCUS_PRESETS: Record<
  CameraFocusTarget,
  { theta: number; phi: number; radius: number; lookAt: [number, number, number] }
> = {
  overview: { theta: 0.35, phi: 1.24, radius: 11.4, lookAt: [0, 0.15, 0] },
  orchestrator: { theta: 0.05, phi: 1.32, radius: 7.4, lookAt: [0, 0.35, 0] },
  visual: { theta: -0.75, phi: 1.18, radius: 8.2, lookAt: [-2.4, 0.6, 1.1] },
  copy: { theta: 0.92, phi: 1.18, radius: 8.2, lookAt: [2.4, -0.35, 1.1] },
};

export function ThreeDashboardScene({
  focusTarget,
  onSelectNode,
  geminiEnabled = true,
}: ThreeDashboardSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<CameraFocusTarget>(focusTarget);
  const onSelectRef = useRef(onSelectNode);

  useEffect(() => {
    focusRef.current = focusTarget;
  }, [focusTarget]);

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050711, 0.036);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 120);
    camera.position.set(3.2, 3.0, 10.6);

    // Lighting rig: studio key, cyan rim, violet bounce
    scene.add(new THREE.AmbientLight(0x8fa8ff, 0.65));

    const keyLight = new THREE.PointLight(0x8b5cf6, 4.2, 35);
    keyLight.position.set(6, 7, 6);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x06b6d4, 3.6, 35);
    rimLight.position.set(-7, 4, 4);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0x10b981, 2.8, 30);
    accentLight.position.set(2, -5, 6);
    scene.add(accentLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Central BAND Shared Room Core
    const coreGeo = new THREE.IcosahedronGeometry(1.38, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.72,
      roughness: 0.18,
      metalness: 0.65,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      flatShading: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.userData = { nodeId: "orchestrator" as CameraFocusTarget };
    rootGroup.add(coreMesh);

    const wireGeo = new THREE.IcosahedronGeometry(1.78, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    const wireShell = new THREE.Mesh(wireGeo, wireMat);
    rootGroup.add(wireShell);

    // Equatorial holographic rings around BAND Core
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(2.55, 0.022, 16, 128),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
      })
    );
    ring1.rotation.x = Math.PI / 2.2;
    rootGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(3.45, 0.016, 16, 128),
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.42,
      })
    );
    ring2.rotation.x = Math.PI / 2.6;
    ring2.rotation.y = 0.55;
    rootGroup.add(ring2);

    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(4.4, 0.014, 16, 128),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.32,
      })
    );
    ring3.rotation.x = Math.PI / 1.9;
    ring3.rotation.y = -0.45;
    rootGroup.add(ring3);

    // 2. Orbiting Multi-Agent Satellites (@visual_pixelate & @copy_pixelate)
    const clickableMeshes: THREE.Object3D[] = [coreMesh];

    const visualNodeGroup = new THREE.Group();
    const visualSphere = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.68, 1),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.85,
        metalness: 0.55,
        roughness: 0.2,
      })
    );
    visualSphere.userData = { nodeId: "visual" as CameraFocusTarget };
    clickableMeshes.push(visualSphere);
    visualNodeGroup.add(visualSphere);

    const visualHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.02, 12, 64),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.72,
      })
    );
    visualHalo.rotation.x = Math.PI / 2.3;
    visualNodeGroup.add(visualHalo);
    visualNodeGroup.position.set(-3.4, 0.85, 1.3);
    rootGroup.add(visualNodeGroup);

    const copyNodeGroup = new THREE.Group();
    const copySphere = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.66, 0),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.85,
        metalness: 0.5,
        roughness: 0.22,
      })
    );
    copySphere.userData = { nodeId: "copy" as CameraFocusTarget };
    clickableMeshes.push(copySphere);
    copyNodeGroup.add(copySphere);

    const copyHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.02, 12, 64),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.72,
      })
    );
    copyHalo.rotation.x = Math.PI / 2.1;
    copyNodeGroup.add(copyHalo);
    copyNodeGroup.position.set(3.4, -0.45, 1.3);
    rootGroup.add(copyNodeGroup);

    // 3. Curved Energy Bridges & Animated @mention Data Packets
    const curves = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-1.8, 1.4, 0.9),
        visualNodeGroup.position.clone(),
      ]),
      new THREE.CatmullRomCurve3([
        visualNodeGroup.position.clone(),
        new THREE.Vector3(0, 1.65, 2.4),
        copyNodeGroup.position.clone(),
      ]),
      new THREE.CatmullRomCurve3([
        copyNodeGroup.position.clone(),
        new THREE.Vector3(1.8, -1.25, 0.7),
        new THREE.Vector3(0, 0, 0),
      ]),
    ];

    const bridgeColors = [0x8b5cf6, 0x22d3ee, 0x34d399];
    const packetMeshes: { mesh: THREE.Mesh; curveIdx: number; offset: number; speed: number }[] = [];

    curves.forEach((curve, idx) => {
      const points = curve.getPoints(48);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: bridgeColors[idx],
        transparent: true,
        opacity: 0.45,
      });
      rootGroup.add(new THREE.Line(lineGeo, lineMat));

      for (let p = 0; p < 3; p++) {
        const packet = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 12, 12),
          new THREE.MeshBasicMaterial({ color: bridgeColors[idx] })
        );
        rootGroup.add(packet);
        packetMeshes.push({
          mesh: packet,
          curveIdx: idx,
          offset: p / 3,
          speed: 0.22 + idx * 0.04,
        });
      }
    });

    // 4. Floating 3D Holographic Dashboard Panels
    const panelSpecs: {
      spec: FloatingPanelSpec;
      pos: [number, number, number];
      rotY: number;
      nodeId: CameraFocusTarget;
    }[] = [
      {
        spec: {
          title: "@visual_pixelate",
          badge: "Creative Director Agent",
          accent: "#22D3EE",
          lines: [
            "Generates 4K concepts & MP4 cuts",
            "Writes visual brief to BAND Memory",
            "Triggers @copy_pixelate handoff",
          ],
          metrics: [
            { label: "ENGINE", value: geminiEnabled ? "Gemini" : "Studio" },
            { label: "ASSETS", value: "IMG+MP4" },
            { label: "STATUS", value: "READY" },
          ],
        },
        pos: [-5.1, 2.15, -1.35],
        rotY: 0.34,
        nodeId: "visual",
      },
      {
        spec: {
          title: "@copy_pixelate",
          badge: "Conversion Copy Agent",
          accent: "#34D399",
          lines: [
            "Hydrates shared BAND Memories",
            "Crafts LinkedIn, IG, X & Ad copy",
            "Syncs taglines to visual palette",
          ],
          metrics: [
            { label: "CHANNELS", value: "4+" },
            { label: "MEMORY", value: "BAND" },
            { label: "LATENCY", value: "<2.4s" },
          ],
        },
        pos: [5.1, -1.35, -1.25],
        rotY: -0.34,
        nodeId: "copy",
      },
      {
        spec: {
          title: "BAND Shared Room",
          badge: "Live Multi-Agent Bus",
          accent: "#A78BFA",
          lines: [
            "Real-time WebSocket event stream",
            "Persistent /data/campaigns store",
            "Agent37 gVisor cloud sandbox",
          ],
          metrics: [
            { label: "AGENTS", value: "3 LIVE" },
            { label: "STREAM", value: "WS 60fps" },
            { label: "AUTH", value: "CLERK" },
          ],
        },
        pos: [4.75, 2.55, -2.5],
        rotY: -0.26,
        nodeId: "orchestrator",
      },
    ];

    const panelMeshes: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
    const createdTextures: THREE.Texture[] = [];

    panelSpecs.forEach((item, idx) => {
      const tex = createHologramTexture(item.spec);
      createdTextures.push(tex);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.88),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.94,
          side: THREE.DoubleSide,
        })
      );
      plane.position.set(...item.pos);
      plane.rotation.y = item.rotY;
      plane.userData = { nodeId: item.nodeId };
      clickableMeshes.push(plane);
      rootGroup.add(plane);
      panelMeshes.push({ mesh: plane, baseY: item.pos[1], phase: idx * 1.8 });
    });

    // 5. Perspective Cyber Floor Grid
    const grid = new THREE.GridHelper(46, 46, 0x38bdf8, 0x1e293b);
    grid.position.y = -3.6;
    const gridMats = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.28;
    });
    scene.add(grid);

    // 6. Floating Starfield / Neural Voxel Particles
    const particleCount = 1200;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const palette = [
      new THREE.Color(0x8b5cf6),
      new THREE.Color(0x06b6d4),
      new THREE.Color(0x10b981),
      new THREE.Color(0xe2e8f0),
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 34 - 4;
      const col = palette[i % palette.length];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleTex = createSoftParticleTexture();
    createdTextures.push(particleTex);

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: particleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Interactive spherical orbit state
    const spherical = {
      theta: FOCUS_PRESETS.overview.theta,
      phi: FOCUS_PRESETS.overview.phi,
      radius: FOCUS_PRESETS.overview.radius,
    };
    const targetSpherical = { ...spherical };
    const currentLookAt = new THREE.Vector3(0, 0.15, 0);
    const targetLookAt = new THREE.Vector3(0, 0.15, 0);

    let isDragging = false;
    let pointerDownPos = { x: 0, y: 0 };
    let lastPointer = { x: 0, y: 0 };
    let userHasDragged = false;
    let mouseNdc = { x: 0, y: 0 };
    let lastPreset: CameraFocusTarget = focusRef.current;

    const raycaster = new THREE.Raycaster();
    const pointerVec = new THREE.Vector2();

    const domEl = renderer.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastPointer = { x: e.clientX, y: e.clientY };
      domEl.style.cursor = "grabbing";
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = domEl.getBoundingClientRect();
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - lastPointer.x;
        const dy = e.clientY - lastPointer.y;
        lastPointer = { x: e.clientX, y: e.clientY };
        targetSpherical.theta -= dx * 0.0065;
        targetSpherical.phi = Math.max(
          0.55,
          Math.min(Math.PI / 1.95, targetSpherical.phi - dy * 0.0055)
        );
        userHasDragged = true;
        return;
      }

      pointerVec.set(mouseNdc.x, mouseNdc.y);
      raycaster.setFromCamera(pointerVec, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      domEl.style.cursor = hits.length > 0 ? "pointer" : "grab";
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      domEl.style.cursor = "grab";

      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist < 6) {
        const rect = domEl.getBoundingClientRect();
        pointerVec.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointerVec, camera);
        const hits = raycaster.intersectObjects(clickableMeshes, false);
        if (hits.length > 0) {
          const hitNode = hits[0].object.userData?.nodeId as
            | CameraFocusTarget
            | undefined;
          if (hitNode && onSelectRef.current) {
            userHasDragged = false;
            onSelectRef.current(hitNode);
          }
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      targetSpherical.radius = Math.max(
        5.8,
        Math.min(16.5, targetSpherical.radius + e.deltaY * 0.006)
      );
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    domEl.style.cursor = "grab";
    domEl.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    domEl.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("resize", handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Apply preset transitions when focusTarget changes
      if (focusRef.current !== lastPreset) {
        lastPreset = focusRef.current;
        const preset = FOCUS_PRESETS[lastPreset];
        targetSpherical.theta = preset.theta;
        targetSpherical.phi = preset.phi;
        targetSpherical.radius = preset.radius;
        targetLookAt.set(...preset.lookAt);
        userHasDragged = false;
      }

      // Gentle auto-orbit when idle
      if (!isDragging && !userHasDragged) {
        targetSpherical.theta += 0.0014;
      }

      // Smooth damped camera interpolation + subtle mouse parallax
      const parallaxTheta = isDragging ? 0 : mouseNdc.x * 0.14;
      const parallaxPhi = isDragging ? 0 : mouseNdc.y * 0.08;

      spherical.theta += (targetSpherical.theta + parallaxTheta - spherical.theta) * 0.06;
      spherical.phi += (targetSpherical.phi - parallaxPhi - spherical.phi) * 0.06;
      spherical.radius += (targetSpherical.radius - spherical.radius) * 0.06;
      currentLookAt.lerp(targetLookAt, 0.06);

      camera.position.set(
        currentLookAt.x +
          spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
        currentLookAt.y + spherical.radius * Math.cos(spherical.phi),
        currentLookAt.z +
          spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
      );
      camera.lookAt(currentLookAt);

      // Animate core, rings, and satellites
      coreMesh.rotation.y = elapsed * 0.42;
      coreMesh.rotation.x = Math.sin(elapsed * 0.35) * 0.28;
      const pulse = 1 + Math.sin(elapsed * 2.2) * 0.04;
      coreMesh.scale.setScalar(pulse);

      wireShell.rotation.y = -elapsed * 0.22;
      wireShell.rotation.z = elapsed * 0.14;

      ring1.rotation.z = elapsed * 0.35;
      ring2.rotation.z = -elapsed * 0.25;
      ring3.rotation.z = elapsed * 0.18;

      visualSphere.rotation.y = elapsed * 0.8;
      visualHalo.rotation.z = -elapsed * 0.9;
      visualNodeGroup.position.y = 0.85 + Math.sin(elapsed * 1.4) * 0.24;

      copySphere.rotation.y = -elapsed * 0.75;
      copyHalo.rotation.z = elapsed * 0.85;
      copyNodeGroup.position.y = -0.45 + Math.cos(elapsed * 1.3) * 0.24;

      // Animate streaming @mention light packets along Bezier bridges
      packetMeshes.forEach((p) => {
        const t = (elapsed * p.speed + p.offset) % 1;
        const pos = curves[p.curveIdx].getPointAt(t);
        p.mesh.position.copy(pos);
      });

      // Gently float holographic dashboard panels
      panelMeshes.forEach((panel) => {
        panel.mesh.position.y =
          panel.baseY + Math.sin(elapsed * 1.1 + panel.phase) * 0.16;
      });

      particles.rotation.y = elapsed * 0.025;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      domEl.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      domEl.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", handleResize);

      createdTextures.forEach((tex) => tex.dispose());
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry?.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else if (mat) {
            mat.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [geminiEnabled]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full select-none"
      aria-label="Interactive Three.js 3D Multi-Agent Dashboard"
    />
  );
}
