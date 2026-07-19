export type SignalAudioFrame = {
  rms: number;
  low: number;
  mid: number;
  high: number;
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function createProceduralFrame(timeSeconds: number): SignalAudioFrame {
  const phrase = 0.5 + 0.5 * Math.sin(timeSeconds * 0.31 + Math.sin(timeSeconds * 0.071));
  const articulation = 0.5 + 0.5 * Math.sin(timeSeconds * 1.17 + 1.4);
  const shimmer = 0.5 + 0.5 * Math.sin(timeSeconds * 2.43 - 0.8);

  return {
    rms: 0.16 + phrase * 0.16 + articulation * 0.04,
    low: 0.24 + phrase * 0.28,
    mid: 0.18 + articulation * 0.24,
    high: 0.1 + shimmer * 0.18,
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
    channel[index] = (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
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
  const upperIndex = Math.min(data.length - 1, Math.ceil(upperFrequency / binWidth));

  if (upperIndex < lowerIndex) {
    return 0;
  }

  let total = 0;

  for (let index = lowerIndex; index <= upperIndex; index += 1) {
    total += data[index] ?? 0;
  }

  return total / (upperIndex - lowerIndex + 1) / 255;
}

export function createSyntheticSignalAudio(): SignalAudioSource {
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let timeDomainData: Float32Array | null = null;
  let frequencyData: Uint8Array | null = null;
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
  ) => {
    const oscillator = registerSource(audioContext.createOscillator());
    const gain = registerNode(audioContext.createGain());

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    gain.gain.value = gainValue;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
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

    sourceBus.gain.value = 0.2;
    analyserNode.fftSize = FFT_SIZE;
    analyserNode.smoothingTimeConstant = 0.84;
    silentOutput.gain.value = 0;

    addOscillator(audioContext, sourceBus, 86, 0.28, "sine");
    addOscillator(audioContext, sourceBus, 137, 0.16, "triangle", -7);
    addOscillator(audioContext, sourceBus, 219, 0.1, "sine", 11);
    addOscillator(audioContext, sourceBus, 347, 0.055, "triangle", -13);

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
    const noiseGain = registerNode(audioContext.createGain());
    noiseSource.buffer = createDeterministicNoiseBuffer(audioContext);
    noiseSource.loop = true;
    noiseGain.gain.value = 0.028;
    noiseSource.connect(noiseGain).connect(sourceBus);
    noiseSource.start();

    sourceBus.connect(analyserNode);
    analyserNode.connect(silentOutput);
    silentOutput.connect(audioContext.destination);

    context = audioContext;
    analyser = analyserNode;
    timeDomainData = new Float32Array(analyserNode.fftSize);
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount);

    await audioContext.resume();
  };

  const sample = (timeSeconds: number): SignalAudioFrame => {
    const fallback = createProceduralFrame(timeSeconds);

    if (
      !context ||
      context.state !== "running" ||
      !analyser ||
      !timeDomainData ||
      !frequencyData
    ) {
      return fallback;
    }

    analyser.getFloatTimeDomainData(timeDomainData);
    analyser.getByteFrequencyData(frequencyData);

    let energy = 0;

    for (const sampleValue of timeDomainData) {
      energy += sampleValue * sampleValue;
    }

    const rms = clamp01(Math.sqrt(energy / timeDomainData.length) * 3.2);
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
  };

  return { start, sample, dispose };
}
