"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

function Blob() {
  const mesh = useRef<THREE.Mesh>(null);
  // tracked on window so the canvas can sit behind content (pointer-events:none)
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.rotation.y = THREE.MathUtils.lerp(
      mesh.current.rotation.y,
      pointer.current.x * 0.5,
      0.04
    );
    mesh.current.rotation.x = THREE.MathUtils.lerp(
      mesh.current.rotation.x,
      -pointer.current.y * 0.5,
      0.04
    );
  });

  return (
    <Float speed={1.3} rotationIntensity={0.5} floatIntensity={1.2}>
      <mesh ref={mesh} scale={0.92}>
        <icosahedronGeometry args={[1.3, 64]} />
        <MeshDistortMaterial
          color="#efe9ee"
          distort={0.4}
          speed={1.4}
          roughness={0.14}
          metalness={0.42}
        />
      </mesh>
    </Float>
  );
}

export default function BlobScene() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.6], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.55} />
      {/* two accent lights paint the magenta→gold gradient across the form */}
      <pointLight position={[-4, 2, 3]} intensity={2.7} color="#9d5a8f" decay={0} />
      <pointLight position={[4, -2, 3]} intensity={2.7} color="#e0a23a" decay={0} />
      <pointLight position={[0, 3, 2]} intensity={1.1} color="#b85c7a" decay={0} />
      <Blob />
    </Canvas>
  );
}
