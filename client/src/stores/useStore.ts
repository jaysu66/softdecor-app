import { create } from "zustand";

export interface Product {
  sku: string;
  name: string;
  cat: string;
  style: string;
  color: string;
  material: string;
  size: string;
  price: number;
  place: string;
  trans: number;
  refl: number;
  rough: number;
  img: string;
  space: string;
  related: string;
}

export interface Analysis {
  room_type: string;
  style: string;
  secondary_styles: string[];
  lighting: string;
  color_tone: string;
  existing_furniture: string[];
  suggested_categories: string[];
  space_features: string;
  suggestions: string;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  products: Product[];
  totalPrice: number;
}

export type Step =
  | "upload"
  | "analyzing"
  | "analysis"
  | "recommending"
  | "recommend"
  | "canvas"
  | "refining"
  | "result";

interface AppState {
  step: Step;
  setStep: (s: Step) => void;

  // Upload
  uploadedImage: string | null;
  uploadedImageBase64: string | null;
  setUploadedImage: (url: string | null, base64: string | null) => void;

  // Analysis
  analysis: Analysis | null;
  setAnalysis: (a: Analysis | null) => void;

  // Recommendations
  schemes: Scheme[];
  setSchemes: (s: Scheme[]) => void;

  // Selected products for canvas
  selectedProducts: Product[];
  addProduct: (p: Product) => void;
  removeProduct: (sku: string) => void;
  setSelectedProducts: (ps: Product[]) => void;

  // Refine result
  refineResult: any;
  setRefineResult: (r: any) => void;

  // All products
  allProducts: Product[];
  setAllProducts: (ps: Product[]) => void;

  // Reset
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  step: "upload",
  setStep: (step) => set({ step }),

  uploadedImage: null,
  uploadedImageBase64: null,
  setUploadedImage: (url, base64) =>
    set({ uploadedImage: url, uploadedImageBase64: base64 }),

  analysis: null,
  setAnalysis: (analysis) => set({ analysis }),

  schemes: [],
  setSchemes: (schemes) => set({ schemes }),

  selectedProducts: [],
  addProduct: (p) =>
    set((s) => {
      if (s.selectedProducts.find((sp) => sp.sku === p.sku)) return s;
      return { selectedProducts: [...s.selectedProducts, p] };
    }),
  removeProduct: (sku) =>
    set((s) => ({
      selectedProducts: s.selectedProducts.filter((p) => p.sku !== sku),
    })),
  setSelectedProducts: (ps) => set({ selectedProducts: ps }),

  refineResult: null,
  setRefineResult: (refineResult) => set({ refineResult }),

  allProducts: [],
  setAllProducts: (allProducts) => set({ allProducts }),

  reset: () =>
    set({
      step: "upload",
      uploadedImage: null,
      uploadedImageBase64: null,
      analysis: null,
      schemes: [],
      selectedProducts: [],
      refineResult: null,
    }),
}));
