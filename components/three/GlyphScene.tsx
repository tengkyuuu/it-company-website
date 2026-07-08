"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, RoundedBox } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

/**
 * One 3D "glyph" per service, crossfaded by scale. `active` picks the glyph;
 * pass -1 to slowly cycle through all of them (used on the Services page).
 * Index order matches lib/services.ts.
 */
export default function GlyphScene({ active = -1 }: { active?: number }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.6], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.42} />
      <pointLight position={[-5, 3, 4]} intensity={3.2} color="#9d5a8f" decay={0} />
      <pointLight position={[5, -3, 4]} intensity={3.2} color="#e0a23a" decay={0} />
      <pointLight position={[0, 4, 2]} intensity={1.3} color="#b85c7a" decay={0} />
      <Glyphs active={active} />
    </Canvas>
  );
}

const GLYPH_COUNT = 6;

function Glyphs({ active }: { active: number }) {
  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // cycle mode when no explicit selection
    const current = active >= 0 ? active : Math.floor(t / 3) % GLYPH_COUNT;
    groups.current.forEach((g, i) => {
      if (!g) return;
      const target = i === current ? 1 : 0;
      const s = THREE.MathUtils.damp(g.scale.x, target, 5.5, delta);
      g.scale.setScalar(Math.max(s, 0.0001));
      g.visible = s > 0.01;
      g.rotation.y += delta * (i === current ? 0.45 : 0.1);
      g.rotation.x = Math.sin(t * 0.4 + i) * 0.18;
    });
  });

  const ref = (i: number) => (el: THREE.Group | null) => {
    groups.current[i] = el;
  };

  const solid = (
    <meshStandardMaterial color="#f1edf3" roughness={0.16} metalness={0.5} />
  );

  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
      {/* 0 · Web Development — woven knot */}
      <group ref={ref(0)}>
        <mesh>
          <torusKnotGeometry args={[0.85, 0.3, 200, 28]} />
          {solid}
        </mesh>
      </group>

      {/* 1 · App Development — the app tile */}
      <group ref={ref(1)}>
        <RoundedBox args={[1.55, 1.55, 1.55]} radius={0.3} smoothness={5}>
          {solid}
        </RoundedBox>
      </group>

      {/* 2 · UI/UX Design — soft clay mass */}
      <group ref={ref(2)}>
        <mesh>
          <icosahedronGeometry args={[1.15, 64]} />
          <MeshDistortMaterial
            color="#f1edf3"
            distort={0.45}
            speed={1.6}
            roughness={0.14}
            metalness={0.4}
          />
        </mesh>
      </group>

      {/* 3 · Cloud & DevOps — the ring that keeps spinning */}
      <group ref={ref(3)}>
        <mesh rotation={[0.9, 0, 0]}>
          <torusGeometry args={[0.95, 0.34, 24, 72]} />
          {solid}
        </mesh>
      </group>

      {/* 4 · AI & Automation — crystal + wire halo */}
      <group ref={ref(4)}>
        <mesh>
          <octahedronGeometry args={[1.05, 0]} />
          {solid}
        </mesh>
        <mesh scale={1.45}>
          <octahedronGeometry args={[1.05, 0]} />
          <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.28} />
        </mesh>
      </group>

      {/* 5 · IT Consulting — the many-faced problem */}
      <group ref={ref(5)}>
        <mesh>
          <dodecahedronGeometry args={[1.05, 0]} />
          {solid}
        </mesh>
      </group>
    </Float>
  );
}
