import { StateCreator } from 'zustand';
import { getFeatureSupport } from '../../shared/lib/featureSupport.ts';

export interface FeatureSupportSlice {
  camera: boolean;
  speechRecognition: boolean;
  mediaRecorder: boolean;
  isChecked: boolean;
  initFeatureSupport: () => void;
}

export const createFeatureSupportSlice: StateCreator<FeatureSupportSlice> = (set) => ({
  camera: true,
  speechRecognition: true,
  mediaRecorder: true,
  isChecked: false,
  initFeatureSupport: () => {
    const support = getFeatureSupport();
    set({
      camera: support.camera,
      speechRecognition: support.speechRecognition,
      mediaRecorder: support.mediaRecorder,
      isChecked: true,
    });
  },
});
