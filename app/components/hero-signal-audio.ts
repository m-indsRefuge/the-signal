export const SIGNAL_AUDIO_TEXTURE_SIZE = 256;

export type SignalAudioFrame = {
  rms: number;
  low: number;
  mid: number;
  high: number;
  flux: number;
  crest: number;
  textureData: Uint8Array;
};

export type SignalAudioSource = {
  start: () => Promise<void>;
  sample: (timeSeconds: number) => SignalAudioFrame;
  dispose: () => void;
};

const AUDIO_ASSET_URL = "/media/silicon-transmitter-01-17z-21424.mp3";
const TEXTURE_CHANNEL_COUNT = 4;
const PEAK_BUCKET_COUNT = SIGNAL_AUDIO_TEXTURE_SIZE / 2;
const ANALYSIS_WINDOW_SECONDS = 0.18;
const CLIP_FADE_IN_SECONDS = 1.8;
const TARGET_NORMALIZED_PEAK = 0.88;
const MAX_NORMALIZATION_GAIN = 3.2;
const TAU = Math.PI * 2;

type ClipData = {
  samples: Float32Array;
  sampleRate: number;
  duration: number;
};

type BandState = {
  low: number;
  mid: number;
  high: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function smootherStep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function encodeUnit(value: number): number {
  return Math.round(clamp01(value) * 255);
}

function encodeSigned(value: number): number {
  return encodeUnit(clampSigned(value) * 0.5 + 0.5);
}

function writeTextureSample(
  textureData: Uint8Array,
  index: number,
  wave: number,
  spectrum: number,
  envelope: number,
  transient: number,
): void {
  const offset = index * TEXTURE_CHANNEL_COUNT;
  textureData[offset] = encodeSigned(wave);
  textureData[offset + 1] = encodeUnit(spectrum);
  textureData[offset + 2] = encodeUnit(envelope);
  textureData[offset + 3] = encodeUnit(transient);
}

function fillProceduralTexture(
  timeSeconds: number,
  textureData: Uint8Array,
): { crest: number; flux: number } {
  let previousWave = 0;
  let maximumAmplitude = 0;
  let totalEnergy = 0;

  for (let index = 0; index < SIGNAL_AUDIO_TEXTURE_SIZE; index += 1) {
    const progress = index / (SIGNAL_AUDIO_TEXTURE_SIZE - 1);
    const phrase =
      0.56 +
      Math.sin(timeSeconds * 0.29 + Math.sin(timeSeconds * 0.071)) * 0.18 +
      Math.sin(progress * TAU * 1.3 - timeSeconds * 0.083) * 0.08;
    const phaseWarp =
      Math.sin(progress * TAU * 1.7 - timeSeconds * 0.047) * 0.72 +
      Math.sin(progress * TAU * 4.1 - timeSeconds * 0.13) * 0.21;
    const carrier = Math.sin(
      TAU * (progress * 8.6 - timeSeconds * 0.16) + phaseWarp,
    );
    const harmonic = Math.sin(
      TAU * (progress * 15.4 - timeSeconds * 0.23) + carrier * 0.84,
    );
    const articulation = Math.sin(
      TAU * (progress * 31 - timeSeconds * 0.51) + harmonic * 0.38,
    );
    const localEnvelope = clamp01(
      phrase *
        (0.74 + Math.sin(progress * TAU * 2.2 - timeSeconds * 0.19) * 0.16),
    );
    const wave = clampSigned(
      (carrier * 0.66 + harmonic * 0.24 + articulation * 0.1) * localEnvelope,
    );
    const lowPeak = Math.exp(-Math.pow((progress - 0.08) / 0.09, 2));
    const midPeak = Math.exp(-Math.pow((progress - 0.3) / 0.17, 2));
    const highPeak = Math.exp(-Math.pow((progress - 0.68) / 0.24, 2));
    const spectrum = clamp01(
      lowPeak * (0.38 + localEnvelope * 0.28) +
        midPeak * (0.18 + Math.abs(harmonic) * 0.26) +
        highPeak * (0.07 + Math.abs(articulation) * 0.16),
    );
    const transient = clamp01(Math.abs(wave - previousWave) * 2.4);

    writeTextureSample(
      textureData,
      index,
      wave,
      spectrum,
      localEnvelope,
      transient,
    );

    previousWave = wave;
    maximumAmplitude = Math.max(maximumAmplitude, Math.abs(wave));
    totalEnergy += wave * wave;
  }

  const rms = Math.sqrt(totalEnergy / SIGNAL_AUDIO_TEXTURE_SIZE);

  return {
    crest: clamp01((maximumAmplitude / Math.max(rms, 0.001) - 1) / 4.5),
    flux:
      0.14 +
      (0.5 +
        0.5 * Math.sin(timeSeconds * 0.83 + Math.sin(timeSeconds * 0.17))) *
        0.18,
  };
}

function createProceduralFrame(
  timeSeconds: number,
  textureData: Uint8Array,
): SignalAudioFrame {
  const phrase =
    0.5 + 0.5 * Math.sin(timeSeconds * 0.31 + Math.sin(timeSeconds * 0.071));
  const articulation = 0.5 + 0.5 * Math.sin(timeSeconds * 1.17 + 1.4);
  const shimmer = 0.5 + 0.5 * Math.sin(timeSeconds * 2.43 - 0.8);
  const dynamics = fillProceduralTexture(timeSeconds, textureData);

  return {
    rms: 0.16 + phrase * 0.16 + articulation * 0.04,
    low: 0.24 + phrase * 0.28,
    mid: 0.18 + articulation * 0.24,
    high: 0.1 + shimmer * 0.18,
    flux: dynamics.flux,
    crest: dynamics.crest,
    textureData,
  };
}

function createNormalizedMonoData(decodedBuffer: AudioBuffer): ClipData {
  const monoSamples = new Float32Array(decodedBuffer.length);
  let decodedPeak = 0;

  for (
    let sampleIndex = 0;
    sampleIndex < decodedBuffer.length;
    sampleIndex += 1
  ) {
    let mixedSample = 0;

    for (
      let channelIndex = 0;
      channelIndex < decodedBuffer.numberOfChannels;
      channelIndex += 1
    ) {
      mixedSample +=
        decodedBuffer.getChannelData(channelIndex)[sampleIndex] ?? 0;
    }

    mixedSample /= Math.max(1, decodedBuffer.numberOfChannels);
    monoSamples[sampleIndex] = mixedSample;
    decodedPeak = Math.max(decodedPeak, Math.abs(mixedSample));
  }

  const normalizationGain = Math.min(
    MAX_NORMALIZATION_GAIN,
    TARGET_NORMALIZED_PEAK / Math.max(decodedPeak, 0.001),
  );

  for (
    let sampleIndex = 0;
    sampleIndex < monoSamples.length;
    sampleIndex += 1
  ) {
    monoSamples[sampleIndex] = clampSigned(
      (monoSamples[sampleIndex] ?? 0) * normalizationGain,
    );
  }

  return {
    samples: monoSamples,
    sampleRate: decodedBuffer.sampleRate,
    duration: decodedBuffer.duration,
  };
}

function readLoopedSample(samples: Float32Array, index: number): number {
  if (samples.length === 0) {
    return 0;
  }

  const wrappedIndex =
    ((index % samples.length) + samples.length) % samples.length;
  return samples[wrappedIndex] ?? 0;
}

function fillClipTexture(
  clip: ClipData,
  timeSeconds: number,
  textureData: Uint8Array,
  previousBands: BandState,
): Omit<SignalAudioFrame, "textureData"> {
  const windowLength = Math.max(
    PEAK_BUCKET_COUNT * 4,
    Math.round(clip.sampleRate * ANALYSIS_WINDOW_SECONDS),
  );
  const currentIndex = Math.floor(
    (((timeSeconds % clip.duration) + clip.duration) % clip.duration) *
      clip.sampleRate,
  );
  const windowStartIndex = currentIndex - windowLength + 1;
  const lowAlpha = 1 - Math.exp((-TAU * 250) / clip.sampleRate);
  const midAlpha = 1 - Math.exp((-TAU * 2200) / clip.sampleRate);

  let lowState = 0;
  let midState = 0;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;
  let maximumAmplitude = 0;
  let transientTotal = 0;
  let previousSample = readLoopedSample(clip.samples, windowStartIndex - 1);

  for (let bucketIndex = 0; bucketIndex < PEAK_BUCKET_COUNT; bucketIndex += 1) {
    const bucketStart = Math.floor(
      (bucketIndex / PEAK_BUCKET_COUNT) * windowLength,
    );
    const bucketEnd = Math.max(
      bucketStart + 1,
      Math.floor(((bucketIndex + 1) / PEAK_BUCKET_COUNT) * windowLength),
    );

    let minimum = 1;
    let maximum = -1;
    let envelopeTotal = 0;
    let localTransient = 0;
    let roughnessTotal = 0;

    for (let offset = bucketStart; offset < bucketEnd; offset += 1) {
      const sampleValue = readLoopedSample(
        clip.samples,
        windowStartIndex + offset,
      );
      const signedSample = clampSigned(sampleValue * 1.08);
      const difference = Math.abs(signedSample - previousSample);

      lowState += lowAlpha * (signedSample - lowState);
      midState += midAlpha * (signedSample - midState);

      const lowComponent = lowState;
      const midComponent = midState - lowState;
      const highComponent = signedSample - midState;

      minimum = Math.min(minimum, signedSample);
      maximum = Math.max(maximum, signedSample);
      envelopeTotal += Math.abs(signedSample);
      localTransient = Math.max(localTransient, difference);
      roughnessTotal += difference;
      totalEnergy += signedSample * signedSample;
      lowEnergy += lowComponent * lowComponent;
      midEnergy += midComponent * midComponent;
      highEnergy += highComponent * highComponent;
      maximumAmplitude = Math.max(maximumAmplitude, Math.abs(signedSample));
      previousSample = signedSample;
    }

    const bucketLength = Math.max(1, bucketEnd - bucketStart);
    const envelope = clamp01((envelopeTotal / bucketLength) * 2.4);
    const transient = clamp01(localTransient * 4.2);
    const spectrum = clamp01(
      (roughnessTotal / bucketLength) * 5.4 + transient * 0.16,
    );
    const forwardBucketIndex = PEAK_BUCKET_COUNT - 1 - bucketIndex;
    const textureIndex = forwardBucketIndex * 2;

    writeTextureSample(
      textureData,
      textureIndex,
      minimum,
      spectrum,
      envelope,
      transient,
    );
    writeTextureSample(
      textureData,
      textureIndex + 1,
      maximum,
      spectrum,
      envelope,
      transient,
    );

    transientTotal += transient;
  }

  const rms = Math.sqrt(totalEnergy / windowLength);
  const low = clamp01(Math.sqrt(lowEnergy / windowLength) * 3.1);
  const mid = clamp01(Math.sqrt(midEnergy / windowLength) * 4.2);
  const high = clamp01(Math.sqrt(highEnergy / windowLength) * 5.6);
  const bandChange =
    Math.max(0, low - previousBands.low) +
    Math.max(0, mid - previousBands.mid) +
    Math.max(0, high - previousBands.high);
  const flux = clamp01(
    bandChange * 1.8 + (transientTotal / PEAK_BUCKET_COUNT) * 0.42,
  );
  const crest = clamp01((maximumAmplitude / Math.max(rms, 0.001) - 1) / 4.5);

  previousBands.low = low;
  previousBands.mid = mid;
  previousBands.high = high;

  return {
    rms: clamp01(rms * 2.1),
    low,
    mid,
    high,
    flux,
    crest,
  };
}

function mixValue(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function mixTextureData(
  output: Uint8Array,
  fallback: Uint8Array,
  clip: Uint8Array,
  progress: number,
): void {
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Math.round(
      mixValue(fallback[index] ?? 0, clip[index] ?? 0, progress),
    );
  }
}

export function createSignalAudioSource(): SignalAudioSource {
  const fallbackTextureData = new Uint8Array(
    SIGNAL_AUDIO_TEXTURE_SIZE * TEXTURE_CHANNEL_COUNT,
  );
  const clipTextureData = new Uint8Array(
    SIGNAL_AUDIO_TEXTURE_SIZE * TEXTURE_CHANNEL_COUNT,
  );
  const outputTextureData = new Uint8Array(
    SIGNAL_AUDIO_TEXTURE_SIZE * TEXTURE_CHANNEL_COUNT,
  );
  const previousBands: BandState = { low: 0, mid: 0, high: 0 };

  let clipData: ClipData | null = null;
  let loadingPromise: Promise<void> | null = null;
  let clipBlendStartTime: number | null = null;
  let disposed = false;

  const start = async () => {
    if (disposed || clipData) {
      return;
    }

    if (loadingPromise) {
      await loadingPromise;
      return;
    }

    loadingPromise = (async () => {
      const response = await fetch(AUDIO_ASSET_URL, { cache: "force-cache" });

      if (!response.ok) {
        throw new Error(`Unable to load Signal audio: ${response.status}`);
      }

      const encodedAudio = await response.arrayBuffer();
      const decodeContext = new OfflineAudioContext(1, 1, 44_100);
      const decodedAudio = await decodeContext.decodeAudioData(encodedAudio);

      if (!disposed) {
        clipData = createNormalizedMonoData(decodedAudio);
      }
    })().catch(() => undefined);

    await loadingPromise;
  };

  const sample = (timeSeconds: number): SignalAudioFrame => {
    const fallback = createProceduralFrame(timeSeconds, fallbackTextureData);

    if (!clipData) {
      outputTextureData.set(fallbackTextureData);
      return { ...fallback, textureData: outputTextureData };
    }

    if (clipBlendStartTime === null) {
      clipBlendStartTime = timeSeconds;
    }

    const clipFrame = fillClipTexture(
      clipData,
      timeSeconds,
      clipTextureData,
      previousBands,
    );
    const blend = smootherStep(
      (timeSeconds - clipBlendStartTime) / CLIP_FADE_IN_SECONDS,
    );

    mixTextureData(
      outputTextureData,
      fallbackTextureData,
      clipTextureData,
      blend,
    );

    return {
      rms: mixValue(fallback.rms, clipFrame.rms, blend),
      low: mixValue(fallback.low, clipFrame.low, blend),
      mid: mixValue(fallback.mid, clipFrame.mid, blend),
      high: mixValue(fallback.high, clipFrame.high, blend),
      flux: mixValue(fallback.flux, clipFrame.flux, blend),
      crest: mixValue(fallback.crest, clipFrame.crest, blend),
      textureData: outputTextureData,
    };
  };

  const dispose = () => {
    disposed = true;
    clipData = null;
    loadingPromise = null;
    clipBlendStartTime = null;
  };

  return { start, sample, dispose };
}
