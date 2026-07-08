"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The hero constellation: a distorted core orbited by geometric satellites
 * over a drifting particle field. Two external inputs drive it —
 *   pointer  → parallax rotation of the whole system
 *   progress → scroll progress (0..1); shapes scatter outward and the
 *              camera pulls back as the visitor leaves the hero.
 */
type Drive = { progress: { current: number } };

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
      return <torusKnotGeometry args={[0.8, 0.26, 160, 24]} />;
    case "torus":
      return <torusGeometry args={[0.85, 0.3, 24, 64]} />;
    case "capsule":
      return <capsuleGeometry args={[0.42, 0.9, 8, 24]} />;
    case "octa":
      return <octahedronGeometry args={[0.9, 0]} />;
    case "ico":
      return <icosahedronGeometry args={[0.85, 0]} />;
  }
}

function Constellation({ progress }: Drive) {
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

  useFrame((state, delta) => {
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
          <icosahedronGeometry args={[1.15, 64]} />
          <MeshDistortMaterial
            color="#ece7ee"
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
              <meshStandardMaterial color="#e6e1e9" roughness={0.18} metalness={0.55} />
            </mesh>
          </Float>
        </group>
      ))}
    </group>
  );
}

function Particles({ progress }: Drive) {
  const ref = useRef<THREE.Points>(null);
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

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y =
      state.clock.elapsedTime * 0.02 + progress.current * 0.8;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#94a3b8"
        transparent
        opacity={0.65}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function HeroScene({ progress }: Drive) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 7], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      {/* the brand gradient, painted with light */}
      <pointLight position={[-6, 3, 4]} intensity={3} color="#9d5a8f" decay={0} />
      <pointLight position={[6, -3, 4]} intensity={3} color="#e0a23a" decay={0} />
      <pointLight position={[0, 4, 2]} intensity={1.2} color="#b85c7a" decay={0} />
      <Particles progress={progress} />
      <Constellation progress={progress} />
    </Canvas>
  );
}
