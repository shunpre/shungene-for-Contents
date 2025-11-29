
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

export interface SwipeScreen {
  order: number;
  type: 'hook' | 'problem' | 'empathy' | 'solution' | 'benefit' | 'proof' | 'cta';
  title: string;
  mainCopy: string;
  visualDescription: string;
  designNote: string;
  designSpec?: DesignSpec; // Populated in the second phase
  imageData?: string; // Base64 encoded final image (Populated in the third phase)
  history?: SwipeScreenHistory[]; // History for undo functionality
  redoHistory?: SwipeScreenHistory[]; // History for redo functionality
  visualStyle?: 'manga' | 'standard'; // Style for this specific screen
}

export interface SwipeLP {
  screens: SwipeScreen[];
  concept: string;
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
