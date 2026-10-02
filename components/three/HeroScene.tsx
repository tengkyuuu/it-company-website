"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Theme palette for the scene. In dark mode the meshes keep a light albedo (so
 * the accent point-lights still paint the magenta→gold gradient onto them) but
 * the ambient fill drops right down, letting the unlit faces fall into shadow.
 * That's what stops the forms from reading as blown-out white blobs on a dark
 * page — the gradient does the work instead.
 */
const PALETTE = {
  light: { core: "#ece7ee", sat: "#e6e1e9", dot: "#94a3b8", ambient: 0.5, dotOpacity: 0.65 },
  dark: { core: "#d5cbdb", sat: "#cdc4d4", dot: "#93a6c4", ambient: 0.14, dotOpacity: 0.5 },
} as const;

/**
 * The hero constellation: a distorted core orbited by geometric satellites
 * over a drifting particle field. Two external inputs drive it —
 *   pointer  → parallax rotation of the whole system
 *   progress → scroll progress (0..1); shapes scatter outward and the
 *              camera pulls back as the visitor leaves the hero.
 */
type Drive = { progress: { current: number } };

/** Longest step a single frame may advance the animation (seconds). */
const MAX_STEP = 1 / 20;

const SATELLITES: {
  kind: "knot" | "ico" | "capsule" | "torus" | "octa";
  pos: [number, number, number];
  dir: [number, number, number];
  scale: number;
  spin: number;
}[] = [
  { kind: "knot", pos: [2.6, 0.9, -0.6], dir: [1.6, 0.9, -0.8], scale: 0.5, spin: 0.35 },
  { kind: "torus", pos: [-2.9, -0.7, -1.2], dir: [-1.8, -0.7, -0.6], scale: 0.55, spin: 0.25 },
  { kind: "capsule", pos: [-2.2, 1.5, -0.2], dir: [-1.2, 1.6, 0.4], scale: 0.45, spin: 0.5 },
  { kind: "octa", pos: [3.1, -1.3, 0.2], dir: [1.9, -1.4, 0.7], scale: 0.42, spin: 0.6 },
  { kind: "ico", pos: [0.4, -2.1, -1.4], dir: [0.3, -2.0, -1.0], scale: 0.38, spin: 0.3 },
  { kind: "capsule", pos: [1.1, 2.3, -1.8], dir: [0.8, 2.0, -1.2], scale: 0.3, spin: 0.45 },
];

function SatelliteGeometry({ kind }: { kind: (typeof SATELLITES)[number]["kind"] }) {
  switch (kind) {
    case "knot":
      return <torusKnotGeometry args={[0.8, 0.26, 120, 18]} />;
    case "torus":
      return <torusGeometry args={[0.85, 0.3, 18, 44]} />;
    case "capsule":
      return <capsuleGeometry args={[0.42, 0.9, 8, 24]} />;
    case "octa":
      return <octahedronGeometry args={[0.9, 0]} />;
    case "ico":
      return <icosahedronGeometry args={[0.85, 0]} />;
  }
}

type Palette = (typeof PALETTE)[keyof typeof PALETTE];

function Constellation({ progress, p: pal }: Drive & { p: Palette }) {
  const system = useRef<THREE.Group>(null);
  const sats = useRef<(THREE.Group | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, rawDelta) => {
    // the loop is paused while the hero is offscreen; the first frame back
    // would otherwise carry the whole pause as one giant step
    const delta = Math.min(rawDelta, MAX_STEP);
    const p = progress.current;
    const g = system.current;
    if (g) {
      // cursor parallax + a slow idle drift, sped up slightly by scroll
      g.rotation.y = THREE.MathUtils.damp(
        g.rotation.y,
        pointer.current.x * 0.35 + p * 1.4,
        2.2,
        delta
      );
      g.rotation.x = THREE.MathUtils.damp(
        g.rotation.x,
        -pointer.current.y * 0.25 + p * 0.3,
        2.2,
        delta
      );
    }
    // scatter satellites outward as the hero scrolls away
    SATELLITES.forEach((s, i) => {
      const sat = sats.current[i];
      if (!sat) return;
      sat.position.set(
        s.pos[0] + s.dir[0] * p * 2.6,
        s.pos[1] + s.dir[1] * p * 2.6,
        s.pos[2] + s.dir[2] * p * 2.6
      );
      sat.rotation.x += delta * s.spin;
      sat.rotation.y += delta * s.spin * 0.8;
    });
    // camera pulls back
    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      7 + p * 3.2,
      3,
      delta
    );
  });

  return (
    // offset right so the headline owns the left half of the stage
    <group ref={system} position={[1.7, 0.1, 0]}>
      {/* the core — soft distorted mass the lights paint the gradient onto */}
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1}>
        <mesh scale={1.2}>
          <icosahedronGeometry args={[1.15, 20]} />
          <MeshDistortMaterial
            color={pal.core}
            distort={0.42}
            speed={1.3}
            roughness={0.12}
            metalness={0.45}
          />
        </mesh>
      </Float>

      {SATELLITES.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            sats.current[i] = el;
          }}
          position={s.pos}
        >
          <Float speed={1 + s.spin} rotationIntensity={0.3} floatIntensity={0.8}>
            <mesh scale={s.scale}>
              <SatelliteGeometry kind={s.kind} />
              <meshStandardMaterial color={pal.sat} roughness={0.18} metalness={0.55} />
            </mesh>
          </Float>
        </group>
      ))}
    </group>
  );
}

function Particles({ progress, p: pal }: Drive & { p: Palette }) {
  const ref = useRef<THREE.Points>(null);
  // own clock rather than clock.elapsedTime, which keeps counting while the
  // loop is paused and would snap the field round on resume
  const t = useRef(0);
  const positions = useMemo(() => {
    const n = 280;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    t.current += Math.min(delta, MAX_STEP);
    ref.current.rotation.y = t.current * 0.02 + progress.current * 0.8;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color={pal.dot}
        transparent
        opacity={pal.dotOpacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/**
 * `active` = the hero is on screen AND the opening sequence is over. While it's
 * false the canvas is `frameloop="demand"`: it still renders once on mount —
 * so shader compilation happens under the preloader, where nobody can see the
 * stall — and again on a prop change (theme), but otherwise costs nothing.
 * The hero is a 175vh sticky stage; once it's scrolled past, it's free.
 *
 * DPR is capped at 1.25 (was 1.5 — ~30% fewer pixels to shade on hi-dpi
 * screens; the soft distorted forms don't show the difference) and drops to 1
 * if the monitor sees frame rate sag for a sustained stretch. The monitor is
 * remounted on every resume, so a pause can't read as a slow frame.
 */
export default function HeroScene({
  progress,
  active,
}: Drive & { active: boolean }) {
  const { theme } = useTheme();
  const pal = PALETTE[theme === "dark" ? "dark" : "light"];
  const [dprMax, setDprMax] = useState(1.25);

  return (
    <Canvas
      frameloop={active ? "always" : "demand"}
      dpr={[1, dprMax]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      {active && <PerformanceMonitor onDecline={() => setDprMax(1)} />}
      <ambientLight intensity={pal.ambient} />
      {/* the brand gradient, painted with light */}
      <pointLight position={[-6, 3, 4]} intensity={3} color="#9d5a8f" decay={0} />
      <pointLight position={[6, -3, 4]} intensity={3} color="#e0a23a" decay={0} />
      <pointLight position={[0, 4, 2]} intensity={1.2} color="#b85c7a" decay={0} />
      <Particles progress={progress} p={pal} />
      <Constellation progress={progress} p={pal} />
    </Canvas>
  );
}
