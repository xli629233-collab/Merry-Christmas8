
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Points, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { PhotoData, TreeStyle, TreeShape } from '../types';

interface TreeProps {
  photos: PhotoData[];
  onPhotoClick: (photo: PhotoData) => void;
  isExploded: boolean;
  isTwinkling: boolean;
  gestureRotation: number;
  foliageColor?: string;
  treeStyle: TreeStyle;
  shape: TreeShape;
}

// Hook to generate Polka Dot Texture for Frames or Empty Placeholders
export function usePolkaDotTexture(bgColor: string, dotColors: string[], isEmpty: boolean = false) {
  const colorsKey = dotColors.join(',');
  return useMemo(() => {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = Math.floor(512 * (1.8 / 1.4)); // Match frame aspect ratio
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      
      if (isEmpty) {
          // Draw "Add" Symbol for empty frames
          ctx.strokeStyle = '#e5e7eb'; // Light gray
          ctx.lineWidth = 15;
          ctx.setLineDash([30, 20]); // Dashed border
          ctx.strokeRect(40, 40, width - 80, height - 80);
          
          // Draw Plus Sign
          ctx.fillStyle = '#d1d5db';
          ctx.font = 'bold 200px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', width / 2, height / 2);
          
          ctx.font = 'bold 40px Arial';
          ctx.fillText('Add Photo', width / 2, height / 2 + 100);

      } else {
          // Polka Dots for active frames
          const dotCount = 60;
          for (let i = 0; i < dotCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const r = (10 + Math.random() * 30); // Random size
            
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = dotColors[Math.floor(Math.random() * dotColors.length)];
            ctx.fill();
          }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [bgColor, colorsKey, isEmpty]);
}

// Hook to generate Simple Circle Texture for Particles
function useCircleTexture() {
    return useMemo(() => {
        if (typeof document === 'undefined') return new THREE.Texture();
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.arc(16, 16, 14, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }, []);
}

// -- Components for Instanced Decorations --
const Bauble = ({ color, position, scale }: { color: string, position: [number,number,number], scale: number }) => {
    const isGold = color === '#FFD700' || color === '#eab308' || color === '#fbbf24' || color === '#fcd34d';
    const isSilver = color === '#C0C0C0' || color === '#E5E7EB' || color === '#FFFFFF';
    const isMetallic = isGold || isSilver;
    
    return (
        <mesh position={position} scale={scale}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial 
                color={color} 
                metalness={0.9} 
                roughness={0.1} 
                envMapIntensity={1.5} 
                emissive={color} 
                emissiveIntensity={isMetallic ? 2.5 : 0.2} 
                toneMapped={!isMetallic} 
            />
        </mesh>
    );
};

const GiftBox = ({ color, position, scale, rotation, ribbonColor = '#FFD700' }: { color: string, position: [number,number,number], scale: number, rotation: [number,number,number], ribbonColor?: string }) => (
    <mesh position={position} scale={scale} rotation={rotation}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} />
        <mesh scale={[1.05, 1.05, 0.2]}>
             <boxGeometry args={[1, 1, 1]} />
             <meshStandardMaterial 
                color={ribbonColor} 
                metalness={0.6} 
                roughness={0.3} 
                emissive={ribbonColor}
                emissiveIntensity={2.0}
                toneMapped={false}
             />
        </mesh>
    </mesh>
);

// -- Polaroid Frame Component --
const PolaroidFrame = ({ url, onClick, opacity = 1, texture, isEmpty }: { url: string, onClick: (e: any) => void, opacity?: number, texture: THREE.Texture, isEmpty: boolean }) => {
    return (
        <group onClick={onClick} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
            <mesh position={[0, -0.2, -0.01]}>
                <boxGeometry args={[1.4, 1.8, 0.05]} />
                <meshStandardMaterial map={texture} roughness={0.8} transparent opacity={opacity} />
            </mesh>
            
            {/* If empty, don't show the Image component, the texture on the box handles visual representation */}
            {!isEmpty && (
                <Image 
                    key={url} // FORCE TEXTURE RELOAD
                    url={url} 
                    position={[0, 0.1, 0.02]}
                    scale={[1.2, 1.2]}
                    toneMapped={false}
                    transparent
                    opacity={opacity}
                />
            )}
            
            <mesh position={[0, 0.1, 0.03]}>
                <planeGeometry args={[1.2, 1.2]} />
                <meshPhysicalMaterial 
                    transparent 
                    opacity={0.1 * opacity} 
                    roughness={0.0} 
                    clearcoat={1.0} 
                />
            </mesh>
        </group>
    );
};

// -- Geometric Leaf Component --
const GeometricBlock = ({ 
    initialPos, 
    explodedPos, 
    isExploded, 
    color, 
    shapeType 
}: { 
    initialPos: THREE.Vector3, 
    explodedPos: THREE.Vector3, 
    isExploded: boolean, 
    color: string, 
    shapeType: 'box' | 'sphere' 
}) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const rotationAxis = useMemo(() => new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), []);
    
    useFrame((state, delta) => {
        if (meshRef.current) {
            const target = isExploded ? explodedPos : initialPos;
            meshRef.current.position.lerp(target, delta * 2);
            if (isExploded) {
               meshRef.current.rotateOnAxis(rotationAxis, delta);
            } else {
               meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5 + initialPos.x) * 0.2;
               meshRef.current.rotation.y += delta * 0.2;
            }
        }
    });

    const isMetallic = color === '#FFD700' || color === '#FFFFFF' || color === '#C0C0C0' || color === 'rainbow';
    const metalness = isMetallic ? 0.9 : 0.1;
    const roughness = isMetallic ? 0.2 : 0.8;
    const emissiveInt = isMetallic ? 2.5 : 0.0;

    return (
        <mesh ref={meshRef} position={initialPos}>
            {shapeType === 'box' ? <boxGeometry args={[0.8, 0.8, 0.8]} /> : <sphereGeometry args={[0.5, 16, 16]} />}
            <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={emissiveInt}
                metalness={metalness}
                roughness={roughness}
                toneMapped={!isMetallic}
            />
        </mesh>
    );
};

// -- HELPER: Shape Radius for Wrapping Items --
const getShapeRadiusAtY = (y: number, shape: TreeShape): number => {
    if (shape === 'tree') {
         return Math.max(0, 8 * (1 - (y + 9) / 18));
    }
    if (shape === 'snowman') {
        if (y < -3) { // Bottom
            const dy = y - (-6); return Math.max(0, Math.sqrt(Math.max(0, 4.5*4.5 - dy*dy)));
        } else if (y < 3) { // Middle
             const dy = y - 0; return Math.max(0, Math.sqrt(Math.max(0, 3.5*3.5 - dy*dy)));
        } else { // Head
             const dy = y - 5; return Math.max(0, Math.sqrt(Math.max(0, 2.5*2.5 - dy*dy)));
        }
    }
    if (shape === 'santa') {
        if (y < -4) return 3; // Legs area wrapper
        if (y < 2) return 4.5; // Body wrapper
        if (y < 5) return 2.5; // Head wrapper
        return Math.max(0, 2 * (1 - (y - 5)/3)); // Hat
    }
    if (shape === 'reindeer') {
        if (y < -2) return 2.5; // Legs area
        if (y < 2) return 3.5; // Body
        if (y < 6) return 2; // Neck/Head
        return 3; // Antlers
    }
    return 0;
};

// -- HELPER: Random Point Generators --
const getRandomPointInSphere = (cy: number, r: number) => {
    let safety = 100;
    while(safety-- > 0) {
        const u = Math.random() * 2 - 1;
        const v = Math.random() * 2 - 1;
        const w = Math.random() * 2 - 1;
        if (u*u + v*v + w*w < 1) {
            return new THREE.Vector3(u*r, v*r + cy, w*r);
        }
    }
    return new THREE.Vector3(0, cy, 0); // Fallback
};

const getRandomPointInCylinder = (minY: number, maxY: number, r: number) => {
    const y = minY + Math.random() * (maxY - minY);
    const theta = Math.random() * 2 * Math.PI;
    const rad = r * Math.sqrt(Math.random());
    return new THREE.Vector3(rad * Math.cos(theta), y, rad * Math.sin(theta));
};

export const Tree: React.FC<TreeProps> = ({ photos, onPhotoClick, isExploded, isTwinkling, gestureRotation, foliageColor = '#064e3b', treeStyle, shape }) => {
  const groupRef = useRef<THREE.Group>(null);
  const foliageRef = useRef<THREE.Points>(null);
  
  const height = 18; // Approx -9 to 9
  const radiusBottom = 8;
  const leafCount = treeStyle === 'geometric' ? 400 : (treeStyle === 'crayon' ? 1500 : 5000);
  
  // Create textures for both active and empty states
  const activeTexture = usePolkaDotTexture('#ffffff', ['#ef4444', '#22c55e'], false);
  const emptyTexture = usePolkaDotTexture('#f3f4f6', [], true);

  const circleTexture = useCircleTexture();

  // Determine special modes for enhanced effects
  const isRainbow = foliageColor === 'rainbow';
  const isGold = foliageColor === '#FFD700';
  const isSilver = foliageColor === '#C0C0C0';
  const isMetallicMode = isRainbow || isGold || isSilver;

  // -- 1. Generate Shape Points --
  const { positions, colors, geometricItems } = useMemo(() => {
    const posArray = new Float32Array(leafCount * 3);
    const colArray = new Float32Array(leafCount * 3);
    
    const geoItems: { 
        initialPos: THREE.Vector3, 
        explodedPos: THREE.Vector3, 
        color: string, 
        shapeType: 'box' | 'sphere' 
    }[] = [];
    
    const tempColor = new THREE.Color();

    for (let i = 0; i < leafCount; i++) {
        let x=0, y=0, z=0;
        let colorHex = foliageColor;

        if (shape === 'tree') {
            const h = Math.random() * height;
            const progress = h / height;
            const rMax = (radiusBottom * (1 - progress));
            const r = rMax * Math.sqrt(Math.random()); 
            const theta = Math.random() * 2 * Math.PI;
            x = r * Math.cos(theta);
            y = h - height/2;
            z = r * Math.sin(theta);
            
            if (foliageColor === 'rainbow') {
                tempColor.setHSL(Math.random(), 0.8, 0.5);
                colorHex = '#' + tempColor.getHexString();
            }
        } 
        else if (shape === 'snowman') {
            const rand = Math.random();
            let p = new THREE.Vector3();
            if (rand < 0.4) { // Bottom
                p = getRandomPointInSphere(-6, 4.5);
                colorHex = '#ffffff';
            } else if (rand < 0.75) { // Middle
                p = getRandomPointInSphere(0, 3.5);
                colorHex = '#ffffff';
                if (p.z > 2.5 && Math.abs(p.x) < 1 && Math.random() < 0.1) colorHex = '#ef4444';
            } else if (rand < 0.95) { // Head
                p = getRandomPointInSphere(5, 2.5);
                colorHex = '#ffffff';
                if (p.z > 1.8 && p.y > 5 && Math.abs(p.x) < 1.5 && Math.random() < 0.1) colorHex = '#111111';
                if (p.z > 2 && Math.abs(p.y - 5) < 0.5 && Math.abs(p.x) < 0.5) {
                    p.z += 1; // Pull out
                    colorHex = '#f97316';
                }
            } else { // Hat
                 p = getRandomPointInCylinder(7, 9, 2);
                 colorHex = '#1e293b'; 
                 if (p.y < 7.2) { 
                     p.x *= 1.5; p.z *= 1.5; 
                     colorHex = '#ef4444'; 
                 }
            }
            x = p.x; y = p.y; z = p.z;
        }
        else if (shape === 'santa') {
            const rand = Math.random();
            let p = new THREE.Vector3();
            if (rand < 0.15) { // Boots
                p = getRandomPointInCylinder(-9, -8, 1.5);
                p.x += (Math.random() > 0.5 ? 2 : -2);
                colorHex = '#111111';
            } else if (rand < 0.3) { // Legs
                p = getRandomPointInCylinder(-8, -4, 1.3);
                p.x += (Math.random() > 0.5 ? 2 : -2);
                colorHex = '#ef4444';
            } else if (rand < 0.65) { // Body
                p = getRandomPointInCylinder(-4, 2, 4);
                colorHex = '#ef4444'; 
                if (Math.abs(p.y - (-1)) < 0.5) colorHex = '#111111'; 
                if (p.z > 3.5 && Math.abs(p.x) < 1) colorHex = '#ffffff'; 
            } else if (rand < 0.85) { // Head & Beard
                p = getRandomPointInSphere(3.5, 2.2);
                if (p.z > 1 && p.y < 3.5) colorHex = '#ffffff'; 
                else if (p.z > 1 && p.y >= 3.5) colorHex = '#fca5a5'; 
                else colorHex = '#ffffff'; 
            } else { // Hat
                const h = Math.random() * 4; 
                const r = 2.2 * (1 - h/4);
                const theta = Math.random() * 2 * Math.PI;
                p.set(r*Math.cos(theta), 5.5 + h, r*Math.sin(theta));
                if (h > 2) p.x += (h-2);
                colorHex = h < 1 ? '#ffffff' : '#ef4444';
                if (h > 3.5) colorHex = '#ffffff'; 
            }
            x = p.x; y = p.y; z = p.z;
        }
        else if (shape === 'reindeer') {
             const rand = Math.random();
             let p = new THREE.Vector3();
             if (rand < 0.3) { 
                 const legIdx = Math.floor(Math.random() * 4);
                 const lx = (legIdx % 2 === 0 ? 1.5 : -1.5);
                 const lz = (legIdx < 2 ? 2 : -2);
                 p = getRandomPointInCylinder(-9, -3, 0.8);
                 p.x += lx; p.z += lz;
                 colorHex = p.y < -8 ? '#111111' : '#854d0e';
             } else if (rand < 0.7) { 
                 p = getRandomPointInSphere(-1, 3.5);
                 colorHex = '#854d0e'; 
                 if (p.y < -1 && p.z > 2) colorHex = '#fef3c7'; 
             } else if (rand < 0.9) { 
                 p = getRandomPointInSphere(4, 2.2);
                 p.z += 1.5; 
                 colorHex = '#854d0e';
                 if (p.z > 3 && Math.abs(p.x) < 0.5 && Math.abs(p.y - 4) < 0.5) colorHex = '#ef4444'; 
             } else { 
                 const side = Math.random() > 0.5 ? 1 : -1;
                 const t = Math.random();
                 p.set(side * (0.5 + t * 2), 5.5 + t * 2, 1.5);
                 p.add(new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).multiplyScalar(0.5));
                 colorHex = '#fde68a';
             }
             x = p.x; y = p.y; z = p.z;
        }

        posArray[i * 3] = x;
        posArray[i * 3 + 1] = y;
        posArray[i * 3 + 2] = z;

        tempColor.set(colorHex);
        colArray[i * 3] = tempColor.r;
        colArray[i * 3 + 1] = tempColor.g;
        colArray[i * 3 + 2] = tempColor.b;

        if (treeStyle === 'geometric') {
            const initialPos = new THREE.Vector3(x, y, z);
            const explodedPos = initialPos.clone().normalize().multiplyScalar(15 + Math.random() * 10);
            geoItems.push({
                initialPos,
                explodedPos,
                color: colorHex,
                shapeType: Math.random() > 0.5 ? 'box' : 'sphere'
            });
        }
    }
    return { positions: posArray, colors: colArray, geometricItems: geoItems };
  }, [leafCount, treeStyle, foliageColor, shape]); 

  // -- 2. String Lights --
  const stringLights = useMemo(() => {
      const points = [];
      const lightColors = [];
      const loops = 15;
      const pointsPerLoop = 60;
      const total = loops * pointsPerLoop;
      const palette = [new THREE.Color('#FFD700'), new THREE.Color('#ff0000'), new THREE.Color('#00ff00'), new THREE.Color('#00ffff')];

      for(let i=0; i<total; i++) {
          const t = i / total;
          const h = (t * 18) - 9; 
          const rBase = getShapeRadiusAtY(h, shape);
          if (rBase <= 0.1) continue; 

          const r = rBase + 0.2; 
          const angle = t * loops * Math.PI * 2;
          
          points.push(Math.cos(angle) * r, h, Math.sin(angle) * r);
          
          const col = palette[Math.floor(Math.random() * palette.length)];
          lightColors.push(col.r * 5, col.g * 5, col.b * 5); 
      }
      return { positions: new Float32Array(points), colors: new Float32Array(lightColors) };
  }, [shape]);

  // -- 3. Decorations --
  const decorations = useMemo(() => {
      if (shape !== 'tree') return { baubles: [], gifts: [] }; 
      const baubles = [];
      const gifts = [];
      
      const baublePalette = isSilver 
          ? ['#ef4444', '#C0C0C0', '#3b82f6', '#ffffff'] // Silver palette
          : ['#ef4444', '#FFD700', '#3b82f6'];           // Gold palette

      for (let i = 0; i < 200; i++) {
        const h = Math.random() * height;
        const r = (radiusBottom * (1 - h/height)) * 0.9;
        const theta = Math.random() * 2 * Math.PI;
        const pos: [number,number,number] = [r*Math.cos(theta), h - height/2, r*Math.sin(theta)];
        const scale = 0.2 + Math.random() * 0.3;
        if (Math.random() > 0.3) {
            baubles.push({ position: pos, color: baublePalette[Math.floor(Math.random()*baublePalette.length)], scale });
        } else {
            gifts.push({ position: pos, color: ['#8b5cf6', '#ec4899'][Math.floor(Math.random()*2)], scale, rotation: [Math.random(), Math.random(), 0] as [number,number,number] });
        }
      }
      return { baubles, gifts };
  }, [shape, isSilver]);

  // -- 4. Photos Scattered --
  // CRITICAL FIX: Separate layout generation from photo data to prevent position shuffle on update
  const layout = useMemo(() => {
      const count = photos.length > 0 ? photos.length : 24; // Default count or dynamic
      return Array.from({ length: count }).map((_, i) => {
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const t = i / count;
          
          const h = (t * 14) - 7; 
          const rBase = getShapeRadiusAtY(h, shape);
          const r = rBase + 0.8;
          
          const theta = i * goldenAngle * 10; 
          const x = r * Math.cos(theta);
          const y = h;
          const z = r * Math.sin(theta);

          const position = new THREE.Vector3(x, y, z);
          
          const dummy = new THREE.Object3D();
          dummy.position.copy(position);
          dummy.lookAt(0, y, 0); 
          dummy.rotateY(Math.PI); 

          const rotation = dummy.rotation.clone();
          const explodedPosition = position.clone().normalize().multiplyScalar(10 + Math.random() * 8);
          explodedPosition.y += (Math.random() - 0.5) * 10; 
          
          return { initialPos: position, explodedPos: explodedPosition, initialRot: rotation };
      });
  }, [photos.length, shape]);

  // Merge stable layout with photo data
  const photoItems = useMemo(() => {
      return photos.map((photo, i) => {
          const itemLayout = layout[i] || layout[0]; // Fallback safe
          return {
              ...itemLayout,
              ref: React.createRef<THREE.Group>(),
              photo
          };
      });
  }, [photos, layout]);

  useFrame((state, delta) => {
    // 1. Rotate Tree with Gesture
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05 + (gestureRotation * 0.05);
    }

    const lerpFactor = delta * 2; 
    
    if (foliageRef.current) {
        const targetScale = isExploded ? 4 : 1;
        foliageRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
    }

    photoItems.forEach(item => {
        if (item.ref.current) {
            const targetPos = isExploded ? item.explodedPos : item.initialPos;
            item.ref.current.position.lerp(targetPos, lerpFactor);
            const targetScale = isExploded ? 4.5 : 1;
            item.ref.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);
            if (isExploded) {
                item.ref.current.rotation.x += delta * 0.2;
                item.ref.current.rotation.y += delta * 0.2;
            } else {
                item.ref.current.rotation.x = THREE.MathUtils.lerp(item.ref.current.rotation.x, item.initialRot.x, lerpFactor);
                item.ref.current.rotation.y = THREE.MathUtils.lerp(item.ref.current.rotation.y, item.initialRot.y, lerpFactor);
                item.ref.current.rotation.z = THREE.MathUtils.lerp(item.ref.current.rotation.z, item.initialRot.z, lerpFactor);
            }
        }
    });
  });

  // Derived Sparkle Properties for "Flashing" effect
  const sparkleColor = useMemo(() => {
      if (isRainbow) return '#ffffff';
      if (isGold) return '#FFD700';
      if (isSilver) return '#FFFFFF';
      return '#FFD700'; // Default Green gets Gold sparkles
  }, [isRainbow, isGold, isSilver]);

  const sparkleCount = useMemo(() => {
      let base = 60; // Reduced from 200
      if (isTwinkling) base += 150; // Reduced from 400
      if (isMetallicMode) base += 100; // Reduced from 500
      return base;
  }, [isTwinkling, isMetallicMode]);

  const sparkleSize = useMemo(() => {
    let base = 4; // Reduced from 6
    if (isTwinkling) base = 10; // Reduced from 15
    if (isMetallicMode) base = 8; // Reduced from 12
    return base;
  }, [isTwinkling, isMetallicMode]);

  // Top Star Color Logic
  const starColor = isSilver ? '#C0C0C0' : '#FFD700';

  return (
    <group ref={groupRef}>
      {treeStyle === 'geometric' && (
         <group>
             {geometricItems.map((item, i) => (
                 <GeometricBlock key={i} {...item} isExploded={isExploded} />
             ))}
         </group>
      )}

      {treeStyle !== 'geometric' && (
        <points ref={foliageRef} key={`${shape}-${foliageColor}`}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={leafCount} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={leafCount} array={colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial 
                transparent 
                vertexColors 
                size={treeStyle === 'crayon' ? 0.8 : 0.3} 
                sizeAttenuation={true} 
                opacity={treeStyle === 'crayon' ? 1.0 : (isMetallicMode ? 1.0 : 0.9)} 
                map={circleTexture}
                alphaTest={0.01}
                depthWrite={false}
                toneMapped={false}
                // Boost brightness for metallic modes
                emissive={isGold ? '#FFD700' : (isSilver ? '#AAAAAA' : '#000000')}
                emissiveIntensity={isMetallicMode ? 2 : 0}
            />
        </points>
      )}

      {/* Lights & Sparkles */}
      <group visible={!isExploded}>
        {/* String Lights - Hidden in metallic modes to emphasize the main glitter */}
        {!isMetallicMode && (
            <points>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={stringLights.positions.length / 3} array={stringLights.positions} itemSize={3} />
                    <bufferAttribute attach="attributes-color" count={stringLights.colors.length / 3} array={stringLights.colors} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial 
                    vertexColors 
                    size={isTwinkling ? 0.4 : 0.25} 
                    sizeAttenuation 
                    transparent 
                    opacity={1} 
                    toneMapped={false}
                    map={circleTexture}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </points>
        )}
        
        <Sparkles 
            count={sparkleCount} 
            scale={isTwinkling || isMetallicMode ? [15, 22, 15] : [10, 18, 10]} 
            size={sparkleSize} 
            speed={isTwinkling || isMetallicMode ? 2 : 0.8} 
            opacity={1}
            color={sparkleColor}
            noise={0.5}
        />
        <pointLight position={[0,0,0]} intensity={isTwinkling || isMetallicMode ? 3 : 1} distance={15} color={sparkleColor} />
      </group>

      <group visible={!isExploded}>
        {decorations.baubles.map((d, i) => <Bauble key={`b-${i}`} {...d} />)}
        {decorations.gifts.map((d, i) => <GiftBox key={`g-${i}`} {...d} ribbonColor={isSilver ? '#C0C0C0' : '#FFD700'} />)}
      </group>

      {photoItems.map((item) => (
         <group key={item.photo.id} ref={item.ref} position={item.initialPos} rotation={item.initialRot}>
             <Float rotationIntensity={isExploded ? 0 : 0.1} floatIntensity={isExploded ? 0 : 0.2} speed={2}>
                <PolaroidFrame 
                    // Add version to key to FORCE texture reload if URL changes but key was same
                    url={item.photo.url} 
                    texture={item.photo.isEmpty ? emptyTexture : activeTexture}
                    onClick={(e) => { e.stopPropagation(); onPhotoClick(item.photo); }} 
                    isEmpty={item.photo.isEmpty}
                />
             </Float>
         </group>
      ))}

      {/* Top Star (only for tree) */}
      {shape === 'tree' && (
        <group visible={!isExploded} position={[0, height/2 + 0.5, 0]}>
            <mesh>
                <octahedronGeometry args={[1, 0]} />
                <meshBasicMaterial color={starColor} toneMapped={false} />
            </mesh>
            <pointLight color={starColor} intensity={isTwinkling ? 5 : 2} distance={15} />
            <Sparkles count={isTwinkling ? 100 : 40} scale={4} size={isTwinkling ? 15 : 8} speed={0.4} opacity={1} color={starColor} />
        </group>
      )}
    </group>
  );
};
