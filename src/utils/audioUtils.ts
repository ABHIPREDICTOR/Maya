export type VolumeCallback = (volume: number) => void;

let currentAudioCtx: AudioContext | null = null;

export async function playPCM(base64Data: string, onVolume?: VolumeCallback): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    
    const audioCtx = new AudioContextClass({ sampleRate: 24000 });
    currentAudioCtx = audioCtx;
    
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new Int16Array(bytes.buffer);
    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Analyzer for lip sync
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedVolume = Math.min(1, average / 128); // Normalize to 0-1
      if (onVolume) onVolume(normalizedVolume);
      animationId = requestAnimationFrame(checkVolume);
    };

    if (onVolume) checkVolume();

    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (onVolume) onVolume(0);
        audioCtx.close();
        resolve();
      };
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}
