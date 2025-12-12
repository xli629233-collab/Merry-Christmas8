import React, { useRef, useMemo, useEffect } from 'react';
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

// -- NEW: Instanced Diamonds --
const Diamonds = ({ shape }: { shape: TreeShape }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 150;
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const diamondsData = useMemo(() => {
        if (shape !== 'diamond') return [];
        const data = [];
        const height = 18;
        for(let i=0; i<count; i++) {
            const h = (Math.random() * height) - (height/2);
            const progress = (h + 9) / 18;
            const rBase = Math.max(0, 9 * (1 - progress));
            // Scatter on surface
            const r = rBase * (0.9 + Math.random() * 0.2); 
            const theta = Math.random() * Math.PI * 2;
            
            data.push({
                position: new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta)),
                scale: 0.5 + Math.random() * 0.4,
                rotation: [Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI]
            });
        }
        return data;
    }, [shape]);

    useEffect(() => {
        if (!meshRef.current || diamondsData.length === 0) return;
        diamondsData.forEach((data, i) => {
            dummy.position.copy(data.position);
            dummy.scale.setScalar(data.scale);
            dummy.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [diamondsData, dummy]);

    if (shape !== 'diamond') return null;

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <octahedronGeometry args={[0.8, 0]} />
            <meshPhysicalMaterial 
                color="#e0f2fe"
                transmission={1.0}
                opacity={1}
                metalness={0.0}
                roughness={0.0}
                ior={2.4} // Diamond IOR
                thickness={1.5}
                specularIntensity={1}
                envMapIntensity={2.0}
            />
        </instancedMesh>
    );
};

// -- NEW: Pearls Component (Updated: Draped Garlands) --
const Pearls = ({ shape }: { shape: TreeShape }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pearlsData = useMemo(() => {
     if (shape !== 'diamond') return [];
     
     const data = [];
     
     // Config for Draped Garlands
     // Lower density: Single strand, fewer loops
     const strands = 1; 
     const loops = 6;  
     const pearlsPerLoop = 200; // Continuous look
     const totalPerStrand = loops * pearlsPerLoop;
     const height = 18;
     
     for(let s = 0; s < strands; s++) {
         const strandOffset = (s * Math.PI * 2) / strands;

         for(let i = 0; i < totalPerStrand; i++) {
            const t = i / totalPerStrand;
            
            // Base linear spiral downwards
            // hBase goes from 9 to -9
            const hBase = (height / 2) - (t * height); 
            
            // Cone Radius at this height
            const progress = (hBase + (height/2)) / height; // 0 to 1
            const rCone = Math.max(0.2, 9 * (1 - progress)); 
            
            // Spiral Angle
            const angle = (t * loops * Math.PI * 2) + strandOffset;
            
            // -- DRAPING LOGIC --
            // Higher frequency for "shorter" draped segments
            const drapeFreq = 12; 
            const drapePhase = (Math.sin(angle * drapeFreq) + 1) / 2;
            
            const rOffset = (1 - drapePhase) * 0.5; // Bulge out
            const hOffset = (1 - drapePhase) * 0.8; // Drop down
            
            const r = rCone + rOffset + 0.2; 
            const h = hBase - hOffset;
            
            // Jitter for natural look
            const jitterX = (Math.random() - 0.5) * 0.05;
            const jitterY = (Math.random() - 0.5) * 0.05;
            const jitterZ = (Math.random() - 0.5) * 0.05;
            
            // Smaller pearls
            const scale = 0.1 + Math.random() * 0.1; 

            data.push({
                position: new THREE.Vector3(
                    r * Math.cos(angle) + jitterX, 
                    h + jitterY, 
                    r * Math.sin(angle) + jitterZ
                ),
                scale: scale
            });
         }
     }
     return data;
  }, [shape]);

  useEffect(() => {
     if (!meshRef.current || pearlsData.length === 0) return;
     
     pearlsData.forEach((data, i) => {
         dummy.position.copy(data.position);
         dummy.scale.setScalar(data.scale);
         dummy.updateMatrix();
         meshRef.current!.setMatrixAt(i, dummy.matrix);
     });
     meshRef.current.instanceMatrix.needsUpdate = true;
  }, [pearlsData, dummy]);

  if (shape !== 'diamond') return null;

  // Ensure count is sufficient for the generated data
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, pearlsData.length]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial 
            color="#f8fafc" 
            emissive="#ffffff"
            emissiveIntensity={0.25} // Low emissive to prevent overexposure
            roughness={0.2} 
            metalness={0.3} 
            clearcoat={1.0} 
            clearcoatRoughness={0.1}
            envMapIntensity={2.0} 
        />
    </instancedMesh>
  )
}

// -- TWIN TOWERS REFACTOR: Dual Rotated Prism & High Contrast Materials --
const TwinTowers = () => {
    // 1. Geometries
    // Square Cylinder (4 segments) creates the base for the prism
    const squareGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 4, 1, false), []);
    // Smooth cylinder for spires
    const smoothGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 64, 1), []);
    // Spire cone
    const spireGeo = useMemo(() => new THREE.ConeGeometry(1, 4, 32), []);
    // Ring details
    const ringGeo = useMemo(() => new THREE.TorusGeometry(1, 0.025, 4, 64), []);

    // 2. Materials
    
    // High Contrast Silver Edge (Mullions & Outlines)
    const edgeMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff', // Glows slightly to stand out
        emissiveIntensity: 0.2,
        roughness: 0.1,
        metalness: 1.0,
        envMapIntensity: 2.0,
        toneMapped: false // Ensure bright whites don't get clamped
    }), []);

    // Green Body Material (Emissive Emerald)
    const greenBodyMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#059669', // Emerald 600
        emissive: '#047857', // Self-illuminated look
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.3,
        toneMapped: false
    }), []);

    // Red Body Material (Emissive Ruby)
    const redBodyMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#dc2626', // Red 600
        emissive: '#b91c1c',
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.3,
        toneMapped: false
    }), []);

    // 3. Helper: Detailed Tower Tier (8-Pointed Star Construction)
    const Tier = ({ y, h, r, isRed }: { y: number, h: number, r: number, isRed?: boolean }) => {
        const bodyMat = isRed ? redBodyMat : greenBodyMat;
        // Corner positions for Cylinder with 4 segments (radius 1)
        // Normal (Rot 0): corners at (1,0,0), (0,0,1)... 
        // Rotated (Rot 45): corners at diagonals (0.707, 0, 0.707)...
        // We place "Mullions" (strips) at these calculated positions relative to center.
        
        return (
            <group>
                {/* Main Body: Dual Intersecting Squares = 8 Pointed Star */}
                <group position={[0, y + h/2, 0]}>
                    {/* Square 1: Rotated 45 degrees */}
                    <mesh geometry={squareGeo} material={bodyMat} scale={[r, h, r]} rotation={[0, Math.PI/4, 0]} />
                    
                    {/* Square 2: Aligned to Axes */}
                    <mesh geometry={squareGeo} material={bodyMat} scale={[r, h, r]} rotation={[0, 0, 0]} />
                    
                    {/* -- Vertical Metallic Mullions (Edges) -- */}
                    
                    {/* Set 1: At the corners of the Rotated Square (Diagonals) */}
                    {/* r * 0.707 is the x/z distance for 45 deg angle */}
                    {[45, 135, 225, 315].map((deg) => {
                         const rad = deg * Math.PI / 180;
                         // The corners of the rotated square are effectively on the axes if the mesh is rotated 45.
                         // But here we place independent vertical strips.
                         // The mesh "Rotated 45" has corners at X/Z axes? No, Cylinder(4) starts at X=radius.
                         // So Cylinder rotated 45 has corners at 45, 135...
                         // We place strips at these angles.
                         const x = Math.cos(rad) * r;
                         const z = Math.sin(rad) * r;
                         return (
                             <mesh key={`c1-${deg}`} position={[x, 0, z]} scale={[0.08, h, 0.08]}>
                                 <boxGeometry />
                                 <mesh material={edgeMat} />
                             </mesh>
                         );
                    })}

                    {/* Set 2: At the corners of the Normal Square (Axes) */}
                    {[0, 90, 180, 270].map((deg) => {
                         const rad = deg * Math.PI / 180;
                         const x = Math.cos(rad) * r;
                         const z = Math.sin(rad) * r;
                         return (
                             <mesh key={`c2-${deg}`} position={[x, 0, z]} scale={[0.08, h, 0.08]}>
                                 <boxGeometry />
                                 <mesh material={edgeMat} />
                             </mesh>
                         );
                    })}
                </group>

                {/* Decorative Horizontal Ring between tiers */}
                <group position={[0, y + h, 0]} rotation={[Math.PI/2, 0, 0]}>
                     <mesh geometry={ringGeo} material={edgeMat} scale={[r * 1.05, r * 1.05, 1]} />
                </group>
                
                {/* Internal Glow Light */}
                <pointLight position={[0, y + h/2, 0]} color={isRed ? '#ff4444' : '#44ffaa'} distance={h * 3} intensity={0.8} decay={2} />
            </group>
        );
    };

    // 4. Helper: Detailed Spire
    const Spire = ({ y }: { y: number }) => (
        <group position={[0, y, 0]}>
            {/* Base of Spire - Silver */}
            <mesh geometry={smoothGeo} material={edgeMat} scale={[0.8, 2, 0.8]} position={[0, 1, 0]} />
            
            {/* The Needle - Silver */}
            <mesh geometry={spireGeo} material={edgeMat} scale={[0.15, 4, 0.15]} position={[0, 3, 0]} />
            
            {/* Finial Beacon */}
            <mesh position={[0, 5, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
                <pointLight color="#ffffff" intensity={5} distance={20} decay={2} />
            </mesh>
        </group>
    );

    // 5. Structure: Single Tower
    const SingleTower = () => (
        <group>
             <Tier y={0} h={14} r={2.2} />          {/* Base - Green */}
             <Tier y={14} h={5} r={2.0} />          {/* Tier 1 - Green */}
             <Tier y={19} h={4} r={1.7} isRed />    {/* Tier 2 - RED */}
             <Tier y={23} h={3} r={1.4} />          {/* Tier 3 - Green */}
             <Tier y={26} h={2} r={1.0} isRed />    {/* Tier 4 - RED */}
             <Spire y={28} />                       {/* Spire */}
        </group>
    );

    return (
        <group position={[0, -14, -8]} scale={[1.15, 1.15, 1.15]}>
            {/* Left Tower */}
            <group position={[-3.2, 0, 0]}>
                <SingleTower />
            </group>

            {/* Right Tower */}
            <group position={[3.2, 0, 0]}>
                <SingleTower />
            </group>

            {/* Skybridge (Floor 41/42) */}
            <group position={[0, 12.5, 0]}>
                {/* Double Deck Bridge - Silver */}
                <mesh material={edgeMat} position={[0, -0.2, 0]}>
                    <boxGeometry args={[6.4, 0.5, 0.8]} />
                </mesh>
                <mesh material={edgeMat} position={[0, 0.6, 0]}>
                    <boxGeometry args={[6.4, 0.4, 0.6]} />
                </mesh>
                
                {/* Bright White Light Strip on Bridge */}
                <mesh position={[0, 0.2, 0.41]}>
                    <boxGeometry args={[6.4, 0.15, 0.05]} />
                    <meshBasicMaterial color="#ffffff" toneMapped={false} />
                </mesh>
                 <pointLight position={[0, 0.2, 1]} color="#ffffff" intensity={2} distance={5} />

                {/* V-Leg Supports */}
                <group position={[0, -4.5, 0]}>
                    <mesh material={edgeMat} position={[0, 4.2, 0]}>
                        <sphereGeometry args={[0.5]} />
                    </mesh>
                    <mesh material={edgeMat} position={[-1.6, 2.0, 0]} rotation={[0, 0, -0.6]}>
                        <cylinderGeometry args={[0.15, 0.15, 5.5, 16]} />
                    </mesh>
                    <mesh material={edgeMat} position={[1.6, 2.0, 0]} rotation={[0, 0, 0.6]}>
                        <cylinderGeometry args={[0.15, 0.15, 5.5, 16]} />
                    </mesh>
                </group>
            </group>
        </group>
    )
}

// -- NEW: Crystal Core --
const CrystalCore = () => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if(groupRef.current) {
            groupRef.current.rotation.y += delta * 0.1;
        }
    });

    return (
        <group ref={groupRef} position={[0, 0, 0]}>
             <mesh position={[0, 0, 0]}>
                 <cylinderGeometry args={[0.5, 2, 14, 6]} />
                 <meshPhysicalMaterial 
                    color="#e0f2fe"
                    transmission={0.9}
                    opacity={1}
                    metalness={0.1}
                    roughness={0}
                    ior={1.5}
                    thickness={2}
                    specularIntensity={1}
                 />
             </mesh>
             <pointLight color="#0ea5e9" intensity={5} distance={10} />
        </group>
    );
};

// -- NEW: Floating Diamond Topper --
const DiamondTopper = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.elapsedTime;
            // Float higher above the tip and bob up and down
            meshRef.current.position.y = 2.0 + Math.sin(t * 1.5) * 0.3; 
            // Gentle Rotation
            meshRef.current.rotation.y = t * 0.5;
            meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
        }
    });

    return (
        <mesh ref={meshRef}>
            <octahedronGeometry args={[1.4, 0]} />
            <meshPhysicalMaterial 
                color="#ffffff" 
                emissive="#e0f2fe"
                emissiveIntensity={0.8} // Significantly reduced to prevent overexposure
                transmission={0.9} // Glassy look
                roughness={0}
                metalness={0.1}
                thickness={3.0}
                ior={2.4}
                toneMapped={false} 
            />
        </mesh>
    );
};

// -- NEW: Flower Component --
const Flower = ({ color, position, scale, rotation }: { color: string, position: [number,number,number], scale: number, rotation?: [number,number,number] }) => {
    const groupRef = useRef<THREE.Group>(null);
    const phase = useMemo(() => Math.random() * 100, []);
    const isWhite = color === '#ffffff';
    const petalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: isWhite ? 0.8 : 0.6,
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide,
        toneMapped: false
    }), [color, isWhite]);
    const centerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 0.8, roughness: 0.8, toneMapped: false
    }), []);

    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime + phase;
        const breathe = Math.sin(t * 1.5) * 0.05;
        groupRef.current.scale.setScalar(scale * (1 + breathe));
        if (rotation) groupRef.current.rotation.z = rotation[2] + Math.sin(t) * 0.05;
    });

    return (
        <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
            <mesh position={[0, 0, 0.15]} material={centerMaterial}><sphereGeometry args={[0.2, 12, 12]} /></mesh>
            {Array.from({ length: 5 }).map((_, i) => (
                <group key={i} rotation={[0, 0, (i / 5) * Math.PI * 2]}>
                    <mesh position={[0, 0.45, 0.05]} rotation={[0.2, 0, 0]} scale={[0.35, 0.5, 0.1]} material={petalMaterial}>
                        <sphereGeometry args={[1, 16, 16]} />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

// -- Polaroid Frame Component --
const PolaroidFrame = ({ url, onClick, opacity = 1, texture, isEmpty }: { url: string, onClick: (e: any) => void, opacity?: number, texture: THREE.Texture, isEmpty: boolean }) => {
    return (
        <group onClick={onClick} onPointerOver={() => document.body.style.cursor = 'pointer'} onPointerOut={() => document.body.style.cursor = 'auto'}>
            <mesh position={[0, -0.2, -0.01]}>
                <boxGeometry args={[1.4, 1.8, 0.05]} />
                <meshStandardMaterial map={texture} roughness={0.8} transparent opacity={opacity} />
            </mesh>
            {!isEmpty && (
                <Image key={url} url={url} position={[0, 0.1, 0.02]} scale={[1.2, 1.2]} toneMapped={false} transparent opacity={opacity} />
            )}
            <mesh position={[0, 0.1, 0.03]}><planeGeometry args={[1.2, 1.2]} /><meshPhysicalMaterial transparent opacity={0.1 * opacity} roughness={0.0} clearcoat={1.0} /></mesh>
        </group>
    );
};

// -- Geometric Leaf Component --
const GeometricBlock = ({ initialPos, explodedPos, isExploded, color, shapeType }: { initialPos: THREE.Vector3, explodedPos: THREE.Vector3, isExploded: boolean, color: string, shapeType: 'box' | 'sphere' }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const rotationAxis = useMemo(() => new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), []);
    useFrame((state, delta) => {
        if (meshRef.current) {
            const target = isExploded ? explodedPos : initialPos;
            meshRef.current.position.lerp(target, delta * 2);
            if (isExploded) { meshRef.current.rotateOnAxis(rotationAxis, delta); } 
            else { meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5 + initialPos.x) * 0.2; meshRef.current.rotation.y += delta * 0.2; }
        }
    });
    const isMetallic = color === '#FFD700' || color === '#FFFFFF' || color === '#C0C0C0' || color === 'rainbow';
    return (
        <mesh ref={meshRef} position={initialPos}>
            {shapeType === 'box' ? <boxGeometry args={[0.8, 0.8, 0.8]} /> : <sphereGeometry args={[0.5, 16, 16]} />}
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isMetallic ? 2.5 : 0.0} metalness={isMetallic ? 0.9 : 0.1} roughness={isMetallic ? 0.2 : 0.8} toneMapped={!isMetallic} />
        </mesh>
    );
};

// -- Geometric Decoration Component --
const GeometricDecoration = ({ position, scale, type }: { position: [number, number, number], scale: number, type: 'box' | 'octahedron' }) => {
    return (
        <mesh position={position} scale={scale}>
            {type === 'box' ? <boxGeometry args={[1, 1, 1]} /> : <octahedronGeometry args={[1, 0]} />}
            <meshStandardMaterial color="#f1f5f9" metalness={0.1} roughness={0.1} />
        </mesh>
    );
};

// -- HELPER: Shape Radius for Wrapping Items --
const getShapeRadiusAtY = (y: number, shape: TreeShape): number => {
    if (shape === 'tree' || shape === 'real_tree' || shape === 'diamond' || shape === 'twin_towers') {
         return Math.max(0, 9 * (1 - (y + 9) / 18));
    }
    if (shape === 'snowman') {
        if (y < -3) { const dy = y - (-6); return Math.max(0, Math.sqrt(Math.max(0, 4.5*4.5 - dy*dy))); } 
        else if (y < 3) { const dy = y - 0; return Math.max(0, Math.sqrt(Math.max(0, 3.5*3.5 - dy*dy))); } 
        else { const dy = y - 5; return Math.max(0, Math.sqrt(Math.max(0, 2.5*2.5 - dy*dy))); }
    }
    if (shape === 'santa') {
        if (y < -2) return 5; if (y < 4) return 4; return 3;
    }
    if (shape === 'reindeer') {
        if (y < -2) return 3; if (y < 4) return 3.5; return 4;
    }
    return 0;
};

// -- HELPER: Random Point Generators --
const getRandomPointInSphere = (cy: number, r: number) => {
    let safety = 100;
    while(safety-- > 0) {
        const u = Math.random() * 2 - 1; const v = Math.random() * 2 - 1; const w = Math.random() * 2 - 1;
        if (u*u + v*v + w*w < 1) return new THREE.Vector3(u*r, v*r + cy, w*r);
    }
    return new THREE.Vector3(0, cy, 0);
};

const lerp3 = (v1: THREE.Vector3, v2: THREE.Vector3, t: number) => {
    return new THREE.Vector3().lerpVectors(v1, v2, t);
};

export const Tree: React.FC<TreeProps> = ({ photos, onPhotoClick, isExploded, isTwinkling, gestureRotation, foliageColor = '#064e3b', treeStyle, shape }) => {
  const groupRef = useRef<THREE.Group>(null);
  const foliageRef = useRef<THREE.Points>(null);
  
  const height = 18; // Approx -9 to 9
  const radiusBottom = 8;
  const leafCount = treeStyle === 'geometric' ? 400 : (treeStyle === 'crayon' ? 1500 : 5000);
  
  const activeTexture = usePolkaDotTexture('#ffffff', ['#ef4444', '#22c55e'], false);
  const emptyTexture = usePolkaDotTexture('#f3f4f6', [], true);
  // Red background, Green dots
  const redTexture = usePolkaDotTexture('#ef4444', ['#22c55e', '#ffffff'], false);
  // Green background, Red dots
  const greenTexture = usePolkaDotTexture('#22c55e', ['#ef4444', '#ffffff'], false);

  // Sakura Textures
  const sakuraLightTexture = usePolkaDotTexture('#fce7f3', ['#db2777', '#ffffff'], false); 
  const sakuraDarkTexture = usePolkaDotTexture('#f472b6', ['#ffe4e6', '#ffffff'], false);

  const circleTexture = useCircleTexture();

  const isRainbow = foliageColor === 'rainbow';
  const isGold = foliageColor === '#FFD700';
  const isSilver = foliageColor === '#C0C0C0';
  const isMetallicMode = isRainbow || isGold || isSilver;

  // -- 1. Generate Shape Points --
  const { positions, colors, geometricItems } = useMemo(() => {
    // Increase particle density significantly for "Hollow" shapes (Tree, Snowman, Reindeer)
    const isHighDensity = shape === 'real_tree' || shape === 'diamond' || shape === 'tree' || shape === 'snowman' || shape === 'reindeer';
    
    // Base count logic: Geometric is low poly, others are high particle count
    const baseCount = treeStyle === 'geometric' ? 1000 : 12000; 
    
    let effectiveLeafCount = isHighDensity ? 15000 : leafCount;

    // Custom Adjustment: Reduce particle count for Diamond to avoid overcrowding
    if (shape === 'diamond') {
        effectiveLeafCount = 8000;
    }
    
    const posArray = new Float32Array(effectiveLeafCount * 3);
    const colArray = new Float32Array(effectiveLeafCount * 3);
    
    const geoItems: { initialPos: THREE.Vector3, explodedPos: THREE.Vector3, color: string, shapeType: 'box' | 'sphere' }[] = [];
    const tempColor = new THREE.Color();

    for (let i = 0; i < effectiveLeafCount; i++) {
        let x=0, y=0, z=0;
        let colorHex = foliageColor;

        if (shape === 'tree' || shape === 'twin_towers') {
            const h = Math.random() * height;
            const progress = h / height;
            const rMax = (radiusBottom * (1 - progress));
            
            // IMPROVED FILL LOGIC:
            // Combine linear random (dense core) and sqrt random (uniform disk) 
            // to eliminate the "Hollow" look.
            const rMode = Math.random();
            let r;
            
            if (rMode < 0.4) {
                 // 40% particles: Inner Core Filler (Linear distribution = dense center)
                 // Keeping them within 50% of the radius
                 r = rMax * Math.random() * 0.5;
            } else {
                 // 60% particles: Volumetric Body (Sqrt distribution = uniform coverage)
                 r = rMax * Math.sqrt(Math.random()); 
            }

            const theta = Math.random() * 2 * Math.PI;
            x = r * Math.cos(theta); y = h - height/2; z = r * Math.sin(theta);
            
            if (foliageColor === 'rainbow') {
                tempColor.setHSL(Math.random(), 0.8, 0.5);
                colorHex = '#' + tempColor.getHexString();
            }
        } 
        else if (shape === 'diamond') {
            // Diamond Tree: Surface Shell for Solid Crystal Look
            const h = Math.random() * height;
            const yPos = h - height/2;
            const rMax = Math.max(0, radiusBottom * (1 - h/height));
            
            const isSurface = Math.random() > 0.1;
            const dist = isSurface ? (0.95 + Math.random() * 0.05) : Math.pow(Math.random(), 0.5);
            
            const r = rMax * dist;
            const theta = Math.random() * 2 * Math.PI;
            
            x = r * Math.cos(theta);
            y = yPos;
            z = r * Math.sin(theta);

            // Palette: Diamond Dust (White, Silver)
            const val = Math.random();
            if (val > 0.8) colorHex = '#ffffff';      // Sparkle White
            else if (val > 0.6) colorHex = '#f8fafc'; // Slate 50
            else if (val > 0.4) colorHex = '#cbd5e1'; // Slate 300
            else colorHex = '#94a3b8';                // Slate 400
        }
        else if (shape === 'real_tree') {
             // Realistic Pink Tree
             const layers = 30;
             const layerIndex = Math.floor(i / (effectiveLeafCount / layers));
             const t = layerIndex / (layers - 1);
             const yLayer = -9 + t * 18;
             const rMax = radiusBottom * (1 - t) + 1.0;
             const branchCount = Math.floor(6 + (1-t) * 8);
             const branchIdx = Math.floor(Math.random() * branchCount);
             const angleStep = (Math.PI * 2) / branchCount;
             let angle = branchIdx * angleStep + (layerIndex * 0.4);
             angle += (Math.random() - 0.5) * 0.4;
             const rRand = Math.random();
             const r = rMax * Math.sqrt(rRand);
             const spread = 0.5 * (1 - t);
             x = r * Math.cos(angle) + (Math.random() - 0.5) * spread;
             z = r * Math.sin(angle) + (Math.random() - 0.5) * spread;
             const droop = (r / rMax) * 1.5 * (1 - t * 0.5);
             y = yLayer - droop + (Math.random() - 0.5) * 0.5;

             const distRatio = r / rMax;
             if (distRatio > 0.95 || y > 8) colorHex = '#ffffff'; 
             else if (distRatio > 0.85) colorHex = '#fbcfe8'; 
             else if (distRatio > 0.5) colorHex = '#ec4899'; 
             else colorHex = '#be185d'; 
        }
        else if (shape === 'snowman') {
            const rand = Math.random();
            let p = new THREE.Vector3();
            // Snowman body parts using random points in sphere (Solid Volume)
            if (rand < 0.35) { p = getRandomPointInSphere(-6, 4.5); colorHex = '#ffffff'; } 
            else if (rand < 0.65) { 
                p = getRandomPointInSphere(0, 3.5); colorHex = '#ffffff';
                if (p.z > 2.8 && Math.abs(p.x) < 0.6) { if (Math.abs(p.y - 1.5) < 0.4 || Math.abs(p.y - (-0.5)) < 0.4 || Math.abs(p.y - (-2.5)) < 0.4) { colorHex = '#ef4444'; p.z += 0.2; } }
            } 
            else if (rand < 0.72) { 
                const theta = Math.random() * 2 * Math.PI; const r = 2.6 + Math.random() * 0.8; const y = 2.5 + Math.random() * 1.5;
                p.set(r * Math.cos(theta), y, r * Math.sin(theta));
                if (Math.random() < 0.25 && p.z > 0.5) { p.x = 1.8 + Math.random() * 0.8; p.y = 2.0 - Math.random() * 3.5; p.z = 2.0 + Math.random() * 0.5; }
                colorHex = '#16a34a'; 
            }
            else if (rand < 0.90) { 
                p = getRandomPointInSphere(5, 2.5); colorHex = '#ffffff';
                const isFront = p.z > 1.8;
                if (isFront && p.y > 5.5 && Math.abs(p.x) > 0.6 && Math.abs(p.x) < 1.2) { colorHex = '#111111'; p.z += 0.1; }
                if (isFront && Math.abs(p.x) < 0.5 && Math.abs(p.y - 5.0) < 0.5) { const distFromCenter = Math.sqrt(p.x*p.x + (p.y-5)*(p.y-5)); const protrusion = (0.5 - distFromCenter) * 4; p.z += Math.max(0, protrusion); colorHex = '#f97316'; }
                if (isFront && p.y < 5.2 && Math.abs(p.x) > 1.2 && Math.abs(p.x) < 1.8) { colorHex = '#fbcfe8'; }
            } 
            else { 
                const hatRand = Math.random();
                if (hatRand < 0.3) { const theta = Math.random() * 2 * Math.PI; const r = 2.4 + Math.random() * 0.4; const y = 7.0 + Math.random() * 0.8; p.set(r * Math.cos(theta), y, r * Math.sin(theta)); colorHex = '#ffffff'; } 
                else if (hatRand < 0.9) { const h = Math.random(); const y = 7.5 + h * 4; const r = 2.2 * (1 - h); const theta = Math.random() * 2 * Math.PI; const tilt = h * 1.5; p.set(r * Math.cos(theta) + tilt, y, r * Math.sin(theta)); colorHex = '#ef4444'; } 
                else { p = getRandomPointInSphere(11.5, 0.6); p.x += 1.5; colorHex = '#ffffff'; }
            }
            x = p.x; y = p.y; z = p.z;
        }
        else if (shape === 'santa') {
             // Compressed Santa Logic
            const rand = Math.random();
            let p = new THREE.Vector3();
            if (rand < 0.10) { const side = Math.random() > 0.5 ? 1.8 : -1.8; const t = Math.random(); const z = -6 + t * 12; let y = -4.0; if (z > 2) { y += Math.pow((z - 2)/2, 2) * 1.5; } p.set(side, y, z); colorHex = '#FFD700'; }
            else if (rand < 0.35) { const x = (Math.random() - 0.5) * 3.2; const z = -4 + Math.random() * 7; let yMin = -3.5; let yMax = -1.0; if (Math.abs(x) > 1.4) yMax += 0.5; if (z > 2 || z < -3) yMax += 0.8; const y = yMin + Math.random() * (yMax - yMin); p.set(x, y, z); colorHex = '#ef4444'; if (y > yMax - 0.2) colorHex = '#FFD700'; }
            else if (rand < 0.55) { p = getRandomPointInSphere(0, 2.5); p.z -= 3.0; p.y += 0.5; colorHex = Math.random() > 0.5 ? '#7f1d1d' : '#92400e'; }
            else if (rand < 0.80) { const part = Math.random(); if (part < 0.4) { const isLeft = Math.random() > 0.5; const legOffset = isLeft ? 0.6 : -0.6; const t = Math.random(); const start = new THREE.Vector3(legOffset, -0.5, 0.5); const end = new THREE.Vector3(legOffset, -1.5, 3.0); p = new THREE.Vector3().lerpVectors(start, end, t); const theta = Math.random() * 2 * Math.PI; const r = 0.5 * Math.sqrt(Math.random()); p.x += r * Math.cos(theta); p.y += r * Math.sin(theta); colorHex = '#ef4444'; if (t > 0.8) colorHex = '#111111'; } else { p = getRandomPointInSphere(1.0, 1.6); p.z += 0.5; if (p.z < 0) p.z *= 0.5; colorHex = '#ef4444'; if (p.z > 1.5 && Math.abs(p.x) < 0.4) colorHex = '#ffffff'; if (p.z > 0.8 && Math.abs(p.y - 0.2) < 0.3) colorHex = '#111111'; } }
            else if (rand < 0.95) { p = getRandomPointInSphere(3.2, 0.9); p.z += 0.5; colorHex = '#fca5a5'; if (p.z > 0.9 && p.y < 3.2) colorHex = '#ffffff'; if (p.y > 3.8) { if (Math.random() < 0.5) { p.y += Math.random() * 1.5; const taper = (1 - (p.y - 3.8)/2); p.x *= taper; p.z *= taper; p.z -= (p.y - 3.8) * 0.5; colorHex = '#ef4444'; if (p.y > 5.0) colorHex = '#ffffff'; } else { colorHex = '#ffffff'; } } }
            else { p.x = (Math.random() - 0.5) * 6; p.y = -4 + Math.random() * 4; p.z = -6 - Math.random() * 8; colorHex = '#FFD700'; }
            const angle = -0.35; const yOld = p.y; const zOld = p.z; p.y = yOld * Math.cos(angle) - zOld * Math.sin(angle); p.z = yOld * Math.sin(angle) + zOld * Math.cos(angle); p.y += 2.0; x = p.x; y = p.y; z = p.z;
        }
        else if (shape === 'reindeer') {
             // IMPROVED Reindeer Logic: "Fattened" Lines (Capsule/Cylindrical Volume)
             const rand = Math.random(); let p = new THREE.Vector3();
             let thickness = 0.0; // Volume thickness radius

             if (rand < 0.05) { 
                 // Ground Snow / Base
                 const t = Math.random(); p.x = (Math.random() - 0.5) * 4; p.y = -5 + Math.random() * 6; p.z = -8 - Math.random() * 10; p.y += Math.sin(p.z * 0.5) * 2; colorHex = '#FFD700'; 
                 thickness = 0.2;
             }
             else if (rand < 0.25) { 
                 // Legs
                 const legSelect = Math.random(); const t = Math.random(); 
                 let p1, p2, p3;
                 
                 if (legSelect < 0.25) { p1 = new THREE.Vector3(1.2, 2.5, 3.5); p2 = new THREE.Vector3(1.2, 0.5, 5.0); p3 = new THREE.Vector3(1.2, -3.0, 4.0); } 
                 else if (legSelect < 0.50) { p1 = new THREE.Vector3(-1.2, 2.5, 3.5); p2 = new THREE.Vector3(-1.2, 1.0, 3.0); p3 = new THREE.Vector3(-1.2, -1.0, 2.0); } 
                 else if (legSelect < 0.75) { p1 = new THREE.Vector3(1.2, 1.5, -2.0); p2 = new THREE.Vector3(1.2, 0.0, -4.0); p3 = new THREE.Vector3(1.2, -4.0, -7.0); } 
                 else { p1 = new THREE.Vector3(-1.2, 1.5, -2.0); p2 = new THREE.Vector3(-1.2, 0.5, -3.5); p3 = new THREE.Vector3(-1.2, -3.0, -6.0); } 
                 
                 p = t < 0.5 ? lerp3(p1, p2, t*2) : lerp3(p2, p3, (t-0.5)*2);
                 colorHex = (p.y < -2.5 || (legSelect >= 0.25 && legSelect < 0.5 && p.y < -0.5)) ? '#111111' : '#854d0e'; 
                 thickness = 0.5; // Thicker legs
             } 
             else if (rand < 0.60) { 
                 // Body (Ellipsoid volume via math)
                 const u = Math.random() * Math.PI * 2; const v = Math.random() * Math.PI; const r = 2.5; 
                 // Random radius inside volume
                 const vol = Math.pow(Math.random(), 1/3); 
                 let bx = r * 0.7 * Math.sin(v) * Math.cos(u) * vol; 
                 let by = r * 0.8 * Math.sin(v) * Math.sin(u) * vol; 
                 let bz = r * 1.6 * Math.cos(v) * vol; 
                 
                 if (bz < 0) { bx *= 0.8; by *= 0.8; } 
                 const tiltAngle = -0.3; 
                 const yRot = by * Math.cos(tiltAngle) - bz * Math.sin(tiltAngle); 
                 const zRot = by * Math.sin(tiltAngle) + bz * Math.cos(tiltAngle); 
                 p.set(bx, yRot + 1.5, zRot + 0.5); 
                 colorHex = '#854d0e'; 
                 if (by < -0.5 && bz > 0) colorHex = '#fef3c7'; 
                 if (bz < -2.2) { p.y += 0.5; colorHex = '#ffffff'; } 
                 thickness = 0; // Already volumetric
             } 
             else if (rand < 0.70) { 
                 // Neck
                 const t = Math.random(); const start = new THREE.Vector3(0, 3.5, 3.0); const end = new THREE.Vector3(0, 6.5, 4.5); const control = new THREE.Vector3(0, 4.0, 5.0); 
                 p.x = (Math.random() - 0.5) * 1.2; 
                 p.y = (1-t)*(1-t)*start.y + 2*(1-t)*t*control.y + t*t*end.y; 
                 p.z = (1-t)*(1-t)*start.z + 2*(1-t)*t*control.z + t*t*end.z; 
                 colorHex = '#854d0e'; 
                 if (p.z > 4.0 && p.y < 5.0) colorHex = '#fef3c7'; 
                 if (t < 0.2) { colorHex = '#ef4444'; if (p.y < 4.0 && Math.abs(p.x) < 0.3 && p.z > 3.5) { p.z += 0.4; colorHex = '#fbbf24'; } } 
                 thickness = 0.5; // Neck Volume
             } 
             else if (rand < 0.85) { 
                 // Head (Solid Sphere)
                 p = getRandomPointInSphere(0, 1.8); p.y += 6.5; p.z += 5.0; 
                 colorHex = '#854d0e'; 
                 if (p.z > 6.0) { p.x *= 0.6; p.y = 6.5 + (p.y - 6.5) * 0.6; colorHex = '#fde68a'; } 
                 if (p.z > 6.5 && Math.abs(p.x) < 0.3) { colorHex = '#ef4444'; p.z += 0.2; } 
                 if (p.z < 5.5 && p.y > 7.0 && Math.abs(p.x) > 1.0) { p.y += 0.5; colorHex = '#854d0e'; } 
                 if (p.z > 5.8 && Math.abs(p.x) > 0.6 && Math.abs(p.x) < 1.0 && Math.abs(p.y - 6.8) < 0.4) { colorHex = '#111111'; } 
                 thickness = 0; // Already volumetric
             } 
             else { 
                 // Antlers
                 const side = Math.random() > 0.5 ? 1 : -1; const t = Math.random(); 
                 const start = new THREE.Vector3(side * 0.5, 7.5, 4.8); const mid = new THREE.Vector3(side * 2.5, 9.0, 2.0); const end = new THREE.Vector3(side * 1.5, 11.0, 0.0); 
                 p.x = (1-t)*(1-t)*start.x + 2*(1-t)*t*mid.x + t*t*end.x; 
                 p.y = (1-t)*(1-t)*start.y + 2*(1-t)*t*mid.y + t*t*end.y; 
                 p.z = (1-t)*(1-t)*start.z + 2*(1-t)*t*mid.z + t*t*end.z; 
                 if (Math.random() < 0.3) { p.y += 0.5 + Math.random(); } 
                 colorHex = '#fef3c7'; 
                 thickness = 0.15; // Thin Antlers
             }
             
             // Apply Volume Thickness
             if (thickness > 0) {
                 const offset = getRandomPointInSphere(0, thickness);
                 p.add(offset);
             }
             
             x = p.x; y = p.y; z = p.z;
        }

        posArray[i * 3] = x;
        posArray[i * 3 + 1] = y;
        posArray[i * 3 + 2] = z;

        tempColor.set(colorHex);
        
        // Intensity boost
        const boost = (shape === 'diamond' || foliageColor === 'rainbow' || foliageColor === '#FFD700' || foliageColor === '#C0C0C0') ? 1.5 : 1.0;
        
        colArray[i * 3] = tempColor.r * boost;
        colArray[i * 3 + 1] = tempColor.g * boost;
        colArray[i * 3 + 2] = tempColor.b * boost;

        if (treeStyle === 'geometric' && !isHighDensity) {
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
      
      if (shape === 'diamond') {
          // DIAMOND SHAPE: Now handled by <Pearls /> component for 3D volumeric look.
          // Returning empty points here to avoid duplication.
          return { positions: new Float32Array(0), colors: new Float32Array(0) };
      } 
      else {
          // STANDARD TREES: Single Line String Lights
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
      }
      
      return { positions: new Float32Array(points), colors: new Float32Array(lightColors) };
  }, [shape]);

  // -- 3. Decorations --
  const decorations = useMemo(() => {
      const supportsDecor = shape === 'tree' || shape === 'real_tree' || shape === 'diamond' || shape === 'twin_towers';
      if (!supportsDecor) return { baubles: [], gifts: [], ribbons: [], flowers: [], geometricDecors: [] }; 
      
      const baubles = [];
      const gifts = [];
      const ribbons = []; 
      const flowers: { position: [number,number,number], color: string, scale: number, rotation: [number,number,number] }[] = [];
      const geometricDecors: { position: [number,number,number], scale: number, type: 'box' | 'octahedron' }[] = [];
      
      const baublePalette = isSilver 
          ? ['#ef4444', '#C0C0C0', '#3b82f6', '#ffffff'] // Changed #22c55e (Green) to #3b82f6 (Blue)
          : ['#ef4444', '#FFD700', '#22c55e'];           
      
      const flowerPalette = ['#ec4899', '#fbcfe8', '#ffffff']; 

      // Decoration Count
      const count = (shape === 'real_tree') ? 24 : (shape === 'diamond' ? 80 : 200); 

      for (let i = 0; i < count; i++) {
        let pos: [number, number, number] = [0,0,0];
        let rotation: [number, number, number] = [0,0,0];
        let scale = 0.2 + Math.random() * 0.3;
        
        if (shape === 'real_tree') {
             const goldenAngle = Math.PI * (3 - Math.sqrt(5));
             const y = -7.5 + (i / (count - 1)) * 15; 
             const rBase = (radiusBottom * (1 - (y + 9) / 18)) + 1.0; 
             const r = rBase * 1.1; 
             const theta = i * goldenAngle * 3; 
             pos = [r * Math.cos(theta), y, r * Math.sin(theta)];
             rotation = [0, Math.atan2(pos[0], pos[2]), 0];
             scale = 0.8 + Math.random() * 0.5;
             flowers.push({ position: pos, color: flowerPalette[Math.floor(Math.random()*flowerPalette.length)], scale, rotation });
        } 
        // Diamond geometric decorations are now handled by <Diamonds /> component
        else if (shape === 'diamond') {
             // Pass
        }
        else {
            const h = Math.random() * height;
            const rBase = (radiusBottom * (1 - h/height));
            const r = rBase * 0.9;
            const theta = Math.random() * 2 * Math.PI;
            pos = [r*Math.cos(theta), h - height/2, r*Math.sin(theta)];
            
            if (Math.random() > 0.3) {
                baubles.push({ position: pos, color: baublePalette[Math.floor(Math.random()*baublePalette.length)], scale });
            } else {
                gifts.push({ position: pos, color: ['#8b5cf6', '#ec4899'][Math.floor(Math.random()*2)], scale, rotation: [Math.random(), Math.random(), 0] as [number,number,number] });
            }
        }
      }
      return { baubles, gifts, ribbons, flowers, geometricDecors };
  }, [shape, isSilver]);

  // -- 4. Photos Scattered --
  const layout = useMemo(() => {
      const count = photos.length > 0 ? photos.length : 24; 
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

  const photoItems = useMemo(() => {
      return photos.map((photo, i) => {
          const itemLayout = layout[i] || layout[0];
          return {
              ...itemLayout,
              ref: React.createRef<THREE.Group>(),
              photo
          };
      });
  }, [photos, layout]);

  useFrame((state, delta) => {
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

  const sparkleColor = useMemo(() => {
      if (shape === 'real_tree') return '#fbcfe8';
      if (shape === 'diamond') return '#a5f3fc'; // Cyan tint for diamond dust
      if (isRainbow) return '#ffffff';
      if (isGold) return '#FFD700';
      if (isSilver) return '#FFFFFF';
      return '#FFD700';
  }, [isRainbow, isGold, isSilver, shape]);

  const sparkleCount = useMemo(() => {
      let base = 60;
      if (isTwinkling) base += 150;
      if (isMetallicMode) base += 100; 
      if (shape === 'real_tree') base += 400; 
      if (shape === 'diamond') base += 500; // Lots of sparkles
      return base;
  }, [isTwinkling, isMetallicMode, shape]);

  const sparkleSize = useMemo(() => {
    let base = 4; 
    if (isTwinkling) base = 10; 
    if (isMetallicMode) base = 8;
    if (shape === 'real_tree') base = 8; 
    if (shape === 'diamond') base = 12;
    return base;
  }, [isTwinkling, isMetallicMode, shape]);

  const starColor = (isSilver || shape === 'diamond') ? '#ffffff' : '#FFD700';

  const isHighDensity = shape === 'real_tree' || shape === 'diamond' || shape === 'tree' || shape === 'snowman' || shape === 'reindeer';

  return (
    <group ref={groupRef}>
      {shape === 'twin_towers' && <TwinTowers />}
      
      {/* Crystal Core, Pearls, and Diamonds for Diamond Shape */}
      {shape === 'diamond' && (
          <>
            <CrystalCore />
            <Pearls shape={shape} />
            <Diamonds shape={shape} />
          </>
      )}

      {treeStyle === 'geometric' && !isHighDensity && (
         <group>
             {geometricItems.map((item, i) => (
                 <GeometricBlock key={i} {...item} isExploded={isExploded} />
             ))}
         </group>
      )}

      {(treeStyle !== 'geometric' || isHighDensity) && (
        <points ref={foliageRef} key={`${shape}-${foliageColor}`}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial 
                transparent 
                vertexColors 
                // Larger particles for Diamond tree to make it look solid
                size={(shape === 'diamond') ? 1.2 : (shape === 'real_tree' ? 0.6 : (treeStyle === 'crayon' ? 0.8 : 0.3))} 
                sizeAttenuation={true} 
                opacity={treeStyle === 'crayon' ? 1.0 : (isMetallicMode || shape === 'real_tree' || shape === 'diamond' ? 1.0 : 0.9)} 
                map={circleTexture}
                alphaTest={0.01}
                depthWrite={false}
                toneMapped={false}
            />
        </points>
      )}

      {/* Lights & Sparkles */}
      <group visible={!isExploded}>
        {/* String Lights */}
        {(!isMetallicMode || shape === 'real_tree') && shape !== 'diamond' && (
            <points>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={stringLights.positions.length / 3} array={stringLights.positions} itemSize={3} />
                    <bufferAttribute attach="attributes-color" count={stringLights.colors.length / 3} array={stringLights.colors} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial 
                    vertexColors 
                    size={shape === 'diamond' ? 0.4 : (isTwinkling ? 0.4 : 0.25)} 
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
        {decorations.flowers.map((d, i) => <Flower key={`f-${i}`} {...d} />)}
        {decorations.geometricDecors.map((d, i) => <GeometricDecoration key={`gd-${i}`} {...d} />)}
      </group>

      {photoItems.map((item, i) => {
          let texture = item.photo.isEmpty ? emptyTexture : (i % 2 === 0 ? greenTexture : redTexture);
          
          // Override for Sakura Tree (Real Tree)
          if (!item.photo.isEmpty && shape === 'real_tree') {
              texture = i % 2 === 0 ? sakuraLightTexture : sakuraDarkTexture;
          }

          return (
             <group key={item.photo.id} ref={item.ref} position={item.initialPos} rotation={item.initialRot}>
                 <Float rotationIntensity={isExploded ? 0 : 0.1} floatIntensity={isExploded ? 0 : 0.2} speed={2}>
                    <PolaroidFrame 
                        url={item.photo.url} 
                        texture={texture}
                        onClick={(e) => { e.stopPropagation(); onPhotoClick(item.photo); }} 
                        isEmpty={item.photo.isEmpty}
                    />
                 </Float>
             </group>
          );
      })}

      {/* Top Star */}
      {(shape === 'tree' || shape === 'real_tree' || shape === 'diamond' || shape === 'twin_towers') && (
        <group visible={!isExploded} position={[0, height/2 + 0.5, 0]}>
            {shape === 'real_tree' ? (
                 <group>
                     <Flower color="#f9a8d4" position={[0,0,0]} scale={2.8} />
                     <pointLight color="#fbbf24" intensity={4} distance={6} />
                     <Sparkles count={50} scale={3} size={15} color="#fff0f5" speed={0.8} />
                 </group>
            ) : shape === 'diamond' ? (
                // Bright, Larger Star for Diamond Tree
                <DiamondTopper />
            ) : (
                <mesh>
                    <octahedronGeometry args={[1, 0]} />
                    <meshBasicMaterial color={starColor} toneMapped={false} />
                </mesh>
            )}
            <pointLight color={shape === 'real_tree' ? '#ec4899' : starColor} intensity={isTwinkling ? 5 : 2} distance={15} />
            <Sparkles count={isTwinkling ? 100 : 40} scale={4} size={isTwinkling ? 15 : 8} speed={0.4} opacity={1} color={shape === 'real_tree' ? '#fbcfe8' : starColor} />
        </group>
      )}
    </group>
  );
};