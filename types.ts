
export type AppMode = 'tree' | 'focus' | 'album';

export type GestureType = 'Open_Palm' | 'Victory' | 'Closed_Fist' | 'None';

export type TreeStyle = 'classic' | 'crayon' | 'geometric';

export type TreeShape = 'tree' | 'snowman' | 'reindeer' | 'santa' | 'real_tree' | 'diamond' | 'twin_towers';

export interface PhotoData {
  id: string;
  url: string;
  version: number; // Used to force re-render when content changes
  isEmpty: boolean; // True if this slot is waiting for a user photo
}

export interface TreeConfig {
  radius: number;
  height: number;
  particleCount: number;
}