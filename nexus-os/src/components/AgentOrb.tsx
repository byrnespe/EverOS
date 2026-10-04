import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentState } from '@/os/protocol'

const vertex = /* glsl */ `
uniform float uTime;
uniform float uFreq;
attribute float aRandom;
varying float vDist;
void main() {
  vec3 pos = position;
  float noise = sin(pos.x * uFreq + uTime) * cos(pos.y * uFreq + uTime) * sin(pos.z * uFreq + uTime);
  float displacement = noise * (1.0 + aRandom * 0.6);
  pos += normal * displacement;
  vDist = length(pos);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragment = /* glsl */ `
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uTime;
varying float vDist;
void main() {
  float intensity = pow(0.7 + 0.5 * sin(vDist * 2.0 - uTime * 1.5), 2.0);
  vec3 finalColor = mix(uBaseColor, uGlowColor, intensity);
  gl_FragColor = vec4(finalColor, intensity * 0.85);
}
`

// Per-state targets for the orb: how fast it churns, how fast it spins, and its
// glow colour. These are driven by the REAL agent state from the backend.
const STATE_TARGETS: Record<AgentState, { freq: number; spin: number; glow: THREE.Color }> = {
  idle: { freq: 0.9, spin: 0.4, glow: new THREE.Color('#fe523d') },
  thinking: { freq: 3.2, spin: 2.6, glow: new THREE.Color('#ff6b57') },
  tool: { freq: 2.2, spin: 1.6, glow: new THREE.Color('#3b82f6') },
  responding: { freq: 1.6, spin: 1.0, glow: new THREE.Color('#fe523d') },
}

function OrbCore({ state }: { state: AgentState }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const controlsRef = useRef<{ autoRotateSpeed: number } | null>(null)
  const { clock } = useThree()

  // One geometry, shared by the mesh and the wireframe overlay — and the
  // per-vertex aRandom attribute lives on it, so the shader actually sees it.
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(4, 4)
    const n = g.attributes.position.count
    const randoms = new Float32Array(n)
    for (let i = 0; i < n; i++) randoms[i] = Math.random()
    g.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1))
    return g
  }, [])

  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFreq: { value: 0.9 },
      uBaseColor: { value: new THREE.Color('#1a1a1a') },
      uGlowColor: { value: new THREE.Color('#fe523d') },
    }),
    [],
  )

  useEffect(() => () => {
    geometry.dispose()
    edges.dispose()
  }, [geometry, edges])

  useFrame(() => {
    const time = clock.getElapsedTime()
    const target = STATE_TARGETS[state]
    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTime.value = time
      // Smoothly ease the churn frequency and glow toward the current state.
      u.uFreq.value += (target.freq - u.uFreq.value) * 0.06
      ;(u.uGlowColor.value as THREE.Color).lerp(target.glow, 0.06)
    }
    if (meshRef.current) meshRef.current.rotation.y = time * 0.1
    if (controlsRef.current) {
      controlsRef.current.autoRotateSpeed +=
        (target.spin - controlsRef.current.autoRotateSpeed) * 0.06
    }
  })

  return (
    <>
      <mesh ref={meshRef} geometry={geometry} scale={[1.2, 1.2, 1.2]}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertex}
          fragmentShader={fragment}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <lineSegments geometry={edges} scale={[1.22, 1.22, 1.22]}>
        <lineBasicMaterial
          color="#ff6b57"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <OrbitControls
        ref={controlsRef as never}
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </>
  )
}

export default function AgentOrb({ state }: { state: AgentState }) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 18], fov: 45 }} gl={{ alpha: true }}>
        <OrbCore state={state} />
      </Canvas>
    </div>
  )
}
