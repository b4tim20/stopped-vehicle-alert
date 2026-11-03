import { create } from "zustand";

type UiState = {
  selectedCameraId: string | null;
  setSelectedCameraId: (id: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  selectedCameraId: null,
  setSelectedCameraId: (id) => set({ selectedCameraId: id }),
}));
