export interface BrowserFeatureSupport {
  camera: boolean;
  speechRecognition: boolean;
  mediaRecorder: boolean;
}

export function getFeatureSupport(): BrowserFeatureSupport {
  return {
    camera: !!navigator.mediaDevices?.getUserMedia,
    speechRecognition: !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
  };
}
