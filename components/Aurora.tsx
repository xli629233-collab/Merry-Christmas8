
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../types';

export const Aurora: React.FC = () => {
  const count = 1500;
  const mesh = useRef<THREE.Points>(null);

  // 1. Generate Particles (Curtain shape)
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const color1 = new THREE.Color('#00ffaa'); // Teal
    const color2 = new THREE.Color('#8a2be2'); // Violet

    for (let i = 0; i < count; i++) {
        // Spread X wide, Y high, Z in background
        const x = (Math.random() - 0.5) * 120; 
        const y = Math.random() * 30 + 5;      
        const z = -30 + (Math.random() - 0.5) * 10; 

        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;

        // Gradient color based on X and Y
        const t = (Math.sin(x * 0.05) + 1) / 2;
        const c = color1.clone().lerp(color2, t * 0.5 + Math.random() * 0.5);
        
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  // 2. Generate Soft Glow Texture (Programmatic)
  const texture = useMemo(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if(ctx) {
          // Soft radial gradient for "glow" look
          const grad = ctx.createRadialGradient(32,32,0,32,32,32);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0,0,64,64);
      }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
  }, []);

  // 3. Animate Waves
  useFrame((state) => {
      if (!mesh.current) return;
      const time = state.clock.elapsedTime;
      const positions = mesh.current.geometry.attributes.position.array as Float32Array;
      
      // We stored initial positions in the geometry, 
      // but to simple wave we can just oscillate Y based on X
      // For better performance we avoid recreating the array, just mutation
      for(let i=0; i<count; i++) {
          const i3 = i*3;
          const x = positions[i3];
          // Simple wave effect: Y varies by time and X
          // To strictly avoid accumulating error, ideally we'd store initial Y, 
          // but for aurora a drifting particle is fine. 
          // Let's just apply a wave offset to visual only if we used a shader, 
          // but here we modify CPU buffer.
          
          const offset = Math.sin(x * 0.1 + time * 0.5) * 0.05;
          positions[i3 + 1] += offset;
          
          // Reset height if drifting too much (simple bounding)
          if (positions[i3 + 1] > 40) positions[i3+1] = 5;
          if (positions[i3 + 1] < 0) positions[i3+1] = 35;
      }
      mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh} position={[0, 5, -20]}>
        <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial 
            size={4} 
            vertexColors 
            transparent 
            opacity={0.4} 
            blending={THREE.AdditiveBlending} 
            depthWrite={false}
            map={texture}
            sizeAttenuation={true}
        />
    </points>
  );
};
