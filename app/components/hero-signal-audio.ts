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
const FFT_SIZE = 2048;
const MIN_ANALYSIS_FREQUENCY = 35;
const LOW_FREQUENCY_CEILING = 250;
const MID_FREQUENCY_CEILING = 2200;
const HIGH_FREQUENCY_CEILING = 9000;
const TEXTURE_CHANNEL_COUNT = 4;
const PEAK_BUCKET_COUNT = SIGNAL_AUDIO_TEXTURE_SIZE / 2;
const ANALYSIS_WAVE_GAIN = 3.2;
const LOOP_CROSSFADE_SECONDS = 0.72;
const CLIP_FADE_IN_SECONDS = 2.4;
const TARGET_NORMALIZED_PEAK = 0.88;
const MAX_NORMALIZATION_GAIN = 3.2;
const TAU = Math.PI * 2;

type ClipVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
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
      Math.sin(progress * TAU * 1.7 + timeSeconds * 0.047) * 0.72 +
      Math.sin(progress * TAU * 4.1 - timeSeconds * 0.13) * 0.21;
    const carrier = Math.sin(
      TAU * (progress * 8.6 - timeSeconds * 0.16) + phaseWarp,
    );
    const harmonic = Math.sin(
      TAU * (progress * 15.4 + timeSeconds * 0.23) + carrier * 0.84,
    );
    const articulation = Math.sin(
      TAU * (progress * 31 - timeSeconds * 0.51) + harmonic * 0.38,
    );
    const localEnvelope = clamp01(
      phrase *
        (0.74 +
          Math.sin(progress * TAU * 2.2 + timeSeconds * 0.19) * 0.16),
    );
    const wave = clampSigned(
      (carrier * 0.66 + harmonic * 0.24 + articulation * 0.1) *
        localEnvelope,
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
        0.5 *
          Math.sin(timeSeconds * 0.83 + Math.sin(timeSeconds * 0.17))) *
        0.18,
  };
}

function createProceduralFrame(
  timeSeconds: number,
  textureData: Uint8Array,
): SignalAudioFrame {
  const phrase =
    0.5 +
    0.5 * Math.sin(timeSeconds * 0.31 + Math.sin(timeSeconds * 0.071));
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

function averageFrequencyRange(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  lowerFrequency: number,
  upperFrequency: number,
): number {
  const binWidth = sampleRate / fftSize;
  const lowerIndex = Math.max(0, Math.floor(lowerFrequency / binWidth));
  const upperIndex = Math.min(
    data.length - 1,
    Math.ceil(upperFrequency / binWidth),
  );

  if (upperIndex < lowerIndex) {
    return 0;
  }

  let total = 0;

  for (let index = lowerIndex; index <= upperIndex; index += 1) {
    total += data[index] ?? 0;
  }

  return total / (upperIndex - lowerIndex + 1) / 255;
}

function calculateSpectralFlux(
  current: Uint8Array,
  previous: Uint8Array,
): number {
  let positiveDifference = 0;

  for (let index = 0; index < current.length; index += 1) {
    positiveDifference += Math.max(
      0,
      (current[index] ?? 0) - (previous[index] ?? 0),
    );
  }

  previous.set(current);

  return clamp01((positiveDifference / current.length / 255) * 10);
}

function fillPeakPreservedTexture(
  timeDomainData: Float32Array,
  frequencyData: Uint8Array,
  textureData: Uint8Array,
): number {
  let maximumAmplitude = 0;

  for (let bucketIndex = 0; bucketIndex < PEAK_BUCKET_COUNT; bucketIndex += 1) {
    const bucketStart = Math.floor(
      (bucketIndex / PEAK_BUCKET_COUNT) * timeDomainData.length,
    );
    const bucketEnd = Math.max(
      bucketStart + 1,
      Math.floor(
        ((bucketIndex + 1) / PEAK_BUCKET_COUNT) * timeDomainData.length,
      ),
    );
    let minimum = 1;
    let maximum = -1;
    let envelopeTotal = 0;
    let transientMaximum = 0;
    let previousWave = clampSigned(
      (timeDomainData[Math.max(0, bucketStart - 1)] ?? 0) *
        ANALYSIS_WAVE_GAIN,
    );

    for (
      let sampleIndex = bucketStart;
      sampleIndex < Math.min(bucketEnd, timeDomainData.length);
      sampleIndex += 1
    ) {
      const wave = clampSigned(
        (timeDomainData[sampleIndex] ?? 0) * ANALYSIS_WAVE_GAIN,
      );
      minimum = Math.min(minimum, wave);
      maximum = Math.max(maximum, wave);
      envelopeTotal += Math.abs(wave);
      transientMaximum = Math.max(
        transientMaximum,
        Math.abs(wave - previousWave),
      );
      previousWave = wave;
    }

    const sampleCount = Math.max(1, bucketEnd - bucketStart);
    const envelope = clamp01(envelopeTotal / sampleCount);
    const transient = clamp01(transientMaximum * 2.2);
    const progress = bucketIndex / Math.max(1, PEAK_BUCKET_COUNT - 1);
    const frequencyPosition = Math.round(
      Math.pow(progress, 2.15) * Math.max(0, frequencyData.length - 1),
    );
    const spectrum = (frequencyData[frequencyPosition] ?? 0) / 255;
    const textureIndex = bucketIndex * 2;

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

    maximumAmplitude = Math.max(
      maximumAmplitude,
      Math.abs(minimum),
      Math.abs(maximum),
    );
  }

  return maximumAmplitude;
}

function createNormalizedBuffer(
  context: AudioContext,
  decodedBuffer: AudioBuffer,
): AudioBuffer {
  let decodedPeak = 0;

  for (
    let channelIndex = 0;
    channelIndex < decodedBuffer.numberOfChannels;
    channelIndex += 1
  ) {
    const channel = decodedBuffer.getChannelData(channelIndex);

    for (const sampleValue of channel) {
      decodedPeak = Math.max(decodedPeak, Math.abs(sampleValue));
    }
  }

  const normalizationGain = Math.min(
    MAX_NORMALIZATION_GAIN,
    TARGET_NORMALIZED_PEAK / Math.max(decodedPeak, 0.001),
  );
  const normalizedBuffer = context.createBuffer(
    decodedBuffer.numberOfChannels,
    decodedBuffer.length,
    decodedBuffer.sampleRate,
  );

  for (
    let channelIndex = 0;
    channelIndex < decodedBuffer.numberOfChannels;
    channelIndex += 1
  ) {
    const sourceChannel = decodedBuffer.getChannelData(channelIndex);
    const targetChannel = normalizedBuffer.getChannelData(channelIndex);

    for (let sampleIndex = 0; sampleIndex < sourceChannel.length; sampleIndex += 1) {
      targetChannel[sampleIndex] = clampSigned(
        (sourceChannel[sampleIndex] ?? 0) * normalizationGain,
      );
    }
  }

  return normalizedBuffer;
}

export function createSyntheticSignalAudio(): SignalAudioSource {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let timeDomainData: Float32Array | null = null;
  let frequencyData: Uint8Array | null = null;
  let previousFrequencyData: Uint8Array | null = null;
  let clipReady = false;
  let loopSchedulerId: number | null = null;
  const textureData = new Uint8Array(
    SIGNAL_AUDIO_TEXTURE_SIZE * TEXTURE_CHANNEL_COUNT,
  );
  const connectedNodes: AudioNode[] = [];
  const clipVoices = new Set<ClipVoice>();
  let disposed = false;

  const registerNode = <T extends AudioNode>(node: T): T => {
    connectedNodes.push(node);
    return node;
  };

  const stopClipPlayback = () => {
    if (loopSchedulerId !== null) {
      window.clearInterval(loopSchedulerId);
      loopSchedulerId = null;
    }

    for (const voice of clipVoices) {
      try {
        voice.source.stop();
      } catch {
        // A scheduled voice may already have reached its natural end.
      }

      voice.source.disconnect();
      voice.gain.disconnect();
    }

    clipVoices.clear();
  };

  const scheduleLoopingClip = (
    audioContext: AudioContext,
    buffer: AudioBuffer,
    destination: AudioNode,
  ) => {
    const crossfadeSeconds = Math.min(
      LOOP_CROSSFADE_SECONDS,
      buffer.duration * 0.08,
    );
    const loopInterval = Math.max(
      crossfadeSeconds * 2,
      buffer.duration - crossfadeSeconds,
    );
    let nextStartTime = audioContext.currentTime + 0.08;

    const scheduleVoice = (startTime: number) => {
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      const endTime = startTime + buffer.duration;
      const fadeOutStart = Math.max(
        startTime + crossfadeSeconds,
        endTime - crossfadeSeconds,
      );
      const voice: ClipVoice = { source, gain };

      source.buffer = buffer;
      source.connect(gain).connect(destination);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(1, startTime + crossfadeSeconds);
      gain.gain.setValueAtTime(1, fadeOutStart);
      gain.gain.linearRampToValueAtTime(0, endTime);
      source.start(startTime);
      source.stop(endTime + 0.02);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        clipVoices.delete(voice);
      };
      clipVoices.add(voice);
    };

    const scheduleAhead = () => {
      const scheduleHorizon = audioContext.currentTime + buffer.duration * 1.2;

      while (nextStartTime < scheduleHorizon) {
        scheduleVoice(nextStartTime);
        nextStartTime += loopInterval;
      }
    };

    scheduleAhead();
    loopSchedulerId = window.setInterval(scheduleAhead, 1000);
  };

  const start = async () => {
    if (disposed) {
      return;
    }

    if (context) {
      await context.resume();
      return;
    }

    const audioContext = new AudioContext({ latencyHint: "interactive" });
    const analysisBus = registerNode(audioContext.createGain());
    const compressor = registerNode(audioContext.createDynamicsCompressor());
    const analyserNode = registerNode(audioContext.createAnalyser());
    const silentOutput = registerNode(audioContext.createGain());

    analysisBus.gain.value = 1;
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.24;
    analyserNode.fftSize = FFT_SIZE;
    analyserNode.smoothingTimeConstant = 0.62;
    analyserNode.minDecibels = -92;
    analyserNode.maxDecibels = -18;
    silentOutput.gain.value = 0;

    analysisBus.connect(compressor).connect(analyserNode);
    analyserNode.connect(silentOutput).connect(audioContext.destination);

    context = audioContext;
    analyser = analyserNode;
    timeDomainData = new Float32Array(analyserNode.fftSize);
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    previousFrequencyData = new Uint8Array(analyserNode.frequencyBinCount);

    await audioContext.resume();

    try {
      const response = await fetch(AUDIO_ASSET_URL, { cache: "force-cache" });

      if (!response.ok) {
        throw new Error(`Unable to load Signal audio: ${response.status}`);
      }

      const encodedAudio = await response.arrayBuffer();
      const decodedAudio = await audioContext.decodeAudioData(encodedAudio);

      if (disposed) {
        return;
      }

      const normalizedAudio = createNormalizedBuffer(audioContext, decodedAudio);
      const clipMaster = registerNode(audioContext.createGain());
      const fadeStart = audioContext.currentTime;

      clipMaster.gain.setValueAtTime(0, fadeStart);
      clipMaster.gain.linearRampToValueAtTime(
        1,
        fadeStart + CLIP_FADE_IN_SECONDS,
      );
      clipMaster.connect(analysisBus);
      scheduleLoopingClip(audioContext, normalizedAudio, clipMaster);
      clipReady = true;
    } catch {
      clipReady = false;
    }
  };

  const sample = (timeSeconds: number): SignalAudioFrame => {
    const fallback = createProceduralFrame(timeSeconds, textureData);

    if (
      !clipReady ||
      !context ||
      context.state !== "running" ||
      !analyser ||
      !timeDomainData ||
      !frequencyData ||
      !previousFrequencyData
    ) {
      return fallback;
    }

    analyser.getFloatTimeDomainData(timeDomainData);
    analyser.getByteFrequencyData(frequencyData);

    let energy = 0;

    for (const sampleValue of timeDomainData) {
      energy += sampleValue * sampleValue;
    }

    const rawRms = Math.sqrt(energy / timeDomainData.length);
    const rms = clamp01(rawRms * 3.2);
    const maximumAmplitude = fillPeakPreservedTexture(
      timeDomainData,
      frequencyData,
      textureData,
    );
    const flux = calculateSpectralFlux(
      frequencyData,
      previousFrequencyData,
    );
    const crest = clamp01(
      (maximumAmplitude / Math.max(rms, 0.001) - 1) / 4.5,
    );
    const low = averageFrequencyRange(
      frequencyData,
      context.sampleRate,
      analyser.fftSize,
      MIN_ANALYSIS_FREQUENCY,
      LOW_FREQUENCY_CEILING,
    );
    const mid = averageFrequencyRange(
      frequencyData,
      context.sampleRate,
      analyser.fftSize,
      LOW_FREQUENCY_CEILING,
      MID_FREQUENCY_CEILING,
    );
    const high = averageFrequencyRange(
      frequencyData,
      context.sampleRate,
      analyser.fftSize,
      MID_FREQUENCY_CEILING,
      HIGH_FREQUENCY_CEILING,
    );

    return {
      rms: clamp01(rms * 0.9 + fallback.rms * 0.1),
      low: clamp01(low * 0.92 + fallback.low * 0.08),
      mid: clamp01(mid * 0.92 + fallback.mid * 0.08),
      high: clamp01(high * 0.9 + fallback.high * 0.1),
      flux: clamp01(flux * 0.9 + fallback.flux * 0.1),
      crest: clamp01(crest * 0.88 + fallback.crest * 0.12),
      textureData,
    };
  };

  const dispose = () => {
    disposed = true;
    stopClipPlayback();

    for (const node of connectedNodes) {
      node.disconnect();
    }

    if (context) {
      void context.close();
    }

    context = null;
    analyser = null;
    timeDomainData = null;
    frequencyData = null;
    previousFrequencyData = null;
    clipReady = false;
  };

  return { start, sample, dispose };
}
