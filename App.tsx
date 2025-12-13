import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, Image, Float, Html, Hud, OrthographicCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Snow } from './components/Snow';
import { Tree, usePolkaDotTexture } from './components/Tree';
import { AppMode, PhotoData, GestureType, TreeStyle, TreeShape } from './types';
import { initializeHandDetection, detectHands } from './services/gesture';
import { saveFile, getFile, deleteFile, saveSettings, getSettings } from './services/storage';

// Helper: Compress/Resize Image to avoid Memory Crashes with 24+ photos
const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
        const img = document.createElement('img');
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1024; // Limit textures to 1K to save GPU/RAM

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height *= maxDim / width;
                    width = maxDim;
                } else {
                    width *= maxDim / height;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    resolve(blob || file); // Fallback to original if blob creation fails
                }, 'image/jpeg', 0.85); // 85% JPEG quality
            } else {
                URL.revokeObjectURL(url);
                resolve(file);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;
    });
};

// Safe generation of mock photos - NOW GENERATES EMPTY SLOTS
const createMockPhoto = (index: number): PhotoData => {
    // We start with NO image URL (or a transparent placeholder) and isEmpty=true
    return { 
        id: `slot-${index}`, 
        url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // Transparent 
        version: 0,
        isEmpty: true
    };
};

const TREE_COLORS = [
    '#064e3b', // Deep Green (Default)
    '#FFD700', // Golden Sparkles
    '#C0C0C0', // Silver Sparkles
    'rainbow'  // Seven-color Sparkles
];

const SHAPES: { id: TreeShape; icon: string; label: string }[] = [
    { id: 'tree', icon: '🎄', label: 'Tree' },
    { id: 'snowman', icon: '⛄', label: 'Snowman' },
    { id: 'reindeer', icon: '🦌', label: 'Reindeer' },
    { id: 'santa', icon: '🎅', label: 'Santa' },
    { id: 'real_tree', icon: '🌸', label: 'Sakura' },
    { id: 'diamond', icon: '💎', label: 'Diamond' },
    { id: 'twin_towers', icon: '🏙️', label: 'Towers' },
    { id: 'stool', icon: '🪑', label: '胶凳' }
];

const Ground = () => (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -9, 0]} receiveShadow>
        <circleGeometry args={[50, 64]} />
        <shadowMaterial transparent opacity={0.3} />
    </mesh>
);

// -- Gesture Legend Component --
const GestureLegend: React.FC<{ activeGesture: GestureType; visible: boolean }> = ({ activeGesture, visible }) => {
    if (!visible) return null;
    
    // Order: Palm -> Victory -> Fist
    const items: { type: GestureType; icon: string; color: string }[] = [
        { type: 'Open_Palm', icon: '✋', color: 'text-yellow-400' },
        { type: 'Victory', icon: '✌️', color: 'text-pink-400' },
        { type: 'Closed_Fist', icon: '✊', color: 'text-cyan-400' },
    ];

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex gap-6 animate-in fade-in slide-in-from-top-4 duration-700 pointer-events-none">
             {items.map((item) => {
                 const isActive = activeGesture === item.type;
                 return (
                    <div 
                        key={item.type} 
                        className={`
                            flex items-center justify-center w-14 h-14 rounded-full border backdrop-blur-md transition-all duration-300
                            ${isActive 
                                ? 'bg-white/20 border-white/50 scale-125 shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
                                : 'bg-black/20 border-white/10 opacity-60 grayscale'}
                        `}
                    >
                        <span className={`text-3xl filter drop-shadow-lg ${isActive ? 'animate-pulse' : ''}`}>
                            {item.icon}
                        </span>
                        {isActive && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
                        )}
                    </div>
                 );
             })}
        </div>
    );
};

// -- Focus Mode Polaroid --
interface PolaroidFocusProps { 
    photo: PhotoData; 
    onClose: () => void;
    onReplace: (id: string, file: File) => void;
}

const PolaroidFocus: React.FC<PolaroidFocusProps> = ({ photo, onClose, onReplace }) => {
    const { camera, size } = useThree();
    const groupRef = useRef<THREE.Group>(null);
    const overlayRef = useRef<THREE.Mesh>(null);
    const scaleRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Generate texture - Default white for focus view
    const texture = usePolkaDotTexture('#ffffff', ['#ef4444', '#22c55e'], false); 

    // Fixed distance from camera to ensure it's always "in front"
    const distance = 6; 

    useFrame((state, delta) => {
        // Calculate Scale to fill 50% of the screen area
        const vFov = (camera as THREE.PerspectiveCamera).fov;
        const height = 2 * Math.tan((vFov * Math.PI / 180) / 2) * distance;
        const width = height * (size.width / size.height);
        // Geometry is approx 5 x 6.5. Area ~ 32.5
        const targetScale = Math.sqrt((0.5 * width * height) / 32.5);

        // Smoothly animate scale
        scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, delta * 12);
        
        // 1. Lock Photo to Camera Center
        if (groupRef.current) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const pos = camera.position.clone().add(forward.multiplyScalar(distance));
            
            groupRef.current.position.copy(pos);
            groupRef.current.lookAt(camera.position);
            groupRef.current.scale.setScalar(scaleRef.current);
        }

        // 2. Lock Overlay behind Photo
        if (overlayRef.current) {
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const pos = camera.position.clone().add(forward.multiplyScalar(distance + 2));
            
            overlayRef.current.position.copy(pos);
            overlayRef.current.lookAt(camera.position);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onReplace(photo.id, e.target.files[0] as File);
            e.target.value = ''; 
        }
    };

    return (
        <>
            {/* Transparent Overlay to catch background clicks - Moves with camera */}
            <mesh 
                ref={overlayRef}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'auto'}>
                <planeGeometry args={[100, 100]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            <Float speed={2} rotationIntensity={0.05} floatIntensity={0.05}>
                <group 
                    ref={groupRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
                    onPointerOver={() => document.body.style.cursor = 'pointer'} 
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                >
                    {/* Textured Card */}
                    <mesh position={[0, -0.6, -0.05]}>
                        <boxGeometry args={[5, 6.5, 0.1]} />
                        <meshStandardMaterial map={texture} roughness={0.9} />
                    </mesh>
                    
                    <Image key={`${photo.url}-${photo.version}`} url={photo.url} position={[0, 0.5, 0.01]} scale={[4.5, 4.5]} toneMapped={false} />
                    
                    {/* Shine */}
                    <mesh position={[0, 0.5, 0.02]}>
                        <planeGeometry args={[4.5, 4.5]} />
                        <meshPhysicalMaterial transparent opacity={0.15} roughness={0} clearcoat={1} />
                    </mesh>

                    {/* Hidden input */}
                    <Html style={{ display: 'none' }}>
                         <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange}
                            />
                    </Html>
                </group>
            </Float>
        </>
    )
}

// -- Guide Overlay --
const GuideOverlay: React.FC<{ type: 'scroll' | 'diagonal' | 'click' | 'doubleClick' | null }> = ({ type }) => {
    if (!type) return null;
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            {type === 'scroll' && (
                <div className="flex flex-col items-center animate-bounce bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-white/20">
                    <span className="text-6xl mb-2 text-yellow-400">⬆️</span>
                    <span className="text-white text-3xl font-bold tracking-wider font-handwriting-cn">向上滑动</span>
                    <span className="text-white/70 text-sm mt-1">Scroll Up to Explode</span>
                </div>
            )}
            {type === 'diagonal' && (
                <div className="flex flex-col items-center animate-pulse bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-white/20">
                    <span className="text-6xl mb-2 text-purple-400">↗️</span>
                    <span className="text-white text-3xl font-bold tracking-wider font-handwriting-cn">斜着滑动</span>
                    <span className="text-white/70 text-sm mt-1">Swipe Diagonally</span>
                </div>
            )}
            {type === 'click' && (
                <div className="flex flex-col items-center bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-white/20 animate-pulse">
                     <span className="text-6xl mb-2 text-cyan-400">✨</span>
                     <span className="text-white text-3xl font-bold tracking-wider font-handwriting-cn">照片闪光</span>
                     <span className="text-white/70 text-sm mt-1">Click to View</span>
                </div>
            )}
            {type === 'doubleClick' && (
                <div className="flex flex-col items-center bg-black/40 backdrop-blur-sm p-6 rounded-3xl border border-white/20 animate-bounce">
                     <span className="text-6xl mb-2 text-pink-400">👆👆</span>
                     <span className="text-white text-3xl font-bold tracking-wider font-handwriting-cn">切换颜色</span>
                     <span className="text-white/70 text-sm mt-1">Double Click to Change Color</span>
                </div>
            )}
        </div>
    );
};

// -- Gesture Manager --
const GestureManager: React.FC<{
    videoRef: React.RefObject<HTMLVideoElement>;
    isCameraReady: boolean;
    onGesture: (gesture: GestureType, x: number) => void;
}> = ({ videoRef, isCameraReady, onGesture }) => {
    
    const lastUpdate = useRef(0);

    useFrame(({ clock }) => {
        if (!isCameraReady || !videoRef.current) return;
        
        const now = clock.elapsedTime;
        if (now - lastUpdate.current < 0.1) return; 
        
        lastUpdate.current = now;

        const result = detectHands(videoRef.current);
        if (result) {
            onGesture(result.gesture, result.x);
        } else {
            onGesture('None', 0.5);
        }
    });
    return null;
}

// -- Album Item --
const AlbumItem: React.FC<{ 
    photo: PhotoData; 
    onClick: () => void; 
    onDelete: (id: string) => void; 
}> = ({ photo, onClick, onDelete }) => {
    const [offsetY, setOffsetY] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const touchStartY = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta < 0) {
            setOffsetY(delta);
        }
    };

    const handleTouchEnd = () => {
        if (offsetY < -100 && !photo.isEmpty) { // Only delete if not empty
            setIsDeleting(true);
            setTimeout(() => onDelete(photo.id), 300);
        } else {
            setOffsetY(0);
        }
        touchStartY.current = null;
    };

    const style = {
        transform: `translateY(${offsetY}px) ${isDeleting ? 'scale(0)' : 'scale(1)'}`,
        opacity: isDeleting ? 0 : 1,
        transition: touchStartY.current === null ? 'all 0.3s ease-out' : 'none'
    };

    return (
        <div 
            className="snap-center shrink-0 w-64 h-80 relative group cursor-pointer"
            style={style}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => {
                if (offsetY === 0 && !isDeleting) onClick();
            }}
        >
                {/* Delete Indicator - only show if not empty */}
                {!photo.isEmpty && (
                    <div 
                        className={`absolute -top-12 left-0 w-full flex justify-center transition-opacity duration-300 ${offsetY < -50 ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <div className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm shadow-lg animate-bounce">
                            松手删除 🗑️
                        </div>
                    </div>
                )}

                {/* Photo Frame */}
                <div 
                className="w-full h-full p-3 pb-12 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transform rotate-1 group-hover:rotate-0 transition-transform origin-bottom"
                style={{ 
                    backgroundColor: '#ffffff',
                    backgroundImage: `
                        radial-gradient(#ef4444 3px, transparent 4px),
                        radial-gradient(#22c55e 3px, transparent 4px)
                    `,
                    backgroundSize: '40px 40px',
                    backgroundPosition: '0 0, 20px 20px'
                }}
                >
                <div className="w-full h-full bg-gray-200 overflow-hidden relative">
                    {photo.isEmpty ? (
                         <div className="w-full h-full flex items-center justify-center text-gray-400">
                             <div className="text-center">
                                 <div className="text-4xl mb-2">+</div>
                                 <div className="text-sm font-handwriting-cn">添加照片</div>
                             </div>
                         </div>
                    ) : (
                        <img src={photo.url} className="w-full h-full object-cover pointer-events-none" alt="memory" />
                    )}
                </div>
                <div className="absolute bottom-4 left-0 w-full text-center text-slate-800 text-sm font-handwriting-en">
                    {photo.isEmpty ? 'Empty Slot' : 'Memory'}
                </div>
                </div>
        </div>
    );
};

// -- Share Modal Component --
const ShareModal: React.FC<{ 
    onClose: () => void; 
    onGenerate: (name: string) => void;
    postcardUrl: string | null;
}> = ({ onClose, onGenerate, postcardUrl }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = () => {
        if (!name.trim()) return;
        setLoading(true);
        // Small delay to show loading state before heavy canvas op
        setTimeout(() => {
            onGenerate(name);
            setLoading(false);
        }, 100);
    };

    const handleDownload = () => {
        if (!postcardUrl) return;
        const a = document.createElement('a');
        a.href = postcardUrl;
        a.download = `Christmas-Card-${name}.png`;
        a.click();
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('链接已复制，快去分享给朋友吧！\nLink copied to clipboard!');
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300 p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/20 p-6 rounded-3xl max-w-md w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white text-2xl transition-colors">✕</button>
                
                <h2 className="text-2xl text-yellow-400 font-bold mb-6 text-center font-handwriting-cn">🎄 制作您的节日贺卡</h2>
                
                {!postcardUrl ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                             <label className="text-white/80 text-sm">请输入您的名字 / Enter your name:</label>
                             <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={12}
                                placeholder="Santa Claus"
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-colors text-center text-xl font-handwriting-en"
                             />
                        </div>
                        <button 
                            onClick={handleGenerate}
                            disabled={!name.trim() || loading}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${!name.trim() ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white active:scale-95'}`}
                        >
                            {loading ? '生成中...' : '✨ 生成贺卡'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4">
                        <div className="relative aspect-[3/4] w-full bg-black rounded-xl overflow-hidden border-2 border-[#fbbf24]/30 shadow-[0_0_20px_rgba(251,191,36,0.2)]">
                            <img src={postcardUrl} alt="Postcard" className="w-full h-full object-contain" />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleDownload}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                                <span>📥</span> 保存图片
                            </button>
                            
                            <button 
                                onClick={handleCopyLink}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                                <span>🔗</span> 复制链接
                            </button>
                        </div>
                         <button 
                            onClick={() => onGenerate(name)} // Re-generate
                            className="w-full text-white/40 text-xs hover:text-white/80 underline"
                        >
                            重新生成
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [mode, setMode] = useState<AppMode>('tree');
  const [activePhoto, setActivePhoto] = useState<PhotoData | null>(null);
  const [customTitle, setCustomTitle] = useState('Merry Christmas');
  const [headerTitle, setHeaderTitle] = useState('My Christmas Tree');
  
  // Specific upload target
  const [targetPhotoId, setTargetPhotoId] = useState<string | null>(null);
  const singleFileRef = useRef<HTMLInputElement>(null);

  // Interaction States
  const [isExploded, setIsExploded] = useState(false);
  const [isTwinkling, setIsTwinkling] = useState(false);
  
  // Tree Config
  const [treeColorIndex, setTreeColorIndex] = useState(0);
  const [treeStyle, setTreeStyle] = useState<TreeStyle>('classic');
  const [treeShape, setTreeShape] = useState<TreeShape>('tree');

  const [isRecording, setIsRecording] = useState(false);
  const [gestureX, setGestureX] = useState(0);
  const [showGreeting, setShowGreeting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Audio Recording Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourceNodeCreated = useRef(false);

  // Menu State
  const [menuOpen, setMenuOpen] = useState(false);

  // Guide State for Video
  const [guideType, setGuideType] = useState<'scroll' | 'diagonal' | 'click' | 'doubleClick' | null>(null);

  // Share State
  const [showShareModal, setShowShareModal] = useState(false);
  const [postcardUrl, setPostcardUrl] = useState<string | null>(null);

  // Gesture State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const lastColorChange = useRef(0);
  const [lastGesture, setLastGesture] = useState<GestureType>('None');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const albumRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const scrollAccumulator = useRef(0);
  const scrollTimeout = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Hint State
  const [colorHintVisible, setColorHintVisible] = useState(false);
  const colorHintCount = useRef(0);
  
  const [zoomHintVisible, setZoomHintVisible] = useState(false);
  const zoomHintCount = useRef(0);

  // Mobile Detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Load Persisted Data (Hydration)
  useEffect(() => {
    const loadState = async () => {
        try {
            // 1. Load Config
            const config = await getSettings('appConfig');
            if (config) {
                if (config.treeColorIndex !== undefined) setTreeColorIndex(config.treeColorIndex);
                if (config.treeStyle) setTreeStyle(config.treeStyle);
                if (config.treeShape) setTreeShape(config.treeShape);
                if (config.customTitle) setCustomTitle(config.customTitle);
                if (config.headerTitle) setHeaderTitle(config.headerTitle);
            }

            // 2. Load Photos
            const photoMeta = await getSettings('photoMeta');
            if (photoMeta && Array.isArray(photoMeta) && photoMeta.length > 0) {
                const rehydratedPhotos = await Promise.all(photoMeta.map(async (p: any) => {
                    let url = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    if (!p.isEmpty) {
                        const blob = await getFile(p.id);
                        if (blob) {
                            url = URL.createObjectURL(blob);
                        }
                    }
                    return { ...p, url }; 
                }));
                setPhotos(rehydratedPhotos);
            } else {
                 // Default Init
                 const newPhotos = Array.from({ length: 24 }).map((_, i) => createMockPhoto(i));
                 setPhotos(newPhotos);
            }

            // 3. Load Audio
            const audioBlob = await getFile('bg-music');
            if (audioBlob) {
                setAudioUrl(URL.createObjectURL(audioBlob));
            }

        } catch (e) {
            console.error("Failed to load saved state", e);
            // Fallback
            const newPhotos = Array.from({ length: 24 }).map((_, i) => createMockPhoto(i));
            setPhotos(newPhotos);
        }
    };
    loadState();
  }, []);

  // Persist Config Changes
  useEffect(() => {
    saveSettings('appConfig', { treeColorIndex, treeStyle, treeShape, customTitle, headerTitle });
  }, [treeColorIndex, treeStyle, treeShape, customTitle, headerTitle]);

  // Persist Photo Meta Changes (Debounced via useEffect is acceptable for metadata)
  useEffect(() => {
    if (photos.length > 0) {
        const photoMeta = photos.map(p => ({
            id: p.id,
            version: p.version,
            isEmpty: p.isEmpty
        }));
        saveSettings('photoMeta', photoMeta);
    }
  }, [photos]);

  // Ghostly Hint Logic (Color Change)
  useEffect(() => {
      let timeout: number;
      
      const runCycle = () => {
          if (colorHintCount.current >= 3) return;
          
          // Show
          setColorHintVisible(true);
          
          // Hide after 3s
          timeout = window.setTimeout(() => {
              setColorHintVisible(false);
              colorHintCount.current++;
              
              // Schedule next (only if count < 3)
              if (colorHintCount.current < 3) {
                  timeout = window.setTimeout(runCycle, 8000); // 8s interval
              }
          }, 3000);
      };

      // Initial delay: 4s
      timeout = window.setTimeout(runCycle, 4000);
      
      return () => clearTimeout(timeout);
  }, []);

  // Ghostly Hint Logic (Zoom) - Interleaved
  useEffect(() => {
      let timeout: number;
      
      const runCycle = () => {
          if (zoomHintCount.current >= 3) return;
          
          // Show
          setZoomHintVisible(true);
          
          // Hide after 3s
          timeout = window.setTimeout(() => {
              setZoomHintVisible(false);
              zoomHintCount.current++;
              
              // Schedule next (only if count < 3)
              if (zoomHintCount.current < 3) {
                  timeout = window.setTimeout(runCycle, 8000); // 8s interval
              }
          }, 3000);
      };

      // Initial delay: 8s (4s after Color hint starts)
      timeout = window.setTimeout(runCycle, 8000);
      
      return () => clearTimeout(timeout);
  }, []);
  
  // Derived state for empty slots
  const emptySlotsCount = useMemo(() => photos.filter(p => p.isEmpty).length, [photos]);

  useEffect(() => {
    const init = async () => {
        const success = await initializeHandDetection();
        if (success && videoRef.current) {
             try {
                 const stream = await navigator.mediaDevices.getUserMedia({ 
                     video: { width: 320, height: 240, facingMode: 'user' } 
                 });
                 videoRef.current.srcObject = stream;
                 videoRef.current.onloadeddata = () => {
                    setIsCameraReady(true);
                    videoRef.current?.play().catch(e => console.error("Video play failed", e));
                 };
             } catch (err) {
                 console.warn("Camera access denied or failed", err);
             }
        }
    };
    init();
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (mode === 'tree') {
      setTreeColorIndex((prev) => (prev + 1) % TREE_COLORS.length);
    }
  }, [mode]);

  // Audio Playback & Context Initialization
  useEffect(() => {
    if(audioUrl && audioRef.current) {
        const audioEl = audioRef.current;
        audioEl.src = audioUrl;
        
        // --- MOVED SETUP OUTSIDE OF ASYNC PLAY ---
        // Initialize AudioContext ONLY ONCE
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }

        const ctx = audioContextRef.current;

        // Initialize MediaElementSource ONLY ONCE per lifetime of the app
        if (!audioSourceNodeCreated.current) {
            try {
                const source = ctx.createMediaElementSource(audioEl);
                const dest = ctx.createMediaStreamDestination();
                
                // Connect to speakers so user can hear it
                source.connect(ctx.destination);
                // Connect to destination for recording
                source.connect(dest);
                
                audioSourceRef.current = source;
                audioDestRef.current = dest;
                audioSourceNodeCreated.current = true;
            } catch (err) {
                console.error("Error creating MediaElementSource:", err);
            }
        }
        // ------------------------------------------

        // Setup simple one-shot global listener for "Click to play" (Browser Policy)
        const resumeAudio = () => {
             if (audioRef.current && audioRef.current.paused && audioUrl) {
                 audioRef.current.play().catch(() => {});
             }
             if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                 audioContextRef.current.resume();
             }
        };

        const playAudio = async () => {
            try {
                // Resume context first
                if (ctx.state === 'suspended') {
                    await ctx.resume();
                }
                await audioEl.play();
            } catch (e) {
                console.log("Audio autoplay blocked. Waiting for user interaction...");
                // Add listener if autoplay failed
                window.addEventListener('click', resumeAudio);
                window.addEventListener('touchstart', resumeAudio);
            }
        };

        playAudio();

        // Always add the listener as a fallback or for when tab becomes active again
        window.addEventListener('click', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);

        return () => {
             window.removeEventListener('click', resumeAudio);
             window.removeEventListener('touchstart', resumeAudio);
        };
    }
  }, [audioUrl]);

  const handleGesture = useCallback((gesture: GestureType, x: number) => {
      // 1. Open Palm - Explode
      if (gesture === 'Open_Palm') {
          setIsExploded(true);
      } else if (lastGesture === 'Open_Palm') {
          setIsExploded(false);
      }

      // 2. Closed Fist - Rotate & Change Color (Disco Mode)
      if (gesture === 'Closed_Fist') {
          setIsTwinkling(true);
          
          const now = Date.now();
          // Cycle colors rapidly while holding
          if (now - lastColorChange.current > 300) {
              setTreeColorIndex(prev => (prev + 1) % TREE_COLORS.length);
              lastColorChange.current = now;
          }
      } else if (lastGesture === 'Closed_Fist') {
          setIsTwinkling(false);
      }

      // 3. Victory - Random Photo
      if (gesture === 'Victory' && lastGesture !== 'Victory') {
          // Trigger only on rising edge (entry)
          const validPhotos = photos.filter(p => !p.isEmpty);
          if (validPhotos.length > 0) {
              const randomPhoto = validPhotos[Math.floor(Math.random() * validPhotos.length)];
              setActivePhoto(randomPhoto);
              setMode('focus');
          }
      }
      
      // Rotation Logic
      if (gesture === 'Closed_Fist') {
          // Force fast spin
          setGestureX(3.0);
      } else if (gesture !== 'None') {
          // Standard hand tracking rotation
          const rotationSpeed = (x - 0.5) * 4;
          setGestureX(rotationSpeed);
      } else {
          setGestureX(0);
      }

      setLastGesture(gesture);
  }, [lastGesture, photos]);


  const handleWheel = (e: React.WheelEvent) => {
      if (mode !== 'tree') return;
      
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

      scrollAccumulator.current += e.deltaY;

      scrollTimeout.current = window.setTimeout(() => {
          scrollAccumulator.current = 0;
      }, 200);

      const threshold = 500; 

      if (scrollAccumulator.current < -threshold && !isExploded) {
          setIsExploded(true);
          scrollAccumulator.current = 0;
      } 
      else if (scrollAccumulator.current > threshold && isExploded) {
          setIsExploded(false);
          scrollAccumulator.current = 0;
      }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (touchStartY.current === null || mode !== 'tree') return;
      
      const currentY = e.touches[0].clientY;
      const diff = touchStartY.current - currentY; 
      
      const swipeThreshold = 150; 

      if (diff > swipeThreshold && !isExploded) {
          setIsExploded(true);
          touchStartY.current = null;
      } 
      else if (diff < -swipeThreshold && isExploded) {
          setIsExploded(false);
          touchStartY.current = null;
      }
  };

  // --- Main Upload Handlers ---

  // Handle BULK upload from menu
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Get FRESH empty slots
      const emptySlots = photos.filter(p => p.isEmpty);
      const maxAllowed = emptySlots.length;
      let files = Array.from(e.target.files as FileList);

      if (files.length === 0) return;

      if (maxAllowed === 0) {
           alert("没有空余的照片位了！\nNo empty slots available!");
           return;
      }

      if (files.length > maxAllowed) {
           alert(`您选择了 ${files.length} 张照片，但当前只有 ${maxAllowed} 个空位。\n为了保持流畅，系统将只导入前 ${maxAllowed} 张。\n\nYou selected ${files.length} photos, but there are only ${maxAllowed} empty slots.\nOnly the first ${maxAllowed} will be imported.`);
           files = files.slice(0, maxAllowed);
      }

      // 1. Process files and compress them before saving
      let fileIndex = 0;
      const photosClone = [...photos];
      
      for (let i = 0; i < photosClone.length; i++) {
          if (photosClone[i].isEmpty && fileIndex < files.length) {
              const file = files[fileIndex];
              
              try {
                // Compress/Resize image before saving to DB or State
                const compressedBlob = await compressImage(file);
                await saveFile(photosClone[i].id, compressedBlob);
                
                // Update Local State URL with compressed version
                photosClone[i] = {
                    ...photosClone[i],
                    url: URL.createObjectURL(compressedBlob),
                    isEmpty: false,
                    version: photosClone[i].version + 1
                };
              } catch(err) {
                  console.error("Compression failed", err);
                  // Fallback to original
                  await saveFile(photosClone[i].id, file);
                  photosClone[i] = {
                      ...photosClone[i],
                      url: URL.createObjectURL(file),
                      isEmpty: false,
                      version: photosClone[i].version + 1
                  };
              }
              
              fileIndex++;
          }
      }

      // 2. Update State Once (Using the mutated clone)
      setPhotos(photosClone);
      e.target.value = '';
    }
  };

  // Handle SINGLE slot upload (triggered by click on empty frame)
  const handleSingleSlotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && targetPhotoId) {
          const file = e.target.files[0] as File;
          
          // Fixed: Explicitly type as Blob because compressImage returns Blob which is not assignable to inferred File type
          let blob: Blob = file;
          try {
              blob = await compressImage(file);
          } catch(e) { console.warn("Compression failed, using original", e); }
          
          await saveFile(targetPhotoId, blob); // Save to DB

          const url = URL.createObjectURL(blob);
          
          setPhotos(prev => prev.map(p => {
              if (p.id === targetPhotoId) {
                  return { ...p, url, isEmpty: false, version: p.version + 1 };
              }
              return p;
          }));
          
          setTargetPhotoId(null);
          e.target.value = '';
      }
  }

  const handleReplacePhoto = async (id: string, file: File) => {
      let blob: Blob = file;
      try {
          blob = await compressImage(file);
      } catch(e) { console.warn("Compression failed", e); }

      await saveFile(id, blob); // Save to DB
      const newUrl = URL.createObjectURL(blob);
      
      setPhotos(prev => prev.map(p => 
          p.id === id ? { ...p, url: newUrl, version: (p.version || 0) + 1, isEmpty: false } : p
      ));
      
      if (activePhoto && activePhoto.id === id) {
          setActivePhoto({ ...activePhoto, url: newUrl, version: (activePhoto.version || 0) + 1, isEmpty: false });
      }
  };

  const handleDeletePhoto = async (id: string) => {
      await deleteFile(id); // Delete from DB
      // Instead of removing from array (which shifts tree), reset to empty
      setPhotos(prev => prev.map(p => 
          p.id === id ? { ...p, url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', isEmpty: true, version: p.version + 1 } : p
      ));
      if (activePhoto && activePhoto.id === id) {
          setActivePhoto(null);
          setMode('tree');
      }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0] as File;
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          
          await saveFile('bg-music', file); // Save to DB

          const url = URL.createObjectURL(file);
          setAudioUrl(url);
          e.target.value = '';
      }
  }

  const handlePhotoClick = (photo: PhotoData) => {
    // FIX: Block manual interaction during recording to prevent accidental popups,
    // but allow programmatic changes (from generateVideo script) to happen.
    if (isRecording) return;

    if (mode === 'tree') {
      if (photo.isEmpty) {
          // If empty, trigger upload for this specific slot
          setTargetPhotoId(photo.id);
          singleFileRef.current?.click();
      } else {
          // If full, view it
          setActivePhoto(photo);
          setMode('focus');
      }
    }
  };

  const handleCloseFocus = () => {
      if (mode === 'focus') {
          setMode('tree');
          setActivePhoto(null);
      }
  };

  const toggleTreeShape = () => {
      setTreeShape(prev => {
          if (prev === 'tree') return 'snowman';
          if (prev === 'snowman') return 'reindeer';
          if (prev === 'reindeer') return 'santa';
          if (prev === 'santa') return 'real_tree';
          if (prev === 'real_tree') return 'diamond';
          if (prev === 'diamond') return 'twin_towers';
          if (prev === 'twin_towers') return 'stool';
          return 'tree';
      });
  };

  const handleGeneratePostcard = async (name: string) => {
    // 1. Get WebGL Canvas
    const webglCanvas = document.querySelector('canvas');
    if (!webglCanvas) return;

    // 2. Create high-res composite canvas
    // Using a standard postcard aspect ratio (3:4) or matching screen
    const width = 1080;
    const height = 1440; 
    
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const ctx = compositeCanvas.getContext('2d');
    if (!ctx) return;

    // 3. Draw Black Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 4. Draw WebGL Snapshot (Cover fit)
    // Calc aspect ratios
    const srcAspect = webglCanvas.width / webglCanvas.height;
    const destAspect = width / height;
    
    let drawW, drawH, drawX, drawY;
    if (srcAspect > destAspect) {
        // Source is wider, crop sides
        drawH = height;
        drawW = height * srcAspect;
        drawX = (width - drawW) / 2;
        drawY = 0;
    } else {
        // Source is taller, crop top/bottom
        drawW = width;
        drawH = width / srcAspect;
        drawX = 0;
        drawY = (height - drawH) / 2;
    }

    ctx.drawImage(webglCanvas, drawX, drawY, drawW, drawH);

    // 5. Draw Gradient Overlay at bottom for text visibility
    const gradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.8, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);

    // 6. Draw "Merry Christmas" (Simulating the end effect)
    // Glow
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 40;
    
    // Text - Updated to Pinyon Script for elegance
    ctx.font = 'bold 160px "Pinyon Script", cursive'; 
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(customTitle, width / 2, height * 0.75);
    
    // Reset Shadow for subtext
    ctx.shadowBlur = 0;

    // 7. Draw "From: [Name]"
    ctx.font = '40px "Ma Shan Zheng", cursive';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`From: ${name}`, width / 2, height * 0.85);
    
    // 8. Draw Date / Watermark
    ctx.font = '30px "Pinyon Script", cursive';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Made with 3D Christmas Tree @Lpanda233', width / 2, height * 0.95);

    // 9. Convert to Data URL
    setPostcardUrl(compositeCanvas.toDataURL('image/png'));
  };

  const generateVideo = useCallback(async () => {
    if (isRecording) return;
    setIsRecording(true);
    setMenuOpen(false); 
    setMode('tree');
    setShowGreeting(false);
    setIsExploded(false); 
    setIsTwinkling(false);
    setGestureX(0);
    setTreeColorIndex(0); 

    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    // 1. Ensure Audio is Playing for the recording & Context is valid
    if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = 0; // Restart music for the video
        try {
            await audioRef.current.play();
        } catch (e) {
            console.error("Video recording: Auto-play failed", e);
        }
    }
    
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    const videoStream = canvas.captureStream(30);
    
    // 2. Explicitly combine Video and Audio tracks
    const tracks = [...videoStream.getVideoTracks()];
    if (audioDestRef.current) {
        const audioTracks = audioDestRef.current.stream.getAudioTracks();
        if (audioTracks.length > 0) {
            tracks.push(audioTracks[0]);
        }
    }
    
    let combinedStream = new MediaStream(tracks);

    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
    }
    
    const recorder = new MediaRecorder(combinedStream, { mimeType });
    mediaRecorderRef.current = recorder;
    recordedChunks.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      a.download = `christmas-memory.${ext}`;
      a.click();
      setIsRecording(false);
      setMode('tree');
      setShowGreeting(false);
      setIsExploded(false);
      setGuideType(null);
      setGestureX(0);
      setIsTwinkling(false);
    };

    recorder.start();

    // -- Choreographed Sequence (4 Steps) --
    // ... (Keep existing choreography sequence, omitted for brevity but logic remains same)
    
    setTimeout(() => setGuideType('scroll'), 1500); 
    setTimeout(() => { setIsExploded(true); setGuideType(null); }, 4000); 
    setTimeout(() => setIsExploded(false), 7000);
    setTimeout(() => setGuideType('diagonal'), 8500); 
    setTimeout(() => { setGuideType(null); setIsTwinkling(true); setGestureX(0.5); }, 11000); 
    setTimeout(() => { setIsTwinkling(false); setGestureX(0); }, 14000);
    setTimeout(() => setGuideType('click'), 15000); 
    setTimeout(() => {
        setGuideType(null);
        // Find first non-empty photo for focus
        const validPhoto = photos.find(p => !p.isEmpty) || photos[0];
        setActivePhoto(validPhoto);
        setMode('focus');
    }, 17500); 
    setTimeout(() => { setMode('tree'); setActivePhoto(null); }, 20500);
    setTimeout(() => setGuideType('doubleClick'), 22000); 
    setTimeout(() => { setGuideType(null); setTreeColorIndex(1); }, 24500);
    setTimeout(() => setTreeColorIndex(2), 25500); 
    setTimeout(() => setTreeColorIndex(3), 26500); 
    
    // -- UPDATED SEQUENCE: Extended to capture "Merry Christmas" for exactly 3s after fade --
    setTimeout(() => setShowGreeting(true), 28000); // Fade in starts
    // Greeting takes 1s to fade in -> visible at 29s.
    // End 3s after visible -> 32s.
    setTimeout(() => recorder.stop(), 32000); 

  }, [isRecording, photos, audioUrl]);

  return (
    <div 
        className="w-full h-screen bg-[#000] relative text-slate-100 font-handwriting-cn selection:bg-amber-500/30 overflow-hidden select-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onDoubleClick={handleDoubleClick}
    >
      <audio ref={audioRef} loop crossOrigin="anonymous" />
      <video ref={videoRef} className="hidden" playsInline autoPlay muted />
      
      {/* Hidden input for single slot upload */}
      <input ref={singleFileRef} type="file" accept="image/*" onChange={handleSingleSlotUpload} className="hidden" />

      {/* BLOCKING OVERLAY REMOVED TO ALLOW CAMERA ROTATION */}

      <GuideOverlay type={guideType} />

      {/* Color Change Hint - Ghostly appearing 3 times */}
      <div 
          className={`absolute top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-[2000ms] ${colorHintVisible && !isRecording && mode === 'tree' ? 'opacity-40' : 'opacity-0'}`}
      >
          <div className="bg-white/5 backdrop-blur-[1px] px-6 py-2 rounded-full border border-white/5 text-white font-handwriting-cn text-lg tracking-widest shadow-2xl flex items-center gap-3">
              <span className="text-yellow-200 animate-pulse">✨</span>
              <span>双击切换颜色</span>
              <span className="text-yellow-200 animate-pulse">✨</span>
          </div>
      </div>

      {/* Zoom Hint - Alternates with Color Hint */}
      <div 
          className={`absolute top-44 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-[2000ms] ${zoomHintVisible && !isRecording && mode === 'tree' ? 'opacity-40' : 'opacity-0'}`}
      >
          <div className="bg-white/5 backdrop-blur-[1px] px-6 py-2 rounded-full border border-white/5 text-white font-handwriting-cn text-lg tracking-widest shadow-2xl flex items-center gap-3">
              <span className="text-cyan-200 animate-pulse">🔍</span>
              <span>手指放大缩小</span>
              <span className="text-cyan-200 animate-pulse">🔍</span>
          </div>
      </div>

      {/* HTML Watermark Overlay (Not recorded by canvas stream) */}
      {!isRecording && (
        <div className="absolute top-6 right-6 z-30 pointer-events-none opacity-80 animate-pulse mix-blend-screen">
          <span className="font-handwriting-en text-xl text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">
            @Lpanda233
          </span>
        </div>
      )}

      {/* Quick Batch Upload Button - Visible if there are empty slots */}
      {mode === 'tree' && !isRecording && photos.some(p => p.isEmpty) && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40">
            <label className="flex flex-col items-center gap-2 cursor-pointer group hover:scale-105 transition-transform duration-300">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 border-4 border-white/30 shadow-[0_0_30px_rgba(34,197,94,0.6)] flex items-center justify-center animate-bounce">
                    <span className="text-4xl filter drop-shadow-md">📸</span>
                </div>
                <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/20 text-white font-bold font-handwriting-cn shadow-lg flex flex-col items-center">
                    <span className="text-xl">一键填满</span>
                    <span className="text-xs text-green-200 mt-1 font-sans font-normal">(还缺 {emptySlotsCount} 张)</span>
                </div>
                <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleBulkUpload} 
                    className="hidden" 
                />
            </label>
        </div>
      )}

      <Canvas 
        ref={canvasRef}
        shadows 
        dpr={[1, 1.5]} 
        gl={{ preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, alpha: false }}
        camera={{ position: [0, 2, isMobile ? 55 : 36], fov: 45 }}
      >
        <color attach="background" args={['#000']} />
        
        {/* Environment is critical for Pearl and Glass/Diamond materials */}
        <Environment preset="city" />

        <GestureManager videoRef={videoRef} isCameraReady={isCameraReady} onGesture={handleGesture} />
        
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={1} fade speed={1} />
        <ambientLight intensity={0.2} color="#4c1d95" />
        <spotLight position={[10, 20, 10]} angle={0.5} intensity={1.5} color="#fbbf24" castShadow />
        <pointLight position={[-10, 5, -10]} intensity={2} color="#2dd4bf" distance={40} />

        <group position={[0, -2, 0]}>
            <Snow />
            <Ground />
            
            <group visible={mode !== 'album' || isRecording}>
                <Tree 
                    photos={photos} 
                    onPhotoClick={handlePhotoClick} 
                    isExploded={isExploded}
                    isTwinkling={isTwinkling}
                    gestureRotation={gestureX}
                    foliageColor={TREE_COLORS[treeColorIndex]}
                    treeStyle={treeStyle}
                    shape={treeShape}
                />
                
                {/* 3D Header Title sitting above the tree (Raised to Y=15) - Updated to Cinzel Uppercase */}
                {!isExploded && mode === 'tree' && (
                    <Html position={[0, 15, 0]} center zIndexRange={[50, 0]} className="pointer-events-none">
                        <div className="text-center whitespace-nowrap select-none">
                            <h1 className="text-4xl md:text-6xl text-slate-100 font-serif-card drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] animate-pulse tracking-widest uppercase" style={{ textShadow: '0 0 15px rgba(255,255,255,0.4)' }}>
                                {headerTitle}
                            </h1>
                        </div>
                    </Html>
                )}
            </group>
        </group>

        {mode === 'focus' && activePhoto && (
            <PolaroidFocus 
                photo={activePhoto} 
                onClose={handleCloseFocus} 
                onReplace={handleReplacePhoto}
            />
        )}

        <EffectComposer enableNormalPass={false}>
          {/* Reduced intensity to prevent overexposure/fog effect */}
          <Bloom luminanceThreshold={1.5} intensity={0.4} levels={9} mipmapBlur />
          <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>

        <OrbitControls 
            enabled={mode === 'tree'}
            enableZoom={mode === 'tree'} 
            enablePan={false} 
            maxPolarAngle={Math.PI / 1.9} 
            minPolarAngle={Math.PI / 3}
            autoRotate={mode === 'tree' && !isRecording && gestureX === 0}
            autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* --- UI Controls --- */}
      <GestureLegend activeGesture={lastGesture} visible={isCameraReady && !isRecording} />

      <div className={`absolute top-6 right-6 z-50 flex items-center gap-3 bg-red-500/20 px-4 py-2 rounded-full backdrop-blur border border-red-500/50 transition-opacity duration-300 ${isRecording ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
          <span className="text-white font-bold font-mono tracking-widest text-sm">REC</span>
      </div>

      <div className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMenuOpen(false)} />
      
      {/* Settings Panel - Reduced opacity (bg-slate-900/40) for better visibility */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full md:w-96 bg-slate-900/40 backdrop-blur-md border-l border-white/10 transform transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
          <div className="p-6 space-y-8 min-h-full">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white font-handwriting-cn">控制面板 <span className="text-sm opacity-50 font-sans">Settings</span></h2>
                <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">✕</button>
            </div>

            {/* Header Title Section */}
            <div className="space-y-3">
                 <label className="text-sm text-yellow-300 font-bold tracking-wider uppercase">标题 / Title</label>
                 <div className="relative">
                    <input 
                        type="text" 
                        value={headerTitle} 
                        onChange={e => setHeaderTitle(e.target.value)}
                        className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-colors font-serif-card text-xl uppercase tracking-widest"
                        placeholder="My Christmas Tree"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">✨</span>
                 </div>
            </div>

            {/* Greeting Section (Renamed from Title) */}
            <div className="space-y-3">
                 <label className="text-sm text-blue-300 font-bold tracking-wider uppercase">贺卡祝福语 / Card Greeting</label>
                 <div className="relative">
                    <input 
                        type="text" 
                        value={customTitle} 
                        onChange={e => setCustomTitle(e.target.value)}
                        className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-400 transition-colors font-handwriting-en text-xl"
                        placeholder="Merry Christmas"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl">✍️</span>
                 </div>
            </div>

            {/* Shape Section */}
            <div className="space-y-3">
                <label className="text-sm text-green-300 font-bold tracking-wider uppercase">造型 / Shape</label>
                <div className="grid grid-cols-4 gap-3">
                    {SHAPES.map(shape => (
                        <button 
                            key={shape.id} 
                            onClick={() => setTreeShape(shape.id)}
                            className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-200 group relative overflow-hidden ${treeShape === shape.id ? 'bg-white/20 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                        >
                            <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">{shape.icon}</span>
                            <span className="text-[10px] text-white/60 font-sans">{shape.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Color Section */}
             <div className="space-y-3">
                <label className="text-sm text-purple-300 font-bold tracking-wider uppercase">颜色 / Color</label>
                <div className="flex gap-4 p-2 bg-white/5 rounded-xl justify-around">
                    {TREE_COLORS.map((color, index) => (
                        <button
                            key={index}
                            onClick={() => setTreeColorIndex(index)}
                            className={`w-12 h-12 rounded-full border-2 transition-all ${treeColorIndex === index ? 'border-white scale-110 shadow-[0_0_10px_white]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                            style={{ 
                                backgroundColor: color === 'rainbow' ? 'transparent' : color, 
                                backgroundImage: color === 'rainbow' ? 'linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6)' : 'none' 
                            }}
                        />
                    ))}
                </div>
             </div>

             {/* Action Buttons */}
             <div className="pt-6 border-t border-white/10 space-y-4">
                 <label className="text-sm text-gray-400 font-bold tracking-wider uppercase">操作 / Actions</label>
                 
                 <button 
                    onClick={() => { setMode(mode === 'album' ? 'tree' : 'album'); setMenuOpen(false); }}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center justify-center gap-3 transition-all group"
                 >
                     <span className="text-2xl group-hover:scale-110 transition-transform">{mode === 'album' ? '🎄' : '🖼️'}</span>
                     <span className="font-bold text-white">{mode === 'album' ? '返回圣诞树 / Back to Tree' : '相册模式 / Album Mode'}</span>
                 </button>

                 <label className="flex items-center gap-3 p-4 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-white/10">
                    <span className="text-2xl">🎵</span>
                    <div className="flex-1">
                        <div className="font-bold text-white">背景音乐</div>
                        <div className="text-xs text-white/50">点击更换 / Change Music</div>
                    </div>
                    <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                 </label>

                 <button 
                    onClick={() => generateVideo()}
                    disabled={isRecording}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isRecording ? 'bg-red-500/50 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white'}`}
                 >
                    {isRecording ? (
                        <>
                            <span className="animate-spin">⏳</span> 录制中...
                        </>
                    ) : (
                        <>
                            <span className="animate-bounce">🎥</span> 生成祝福视频
                        </>
                    )}
                 </button>
                 
                 <button 
                    onClick={() => { setShowShareModal(true); setMenuOpen(false); }}
                    className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                 >
                     <span>📮</span> 制作贺卡 / Card
                 </button>
             </div>
          </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
          <ShareModal 
            onClose={() => setShowShareModal(false)} 
            onGenerate={handleGeneratePostcard}
            postcardUrl={postcardUrl}
          />
      )}

      {/* Settings Toggle Button - BOTTOM RIGHT */}
      {!menuOpen && !isRecording && (
        <button 
            onClick={() => setMenuOpen(true)}
            className="absolute bottom-8 right-8 z-40 w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all hover:bg-white/20 hover:scale-110 active:scale-95 group"
        >
            {/* Ping effect for dynamic visibility */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-20 animate-[ping_2s_ease-in-out_infinite]"></span>
            
            <span className="text-3xl opacity-80 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-500 relative z-10">⚙️</span>
        </button>
      )}

      {/* Album Overlay */}
      {mode === 'album' && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 flex flex-col">
            <div className="p-6 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent border-b border-white/10">
                <h2 className="text-3xl text-yellow-400 font-handwriting-cn font-bold">🎄 圣诞回忆录</h2>
                <button onClick={() => setMode('tree')} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors border border-white/10">
                    返回
                </button>
            </div>
            
            <div ref={albumRef} className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 content-start pb-24 no-scrollbar">
                {photos.map((photo, index) => (
                     <div key={photo.id} className="relative group">
                        <div className="aspect-[3/4]">
                            <AlbumItem 
                                photo={photo} 
                                onClick={() => {}} 
                                onDelete={handleDeletePhoto}
                            />
                        </div>
                        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white/70 font-mono backdrop-blur-sm">
                            #{index + 1}
                        </div>
                     </div>
                ))}
            </div>
        </div>
      )}

    </div>
  );
};

export default App;