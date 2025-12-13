import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image, Points, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

// -- Instanced Stools (Plastic Stool) --
const Stools = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Create a robust, stereoscopic stool geometry
    const stoolGeometry = useMemo(() => {
        // Dimensions (Base Scale 1.0)
        const width = 2.6;
        const height = 3.2;
        const legThick = 0.35;
        const seatThick = 0.15;

        // 1. Seat Top
        const seatGeo = new THREE.BoxGeometry(width, seatThick, width);
        seatGeo.translate(0, height/2, 0);

        // 2. Legs
        const legGeo = new THREE.BoxGeometry(legThick, height, legThick);
        const legOffset = (width - legThick) / 2 - 0.1; // Inset slightly
        
        const leg1 = legGeo.clone(); leg1.translate(-legOffset, 0, -legOffset);
        const leg2 = legGeo.clone(); leg2.translate(legOffset, 0, -legOffset);
        const leg3 = legGeo.clone(); leg3.translate(-legOffset, 0, legOffset);
        const leg4 = legGeo.clone(); leg4.translate(legOffset, 0, legOffset);

        // 3. Under-seat Skirt (Reinforcement look)
        const skirtHeight = 0.5;
        const skirtThick = 0.1;
        // X-aligned skirts
        const skirtGeoX = new THREE.BoxGeometry(width, skirtHeight, skirtThick);
        const skirt1 = skirtGeoX.clone(); skirt1.translate(0, height/2 - skirtHeight/2, -width/2 + skirtThick/2);
        const skirt2 = skirtGeoX.clone(); skirt2.translate(0, height/2 - skirtHeight/2, width/2 - skirtThick/2);
        // Z-aligned skirts
        const skirtGeoZ = new THREE.BoxGeometry(skirtThick, skirtHeight, width - 2*skirtThick); // Adjust length to fit between X skirts
        const skirt3 = skirtGeoZ.clone(); skirt3.translate(-width/2 + skirtThick/2, height/2 - skirtHeight/2, 0);
        const skirt4 = skirtGeoZ.clone(); skirt4.translate(width/2 - skirtThick/2, height/2 - skirtHeight/2, 0);

        // 4. Mid/Low Support Bracing
        const supportHeight = 0.15;
        const supportY = -height/4;
        const suppGeoX = new THREE.BoxGeometry(width - legThick, supportHeight, 0.1);
        const suppGeoZ = new THREE.BoxGeometry(0.1, supportHeight, width - legThick);
        
        const supp1 = suppGeoX.clone(); supp1.translate(0, supportY, -legOffset);
        const supp2 = suppGeoX.clone(); supp2.translate(0, supportY, legOffset);
        const supp3 = suppGeoZ.clone(); supp3.translate(-legOffset, supportY, 0);
        const supp4 = suppGeoZ.clone(); supp4.translate(legOffset, supportY, 0);

        return BufferGeometryUtils.mergeGeometries([
            seatGeo, 
            leg1, leg2, leg3, leg4,
            skirt1, skirt2, skirt3, skirt4,
            supp1, supp2, supp3, supp4
        ]);
    }, []);

    // SCALE INCREASED: 1.725 -> 1.925 (approx 11.5% expansion requested)
    const scale = 1.925; 

    // Calculate initial positions and animation parameters
    const instancesState = useMemo(() => {
        const data = [];
        const stoolHeight = 3.2 * scale;
        const yStep = stoolHeight * 0.95; 

        // Adjusted startY to keep stack centered with new height
        const startY = -7.0;

        // Radii adjusted for new scale (Scale 1.925)
        // Layer 0: 6 stools, R ~ 4.8
        const layer0 = { y: startY, count: 6, r: 4.8 };
        // Layer 1: 3 stools, R ~ 2.6
        const layer1 = { y: startY + yStep, count: 3, r: 2.6 };
        // Layer 2: 1 stool, R = 0
        const layer2 = { y: startY + yStep * 2, count: 1, r: 0 };

        const layers = [layer0, layer1, layer2];

        layers.forEach((layer, layerIdx) => {
            const { y, r, count } = layer;
            const layerRotOffset = layerIdx % 2 === 0 ? 0 : Math.PI / count; 

            for(let i=0; i<count; i++) {
                const angle = (i / count) * Math.PI * 2 + layerRotOffset;
                const x = r === 0 ? 0 : Math.cos(angle) * r;
                const z = r === 0 ? 0 : Math.sin(angle) * r;
                
                const rotY = -angle; 
                const rotX = (Math.random() - 0.5) * 0.05;
                const rotZ = (Math.random() - 0.5) * 0.05;

                // Random animation phases for floating effect
                const phase = Math.random() * Math.PI * 2;
                const speed = 0.5 + Math.random() * 0.5;

                data.push({
                    basePosition: new THREE.Vector3(x, y, z),
                    rotation: [rotX, rotY, rotZ],
                    scale: scale,
                    phase,
                    speed
                });
            }
        });
        return data;
    }, []);

    // Animation Loop
    useFrame((state) => {
        if (!meshRef.current) return;
        const t = state.clock.elapsedTime;
        
        instancesState.forEach((data, i) => {
            // Floating Animation: Sine wave offset on Y
            const floatY = Math.sin(t * data.speed + data.phase) * 0.3; // Amplitude 0.3
            
            // Gentle Sway: Slight rotation
            const sway = Math.sin(t * data.speed * 0.5 + data.phase) * 0.02;

            dummy.position.copy(data.basePosition).add(new THREE.Vector3(0, floatY, 0));
            dummy.rotation.set(
                data.rotation[0] + sway, 
                data.rotation[1], 
                data.rotation[2] + sway
            );
            dummy.scale.setScalar(data.scale);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[stoolGeometry, undefined, instancesState.length]}>
            <meshStandardMaterial 
                color="#dc2626" 
                roughness={0.3} 
                metalness={0.1} 
                side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
};

// -- NEW: Stool Ribbon (Wide & Organic) --
const StoolRibbon = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = 8000; // Increased from 6500 to maintain density with wider ribbon
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const data = useMemo(() => {
        const items = [];
        for(let i=0; i<count; i++) {
            const t = i / count;
            
            // Center Height
            const hCenter = -10.0 + t * 19.5; 

            // Organic Winding
            const turns = 6; 
            const theta = t * turns * Math.PI * 2;
            
            // Base Radius (Tapered)
            const rCenter = 9.5 - (t * 6.0); 
            
            // Low frequency wobble to break rigidity
            const wobbleR = Math.sin(theta * 2.5) * 0.3;
            const wobbleY = Math.cos(theta * 2.5) * 0.4;
            
            // "Wide Ribbon" Effect: Scatter vertical position (width) and slightly radial (thickness)
            // Increased widthSpread from 1.2 to 1.7 (approx 0.4x increase as requested)
            const widthSpread = (Math.random() - 0.5) * 1.7; 
            const thickSpread = (Math.random() - 0.5) * 0.6; // Thickness

            const r = rCenter + wobbleR + thickSpread;
            const h = hCenter + wobbleY + widthSpread;

            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            
            const rot = [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI];
            
            // Matte Green Variations
            const noise = Math.random();
            let colorHex;
            if (noise > 0.6) colorHex = '#15803d'; 
            else if (noise > 0.3) colorHex = '#16a34a'; 
            else colorHex = '#22c55e'; 

            items.push({ pos: new THREE.Vector3(x, h, z), rot, scale: 0.15 + Math.random() * 0.25, color: colorHex });
        }
        return items;
    }, []);

    useEffect(() => {
        if (!meshRef.current) return;
        const color = new THREE.Color();
        data.forEach((d, i) => {
            dummy.position.copy(d.pos);
            dummy.rotation.set(d.rot[0] as number, d.rot[1] as number, d.rot[2] as number);
            dummy.scale.setScalar(d.scale);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
            
            color.set(d.color);
            meshRef.current!.setColorAt(i, color);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [data, dummy]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshStandardMaterial 
                roughness={0.9} 
                metalness={0.0} 
                flatShading={true}
            />
        </instancedMesh>
    );
};

// -- NEW: Stool Gems (Reflective Cubes & Icosahedrons) --
const StoolGems = () => {
    const cubeRef = useRef<THREE.InstancedMesh>(null);
    const icoRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const countCubes = 500; // Increased from 400
    const countIcos = 500;  // Increased from 400

    const generateData = (count: number, type: 'cube' | 'ico') => {
        const items = [];
        for(let i=0; i<count; i++) {
             // Randomly sample along the ribbon length (t)
             const t = Math.random(); 
             
             // Must match Ribbon logic to sit inside it
             const hCenter = -10.0 + t * 19.5;
             const turns = 6; 
             const theta = t * turns * Math.PI * 2;
             const rCenter = 9.5 - (t * 6.0); 
             
             const wobbleR = Math.sin(theta * 2.5) * 0.3;
             const wobbleY = Math.cos(theta * 2.5) * 0.4;
             
             // Spread logic - increased widthSpread from 1.0 to 1.4 to match wider ribbon
             const widthSpread = (Math.random() - 0.5) * 1.4; 
             const thickSpread = (Math.random() - 0.5) * 0.8; 

             const r = rCenter + wobbleR + thickSpread;
             const h = hCenter + wobbleY + widthSpread;
             
             const x = r * Math.cos(theta);
             const z = r * Math.sin(theta);

             // Color: White (Mirror) or Pale Purple (Gem)
             // Icosahedrons more likely to be purple gems, Cubes mirrors
             let color;
             if (type === 'ico') {
                 color = Math.random() > 0.3 ? '#e9d5ff' : '#ffffff'; // Pale purple dominant
             } else {
                 color = '#ffffff'; // White dominant
             }

             items.push({ 
                 pos: new THREE.Vector3(x, h, z), 
                 rot: [Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI], 
                 scale: 0.3 + Math.random() * 0.2,
                 color
             });
        }
        return items;
    }
    
    const cubesData = useMemo(() => generateData(countCubes, 'cube'), []);
    const icosData = useMemo(() => generateData(countIcos, 'ico'), []);

    useEffect(() => {
        if (cubeRef.current) {
            const c = new THREE.Color();
            cubesData.forEach((d, i) => {
                dummy.position.copy(d.pos);
                dummy.rotation.set(d.rot[0] as number, d.rot[1] as number, d.rot[2] as number);
                dummy.scale.setScalar(d.scale);
                dummy.updateMatrix();
                cubeRef.current!.setMatrixAt(i, dummy.matrix);
                c.set(d.color);
                cubeRef.current!.setColorAt(i, c);
            });
            cubeRef.current.instanceMatrix.needsUpdate = true;
            if (cubeRef.current.instanceColor) cubeRef.current.instanceColor.needsUpdate = true;
        }
        if (icoRef.current) {
            const c = new THREE.Color();
            icosData.forEach((d, i) => {
                dummy.position.copy(d.pos);
                dummy.rotation.set(d.rot[0] as number, d.rot[1] as number, d.rot[2] as number);
                dummy.scale.setScalar(d.scale);
                dummy.updateMatrix();
                icoRef.current!.setMatrixAt(i, dummy.matrix);
                c.set(d.color);
                icoRef.current!.setColorAt(i, c);
            });
            icoRef.current.instanceMatrix.needsUpdate = true;
            if (icoRef.current.instanceColor) icoRef.current.instanceColor.needsUpdate = true;
        }
    }, [cubesData, icosData, dummy]);

    return (
        <group>
            <instancedMesh ref={cubeRef} args={[undefined, undefined, countCubes]}>
                 <boxGeometry args={[0.6, 0.6, 0.6]} />
                 <meshPhysicalMaterial 
                    roughness={0.1}
                    metalness={0.9} // Mirror like
                    envMapIntensity={2.5}
                 />
            </instancedMesh>
             <instancedMesh ref={icoRef} args={[undefined, undefined, countIcos]}>
                 <icosahedronGeometry args={[0.5, 0]} />
                 <meshPhysicalMaterial 
                    roughness={0}
                    metalness={0.4}
                    transmission={0.6} // Gem like
                    thickness={1.5}
                    envMapIntensity={2.5}
                 />
            </instancedMesh>
        </group>
    )
}

// -- NEW: Christmas Wreath (Replaces Bell) --
const Wreath = ({ position, scale = 1 }: { position: [number, number, number], scale?: number }) => {
    const groupRef = useRef<THREE.Group>(null);

    // Generate static data for wreath baubles
    const ornaments = useMemo(() => {
        const items = [];
        const colors = ['#ef4444', '#eab308', '#3b82f6', '#22c55e', '#ffffff']; // Red, Gold, Blue, Green, Silver
        const count = 40;
        
        // Large Baubles
        for(let i=0; i<count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            // Torus roughly R=1, tube=0.4
            // Scatter around the tube
            const rTube = 0.3;
            const tubeAngle = Math.random() * Math.PI * 2;
            
            // Position on Torus Surface
            const R = 1.0;
            const x = (R + rTube * Math.cos(tubeAngle)) * Math.cos(angle);
            const y = (R + rTube * Math.cos(tubeAngle)) * Math.sin(angle);
            const z = rTube * Math.sin(tubeAngle);

            const s = 0.2 + Math.random() * 0.15;
            items.push({ pos: [x,y,z], color: colors[Math.floor(Math.random()*colors.length)], scale: s });
        }
        
        // Small Filler Berries (Red/Gold)
        for(let i=0; i<50; i++) {
             const angle = Math.random() * Math.PI * 2;
             const rTube = 0.25;
             const tubeAngle = Math.random() * Math.PI * 2;
             const R = 1.0;
             const x = (R + rTube * Math.cos(tubeAngle)) * Math.cos(angle);
             const y = (R + rTube * Math.cos(tubeAngle)) * Math.sin(angle);
             const z = rTube * Math.sin(tubeAngle);
             items.push({ pos: [x,y,z], color: Math.random() > 0.5 ? '#ef4444' : '#eab308', scale: 0.1 });
        }

        return items;
    }, []);

    useFrame((state) => {
        if(groupRef.current) {
            // Gentle twist/sway
            groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
        }
    });

    return (
        <group ref={groupRef} position={position} scale={scale}>
            {/* Base Green Foliage Ring */}
            <mesh>
                <torusGeometry args={[1.0, 0.35, 16, 48]} />
                <meshStandardMaterial color="#166534" roughness={0.9} /> 
            </mesh>
            {/* Tinsel/Texture particles could be added, but noise texture is cheaper */}
            <mesh rotation={[0,0,1]}>
                 <torusGeometry args={[1.0, 0.36, 16, 48]} />
                 <meshStandardMaterial color="#15803d" wireframe transparent opacity={0.3} />
            </mesh>

            {/* Ornaments */}
            {ornaments.map((d, i) => (
                <mesh key={i} position={d.pos as any} scale={d.scale}>
                    <sphereGeometry args={[1, 16, 16]} />
                    <meshStandardMaterial color={d.color} metalness={0.7} roughness={0.2} emissive={d.color} emissiveIntensity={0.2} />
                </mesh>
            ))}
            
            {/* Top Ribbon Knot (Simplified) */}
            <group position={[0, 1.1, 0.2]}>
                 <mesh position={[0,0,0]}>
                     <sphereGeometry args={[0.3]} />
                     <meshStandardMaterial color="#ef4444" />
                 </mesh>
                 <mesh position={[-0.4, 0.2, 0]} rotation={[0,0,0.5]}>
                     <cylinderGeometry args={[0.2, 0.2, 0.8]} />
                     <meshStandardMaterial color="#ef4444" />
                 </mesh>
                 <mesh position={[0.4, 0.2, 0]} rotation={[0,0,-0.5]}>
                     <cylinderGeometry args={[0.2, 0.2, 0.8]} />
                     <meshStandardMaterial color="#ef4444" />
                 </mesh>
            </group>
        </group>
    );
};


// -- Instanced Diamonds --
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

// -- Pearls Component --
const Pearls = ({ shape }: { shape: TreeShape }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pearlsData = useMemo(() => {
     if (shape !== 'diamond') return [];
     
     const data = [];
     const strands = 1; 
     const loops = 6;  
     const pearlsPerLoop = 200; // Continuous look
     const totalPerStrand = loops * pearlsPerLoop;
     const height = 18;
     
     for(let s = 0; s < strands; s++) {
         const strandOffset = (s * Math.PI * 2) / strands;

         for(let i = 0; i < totalPerStrand; i++) {
            const t = i / totalPerStrand;
            const hBase = (height / 2) - (t * height); 
            const progress = (hBase + (height/2)) / height; // 0 to 1
            const rCone = Math.max(0.2, 9 * (1 - progress)); 
            const angle = (t * loops * Math.PI * 2) + strandOffset;
            
            const drapeFreq = 12; 
            const drapePhase = (Math.sin(angle * drapeFreq) + 1) / 2;
            
            const rOffset = (1 - drapePhase) * 0.5; // Bulge out
            const hOffset = (1 - drapePhase) * 0.8; // Drop down
            
            const r = rCone + rOffset + 0.2; 
            const h = hBase - hOffset;
            
            const jitterX = (Math.random() - 0.5) * 0.05;
            const jitterY = (Math.random() - 0.5) * 0.05;
            const jitterZ = (Math.random() - 0.5) * 0.05;
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

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, pearlsData.length]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhysicalMaterial 
            color="#f8fafc" 
            emissive="#ffffff"
            emissiveIntensity={0.25} 
            roughness={0.2} 
            metalness={0.3} 
            clearcoat={1.0} 
            clearcoatRoughness={0.1}
            envMapIntensity={2.0} 
        />
    </instancedMesh>
  );
};

// -- Twin Towers --
const TwinTowers = () => {
    // 1. Geometries
    const squareGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 4, 1, false), []);
    const smoothGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 64, 1), []);
    const spireGeo = useMemo(() => new THREE.ConeGeometry(1, 4, 32), []);

    // 2. Materials (Matte Finish)
    const steelMat = useMemo(() => new THREE.MeshPhysicalMaterial({
        color: '#cbd5e1', 
        emissive: '#000000',
        emissiveIntensity: 0.0,
        roughness: 0.7, // Matte
        metalness: 0.3, // Brushed look
        clearcoat: 0.0,
        envMapIntensity: 0.5,
        flatShading: false
    }), []);

    const greenBodyMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#059669', 
        emissive: '#064e3b', 
        emissiveIntensity: 0.1,
        roughness: 0.9, // Very matte
        metalness: 0.0,
        toneMapped: true
    }), []);

    const redBodyMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: '#dc2626',
        emissive: '#7f1d1d',
        emissiveIntensity: 0.1,
        roughness: 0.9, // Very matte
        metalness: 0.0,
        toneMapped: true
    }), []);

    // 3. Helper: Detailed Tower Tier
    const Tier = ({ y, h, r, isRed }: { y: number, h: number, r: number, isRed?: boolean }) => {
        const bodyMat = isRed ? redBodyMat : greenBodyMat;
        const bands = useMemo(() => {
             const items = [];
             const count = Math.max(2, Math.floor(h / 1.0)); 
             for(let i=0; i<=count; i++) {
                 const bandY = -h/2 + (h * i) / count;
                 items.push(bandY);
             }
             return items;
        }, [h]);

        return (
            <group position={[0, y + h/2, 0]}>
                <group>
                    <mesh geometry={squareGeo} material={bodyMat} scale={[r, h, r]} rotation={[0, Math.PI/4, 0]} />
                    <mesh geometry={squareGeo} material={bodyMat} scale={[r, h, r]} />
                </group>
                {bands.map((bandY, i) => (
                     <group key={`b-${i}`} position={[0, bandY, 0]}>
                         <mesh geometry={squareGeo} material={steelMat} scale={[r * 1.005, 0.03, r * 1.005]} rotation={[0, Math.PI/4, 0]} />
                         <mesh geometry={squareGeo} material={steelMat} scale={[r * 1.005, 0.03, r * 1.005]} />
                     </group>
                ))}
                {[45, 135, 225, 315].map((deg) => {
                         const rad = deg * Math.PI / 180;
                         const x = Math.cos(rad) * r;
                         const z = Math.sin(rad) * r;
                         return (
                             <mesh key={`c1-${deg}`} position={[x, 0, z]} scale={[0.04, h, 0.04]}>
                                 <boxGeometry />
                                 <mesh material={steelMat} />
                             </mesh>
                         );
                })}
                {[0, 90, 180, 270].map((deg) => {
                         const rad = deg * Math.PI / 180;
                         const x = Math.cos(rad) * r;
                         const z = Math.sin(rad) * r;
                         return (
                             <mesh key={`c2-${deg}`} position={[x, 0, z]} scale={[0.04, h, 0.04]}>
                                 <boxGeometry />
                                 <mesh material={steelMat} />
                             </mesh>
                         );
                })}
                <pointLight position={[0, 0, 0]} color={isRed ? '#ff4444' : '#44ffaa'} distance={h * 2.5} intensity={1.0} decay={2} />
            </group>
        );
    };

    const Spire = ({ y }: { y: number }) => (
        <group position={[0, y, 0]}>
            <mesh geometry={smoothGeo} material={greenBodyMat} scale={[0.8, 2, 0.8]} position={[0, 1, 0]} />
            <mesh geometry={spireGeo} material={redBodyMat} scale={[0.05, 4, 0.05]} position={[0, 3, 0]} />
            <mesh position={[0, 5, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
                <pointLight color="#ffffff" intensity={5} distance={20} decay={2} />
            </mesh>
        </group>
    );

    const SingleTower = () => (
        <group>
             <Tier y={0} h={14} r={2.2} />          
             <Tier y={14} h={5} r={2.0} />          
             <Tier y={19} h={4} r={1.7} isRed />    
             <Tier y={23} h={3} r={1.4} />          
             <Tier y={26} h={2} r={1.0} isRed />    
             <Spire y={28} />                       
        </group>
    );

    return (
        <group position={[0, -14, -8]} scale={[1.15, 1.15, 1.15]}>
            <group position={[-3.2, 0, 0]}><SingleTower /></group>
            <group position={[3.2, 0, 0]}><SingleTower /></group>
            <group position={[0, 12.5, 0]}>
                <mesh material={steelMat} position={[0, -0.2, 0]}><boxGeometry args={[6.4, 0.6, 0.8]} /></mesh>
                <mesh material={steelMat} position={[0, 0.6, 0]}><boxGeometry args={[6.4, 0.5, 0.6]} /></mesh>
                <mesh position={[0, 0.2, 0.41]}><boxGeometry args={[6.4, 0.2, 0.05]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
                 <pointLight position={[0, 0.2, 1]} color="#ffffff" intensity={3} distance={8} />
                <group position={[0, -4.5, 0]}>
                    <mesh material={steelMat} position={[0, 4.2, 0]}><sphereGeometry args={[0.6]} /></mesh>
                    <mesh material={steelMat} position={[-1.6, 2.0, 0]} rotation={[0, 0, -0.6]}><cylinderGeometry args={[0.2, 0.2, 5.5, 16]} /></mesh>
                    <mesh material={steelMat} position={[1.6, 2.0, 0]} rotation={[0, 0, 0.6]}><cylinderGeometry args={[0.2, 0.2, 5.5, 16]} /></mesh>
                </group>
            </group>
        </group>
    );
};

// -- Crystal Core --
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

// -- Floating Diamond Topper --
const DiamondTopper = () => {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.elapsedTime;
            meshRef.current.position.y = 2.0 + Math.sin(t * 1.5) * 0.3; 
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
                emissiveIntensity={0.8} 
                transmission={0.9} 
                roughness={0}
                metalness={0.1}
                thickness={3.0}
                ior={2.4}
                toneMapped={false} 
            />
        </mesh>
    );
};

// -- Flower Component --
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
    if (shape === 'stool') {
        // Updated for Scaled (1.925x) Stool
        // Ensure items float outside the larger stool radius
        // Base radius 6.5 tapering to 5.0
        const t = (y + 7) / 14; 
        const tClamped = Math.max(0, Math.min(1, t));
        return 6.5 * (1 - tClamped) + 5.0 * tClamped;
    }
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
        // Expanded to include Sleigh
        if (y < -2) return 5.0; // Sleigh area
        if (y < 4) return 4.5; // Legs/Body
        return 4.5; // Head/Antlers
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
    
    // Adjusted: High density shapes reduced from 15000 to 10000 for better balance
    let effectiveLeafCount = isHighDensity ? 10000 : leafCount;

    // Custom Adjustment: Reduce particle count for Diamond to avoid overcrowding
    if (shape === 'diamond') {
        effectiveLeafCount = 8000;
    }
    // For Stool, we replace particles with InstancedMesh Octahedrons
    if (shape === 'stool') {
        effectiveLeafCount = 0; 
    }
    
    const posArray = new Float32Array(effectiveLeafCount * 3);
    const colArray = new Float32Array(effectiveLeafCount * 3);
    
    const geoItems: { initialPos: THREE.Vector3, explodedPos: THREE.Vector3, color: string, shapeType: 'box' | 'sphere' }[] = [];
    const tempColor = new THREE.Color();

    for (let i = 0; i < effectiveLeafCount; i++) {
        let x=0, y=0, z=0;
        let colorHex = foliageColor;

        if (shape === 'stool') {
             // Logic moved to StoolRibbon component
        }
        else if (shape === 'tree' || shape === 'twin_towers') {
            const h = Math.random() * height;
            const progress = h / height;
            const rMax = (radiusBottom * (1 - progress));
            
            const rMode = Math.random();
            let r;
            
            if (rMode < 0.4) {
                 r = rMax * Math.random() * 0.5;
            } else {
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

            const val = Math.random();
            if (val > 0.8) colorHex = '#ffffff';      
            else if (val > 0.6) colorHex = '#f8fafc'; 
            else if (val > 0.4) colorHex = '#cbd5e1'; 
            else colorHex = '#94a3b8';                
        }
        else if (shape === 'real_tree') {
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
                if (isFront && p.y > 5.5 && Math.abs(p.x) < 0.6 && Math.abs(p.x) < 1.2) { colorHex = '#111111'; p.z += 0.1; }
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
             // Split: 0-35% Deer1, 35-70% Deer2, 70-100% Sleigh
             const entityType = Math.random(); 
             let p = new THREE.Vector3();
             
             if (entityType < 0.7) {
                 // --- REINDEER (Two of them) ---
                 const deerIndex = entityType < 0.35 ? 0 : 1;
                 const part = Math.random();
                 
                 // Reuse Reindeer Logic
                 if (part < 0.3) {
                     // Body
                     const theta = Math.random() * 2 * Math.PI;
                     const phi = Math.random() * Math.PI;
                     const r = Math.pow(Math.random(), 1/3); 
                     p.x = 1.0 * r * Math.sin(phi) * Math.cos(theta);
                     p.y = 1.2 * r * Math.cos(phi);
                     p.z = 2.0 * r * Math.sin(phi) * Math.sin(theta);
                     // Tilt
                     const tilt = 0.3; 
                     const yOld = p.y; const zOld = p.z;
                     p.y = yOld * Math.cos(tilt) - zOld * Math.sin(tilt);
                     p.z = yOld * Math.sin(tilt) + zOld * Math.cos(tilt);
                     colorHex = '#8B4513';
                     if (p.y < -0.3 && Math.abs(p.x) < 0.6) colorHex = '#D2B48C';
                 }
                 else if (part < 0.5) {
                     // Neck/Head
                     if (Math.random() > 0.45) {
                         // Neck
                         const t = Math.random();
                         const neckBase = new THREE.Vector3(0, 1.0, 1.5);
                         const headBase = new THREE.Vector3(0, 3.2, 2.8);
                         p.lerpVectors(neckBase, headBase, t);
                         const thick = 0.6 * (1 - t * 0.3);
                         p.x += (Math.random() - 0.5) * thick;
                         p.z += (Math.random() - 0.5) * thick;
                         p.y += (Math.random() - 0.5) * 0.2;
                         colorHex = '#8B4513';
                         if (p.y < 1.5) colorHex = '#D2B48C';
                     } else {
                         // Head
                         const headCenter = new THREE.Vector3(0, 3.5, 3.0);
                         p = getRandomPointInSphere(0, 0.85); 
                         p.add(headCenter);
                         colorHex = '#8B4513';
                         if (p.z > 3.6) { 
                             colorHex = '#D2B48C'; 
                             if (p.z > 3.8 && Math.abs(p.x) < 0.2) {
                                 // Deer 1 gets red nose
                                 colorHex = (deerIndex === 0) ? '#ef4444' : '#111111';
                                 p.z += 0.1; 
                             }
                         }
                         if (p.z > 3.3 && p.y > 3.6 && Math.abs(p.x) > 0.4) colorHex = '#111111';
                     }
                 }
                 else if (part < 0.8) {
                     // Legs
                     const isFront = Math.random() > 0.5;
                     const isLeft = Math.random() > 0.5;
                     const sideX = isLeft ? -0.7 : 0.7;
                     const t = Math.random(); 
                     if (isFront) {
                         const shoulder = new THREE.Vector3(sideX, 0, 1.5);
                         const knee = new THREE.Vector3(sideX, 0.5, 2.5);
                         const hoof = new THREE.Vector3(sideX, -0.8, 3.2);
                         if (isLeft) { knee.z += 0.5; hoof.z += 0.5; hoof.y += 0.5; }
                         if (t < 0.5) p.lerpVectors(shoulder, knee, t * 2);
                         else p.lerpVectors(knee, hoof, (t - 0.5) * 2);
                     } else {
                         const hip = new THREE.Vector3(sideX, 0, -1.5);
                         const hock = new THREE.Vector3(sideX, -0.5, -2.5);
                         const hoof = new THREE.Vector3(sideX, -2.0, -3.5);
                         if (!isLeft) { hoof.z -= 0.5; hoof.y += 0.5; }
                         if (t < 0.5) p.lerpVectors(hip, hock, t * 2);
                         else p.lerpVectors(hock, hoof, (t - 0.5) * 2);
                     }
                     p.x += (Math.random() - 0.5) * 0.3;
                     p.y += (Math.random() - 0.5) * 0.3;
                     p.z += (Math.random() - 0.5) * 0.3;
                     colorHex = '#5D4037';
                     if (p.y < -1.5 || (p.z > 3.0 && isFront)) colorHex = '#111111';
                 }
                 else {
                     // Antlers
                     const isLeftAntler = Math.random() > 0.5;
                     const sideMult = isLeftAntler ? 1 : -1;
                     const t = Math.random();
                     const start = new THREE.Vector3(sideMult * 0.2, 4.0, 2.8);
                     const mid = new THREE.Vector3(sideMult * 1.5, 5.5, 2.0);
                     const end = new THREE.Vector3(sideMult * 0.5, 6.5, 0.5);
                     p.x = (1-t)*(1-t)*start.x + 2*(1-t)*t*mid.x + t*t*end.x;
                     p.y = (1-t)*(1-t)*start.y + 2*(1-t)*t*mid.y + t*t*end.y;
                     p.z = (1-t)*(1-t)*start.z + 2*(1-t)*t*mid.z + t*t*end.z;
                     p.addScalar((Math.random()-0.5)*0.15);
                     colorHex = '#F5DEB3'; 
                 }
                 
                 p.multiplyScalar(1.3);

                 if (deerIndex === 0) {
                     // Deer 1: Front Left
                     p.x -= 2.5;
                     p.z += 4.0;
                     p.y += 2.0; 
                 } else {
                     // Deer 2: Front Right
                     p.x += 2.5;
                     p.z += 4.0; 
                     p.y += 2.5;
                 }
             } else {
                 // --- SLEIGH ---
                 const part = Math.random();
                 
                 if (part < 0.3) {
                     // Runners (Gold)
                     // Two curves at x = +/- 2.0
                     const side = Math.random() > 0.5 ? 2.0 : -2.0;
                     const t = Math.random(); // 0 to 1 along length Z
                     const z = -4.0 + t * 8.0; // Length 8
                     // Curve up at front (z > 2)
                     let y = -2.0;
                     if (z > 2.0) {
                         y += Math.pow((z - 2.0), 2) * 0.3;
                     }
                     // Curl at very front
                     if (z > 3.5) {
                         y += (z - 3.5) * 0.5;
                     }
                     
                     p.set(side, y, z);
                     p.x += (Math.random()-0.5) * 0.2; // Thickness
                     p.y += (Math.random()-0.5) * 0.2; 
                     colorHex = '#FFD700'; 
                 } 
                 else if (part < 0.6) {
                     // Body (Red Carriage)
                     // Box-ish shell
                     // x: -2 to 2
                     // z: -3 to 2
                     // y: -1.5 to 0.5 (floor to rim)
                     // High back at z = -3
                     
                     const u = Math.random();
                     const v = Math.random();
                     const w = Math.random();
                     
                     // Generate points on surface of "tub"
                     // Simplified: Just random points in volume with bias to walls
                     const x = (u - 0.5) * 4.0;
                     const z = (v - 0.5) * 5.0; // -2.5 to 2.5
                     let yBase = -1.5;
                     
                     // Side walls
                     let isWall = false;
                     if (Math.abs(x) > 1.8 || z < -2.3 || z > 2.3) isWall = true;
                     
                     let yHeight = 1.0;
                     if (z < -2.0) yHeight = 2.0; // High back
                     if (z > 2.0) yHeight = 0.8; // Low front
                     
                     const y = yBase + w * yHeight;
                     
                     // Hollow it out roughly? 
                     // Just fill it, it's points.
                     
                     p.set(x, y, z);
                     colorHex = '#dc2626'; // Red
                     if (Math.abs(x) > 1.9 || z < -2.4 || Math.abs(y - (yBase + yHeight)) < 0.1) {
                         colorHex = '#FFD700'; // Gold Trim
                     }
                 }
                 else {
                     // Gifts (Colorful Pile)
                     // Inside the sleigh: x -1.5 to 1.5, z -2 to 1, y -1.0 to 1.5
                     const x = (Math.random() - 0.5) * 3.0;
                     const z = (Math.random() - 0.5) * 3.0 - 0.5;
                     const y = -1.0 + Math.random() * 2.0;
                     
                     // Taper pile
                     if (Math.abs(x) < 1.5 && Math.abs(z+0.5) < 1.5) {
                         p.set(x, y, z);
                         
                         const giftType = Math.floor(Math.random() * 4);
                         if (giftType === 0) colorHex = '#22c55e'; // Green
                         else if (giftType === 1) colorHex = '#3b82f6'; // Blue
                         else if (giftType === 2) colorHex = '#a855f7'; // Purple
                         else colorHex = '#ffffff'; // White
                     } else {
                         // Fallback to body if outside pile bounds
                         p.set(x, -1.5, z);
                         colorHex = '#dc2626';
                     }
                 }
                 
                 // Shift Sleigh Back
                 p.z -= 4.0;
                 p.y += 1.0;
             }

             // Global Flight Rotation (Pitch up slightly, traveling +Z +Y)
             // Rotate around X axis
             const pitch = Math.PI / 12; // 15 deg up
             const yOld = p.y; const zOld = p.z;
             p.y = yOld * Math.cos(pitch) - zOld * Math.sin(pitch);
             p.z = yOld * Math.sin(pitch) + zOld * Math.cos(pitch);

             x = p.x; y = p.y; z = p.z;
        }

        posArray[i * 3] = x;
        posArray[i * 3 + 1] = y;
        posArray[i * 3 + 2] = z;

        tempColor.set(colorHex);
        
        const boost = (shape === 'diamond' || foliageColor === 'rainbow' || foliageColor === '#FFD700' || foliageColor === '#C0C0C0') ? 1.5 : 1.0;
        
        colArray[i * 3] = tempColor.r * boost;
        colArray[i * 3 + 1] = tempColor.g * boost;
        colArray[i * 3 + 2] = tempColor.b * boost;

        if (treeStyle === 'geometric' && !isHighDensity && shape !== 'stool') {
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
          return { positions: new Float32Array(0), colors: new Float32Array(0) };
      } 
      else if (shape === 'stool') {
          // Stool: Simple small lights along the garland path
          const loops = 12;
          const total = 120;
          for(let i=0; i<total; i++) {
               const t = i/total;
               const h = -9.0 + t * 18; 
               const angle = t * loops * Math.PI * 2;
               
               // Match particle radius
               const rBase = 6.2 - (t * 1.2); 
               const weave = Math.sin(angle * 5) * 0.2; 
               const r = rBase + weave + 0.2; // Slightly offset

               points.push(r*Math.cos(angle), h, r*Math.sin(angle));
               lightColors.push(1.0, 0.8, 0.0); // Gold
          }
      }
      else {
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
          
          let h, rBase;
          if (shape === 'stool') {
             // Updated Photo Layout for new size (match Ribbon height and taper)
             // Ribbon moves -10 to 9.5
             // Safe Photo range -8 to 8
             h = -8 + t * 16; 
             
             // Calculate Ribbon Radius at this height
             // Ribbon T relative to its own range (-10 to 9.5, range 19.5)
             // R = 9.5 - (T * 6.0)
             const ribbonT = (h - (-10)) / 19.5;
             const ribbonR = 9.5 - (ribbonT * 6.0);
             
             // Place photo slightly outside ribbon radius
             rBase = ribbonR + 0.5;
          } else {
             h = (t * 14) - 7; 
             rBase = getShapeRadiusAtY(h, shape);
          }

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
      if (shape === 'diamond') return '#a5f3fc'; 
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
      if (shape === 'diamond') base += 500; 
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
      
      {shape === 'diamond' && (
          <>
            <CrystalCore />
            <Pearls shape={shape} />
            <Diamonds shape={shape} />
          </>
      )}

      {shape === 'stool' && (
          <>
             <Stools />
             <StoolRibbon />
             <StoolGems />
          </>
      )}

      {treeStyle === 'geometric' && !isHighDensity && shape !== 'stool' && (
         <group>
             {geometricItems.map((item, i) => (
                 <GeometricBlock key={i} {...item} isExploded={isExploded} />
             ))}
         </group>
      )}

      {(treeStyle !== 'geometric' || isHighDensity || shape === 'stool') && (
        <points ref={foliageRef} key={`${shape}-${foliageColor}`}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial 
                transparent 
                vertexColors 
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
        {(!isMetallicMode || shape === 'real_tree' || shape === 'stool') && stringLights.positions.length > 0 && (
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

      {/* Top Ornament */}
      {(shape === 'tree' || shape === 'real_tree' || shape === 'diamond' || shape === 'twin_towers' || shape === 'stool') && (
        <group visible={!isExploded} position={[0, (shape === 'stool' ? 11.5 : (shape === 'tree' || shape === 'real_tree' || shape === 'diamond' || shape === 'twin_towers' ? height/2 + 0.5 : 0)), 0]}>
            {shape === 'real_tree' ? (
                 <group>
                     <Flower color="#f9a8d4" position={[0,0,0]} scale={2.8} />
                     <pointLight color="#fbbf24" intensity={4} distance={6} />
                     <Sparkles count={50} scale={3} size={15} color="#fff0f5" speed={0.8} />
                 </group>
            ) : shape === 'diamond' ? (
                <DiamondTopper />
            ) : shape === 'stool' ? (
                // Replaced Bell with Wreath at top of reduced stack
                <Wreath position={[0, -0.2, 0]} scale={1.5} />
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