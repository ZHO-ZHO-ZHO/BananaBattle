export interface ImageResult {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  latency: number;
  modelName: string;
}

export enum ModelType {
  // User requested specific model names
  FLASH_IMAGE = 'gemini-2.5-flash-image-preview',
  PRO_IMAGE = 'gemini-3-pro-image-preview'
}

export interface ComparisonState {
  modelA: ImageResult;
  modelB: ImageResult;
}
