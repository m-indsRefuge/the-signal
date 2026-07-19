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

const FFT_SIZE = 2048;
const MIN_ANALYSIS_FREQUENCY = 35;
const LOW_FREQUENCY_CEILING = 250;
const MID_FREQUENCY_CEILING = 2200;
const HIGH_FREQUENCY_CEILING = 9000;
const TEXTURE_CHANNEL_COUNT = 4;
const TAU = Math.PI * 2;

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
      TAU * (progress * 31.0 - timeSeconds * 0.51) + harmonic * 0.38,
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
      (0.5 + 0.5 * Math.sin(timeSeconds * 0.83 + Math.sin(timeSeconds * 0.17))) *
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

function createDeterministicNoiseBuffer(context: AudioContext): AudioBuffer {
  const frameCount = context.sampleRate * 2;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let state = 0x5349474e;

  for (let index = 0; index < channel.length; index += 1) {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    channel[index] =
      (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  return buffer;
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

function fillAnalysisTexture(
  timeDomainData: Float32Array,
  frequencyData: Uint8Array,
  textureData: Uint8Array,
): number {
  let maximumAmplitude = 0;

  for (let index = 0; index < SIGNAL_AUDIO_TEXTURE_SIZE; index += 1) {
    const progress = index / (SIGNAL_AUDIO_TEXTURE_SIZE - 1);
    const samplePosition = Math.round(
      progress * Math.max(0, timeDomainData.length - 1),
    );
    const previousPosition = Math.max(0, samplePosition - 1);
    const wave = clampSigned((timeDomainData[samplePosition] ?? 0) * 3.6);
    const previousWave = clampSigned(
      (timeDomainData[previousPosition] ?? 0) * 3.6,
    );
    const frequencyPosition = Math.round(
      Math.pow(progress, 2.15) * Math.max(0, frequencyData.length - 1),
    );
    const spectrum = (frequencyData[frequencyPosition] ?? 0) / 255;

    let envelopeTotal = 0;
    const envelopeRadius = 9;

    for (let offset = -envelopeRadius; offset <= envelopeRadius; offset += 1) {
      const envelopePosition = Math.min(
        timeDomainData.length - 1,
        Math.max(0, samplePosition + offset),
      );
      envelopeTotal += Math.abs(timeDomainData[envelopePosition] ?? 0) * 3.2;
    }

    const envelope = clamp01(envelopeTotal / (envelopeRadius * 2 + 1));
    const transient = clamp01(Math.abs(wave - previousWave) * 2.8);

    writeTextureSample(
      textureData,
      index,
      wave,
      spectrum,
      envelope,
      transient,
    );

    maximumAmplitude = Math.max(maximumAmplitude, Math.abs(wave));
  }

  return maximumAmplitude;
}

export function createSyntheticSignalAudio(): SignalAudioSource {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let timeDomainData: Float32Array | null = null;
  let frequencyData: Uint8Array | null = null;
  let previousFrequencyData: Uint8Array | null = null;
  const textureData = new Uint8Array(
    SIGNAL_AUDIO_TEXTURE_SIZE * TEXTURE_CHANNEL_COUNT,
  );
  const scheduledSources: AudioScheduledSourceNode[] = [];
  const connectedNodes: AudioNode[] = [];
  let disposed = false;

  const registerSource = <T extends AudioScheduledSourceNode>(source: T): T => {
    scheduledSources.push(source);
    return source;
  };

  const registerNode = <T extends AudioNode>(node: T): T => {
    connectedNodes.push(node);
    return node;
  };

  const addOscillator = (
    audioContext: AudioContext,
    destination: AudioNode,
    frequency: number,
    gainValue: number,
    type: OscillatorType,
    detune = 0,
  ): OscillatorNode => {
    const oscillator = registerSource(audioContext.createOscillator());
    const gain = registerNode(audioContext.createGain());

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    gain.gain.value = gainValue;
    oscillator.connect(gain).connect(destination);
    oscillator.start();

    return oscillator;
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
    const sourceBus = registerNode(audioContext.createGain());
    const analyserNode = registerNode(audioContext.createAnalyser());
    const silentOutput = registerNode(audioContext.createGain());

    sourceBus.gain.value = 0.21;
    analyserNode.fftSize = FFT_SIZE;
    analyserNode.smoothingTimeConstant = 0.72;
    analyserNode.minDecibels = -92;
    analyserNode.maxDecibels = -18;
    silentOutput.gain.value = 0;

    const fundamental = addOscillator(
      audioContext,
      sourceBus,
      86,
      0.28,
      "sine",
    );
    addOscillator(audioContext, sourceBus, 137, 0.16, "triangle", -7);
    addOscillator(audioContext, sourceBus, 219, 0.1, "sine", 11);
    addOscillator(audioContext, sourceBus, 347, 0.055, "triangle", -13);
    addOscillator(audioContext, sourceBus, 521, 0.022, "sine", 9);

    const vibrato = registerSource(audioContext.createOscillator());
    const vibratoDepth = registerNode(audioContext.createGain());
    vibrato.frequency.value = 5.15;
    vibratoDepth.gain.value = 5.5;
    vibrato.connect(vibratoDepth).connect(fundamental.detune);
    vibrato.start();

    const amplitudeLfo = registerSource(audioContext.createOscillator());
    const amplitudeDepth = registerNode(audioContext.createGain());
    amplitudeLfo.frequency.value = 0.19;
    amplitudeDepth.gain.value = 0.065;
    amplitudeLfo.connect(amplitudeDepth).connect(sourceBus.gain);
    amplitudeLfo.start();

    const secondaryLfo = registerSource(audioContext.createOscillator());
    const secondaryDepth = registerNode(audioContext.createGain());
    secondaryLfo.frequency.value = 0.47;
    secondaryDepth.gain.value = 0.022;
    secondaryLfo.connect(secondaryDepth).connect(sourceBus.gain);
    secondaryLfo.start();

    const noiseSource = registerSource(audioContext.createBufferSource());
    const noiseFilter = registerNode(audioContext.createBiquadFilter());
    const noiseGain = registerNode(audioContext.createGain());
    noiseSource.buffer = createDeterministicNoiseBuffer(audioContext);
    noiseSource.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1450;
    noiseFilter.Q.value = 0.72;
    noiseGain.gain.value = 0.034;
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(sourceBus);
    noiseSource.start();

    sourceBus.connect(analyserNode);
    analyserNode.connect(silentOutput);
    silentOutput.connect(audioContext.destination);

    context = audioContext;
    analyser = analyserNode;
    timeDomainData = new Float32Array(analyserNode.fftSize);
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    previousFrequencyData = new Uint8Array(analyserNode.frequencyBinCount);

    await audioContext.resume();
  };

  const sample = (timeSeconds: number): SignalAudioFrame => {
    const fallback = createProceduralFrame(timeSeconds, textureData);

    if (
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
    const maximumAmplitude = fillAnalysisTexture(
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
      rms: clamp01(rms * 0.72 + fallback.rms * 0.28),
      low: clamp01(low * 0.82 + fallback.low * 0.18),
      mid: clamp01(mid * 0.82 + fallback.mid * 0.18),
      high: clamp01(high * 0.78 + fallback.high * 0.22),
      flux: clamp01(flux * 0.82 + fallback.flux * 0.18),
      crest: clamp01(crest * 0.78 + fallback.crest * 0.22),
      textureData,
    };
  };

  const dispose = () => {
    disposed = true;

    for (const source of scheduledSources) {
      try {
        source.stop();
      } catch {
        // A source may already have stopped while the component is being removed.
      }

      source.disconnect();
    }

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
  };

  return { start, sample, dispose };
}
