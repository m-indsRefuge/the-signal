import { SIGNAL_AUDIO_TEXTURE_SIZE } from "./hero-signal-audio";
import type { SignalAudioFrame } from "./hero-signal-audio";

const MAX_RENDER_PIXELS = 2_400_000;
const MAX_PIXEL_RATIO = 2;
const MOBILE_PIXEL_RATIO = 1.5;

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMotion;
uniform vec4 uAudio;
uniform vec2 uDynamics;
uniform sampler2D uAudioTexture;

const float TAU = 6.28318530718;

struct AudioTrace {
  float wave;
  float spectrum;
  float envelope;
  float transient;
};

struct SignalField {
  float wave;
  float energy;
  float coherence;
  float dispersion;
};

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);

  float lowerLeft = hash21(cell);
  float lowerRight = hash21(cell + vec2(1.0, 0.0));
  float upperLeft = hash21(cell + vec2(0.0, 1.0));
  float upperRight = hash21(cell + vec2(1.0, 1.0));

  return mix(
    mix(lowerLeft, lowerRight, local.x),
    mix(upperLeft, upperRight, local.x),
    local.y
  );
}

float fractalNoise(vec2 point) {
  return
    valueNoise(point) * 0.56 +
    valueNoise(point * 2.03 + vec2(17.0, 9.0)) * 0.28 +
    valueNoise(point * 4.01 + vec2(41.0, 23.0)) * 0.16;
}

float wrappedOffset(float position, float centre) {
  return mod(position - centre + 0.5, 1.0) - 0.5;
}

float wrappedGaussian(float position, float centre, float width) {
  float distanceFromCentre = wrappedOffset(position, centre) / width;
  return exp(-distanceFromCentre * distanceFromCentre);
}

float asymmetricPulse(
  float position,
  float centre,
  float riseWidth,
  float fallWidth
) {
  float offset = wrappedOffset(position, centre);
  float rise = smoothstep(-riseWidth, 0.0, offset);
  float fall = 1.0 - smoothstep(0.0, fallWidth, offset);
  return rise * fall;
}

float rampDropExcursion(
  float position,
  float centre,
  float riseWidth,
  float dropWidth,
  float risePower
) {
  float offset = wrappedOffset(position, centre);
  float riseProgress = clamp((offset + riseWidth) / riseWidth, 0.0, 1.0);
  float longRise = pow(riseProgress, risePower);
  float sharpDrop = 1.0 - smoothstep(0.0, dropWidth, offset);
  return longRise * sharpDrop;
}

float collapseRecoveryExcursion(
  float position,
  float centre,
  float collapseWidth,
  float recoveryWidth,
  float recoveryPower
) {
  float offset = wrappedOffset(position, centre);
  float collapse = smoothstep(-collapseWidth, 0.0, offset);
  float recoveryProgress = clamp(offset / recoveryWidth, 0.0, 1.0);
  float recovery = 1.0 - pow(recoveryProgress, recoveryPower);
  return collapse * recovery;
}

float softLimit(float value, float limit) {
  float normalized = value / limit;
  float denominator = pow(1.0 + pow(abs(normalized), 4.0), 0.25);
  return limit * normalized / denominator;
}

float cycleEnvelope(
  float timeSeconds,
  float duration,
  float phaseOffset,
  float riseStart,
  float riseEnd,
  float fallStart,
  float fallEnd
) {
  float phase = fract(timeSeconds / duration + phaseOffset);
  float rise = smoothstep(riseStart, riseEnd, phase);
  float fall = 1.0 - smoothstep(fallStart, fallEnd, phase);
  return rise * fall;
}

AudioTrace sampleAudioTrace(float position) {
  vec4 encoded = texture(
    uAudioTexture,
    vec2(clamp(position, 0.0, 1.0), 0.5)
  );

  return AudioTrace(
    encoded.r * 2.0 - 1.0,
    encoded.g,
    encoded.b,
    encoded.a
  );
}

SignalField createSignalField(float x, float timeSeconds) {
  float rms = uAudio.x;
  float low = uAudio.y;
  float mid = uAudio.z;
  float high = uAudio.w;
  float flux = uDynamics.x;
  float crest = uDynamics.y;

  float audioDomainWarp =
    (valueNoise(vec2(x * 2.7 + 4.0, timeSeconds * 0.11)) - 0.5) * 0.012;
  AudioTrace liveTrace = sampleAudioTrace(x + audioDomainWarp);
  AudioTrace broadTrace = sampleAudioTrace(x * 0.82 + 0.09);

  float noisePhase =
    (valueNoise(vec2(x * 5.4, timeSeconds * 0.16)) - 0.5) * 1.35 +
    liveTrace.wave * (0.08 + rms * 0.16);
  float phaseDomain =
    (fractalNoise(vec2(x * 3.15 + 2.0, timeSeconds * 0.052)) - 0.5) * 0.92 +
    (liveTrace.envelope - 0.5) * 0.12 +
    liveTrace.wave * 0.06;

  float structural = sin(
    TAU * (x * 0.72 - timeSeconds * 0.052) +
    noisePhase +
    broadTrace.wave * 0.06
  );
  float body = sin(
    TAU * (x * (2.55 + low * 0.28) - timeSeconds * 0.135) +
    sin(TAU * (x * 0.68 - timeSeconds * 0.041)) * 0.72 +
    noisePhase * 0.52 +
    phaseDomain * 0.14 +
    liveTrace.wave * (0.08 + low * 0.1)
  );
  float harmonic = sin(
    TAU * (x * (7.4 + mid * 1.3) - timeSeconds * 0.34) +
    structural * 0.58 +
    phaseDomain * 0.42 +
    liveTrace.spectrum * 0.44
  );
  float detail = sin(
    TAU * (x * (18.5 + high * 5.0) - timeSeconds * 0.76) +
    body * 0.48 +
    noisePhase * 0.7 +
    phaseDomain * 0.68 +
    liveTrace.transient * (0.42 + flux * 0.56)
  );

  float localBreathing =
    0.5 +
    0.5 * sin(
      TAU * (x * 1.28 - timeSeconds * 0.046) +
      sin(TAU * (x * 0.39 - timeSeconds * 0.021)) * 0.85 +
      broadTrace.envelope * 0.22
    );

  float packetCentreA = fract(0.08 + timeSeconds * 0.032);
  float packetCentreB = fract(0.53 + timeSeconds * 0.021);
  float packetA = wrappedGaussian(x, packetCentreA, 0.075 + mid * 0.025);
  float packetB = wrappedGaussian(x, packetCentreB, 0.13 + low * 0.035);
  float interference =
    0.5 +
    0.5 * sin(
      TAU * (x * 3.2 - timeSeconds * 0.11) +
      sin(TAU * (x * 1.1 - timeSeconds * 0.036)) +
      liveTrace.wave * 0.24
    );

  float coherenceCycleA = cycleEnvelope(
    timeSeconds,
    17.8,
    0.0,
    0.08,
    0.24,
    0.63,
    0.86
  );
  float coherenceCycleB = cycleEnvelope(
    timeSeconds,
    23.4,
    0.37,
    0.12,
    0.3,
    0.68,
    0.9
  );
  float coherenceCentreA = fract(0.14 + timeSeconds * 0.019);
  float coherenceCentreB = fract(0.64 + timeSeconds * 0.013);
  float coherenceZoneA = wrappedGaussian(
    x,
    coherenceCentreA,
    0.16 + low * 0.035
  );
  float coherenceZoneB = wrappedGaussian(
    x,
    coherenceCentreB,
    0.115 + mid * 0.03
  );
  float coherence = clamp(
    coherenceCycleA * coherenceZoneA +
    coherenceCycleB * coherenceZoneB * 0.78 +
    liveTrace.envelope * flux * 0.08,
    0.0,
    1.0
  );

  float pairSeparation = mix(0.31, 0.055, coherence);
  float pairPhase =
    TAU * (x * 4.42 - timeSeconds * 0.17) +
    phaseDomain * 0.34 +
    liveTrace.wave * 0.16;
  float coupledA = sin(pairPhase);
  float coupledB = sin(
    TAU *
      (x * (4.42 + pairSeparation) -
      timeSeconds * (0.158 + pairSeparation * 0.028)) +
    1.18 -
    coherence * 0.96 +
    phaseDomain * 0.26 +
    broadTrace.wave * 0.12
  );
  float beatPair = (coupledA + coupledB) * 0.5;
  float beatEnergy = 0.5 + 0.5 * coupledA * coupledB;

  float standingField =
    sin(TAU * (x * 5.15 + phaseDomain * 0.055)) *
    sin(
      TAU * (timeSeconds * 0.064) +
      structural * 0.38 +
      liveTrace.envelope * 0.16
    );
  float forwardField = sin(
    TAU * (x * 3.86 - timeSeconds * 0.118) -
    body * 0.36 +
    phaseDomain * 0.44 +
    liveTrace.spectrum * 0.24
  );

  float transferPhase =
    0.5 +
    0.5 * sin(
      TAU * (x * 1.46 - timeSeconds * 0.039) +
      sin(TAU * (x * 0.52 - timeSeconds * 0.018)) * 0.62 +
      broadTrace.envelope * 0.18
    );
  float lowerTransfer = 1.0 - coherence * transferPhase * 0.16;
  float upperTransfer = 1.0 + coherence * transferPhase * 0.22;

  float energy = clamp(
    0.18 +
    localBreathing * 0.22 +
    packetA * (0.2 + rms * 0.23) +
    packetB * (0.12 + low * 0.15) +
    interference * mid * 0.14 +
    beatEnergy * coherence * 0.16 +
    broadTrace.envelope * (0.055 + rms * 0.09) +
    liveTrace.transient * (0.045 + flux * 0.075) +
    high * 0.08,
    0.0,
    1.0
  );

  float macroComposite =
    structural * 0.34 * lowerTransfer +
    body * 0.37 * lowerTransfer +
    harmonic * (0.11 + mid * 0.025) * upperTransfer;
  float microComposite =
    harmonic * (0.08 + mid * 0.015) * upperTransfer +
    detail * (0.07 + high * 0.05) * upperTransfer;

  float packetOscillation =
    packetA *
      sin(
        TAU * (x * 11.2 - timeSeconds * 0.27) +
        body * 0.8 +
        liveTrace.wave * 0.3
      ) *
      0.032 +
    packetB *
      sin(
        TAU * (x * 4.8 - timeSeconds * 0.16) +
        structural +
        broadTrace.wave * 0.22
      ) *
      0.024;

  float coupledOscillation =
    beatPair * coherence * (0.017 + mid * 0.012) +
    standingField * coherence * (0.009 + low * 0.008) +
    forwardField * coherenceZoneB * coherenceCycleB * (0.008 + high * 0.006);

  float microInterference =
    sin(
      TAU * (x * (12.8 + high * 2.4) - timeSeconds * 0.29) +
      beatPair * 0.72 +
      phaseDomain +
      liveTrace.wave * 0.56
    ) *
    coherence *
    (0.0035 + high * 0.0045);

  float liveContour =
    liveTrace.wave *
    (0.0045 + rms * 0.012) *
    (0.45 + liveTrace.envelope * 0.55);
  float liveRipple =
    sin(
      TAU *
        (x * (10.8 + liveTrace.spectrum * 7.5) -
        timeSeconds * (0.22 + flux * 0.08)) +
      liveTrace.wave * 2.1 +
      phaseDomain
    ) *
    (
      liveTrace.envelope * (0.0022 + mid * 0.004) +
      liveTrace.transient * (0.002 + flux * 0.004)
    );
  float onsetImpulse =
    liveTrace.wave *
    liveTrace.transient *
    (0.0025 + crest * 0.006);

  float phraseCycleA = cycleEnvelope(
    timeSeconds,
    12.0,
    0.08,
    0.04,
    0.14,
    0.64,
    0.86
  );
  float phraseCycleB = cycleEnvelope(
    timeSeconds,
    15.25,
    0.44,
    0.08,
    0.2,
    0.61,
    0.84
  );
  float phraseCycleC = cycleEnvelope(
    timeSeconds,
    9.3,
    0.72,
    0.06,
    0.16,
    0.58,
    0.8
  );

  float surgeCentreA = fract(0.18 + timeSeconds * 0.028);
  float valleyCentreB = fract(0.56 + timeSeconds * 0.021);
  float surgeCentreC = fract(0.84 + timeSeconds * 0.037);

  float dominantRise = rampDropExcursion(
    x,
    surgeCentreA,
    0.255,
    0.011,
    1.08
  ) * phraseCycleA;
  float postRiseCollapse = collapseRecoveryExcursion(
    x,
    fract(surgeCentreA + 0.031),
    0.011,
    0.115,
    0.72
  ) * phraseCycleA;
  float dominantValley = collapseRecoveryExcursion(
    x,
    valleyCentreB,
    0.014,
    0.255,
    0.78
  ) * phraseCycleB;
  float valleyRebound = rampDropExcursion(
    x,
    fract(valleyCentreB + 0.095),
    0.095,
    0.022,
    0.9
  ) * phraseCycleB;
  float secondaryRise = rampDropExcursion(
    x,
    surgeCentreC,
    0.165,
    0.018,
    1.0
  ) * phraseCycleC;

  float eventShoulder =
    asymmetricPulse(
      x,
      fract(surgeCentreC + 0.048),
      0.022,
      0.12
    ) *
    phraseCycleC;

  float baselineDrift =
    sin(timeSeconds * 0.069 + 0.6) * 0.015 +
    sin(timeSeconds * 0.023 + 2.1) * 0.009;
  float phraseBias =
    (broadTrace.envelope - 0.5) * 0.02 +
    (low - mid) * 0.012;
  float eventGain = 0.94 + rms * 0.8 + crest * 0.52 + flux * 0.24;
  float phraseDrive = 0.74 + broadTrace.envelope * 0.32 + low * 0.12;
  float structuralExcursion =
    baselineDrift +
    phraseBias +
    dominantRise * (0.17 + low * 0.075) * eventGain * phraseDrive -
    postRiseCollapse * (0.09 + rms * 0.045) * eventGain -
    dominantValley * (0.155 + rms * 0.085) * eventGain +
    valleyRebound * (0.09 + mid * 0.04) * eventGain +
    secondaryRise * (0.115 + flux * 0.07) * eventGain -
    eventShoulder * (0.038 + crest * 0.025);

  float audioExcursion =
    liveTrace.wave *
    (0.02 + liveTrace.envelope * 0.039 + crest * 0.021) +
    broadTrace.wave * (0.01 + low * 0.014);

  float amplitude = 0.032 + energy * (0.075 + rms * 0.035);
  float macroMotion =
    macroComposite * amplitude +
    packetOscillation +
    liveContour +
    onsetImpulse;
  float microMotion =
    microComposite * amplitude +
    coupledOscillation +
    microInterference +
    liveRipple;
  float macroGain = 1.76 + rms * 0.38 + crest * 0.2;
  float microGain = 1.05 + high * 0.08;
  float baseExpanded =
    macroMotion * macroGain +
    microMotion * microGain +
    audioExcursion;
  float baseWave = tanh(baseExpanded / 0.205) * 0.205;
  float eventWave = softLimit(structuralExcursion, 0.31);
  float wave = softLimit(baseWave + eventWave, 0.385);

  float dispersion = clamp(
    high * 0.34 +
    mid * 0.2 +
    coherence * 0.32 +
    abs(beatPair) * coherence * 0.18 +
    liveTrace.spectrum * 0.12 +
    liveTrace.transient * 0.14 +
    flux * 0.08,
    0.0,
    1.0
  );

  return SignalField(wave, energy, coherence, dispersion);
}

float strokeMask(float distanceToLine, float halfWidth) {
  float antialiasWidth = max(fwidth(distanceToLine) * 1.35, 0.75 / uResolution.y);
  return 1.0 - smoothstep(
    halfWidth,
    halfWidth + antialiasWidth,
    distanceToLine
  );
}

float residueFleck(
  float x,
  float distanceFromCore,
  float timeSeconds,
  float energyGate
) {
  float outwardDirection = sign(distanceFromCore + 0.00001);
  vec2 residueDomain = vec2(
    x * 76.0 - timeSeconds * 1.15,
    abs(distanceFromCore) * 122.0 - timeSeconds * (0.18 + energyGate * 0.22)
  );
  vec2 cell = floor(residueDomain);
  vec2 local = fract(residueDomain) - 0.5;
  float seed = hash21(cell + vec2(19.0, 43.0));
  float sparseGate = smoothstep(0.955, 0.995, seed);
  float shape = exp(-dot(local * vec2(4.8, 2.0), local * vec2(4.8, 2.0)) * 5.0);
  float sideVariation = 0.72 + 0.28 * hash21(cell + vec2(7.0, 91.0));
  float directionalBias = mix(0.78, 1.0, step(0.0, outwardDirection));
  return sparseGate * shape * sideVariation * directionalBias * energyGate;
}

void main() {
  float timeSeconds = mix(7.25, uTime, uMotion);
  float x = clamp(vUv.x, 0.0, 1.0);
  float sampleOffset = max(1.4 / uResolution.x, 0.00125);
  SignalField field = createSignalField(x, timeSeconds);
  SignalField leftNeighbour = createSignalField(
    clamp(x - sampleOffset, 0.0, 1.0),
    timeSeconds
  );
  SignalField rightNeighbour = createSignalField(
    clamp(x + sampleOffset, 0.0, 1.0),
    timeSeconds
  );
  SignalField recentMemory = createSignalField(
    x,
    timeSeconds - 0.032 * uMotion
  );

  float localSlope = (rightNeighbour.wave - leftNeighbour.wave) * 0.5;
  float localCurvature =
    rightNeighbour.wave - 2.0 * field.wave + leftNeighbour.wave;
  float temporalDelta = recentMemory.wave - field.wave;
  float temporalActivity = clamp(
    abs(temporalDelta) * 54.0 +
    abs(localSlope) * 7.5 +
    abs(localCurvature) * 22.0 +
    field.energy * 0.34 +
    field.dispersion * 0.24 +
    uDynamics.x * 0.18,
    0.0,
    1.0
  );

  float spectralSplit =
    0.001 +
    field.energy * 0.0032 +
    field.dispersion * 0.0018 +
    temporalActivity * 0.0016 +
    abs(localSlope) * 0.061 +
    abs(localCurvature) * 0.104;
  float corePosition = 0.5 + field.wave;
  float cyanPosition =
    corePosition +
    localSlope * 0.37 -
    spectralSplit -
    localCurvature * 0.112;
  float pinkPosition =
    corePosition -
    localSlope * 0.3 +
    spectralSplit +
    localCurvature * 0.092;

  float recentGhostPosition = clamp(0.5 + recentMemory.wave, 0.035, 0.965);
  float middleGhostPosition = clamp(
    corePosition + temporalDelta * 1.85 - localCurvature * 0.025,
    0.035,
    0.965
  );
  float oldGhostPosition = clamp(
    corePosition + temporalDelta * 3.05 - localCurvature * 0.052,
    0.035,
    0.965
  );

  float coreDistance = abs(vUv.y - corePosition);
  float cyanDistance = abs(vUv.y - cyanPosition);
  float pinkDistance = abs(vUv.y - pinkPosition);
  float recentGhostDistance = abs(vUv.y - recentGhostPosition);
  float middleGhostDistance = abs(vUv.y - middleGhostPosition);
  float oldGhostDistance = abs(vUv.y - oldGhostPosition);

  float coreWidth =
    max(0.00075, 0.72 / uResolution.y) *
    (1.0 + field.coherence * 0.08 + uDynamics.y * 0.035);
  float spectralWidth =
    max(0.00064, 0.6 / uResolution.y) *
    (1.0 + field.dispersion * 0.15 + temporalActivity * 0.09);
  float ghostWidth =
    max(0.00072, 0.68 / uResolution.y) *
    (1.0 + temporalActivity * 0.18 + field.dispersion * 0.12);

  float core = strokeMask(coreDistance, coreWidth);
  float cyan = strokeMask(cyanDistance, spectralWidth);
  float pink = strokeMask(pinkDistance, spectralWidth);
  float recentGhost = strokeMask(recentGhostDistance, ghostWidth);
  float middleGhost = strokeMask(middleGhostDistance, ghostWidth * 1.08);
  float oldGhost = strokeMask(oldGhostDistance, ghostWidth * 1.18);

  float coreGlow = exp(-coreDistance * uResolution.y / 8.5);
  float cyanGlow = exp(-cyanDistance * uResolution.y / 12.0);
  float pinkGlow = exp(-pinkDistance * uResolution.y / 12.5);
  float recentGhostGlow = exp(-recentGhostDistance * uResolution.y / 14.5);
  float middleGhostGlow = exp(-middleGhostDistance * uResolution.y / 18.0);
  float oldGhostGlow = exp(-oldGhostDistance * uResolution.y / 22.0);
  float coherenceGlow =
    exp(-coreDistance * uResolution.y / 22.0) *
    field.coherence;

  float memoryStrength =
    (0.18 + temporalActivity * 0.82) *
    (0.62 + uMotion * 0.38);
  float recentMemoryStrength = memoryStrength * (0.52 + field.energy * 0.2);
  float middleMemoryStrength = memoryStrength * (0.32 + field.dispersion * 0.15);
  float oldMemoryStrength = memoryStrength * (0.2 + uDynamics.x * 0.12);

  float detachmentDistance = abs(vUv.y - corePosition);
  float detachmentBand =
    smoothstep(0.014, 0.035, detachmentDistance) *
    (1.0 - smoothstep(0.11, 0.17, detachmentDistance));
  float detachmentGate = smoothstep(
    0.46,
    0.92,
    field.energy * 0.52 +
    field.dispersion * 0.26 +
    temporalActivity * 0.34 +
    uDynamics.x * 0.18
  );
  float residue =
    residueFleck(
      x,
      vUv.y - corePosition,
      timeSeconds,
      detachmentGate
    ) *
    detachmentBand *
    (0.35 + temporalActivity * 0.65);

  float edgeFade =
    smoothstep(0.0, 0.075, x) *
    (1.0 - smoothstep(0.925, 1.0, x));
  float centreWeight = 1.0 - abs(x * 2.0 - 1.0);
  float coreStrength = mix(0.78, 1.0, pow(centreWeight, 0.7));

  vec3 white = vec3(1.0, 0.985, 0.955);
  vec3 cyanColour = vec3(0.36, 0.87, 1.0);
  vec3 pinkColour = vec3(1.0, 0.19, 0.66);
  vec3 violetColour = vec3(0.66, 0.5, 1.0);
  vec3 residueColour = mix(
    cyanColour,
    pinkColour,
    smoothstep(-0.04, 0.04, vUv.y - corePosition)
  );

  vec3 colour = white * core * coreStrength * 2.24;
  colour += cyanColour * cyan * (0.42 + field.energy * 0.22);
  colour += pinkColour * pink * (0.4 + field.energy * 0.24);
  colour += cyanColour * recentGhost * recentMemoryStrength;
  colour += violetColour * middleGhost * middleMemoryStrength;
  colour += pinkColour * oldGhost * oldMemoryStrength;
  colour += white * coreGlow * (0.056 + field.energy * 0.038);
  colour += cyanColour * cyanGlow * (0.025 + uAudio.z * 0.038);
  colour += pinkColour * pinkGlow * (0.027 + uAudio.w * 0.043);
  colour += cyanColour * recentGhostGlow * recentMemoryStrength * 0.18;
  colour += violetColour * middleGhostGlow * middleMemoryStrength * 0.22;
  colour += pinkColour * oldGhostGlow * oldMemoryStrength * 0.24;
  colour +=
    violetColour *
    min(cyanGlow, pinkGlow) *
    (field.energy * 0.034 + field.coherence * 0.024 + temporalActivity * 0.018);
  colour +=
    mix(cyanColour, pinkColour, 0.54) *
    coherenceGlow *
    (0.017 + field.dispersion * 0.022);
  colour += residueColour * residue * (0.34 + temporalActivity * 0.28);

  float alpha = max(
    core,
    max(
      cyan * 0.56,
      max(
        pink * 0.54,
        max(
          recentGhost * recentMemoryStrength * 0.62,
          max(
            middleGhost * middleMemoryStrength * 0.52,
            oldGhost * oldMemoryStrength * 0.46
          )
        )
      )
    )
  );
  alpha = max(
    alpha,
    coreGlow * 0.2 +
    cyanGlow * 0.072 +
    pinkGlow * 0.08 +
    recentGhostGlow * recentMemoryStrength * 0.11 +
    middleGhostGlow * middleMemoryStrength * 0.12 +
    oldGhostGlow * oldMemoryStrength * 0.13 +
    coherenceGlow * 0.05 +
    residue * 0.42
  );

  colour = vec3(1.0) - exp(-colour);
  outColor = vec4(colour, clamp(alpha * edgeFade, 0.0, 1.0));
}
`;

type LivingSignalRenderer = {
  resize: (cssWidth: number, cssHeight: number) => void;
  render: (
    timeSeconds: number,
    audioFrame: SignalAudioFrame,
    motionAmount?: number,
  ) => void;
  dispose: () => void;
};

type UniformLocations = {
  resolution: WebGLUniformLocation;
  time: WebGLUniformLocation;
  motion: WebGLUniformLocation;
  audio: WebGLUniformLocation;
  dynamics: WebGLUniformLocation;
  audioTexture: WebGLUniformLocation;
};

function compileShader(
  context: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = context.createShader(type);

  if (!shader) {
    throw new Error("Unable to allocate a WebGL shader.");
  }

  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const log =
      context.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    context.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(context: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(
    context,
    context.VERTEX_SHADER,
    VERTEX_SHADER_SOURCE,
  );
  const fragmentShader = compileShader(
    context,
    context.FRAGMENT_SHADER,
    FRAGMENT_SHADER_SOURCE,
  );
  const program = context.createProgram();

  if (!program) {
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    throw new Error("Unable to allocate a WebGL program.");
  }

  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const log =
      context.getProgramInfoLog(program) || "Unknown WebGL link error.";
    context.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

function getUniformLocation(
  context: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = context.getUniformLocation(program, name);

  if (!location) {
    throw new Error(`Missing WebGL uniform: ${name}`);
  }

  return location;
}

export function createLivingSignalRenderer(
  canvas: HTMLCanvasElement,
): LivingSignalRenderer | null {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });

  if (!context) {
    return null;
  }

  try {
    const program = createProgram(context);
    const vertexArray = context.createVertexArray();
    const vertexBuffer = context.createBuffer();
    const audioTexture = context.createTexture();

    if (!vertexArray || !vertexBuffer || !audioTexture) {
      context.deleteProgram(program);
      return null;
    }

    context.bindVertexArray(vertexArray);
    context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      context.STATIC_DRAW,
    );

    const positionLocation = context.getAttribLocation(program, "aPosition");

    if (positionLocation < 0) {
      context.deleteTexture(audioTexture);
      context.deleteBuffer(vertexBuffer);
      context.deleteVertexArray(vertexArray);
      context.deleteProgram(program);
      return null;
    }

    context.enableVertexAttribArray(positionLocation);
    context.vertexAttribPointer(
      positionLocation,
      2,
      context.FLOAT,
      false,
      0,
      0,
    );
    context.bindVertexArray(null);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, audioTexture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MIN_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MAG_FILTER,
      context.LINEAR,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_S,
      context.CLAMP_TO_EDGE,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_T,
      context.CLAMP_TO_EDGE,
    );
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA,
      SIGNAL_AUDIO_TEXTURE_SIZE,
      1,
      0,
      context.RGBA,
      context.UNSIGNED_BYTE,
      null,
    );
    context.bindTexture(context.TEXTURE_2D, null);

    const uniforms: UniformLocations = {
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      motion: getUniformLocation(context, program, "uMotion"),
      audio: getUniformLocation(context, program, "uAudio"),
      dynamics: getUniformLocation(context, program, "uDynamics"),
      audioTexture: getUniformLocation(context, program, "uAudioTexture"),
    };

    context.disable(context.DEPTH_TEST);
    context.disable(context.CULL_FACE);
    context.disable(context.BLEND);
    context.clearColor(0, 0, 0, 0);

    const resize = (cssWidth: number, cssHeight: number) => {
      const safeWidth = Math.max(1, cssWidth);
      const safeHeight = Math.max(1, cssHeight);
      const devicePixelRatio = window.devicePixelRatio || 1;
      const preferredRatio = Math.min(
        devicePixelRatio,
        window.innerWidth <= 768 ? MOBILE_PIXEL_RATIO : MAX_PIXEL_RATIO,
      );
      const pixelBudgetRatio = Math.sqrt(
        MAX_RENDER_PIXELS / (safeWidth * safeHeight),
      );
      const renderRatio = Math.max(
        1,
        Math.min(preferredRatio, pixelBudgetRatio),
      );
      const width = Math.max(1, Math.floor(safeWidth * renderRatio));
      const height = Math.max(1, Math.floor(safeHeight * renderRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.viewport(0, 0, width, height);
    };

    const render = (
      timeSeconds: number,
      audioFrame: SignalAudioFrame,
      motionAmount = 1,
    ) => {
      context.clear(context.COLOR_BUFFER_BIT);
      context.useProgram(program);
      context.bindVertexArray(vertexArray);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, audioTexture);
      context.texSubImage2D(
        context.TEXTURE_2D,
        0,
        0,
        0,
        SIGNAL_AUDIO_TEXTURE_SIZE,
        1,
        context.RGBA,
        context.UNSIGNED_BYTE,
        audioFrame.textureData,
      );
      context.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      context.uniform1f(uniforms.time, timeSeconds);
      context.uniform1f(uniforms.motion, motionAmount);
      context.uniform4f(
        uniforms.audio,
        audioFrame.rms,
        audioFrame.low,
        audioFrame.mid,
        audioFrame.high,
      );
      context.uniform2f(uniforms.dynamics, audioFrame.flux, audioFrame.crest);
      context.uniform1i(uniforms.audioTexture, 0);
      context.drawArrays(context.TRIANGLES, 0, 3);
      context.bindTexture(context.TEXTURE_2D, null);
      context.bindVertexArray(null);
    };

    const dispose = () => {
      context.deleteTexture(audioTexture);
      context.deleteBuffer(vertexBuffer);
      context.deleteVertexArray(vertexArray);
      context.deleteProgram(program);
    };

    return { resize, render, dispose };
  } catch {
    return null;
  }
}
