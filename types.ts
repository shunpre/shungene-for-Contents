
export interface UploadedFile {
  id: string;
  name: string;
  content: string;
  source: 'local' | 'drive' | 'paste' | 'url';
  size: number;
  mimeType?: string;
  data?: string; // Base64 encoded string
  assetType?: 'product' | 'character' | 'voice' | 'analysis_material' | 'design_reference' | 'other'; // User-defined asset category
}

export interface ProductProfile {
  productName: string;
  category: string;
  targetAudience: string;
  painPoints: string[];
  solutions: string[];
  uniqueValueProposition: string;
  toneOfVoice: string;
  // Enhanced Marketing Fields
  price?: string;
  discountOffer?: string;
  authority?: string;
  scarcity?: string;
  uniqueness?: string;
  trackRecord?: string;
}

export interface DesignSpec {
  layoutBlueprint: string; // Specific layout instruction (e.g. "Image top 50%, Text bottom 50%")
  visualAssetInstruction: string; // Specific instruction on which asset to use (e.g. "Use uploaded file product_A.jpg")
  typographyInstruction: string; // Font weight, size, color instructions
  colorPalette: string; // Hex codes or color names
}

export interface SwipeScreenHistory {
  designSpec?: DesignSpec;
  imageData?: string;
  timestamp: number;
}

export interface MangaPanel {
  panelNumber: number;
  situation: string; // Visual description of the scene
  dialogue: string; // Character speech
  characterExpression?: string; // e.g., "Crying", "Smiling"
}

export interface SwipeScreen {
  order: number;
  type: 'hook' | 'problem' | 'empathy' | 'solution' | 'benefit' | 'proof' | 'cta';
  title: string;
  mainCopy: string;
  designNote?: string;
  visualStyle: 'manga' | 'standard';

  // Polymorphic Fields
  designSpec?: DesignSpec; // Required for 'standard' style
  mangaScript?: {
    panel1: MangaPanel;
    panel2: MangaPanel;
    panel3: MangaPanel;
    panel4: MangaPanel;
  }; // Required for 'manga' style

  // App State
  imageData?: string; // Base64 encoded final image
  history?: SwipeScreenHistory[]; // History for undo functionality
  redoHistory?: SwipeScreenHistory[]; // History for redo functionality
}

export interface SwipeLP {
  screens: SwipeScreen[];
  concept: string;
  mainCharacterDesign?: string; // Consistent character description for Manga Mode
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  GENERATING_LP = 'GENERATING_LP',
  LP_CREATED = 'LP_CREATED', // Text/Structure is ready
  GENERATING_VISUALS = 'GENERATING_VISUALS', // Generating Design Specs AND Images sequentially
  VISUALS_COMPLETE = 'VISUALS_COMPLETE', // All images ready
  ERROR = 'ERROR'
}

export interface AnalysisResponse {
  profile: ProductProfile;
  summary: string;
}

export type TargetSegment = 'latent' | 'manifest'; // latent: 潜在層(教育), manifest: 顕在層(指名検索)

// Augment window for AI Studio API Key selection
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
