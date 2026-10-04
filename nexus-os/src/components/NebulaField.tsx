import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
uniform float uTime;
attribute vec3 color;
attribute float size;
varying vec3 vColor;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vColor = color;
  vec3 pos = position;
  float noise = snoise(vec2(pos.x * 0.02, pos.z * 0.02) + uTime * 0.05);
  pos.y += sin(uTime * 0.2 + pos.x * 0.1) * 2.0;
  pos.x += cos(uTime * 0.15 + pos.y * 0.1) * 2.0;
  pos.z += noise * 3.0;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = size * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
void main() {
  vec2 xy = gl_PointCoord.xy - vec2(0.5);
  float ll = length(xy);
  if (ll > 0.5) discard;
  float glow = pow(1.0 - (ll * 2.0), 1.5);
  float pulse = 0.8 + 0.2 * sin(uTime * 2.0);
  gl_FragColor = vec4(vColor, glow * pulse);
}
`

function ParticleSystem() {
  const { camera } = useThree()
  const count = 300
  const SPREAD = 120

  const [positions, colors, sizes] = useMemo(() => {
    const p = new Float32Array(count * 3)
    const c = new Float32Array(count * 3)
    const s = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      p[i * 3] = SPREAD * (Math.random() - 0.5)
      p[i * 3 + 1] = SPREAD * (Math.random() - 0.5)
      p[i * 3 + 2] = SPREAD * (Math.random() - 0.5)
      if (Math.random() > 0.8) {
        c[i * 3] = 1; c[i * 3 + 1] = 0.32; c[i * 3 + 2] = 0.24
      } else {
        c[i * 3] = 0.8; c[i * 3 + 1] = 0.8; c[i * 3 + 2] = 0.8
      }
      s[i] = Math.random() * 2.5 + 0.5
    }
    return [p, c, s]
  }, [])

  const meshRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  // Mouse parallax stored in a ref — no per-move React re-render.
  const mouse = useRef({ x: 0, y: 0 })

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useFrame((state) => {
    const time = state.clock.getElapsedTime()
    if (materialRef.current) materialRef.current.uniforms.uTime.value = time
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.02
      meshRef.current.rotation.x = Math.sin(time * 0.01) * 0.05
    }
    // Ease the camera toward the mouse for a gentle parallax tilt.
    camera.position.x += (mouse.current.x * 6 - camera.position.x) * 0.04
    camera.position.y += (mouse.current.y * 6 - camera.position.y) * 0.04
    camera.lookAt(0, 0, 0)
  })

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        transparent
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function NebulaField() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 80], fov: 60 }} gl={{ antialias: true, alpha: true }}>
        <ParticleSystem />
      </Canvas>
    </div>
  )
}
