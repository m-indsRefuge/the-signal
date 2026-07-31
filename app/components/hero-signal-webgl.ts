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
uniform vec4 uCharge;
uniform vec4 uDischarge;
uniform vec4 uObserver;
uniform vec2 uObserverVelocity;
uniform float uVerticalScale;
uniform vec4 uDrag;
uniform vec2 uDragVelocity;

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
  float electricalGrainA = sin(
    TAU *
      (
        x * (42.0 + high * 10.0) -
        timeSeconds * (1.42 + flux * 0.28)
      ) +
    detail * 0.84 +
    harmonic * 0.36 +
    phaseDomain * 1.18 +
    liveTrace.wave * 0.72
  );
  float electricalGrainB = sin(
    TAU *
      (
        x * (68.0 + high * 15.0) +
        timeSeconds * (2.06 + crest * 0.32)
      ) -
    detail * 0.46 +
    body * 0.28 +
    phaseDomain * 1.52 +
    liveTrace.transient * 1.1
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
    harmonic * (0.15 + mid * 0.032) * upperTransfer +
    detail * (0.145 + high * 0.095) * upperTransfer +
    electricalGrainA * (0.072 + high * 0.072) * upperTransfer +
    electricalGrainB * (0.048 + flux * 0.05) * upperTransfer;

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
    (0.009 + high * 0.01);

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
      liveTrace.envelope * (0.0058 + mid * 0.009) +
      liveTrace.transient * (0.0048 + flux * 0.008)
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
  float microGain = 1.95 + high * 0.3;
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
    x * 54.0 - timeSeconds * 0.92,
    abs(distanceFromCore) * 78.0 - timeSeconds * (0.14 + energyGate * 0.2)
  );
  vec2 cell = floor(residueDomain);
  vec2 local = fract(residueDomain) - 0.5;
  float seed = hash21(cell + vec2(19.0, 43.0));
  float sparseGate = smoothstep(0.88, 0.975, seed);
  float shape = exp(-dot(local * vec2(3.2, 1.45), local * vec2(3.2, 1.45)) * 3.2);
  float sideVariation = 0.72 + 0.28 * hash21(cell + vec2(7.0, 91.0));
  float directionalBias = mix(0.78, 1.0, step(0.0, outwardDirection));
  return sparseGate * shape * sideVariation * directionalBias * energyGate;
}

float energyNodeCore(vec2 localPosition, float radius) {
  float normalizedDistance = length(localPosition) / max(radius, 0.0001);
  return exp(-normalizedDistance * normalizedDistance * 3.6);
}

float energyNodeRing(vec2 localPosition, float radius) {
  float normalizedDistance = length(localPosition) / max(radius, 0.0001);
  return exp(-pow(normalizedDistance - 1.18, 2.0) * 8.5);
}

float energyNodeHalo(vec2 localPosition, float radius) {
  float normalizedDistance = length(localPosition) / max(radius, 0.0001);
  return exp(-normalizedDistance * normalizedDistance * 0.24);
}

float elasticKernel(float horizontalDistance) {
  float narrowField =
    exp(-pow(horizontalDistance / 0.072, 2.0));
  float wideField =
    exp(-pow(horizontalDistance / 0.26, 2.0));

  return clamp(
    narrowField * 0.84 + wideField * 0.16,
    0.0,
    1.0
  );
}

float sparkRay(
  vec2 localPosition,
  vec2 direction,
  float length,
  float width,
  float timeSeconds,
  float phase
) {
  vec2 rayDirection = normalize(direction);
  vec2 rayNormal = vec2(-rayDirection.y, rayDirection.x);
  float along = dot(localPosition, rayDirection);
  float across = abs(dot(localPosition, rayNormal));
  float normalizedAlong = clamp(along / max(length, 0.0001), 0.0, 1.0);
  float startGate = smoothstep(0.0, width * 2.4, along);
  float endGate = 1.0 - smoothstep(length * 0.62, length, along);
  float taper = mix(1.0, 0.22, normalizedAlong);
  float filament = exp(
    -pow(across / max(width * taper, 0.0001), 2.0)
  );
  float segmentation =
    0.44 +
    0.56 *
    smoothstep(
      0.16,
      0.78,
      0.5 +
      0.5 *
      sin(
        normalizedAlong * TAU * 5.0 -
        timeSeconds * 10.5 +
        phase
      )
    );
  float tip =
    exp(
      -pow(
        (along - length * 0.86) / max(length * 0.12, 0.0001),
        2.0
      )
    ) *
    exp(-pow(across / max(width * 1.8, 0.0001), 2.0));

  return startGate * endGate * filament * segmentation + tip * 1.45;
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
    timeSeconds - 0.24 * uMotion
  );

  float verticalScale = clamp(uVerticalScale, 0.12, 1.0);
  float rawLocalSlope =
    (rightNeighbour.wave - leftNeighbour.wave) * 0.5;
  float rawLocalCurvature =
    rightNeighbour.wave - 2.0 * field.wave + leftNeighbour.wave;
  float rawTemporalDelta = recentMemory.wave - field.wave;
  float localSlope = rawLocalSlope * verticalScale;
  float localCurvature = rawLocalCurvature * verticalScale;
  float temporalDelta = rawTemporalDelta * verticalScale;
  float temporalActivity = clamp(
    abs(rawTemporalDelta) * 18.0 +
    abs(rawLocalSlope) * 7.5 +
    abs(rawLocalCurvature) * 22.0 +
    field.energy * 0.34 +
    field.dispersion * 0.24 +
    uDynamics.x * 0.18,
    0.0,
    1.0
  );

  float observerAspectRatio =
    uResolution.x / max(uResolution.y, 1.0);
  float baseCorePosition =
    0.5 + field.wave * verticalScale;
  float dragStrength =
    clamp(uDrag.z, 0.0, 1.0) * uMotion;
  float dragSpeed =
    clamp(length(uDragVelocity) / 3.4, 0.0, 1.0);
  float dragHorizontalDistance =
    (x - uDrag.x) * observerAspectRatio;
  float dragKernelValue =
    elasticKernel(dragHorizontalDistance);
  float dragField =
    dragKernelValue * dragStrength;
  float dragNarrowField =
    exp(-pow(dragHorizontalDistance / 0.072, 2.0));
  float dragWideField =
    exp(-pow(dragHorizontalDistance / 0.26, 2.0));
  float dragTargetY =
    clamp(uDrag.y, 0.018, 0.982);
  float dragDisplacement =
    (dragTargetY - baseCorePosition) * dragField;
  float dragTension =
    abs(dragTargetY - baseCorePosition) * dragField;
  float dragVelocityRipple =
    sin(
      dragHorizontalDistance * TAU * 3.6 -
      timeSeconds * 8.4 +
      uDragVelocity.x * 0.8
    ) *
    dragWideField *
    (1.0 - dragNarrowField) *
    dragStrength *
    dragSpeed *
    0.018;

  float observerInfluence =
    clamp(uObserver.z, 0.0, 1.0) *
    uMotion *
    (1.0 - dragStrength * 0.92);
  float observerSpeed = clamp(uObserver.w, 0.0, 1.0);
  float observerHorizontalDistance =
    (
      (x - uObserver.x) *
      observerAspectRatio
    ) /
    verticalScale;
  float observerVerticalDistance =
    (uObserver.y - baseCorePosition) /
    verticalScale;
  float observerDistance = length(
    vec2(observerHorizontalDistance, observerVerticalDistance)
  );
  float observerProximity =
    observerInfluence *
    (1.0 - smoothstep(0.075, 0.42, observerDistance));
  float observerHorizontalField =
    exp(
      -pow(
        observerHorizontalDistance / 0.27,
        2.0
      )
    ) *
    observerInfluence;
  float observerLineGate =
    1.0 -
    smoothstep(
      0.11,
      0.42,
      abs(observerVerticalDistance)
    );
  float observerField =
    observerHorizontalField * observerLineGate;
  float observerPull =
    clamp(
      observerVerticalDistance * verticalScale,
      -0.24 * verticalScale,
      0.24 * verticalScale
    ) *
    observerField *
    (0.2 + observerProximity * 0.2);
  float observerVelocityRipple =
    sin(
      (x - uObserver.x) * TAU * 8.5 -
      timeSeconds * 5.8 +
      uObserverVelocity.x * 0.9
    ) *
    observerField *
    observerSpeed *
    0.009 *
    verticalScale;
  float observerCompression =
    1.0 - observerProximity * 0.54;
  float dragCompression =
    1.0 - dragField * 0.62;
  float dragShoulder =
    max(
      0.0,
      dragWideField - dragNarrowField * 0.48
    ) *
    dragStrength;
  float dragSpectralStretch =
    1.0 + dragTension * 1.8 + dragShoulder * 0.34;

  float spectralSplit =
    (
      0.003 +
      field.energy * 0.006 +
      field.dispersion * 0.004 +
      temporalActivity * 0.005 +
      abs(rawLocalSlope) * 0.085 +
      abs(rawLocalCurvature) * 0.16
    ) *
    verticalScale *
    observerCompression *
    dragCompression *
    dragSpectralStretch;
  float corePosition = clamp(
    baseCorePosition +
    observerPull +
    observerVelocityRipple +
    dragDisplacement +
    dragVelocityRipple,
    0.015,
    0.985
  );
  float cyanPosition =
    corePosition +
    localSlope * 0.46 * observerCompression -
    spectralSplit -
    localCurvature * 0.16;
  float pinkPosition =
    corePosition -
    localSlope * 0.4 * observerCompression +
    spectralSplit +
    localCurvature * 0.14;

  float memoryDirection = sign(
    temporalDelta + localSlope * 0.22 + 0.00001
  );
  float memorySeparation =
    memoryDirection *
    (0.008 + temporalActivity * 0.026) *
    verticalScale *
    (1.0 - observerProximity * 0.48) *
    (1.0 + dragTension * 1.35 + dragShoulder * 0.42);

  float recentGhostPosition = clamp(
    corePosition +
    temporalDelta * 0.22 +
    memorySeparation * 0.45 -
    localCurvature * 0.018,
    0.015,
    0.985
  );
  float middleGhostPosition = clamp(
    corePosition +
    temporalDelta * 0.55 +
    memorySeparation * 0.85 -
    localCurvature * 0.035,
    0.015,
    0.985
  );
  float oldGhostPosition = clamp(
    corePosition +
    temporalDelta +
    memorySeparation * 1.25 -
    localCurvature * 0.065,
    0.015,
    0.985
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
  float coreBodyWidth =
    coreWidth *
    (
      3.2 +
      field.energy * 0.18 +
      temporalActivity * 0.13
    );
  float coreShellWidth =
    coreWidth *
    (
      4.1 +
      field.dispersion * 0.2 +
      temporalActivity * 0.14
    );
  float spectralWidth =
    max(0.0011, 0.92 / uResolution.y) *
    (1.0 + field.dispersion * 0.28 + temporalActivity * 0.2);
  float ghostWidth =
    max(0.00145, 1.2 / uResolution.y) *
    (1.0 + temporalActivity * 0.34 + field.dispersion * 0.22);

  float coreSpine = strokeMask(coreDistance, coreWidth * 0.92);
  float coreBody = strokeMask(coreDistance, coreBodyWidth);
  float coreShell = strokeMask(coreDistance, coreShellWidth);
  float core = coreBody;
  float cyan = strokeMask(cyanDistance, spectralWidth);
  float pink = strokeMask(pinkDistance, spectralWidth);
  float recentGhost = strokeMask(recentGhostDistance, ghostWidth);
  float middleGhost = strokeMask(middleGhostDistance, ghostWidth * 1.22);
  float oldGhost = strokeMask(oldGhostDistance, ghostWidth * 1.48);

  float signedCoreProfile = clamp(
    (vUv.y - corePosition) / max(coreBodyWidth, 0.00001),
    -1.0,
    1.0
  );
  float coreRoundness = sqrt(
    max(0.0, 1.0 - signedCoreProfile * signedCoreProfile)
  );
  float coreBodyEdge = max(coreBody - coreSpine, 0.0);
  float coreShellEdge = max(coreShell - coreBody, 0.0);
  float coreUpperHighlight =
    coreBodyEdge *
    (1.0 - smoothstep(-0.72, 0.24, signedCoreProfile));
  float coreLowerShadow =
    coreBodyEdge *
    smoothstep(-0.18, 0.86, signedCoreProfile);

  float coreGlow = exp(-coreDistance * uResolution.y / 6.35);
  float cyanGlow = exp(-cyanDistance * uResolution.y / 9.8);
  float pinkGlow = exp(-pinkDistance * uResolution.y / 7.6);
  float recentGhostGlow = exp(-recentGhostDistance * uResolution.y / 24.0);
  float middleGhostGlow = exp(-middleGhostDistance * uResolution.y / 34.0);
  float oldGhostGlow = exp(-oldGhostDistance * uResolution.y / 48.0);
  float coherenceGlow =
    exp(-coreDistance * uResolution.y / 22.0) *
    field.coherence;

  float memoryStrength =
    (0.58 + temporalActivity * 0.72) *
    (0.72 + uMotion * 0.28);
  float recentMemoryStrength = memoryStrength * (1.0 + field.energy * 0.35);
  float middleMemoryStrength = memoryStrength * (0.76 + field.dispersion * 0.26);
  float oldMemoryStrength = memoryStrength * (0.58 + uDynamics.x * 0.22);

  float detachmentDistance = abs(vUv.y - corePosition);
  float detachmentBand =
    smoothstep(
      0.014 * verticalScale,
      0.035 * verticalScale,
      detachmentDistance
    ) *
    (
      1.0 -
      smoothstep(
        0.11 * verticalScale,
        0.17 * verticalScale,
        detachmentDistance
      )
    );
  float detachmentGate = smoothstep(
    0.24,
    0.72,
    field.energy * 0.52 +
    field.dispersion * 0.26 +
    temporalActivity * 0.34 +
    uDynamics.x * 0.18
  );
  float residue =
    residueFleck(
      x,
      (vUv.y - corePosition) / verticalScale,
      timeSeconds,
      detachmentGate
    ) *
    detachmentBand *
    (0.35 + temporalActivity * 0.65);

  float observerConductionNoise =
    0.38 +
    0.62 *
    smoothstep(
      0.24,
      0.82,
      fractalNoise(
        vec2(
          x * 48.0 -
          timeSeconds * (7.2 + observerSpeed * 5.0),
          uObserver.x * 19.0 +
          observerProximity * 3.0
        )
      )
    );
  float observerCurrent =
    strokeMask(
      coreDistance,
      coreWidth *
      (1.8 + observerProximity * 3.2)
    ) *
    observerHorizontalField *
    observerConductionNoise *
    (
      observerProximity * 0.76 +
      observerSpeed * observerField * 0.38
    );
  float observerHalo =
    exp(
      -coreDistance *
      uResolution.y /
      (20.0 + observerProximity * 24.0)
    ) *
    observerField;
  float observerCoherence =
    strokeMask(
      coreDistance,
      coreWidth * (1.3 + observerProximity * 1.4)
    ) *
    observerProximity;

  float dragConductionNoise =
    0.34 +
    0.66 *
    smoothstep(
      0.2,
      0.8,
      fractalNoise(
        vec2(
          x * 62.0 -
          timeSeconds * (9.5 + dragSpeed * 7.0),
          uDrag.x * 23.0 +
          dragTension * 18.0
        )
      )
    );
  float dragCurrent =
    strokeMask(
      coreDistance,
      coreWidth *
      (
        2.2 +
        dragField * 3.8 +
        dragTension * 9.0
      )
    ) *
    dragKernelValue *
    dragStrength *
    dragConductionNoise *
    (
      0.58 +
      dragTension * 2.8 +
      dragSpeed * 0.72
    );
  float dragHalo =
    exp(
      -coreDistance *
      uResolution.y /
      (
        22.0 +
        dragField * 24.0 +
        dragTension * 68.0
      )
    ) *
    dragKernelValue *
    dragStrength;
  float dragCoherence =
    strokeMask(
      coreDistance,
      coreWidth *
      (1.5 + dragField * 2.4)
    ) *
    dragField;
  vec2 dragTipLocal = vec2(
    dragHorizontalDistance,
    vUv.y - dragTargetY
  );
  float dragTipCore =
    energyNodeCore(
      dragTipLocal,
      (
        0.009 +
        dragTension * 0.024 +
        dragSpeed * 0.004
      )
    ) *
    dragStrength;
  float dragTipRing =
    energyNodeRing(
      dragTipLocal,
      (
        0.016 +
        dragTension * 0.036
      )
    ) *
    dragStrength *
    (
      0.62 +
      0.38 *
      sin(
        timeSeconds * 11.0 +
        uDrag.x * TAU
      )
    );
  float dragTipHalo =
    energyNodeHalo(
      dragTipLocal,
      (
        0.028 +
        dragTension * 0.064
      )
    ) *
    dragStrength;

  float aspectRatio = uResolution.x / max(uResolution.y, 1.0);
  float chargeX = clamp(uCharge.x, 0.01, 0.99);
  float dischargeX = clamp(uCharge.y, 0.08, 0.92);
  float chargeStrength = max(uCharge.z, 0.0);
  float accumulationStrength = clamp(uCharge.w, 0.0, 1.0);
  float explosionAge = clamp(uDischarge.y, 0.0, 1.0);
  float explosionStrength = max(uDischarge.z, 0.0);
  float eventSeed = uDischarge.w * 4096.0;

  SignalField chargeAnchor = createSignalField(chargeX, timeSeconds);
  SignalField dischargeAnchor = createSignalField(dischargeX, timeSeconds);
  float chargeBasePosition =
    0.5 + chargeAnchor.wave * verticalScale;
  float dischargeBasePosition =
    0.5 + dischargeAnchor.wave * verticalScale;
  float chargeDragField =
    elasticKernel(
      (chargeX - uDrag.x) * aspectRatio
    ) *
    dragStrength;
  float dischargeDragField =
    elasticKernel(
      (dischargeX - uDrag.x) * aspectRatio
    ) *
    dragStrength;
  float chargePosition = mix(
    chargeBasePosition,
    dragTargetY,
    chargeDragField
  );
  float dischargePosition = mix(
    dischargeBasePosition,
    dragTargetY,
    dischargeDragField
  );
  float effectScale = verticalScale;

  vec2 chargeLocal = vec2(
    (x - chargeX) * aspectRatio,
    vUv.y - chargePosition
  );
  vec2 dischargeLocal = vec2(
    (x - dischargeX) * aspectRatio,
    vUv.y - dischargePosition
  );

  float chargeRadius =
    (
      0.008 +
      chargeStrength * 0.007 +
      uDynamics.y * 0.002
    ) *
    effectScale;
  float chargeCore =
    energyNodeCore(chargeLocal, chargeRadius) *
    chargeStrength;
  float chargeRing =
    energyNodeRing(chargeLocal, chargeRadius * 1.12) *
    chargeStrength;
  float chargeHalo =
    energyNodeHalo(chargeLocal, chargeRadius * 1.95) *
    chargeStrength;

  float travelDistance = abs(x - chargeX);
  float conductiveWindow =
    exp(
      -pow(
        travelDistance /
        max(0.045 + chargeStrength * 0.11, 0.0001),
        2.0
      )
    );
  float conductiveNoise =
    0.34 +
    0.66 *
    smoothstep(
      0.28,
      0.82,
      fractalNoise(
        vec2(
          x * 42.0 - timeSeconds * 8.4,
          eventSeed * 0.17 + temporalActivity * 2.0
        )
      )
    );
  float conductiveWake =
    strokeMask(
      coreDistance,
      coreWidth * (2.4 + chargeStrength * 1.8)
    ) *
    conductiveWindow *
    conductiveNoise *
    chargeStrength;

  float chargeDirection =
    sign(dischargeX - chargeX + 0.00001);
  float chargeTailA =
    exp(
      -pow(
        (x - chargeX + chargeDirection * 0.032) / 0.052,
        2.0
      )
    );
  float chargeTailB =
    exp(
      -pow(
        (x - chargeX + chargeDirection * 0.078) / 0.075,
        2.0
      )
    );
  float electricCurrent =
    strokeMask(
      coreDistance,
      coreWidth * (1.8 + chargeStrength * 1.25)
    ) *
    (
      chargeTailA *
      (
        0.71 +
        sin(
          x * 180.0 -
          timeSeconds * 22.0 +
          eventSeed
        ) *
        0.29
      ) +
      chargeTailB * 0.44
    ) *
    chargeStrength;

  float accumulationRadius =
    (
      0.014 +
      accumulationStrength * 0.032 +
      explosionStrength * 0.008
    ) *
    effectScale;
  float accumulationPulse =
    0.76 +
    0.24 *
    sin(
      timeSeconds * (9.0 + accumulationStrength * 8.0) +
      eventSeed * 0.73
    );
  float accumulationCore =
    energyNodeCore(dischargeLocal, accumulationRadius) *
    accumulationStrength *
    accumulationPulse;
  float accumulationRing =
    energyNodeRing(
      dischargeLocal,
      accumulationRadius * (1.08 + accumulationStrength * 0.2)
    ) *
    accumulationStrength *
    (0.78 + accumulationPulse * 0.42);
  float accumulationHalo =
    energyNodeHalo(dischargeLocal, accumulationRadius * 2.2) *
    accumulationStrength;

  float instabilityAngle = eventSeed * 0.91 + timeSeconds * 0.37;
  vec2 instabilityDirectionA =
    vec2(cos(instabilityAngle), sin(instabilityAngle));
  vec2 instabilityDirectionB =
    vec2(
      cos(instabilityAngle + 2.18),
      sin(instabilityAngle + 2.18)
    );
  vec2 instabilityDirectionC =
    vec2(
      cos(instabilityAngle + 4.32),
      sin(instabilityAngle + 4.32)
    );
  float instabilityArcs =
    (
      sparkRay(
        dischargeLocal,
        instabilityDirectionA,
        (0.085 + accumulationStrength * 0.095) *
        effectScale,
        (0.0026 + accumulationStrength * 0.0018) *
        effectScale,
        timeSeconds,
        eventSeed
      ) +
      sparkRay(
        dischargeLocal,
        instabilityDirectionB,
        (0.074 + accumulationStrength * 0.086) *
        effectScale,
        (0.0024 + accumulationStrength * 0.0016) *
        effectScale,
        timeSeconds,
        eventSeed + 2.1
      ) +
      sparkRay(
        dischargeLocal,
        instabilityDirectionC,
        (0.068 + accumulationStrength * 0.079) *
        effectScale,
        (0.0022 + accumulationStrength * 0.0015) *
        effectScale,
        timeSeconds,
        eventSeed + 4.3
      )
    ) *
    pow(accumulationStrength, 1.45) *
    (
      0.48 +
      0.52 *
      smoothstep(
        0.18,
        0.84,
        0.5 +
        0.5 *
        sin(timeSeconds * 17.0 + eventSeed)
      )
    );

  float explosionEnvelope =
    explosionStrength *
    (1.0 - smoothstep(0.08, 1.0, explosionAge));
  float explosionFlash =
    energyNodeCore(
      dischargeLocal,
      (0.022 + explosionAge * 0.056) *
      effectScale
    ) *
    explosionEnvelope *
    (1.0 - smoothstep(0.0, 0.42, explosionAge));
  float shockRadius =
    (
      0.024 +
      pow(explosionAge, 0.72) * 0.21
    ) *
    effectScale;
  float shockRing =
    energyNodeRing(dischargeLocal, shockRadius) *
    explosionEnvelope *
    (1.0 - smoothstep(0.28, 1.0, explosionAge));
  float explosionHalo =
    energyNodeHalo(
      dischargeLocal,
      (0.042 + explosionAge * 0.15) *
      effectScale
    ) *
    explosionEnvelope;

  float burstAngle = eventSeed * 1.37;
  vec2 burstDirectionA =
    vec2(cos(burstAngle), sin(burstAngle));
  vec2 burstDirectionB =
    vec2(cos(burstAngle + 1.07), sin(burstAngle + 1.07));
  vec2 burstDirectionC =
    vec2(cos(burstAngle + 2.21), sin(burstAngle + 2.21));
  vec2 burstDirectionD =
    vec2(cos(burstAngle + 3.36), sin(burstAngle + 3.36));
  vec2 burstDirectionE =
    vec2(cos(burstAngle + 4.52), sin(burstAngle + 4.52));
  vec2 burstDirectionF =
    vec2(cos(burstAngle + 5.61), sin(burstAngle + 5.61));
  float explosionArcs =
    (
      sparkRay(
        dischargeLocal,
        burstDirectionA,
        0.18 * effectScale,
        0.0042 * effectScale,
        timeSeconds,
        eventSeed
      ) +
      sparkRay(
        dischargeLocal,
        burstDirectionB,
        0.145 * effectScale,
        0.0037 * effectScale,
        timeSeconds,
        eventSeed + 1.4
      ) +
      sparkRay(
        dischargeLocal,
        burstDirectionC,
        0.205 * effectScale,
        0.0044 * effectScale,
        timeSeconds,
        eventSeed + 2.7
      ) +
      sparkRay(
        dischargeLocal,
        burstDirectionD,
        0.16 * effectScale,
        0.0038 * effectScale,
        timeSeconds,
        eventSeed + 3.9
      ) +
      sparkRay(
        dischargeLocal,
        burstDirectionE,
        0.19 * effectScale,
        0.0041 * effectScale,
        timeSeconds,
        eventSeed + 5.1
      ) +
      sparkRay(
        dischargeLocal,
        burstDirectionF,
        0.138 * effectScale,
        0.0035 * effectScale,
        timeSeconds,
        eventSeed + 6.3
      )
    ) *
    explosionEnvelope *
    (1.0 - smoothstep(0.22, 0.86, explosionAge));

  float dischargeWindow =
    exp(
      -pow(
        (x - dischargeX) /
        max(0.11 + explosionAge * 0.17, 0.0001),
        2.0
      )
    );
  float dischargePattern =
    smoothstep(
      0.36,
      0.84,
      fractalNoise(
        vec2(
          (x - dischargeX) * 58.0 + eventSeed,
          timeSeconds * 6.2 - explosionAge * 14.0
        )
      )
    );
  float lineDischarge =
    strokeMask(
      coreDistance,
      coreWidth * (2.8 + explosionStrength * 2.2)
    ) *
    dischargeWindow *
    dischargePattern *
    explosionEnvelope;

  float edgeFade =
    smoothstep(0.0, 0.075, x) *
    (1.0 - smoothstep(0.925, 1.0, x));
  float centreWeight = 1.0 - abs(x * 2.0 - 1.0);
  float coreStrength = mix(0.78, 1.0, pow(centreWeight, 0.7));

  vec3 white = vec3(1.0, 0.992, 0.974);
  vec3 silverColour = vec3(0.76, 0.86, 0.95);
  vec3 coolEdgeColour = vec3(0.24, 0.5, 0.7);
  vec3 cyanColour = vec3(0.36, 0.87, 1.0);
  vec3 pinkColour = vec3(1.0, 0.19, 0.66);
  vec3 violetColour = vec3(0.66, 0.5, 1.0);
  vec3 residualPinkColour = mix(violetColour, pinkColour, 0.2);
  vec3 residueColour = mix(
    cyanColour,
    residualPinkColour,
    smoothstep(-0.04, 0.04, vUv.y - corePosition)
  );
  vec3 chargeColour = mix(
    cyanColour,
    violetColour,
    0.28 + 0.24 * sin(eventSeed)
  );
  vec3 accumulationColour = mix(
    violetColour,
    pinkColour,
    0.42 + 0.18 * sin(eventSeed * 1.7)
  );
  vec3 dischargeColour = mix(
    cyanColour,
    pinkColour,
    0.46 + 0.18 * sin(eventSeed * 2.3)
  );
  vec3 observerColour = mix(
    cyanColour,
    violetColour,
    0.34 + observerSpeed * 0.22
  );
  vec3 dragColour = mix(
    cyanColour,
    pinkColour,
    0.06 +
    dragTension * 0.5 +
    dragSpeed * 0.08
  );

  vec3 colour =
    silverColour *
    coreBody *
    coreStrength *
    (
      1.0 +
      coreRoundness * 0.95 +
      field.energy * 0.16
    );
  colour +=
    coolEdgeColour *
    coreLowerShadow *
    coreStrength *
    (0.28 + field.dispersion * 0.16);
  colour +=
    white *
    coreUpperHighlight *
    coreStrength *
    (0.88 + field.coherence * 0.3);
  colour +=
    white *
    coreSpine *
    coreStrength *
    (
      3.6 +
      field.energy * 0.42 +
      temporalActivity * 0.24
    );
  colour +=
    silverColour *
    coreShellEdge *
    (0.23 + field.energy * 0.095);
  colour += cyanColour * cyan * (0.72 + field.energy * 0.34);
  colour +=
    residualPinkColour *
    pink *
    (0.2 + field.energy * 0.13 + temporalActivity * 0.035);
  colour += cyanColour * recentGhost * recentMemoryStrength;
  colour += violetColour * middleGhost * middleMemoryStrength;
  colour +=
    residualPinkColour *
    oldGhost *
    oldMemoryStrength *
    0.46;
  colour +=
    silverColour *
    coreGlow *
    (0.105 + field.energy * 0.068 + temporalActivity * 0.024);
  colour += cyanColour * cyanGlow * (0.025 + uAudio.z * 0.038);
  colour +=
    residualPinkColour *
    pinkGlow *
    (0.007 + uAudio.w * 0.012);
  colour += cyanColour * recentGhostGlow * recentMemoryStrength * 0.3;
  colour += violetColour * middleGhostGlow * middleMemoryStrength * 0.34;
  colour +=
    residualPinkColour *
    oldGhostGlow *
    oldMemoryStrength *
    0.16;
  colour +=
    violetColour *
    min(cyanGlow, pinkGlow) *
    (field.energy * 0.034 + field.coherence * 0.024 + temporalActivity * 0.018);
  colour +=
    mix(cyanColour, violetColour, 0.62) *
    coherenceGlow *
    (0.02 + field.dispersion * 0.026);
  colour += residueColour * residue * (0.78 + temporalActivity * 0.52);
  colour +=
    observerColour *
    (
      observerCurrent * 2.15 +
      observerHalo * (0.12 + observerProximity * 0.22)
    );
  colour +=
    white *
    observerCoherence *
    (0.42 + observerProximity * 0.68);
  colour +=
    dragColour *
    (
      dragCurrent * 2.8 +
      dragHalo *
      (
        0.14 +
        dragTension * 0.42
      ) +
      dragTipCore * 4.8 +
      dragTipRing * 1.9 +
      dragTipHalo * 0.72
    );
  colour +=
    white *
    (
      dragCoherence *
      (
        0.52 +
        dragTension * 1.1
      ) +
      dragTipCore * 1.9
    );
  colour +=
    chargeColour *
    (
      chargeCore * 4.4 +
      chargeRing * 1.55 +
      chargeHalo * 0.5 +
      conductiveWake * 1.8 +
      electricCurrent * 2.15
    );
  colour += white * chargeCore * 1.8;
  colour +=
    accumulationColour *
    (
      accumulationCore * 5.6 +
      accumulationRing * 2.35 +
      accumulationHalo * 0.82 +
      instabilityArcs * 2.7
    );
  colour +=
    white *
    accumulationCore *
    (1.8 + accumulationStrength * 1.4);
  colour +=
    dischargeColour *
    (
      shockRing * 3.1 +
      explosionHalo * 1.18 +
      explosionArcs * 3.4 +
      lineDischarge * 2.7
    );
  colour +=
    white *
    (
      explosionFlash * 8.4 +
      shockRing * 0.72 +
      explosionArcs * 0.55
    );

  float alpha = max(
    core,
    max(
      cyan * 0.56,
      max(
        pink * 0.22,
        max(
          recentGhost * recentMemoryStrength * 0.92,
          max(
            middleGhost * middleMemoryStrength * 0.8,
            oldGhost * oldMemoryStrength * 0.38
          )
        )
      )
    )
  );
  alpha = max(
    alpha,
    coreShell * 0.38 +
    coreGlow * 0.27 +
    cyanGlow * 0.064 +
    pinkGlow * 0.025 +
    recentGhostGlow * recentMemoryStrength * 0.24 +
    middleGhostGlow * middleMemoryStrength * 0.26 +
    oldGhostGlow * oldMemoryStrength * 0.12 +
    coherenceGlow * 0.05 +
    residue * 0.72
  );

  float electricalAlpha = max(
    max(
      chargeCore,
      max(
        chargeRing * 0.78 + chargeHalo * 0.38,
        max(conductiveWake * 0.76, electricCurrent * 0.88)
      )
    ),
    max(
      accumulationCore,
      max(
        accumulationRing * 0.88 +
        accumulationHalo * 0.44 +
        instabilityArcs * 0.9,
        max(
          explosionFlash,
          shockRing * 0.92 +
          explosionHalo * 0.54 +
          explosionArcs * 0.94 +
          lineDischarge * 0.88
        )
      )
    )
  );
  alpha = max(alpha, electricalAlpha);
  float observerAlpha = max(
    observerCoherence,
    observerCurrent * 0.86 +
    observerHalo * (0.12 + observerProximity * 0.18)
  );
  alpha = max(alpha, observerAlpha);
  float dragAlpha = max(
    dragCoherence,
    max(
      dragCurrent * 0.94 +
      dragHalo *
      (
        0.16 +
        dragTension * 0.24
      ),
      max(
        dragTipCore,
        dragTipRing * 0.88 +
        dragTipHalo * 0.46
      )
    )
  );
  alpha = max(alpha, dragAlpha);

  colour = vec3(1.0) - exp(-colour);
  outColor = vec4(colour, clamp(alpha * edgeFade, 0.0, 1.0));
}
`;

const PARTICLE_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 aParticlePosition;
in vec2 aParticleVelocity;
in float aParticleSize;
in vec3 aParticleColour;
in float aParticleAlpha;
in float aParticleFlicker;

uniform vec2 uParticleResolution;

out vec3 vParticleColour;
out float vParticleAlpha;
out float vParticleFlicker;
out vec2 vParticleDirection;

void main() {
  vec2 clipPosition = aParticlePosition * 2.0 - 1.0;
  vec2 pixelVelocity = vec2(
    aParticleVelocity.x * uParticleResolution.x,
    aParticleVelocity.y * uParticleResolution.y
  );

  gl_Position = vec4(clipPosition, 0.0, 1.0);
  gl_PointSize = max(
    1.0,
    aParticleSize * max(0.72, uParticleResolution.y / 720.0)
  );

  vParticleColour = aParticleColour;
  vParticleAlpha = aParticleAlpha;
  vParticleFlicker = aParticleFlicker;
  vParticleDirection = normalize(pixelVelocity + vec2(0.0001, 0.0));
}
`;

const PARTICLE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec3 vParticleColour;
in float vParticleAlpha;
in float vParticleFlicker;
in vec2 vParticleDirection;

out vec4 outColor;

void main() {
  vec2 local = gl_PointCoord - 0.5;
  vec2 normal = vec2(-vParticleDirection.y, vParticleDirection.x);
  float along = dot(local, vParticleDirection);
  float across = dot(local, normal);

  float head =
    exp(
      -pow((along - 0.14) / 0.24, 2.0) -
      pow(across / 0.19, 2.0)
    );
  float tailGate =
    smoothstep(-0.5, 0.12, along) *
    (1.0 - smoothstep(0.08, 0.48, along));
  float tail =
    exp(-pow(across / 0.12, 2.0)) *
    tailGate *
    (0.72 - along * 0.58);
  float hotCore =
    exp(
      -pow((along - 0.18) / 0.13, 2.0) -
      pow(across / 0.1, 2.0)
    );

  float shape = head + tail * 0.9 + hotCore * 0.7;
  float alpha =
    shape *
    vParticleAlpha *
    (0.7 + vParticleFlicker * 0.3);

  if (alpha < 0.008) {
    discard;
  }

  vec3 colour =
    vParticleColour *
    (1.35 + head * 1.2 + tail * 0.42) +
    vec3(1.0, 0.985, 0.95) * hotCore * 0.78;

  outColor = vec4(colour, clamp(alpha, 0.0, 1.0));
}
`;

const MAX_SPARK_PARTICLES = 160;
const PARTICLE_STRIDE = 10;
const PARTICLE_BUFFER_FLOATS = MAX_SPARK_PARTICLES * PARTICLE_STRIDE;
const NUMBER_TAU = Math.PI * 2;

export type HeroSignalObserverFrame = {
  x: number;
  y: number;
  influence: number;
  velocityX: number;
  velocityY: number;
  speed: number;
  dragX: number;
  dragY: number;
  dragStrength: number;
  dragVelocityX: number;
  dragVelocityY: number;
  dragging: number;
};

const INACTIVE_OBSERVER_FRAME: HeroSignalObserverFrame = {
  x: 0.5,
  y: 0.5,
  influence: 0,
  velocityX: 0,
  velocityY: 0,
  speed: 0,
  dragX: 0.5,
  dragY: 0.5,
  dragStrength: 0,
  dragVelocityX: 0,
  dragVelocityY: 0,
  dragging: 0,
};

type ElectricalFrame = {
  charge: readonly [number, number, number, number];
  discharge: readonly [number, number, number, number];
};

type ChargePhase = "travel" | "accumulate" | "discharge" | "cooldown";

type SparkParticle = {
  active: boolean;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  age: number;
  lifetime: number;
  size: number;
  brightness: number;
  colourR: number;
  colourG: number;
  colourB: number;
  drag: number;
  drift: number;
  turbulence: number;
  flickerPhase: number;
  flickerRate: number;
};

type ElectricalLifecycle = {
  update: (
    timeSeconds: number,
    audioFrame: SignalAudioFrame,
    motionAmount: number,
    observerFrame: HeroSignalObserverFrame,
  ) => ElectricalFrame;
  renderParticles: () => void;
  dispose: () => void;
};

type ParticleUniformLocations = {
  resolution: WebGLUniformLocation;
};

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstepNumber(value: number): number {
  const progress = clampNumber(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function smootherStepNumber(value: number): number {
  const progress = clampNumber(value, 0, 1);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createElectricalLifecycle(
  context: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
): ElectricalLifecycle {
  const program = createProgram(
    context,
    PARTICLE_VERTEX_SHADER_SOURCE,
    PARTICLE_FRAGMENT_SHADER_SOURCE,
  );
  const vertexArray = context.createVertexArray();
  const vertexBuffer = context.createBuffer();

  if (!vertexArray || !vertexBuffer) {
    context.deleteProgram(program);
    throw new Error("Unable to allocate electrical particle resources.");
  }

  const positionLocation = context.getAttribLocation(program, "aParticlePosition");
  const velocityLocation = context.getAttribLocation(program, "aParticleVelocity");
  const sizeLocation = context.getAttribLocation(program, "aParticleSize");
  const colourLocation = context.getAttribLocation(program, "aParticleColour");
  const alphaLocation = context.getAttribLocation(program, "aParticleAlpha");
  const flickerLocation = context.getAttribLocation(program, "aParticleFlicker");

  if (
    positionLocation < 0 ||
    velocityLocation < 0 ||
    sizeLocation < 0 ||
    colourLocation < 0 ||
    alphaLocation < 0 ||
    flickerLocation < 0
  ) {
    context.deleteBuffer(vertexBuffer);
    context.deleteVertexArray(vertexArray);
    context.deleteProgram(program);
    throw new Error("Missing electrical particle shader attribute.");
  }

  const uniforms: ParticleUniformLocations = {
    resolution: getUniformLocation(context, program, "uParticleResolution"),
  };
  const strideBytes = PARTICLE_STRIDE * Float32Array.BYTES_PER_ELEMENT;

  context.bindVertexArray(vertexArray);
  context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
  context.bufferData(
    context.ARRAY_BUFFER,
    PARTICLE_BUFFER_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    context.DYNAMIC_DRAW,
  );

  const configureAttribute = (location: number, size: number, offsetFloats: number) => {
    context.enableVertexAttribArray(location);
    context.vertexAttribPointer(
      location,
      size,
      context.FLOAT,
      false,
      strideBytes,
      offsetFloats * Float32Array.BYTES_PER_ELEMENT,
    );
  };

  configureAttribute(positionLocation, 2, 0);
  configureAttribute(velocityLocation, 2, 2);
  configureAttribute(sizeLocation, 1, 4);
  configureAttribute(colourLocation, 3, 5);
  configureAttribute(alphaLocation, 1, 8);
  configureAttribute(flickerLocation, 1, 9);

  context.bindVertexArray(null);
  context.bindBuffer(context.ARRAY_BUFFER, null);

  const particles: SparkParticle[] = Array.from({ length: MAX_SPARK_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    age: 0,
    lifetime: 1,
    size: 1,
    brightness: 0,
    colourR: 1,
    colourG: 1,
    colourB: 1,
    drag: 0,
    drift: 0,
    turbulence: 0,
    flickerPhase: 0,
    flickerRate: 1,
  }));
  const particleBufferData = new Float32Array(PARTICLE_BUFFER_FLOATS);

  let readbackData = new Uint8Array(0);
  let initialized = false;
  let lastTimeSeconds = 0;
  let phase: ChargePhase = "travel";
  let phaseStartSeconds = 0;
  let eventIndex = 0;
  let cycleSeed = 0;
  let startX = 0.02;
  let targetX = 0.62;
  let travelDuration = 1.6;
  let accumulationDuration = 0.9;
  let dischargeDuration = 0.62;
  let cooldownDuration = 1.8;
  let eventStrength = 1;
  let majorDischarge = false;
  let pendingBurst = false;
  let motionEnabled = true;
  let currentFrame: ElectricalFrame = {
    charge: [0.02, 0.62, 0, 0],
    discharge: [0.62, 1, 0, 0],
  };

  const clearParticles = () => {
    for (const particle of particles) {
      particle.active = false;
    }
  };

  const beginCycle = (timeSeconds: number) => {
    cycleSeed = (0x51f15e3d ^ Math.imul(eventIndex + 1, 0x9e3779b1)) >>> 0;
    const random = createSeededRandom(cycleSeed);
    const entersFromLeft = random() >= 0.5;

    startX = entersFromLeft ? 0.015 + random() * 0.035 : 0.985 - random() * 0.035;
    targetX = 0.16 + random() * 0.68;

    if (Math.abs(targetX - startX) < 0.28) {
      targetX = entersFromLeft ? 0.56 + random() * 0.26 : 0.18 + random() * 0.26;
    }

    majorDischarge = random() < 0.34;
    eventStrength = majorDischarge ? 1.18 + random() * 0.34 : 0.84 + random() * 0.3;
    travelDuration = 1.05 + random() * 1.65;
    accumulationDuration = 0.58 + random() * 0.92;
    dischargeDuration = majorDischarge ? 0.68 + random() * 0.2 : 0.5 + random() * 0.18;
    cooldownDuration = 1.15 + random() * 2.25;
    phase = "travel";
    phaseStartSeconds = timeSeconds;
    pendingBurst = false;
  };

  const advancePhase = (timeSeconds: number) => {
    for (let guard = 0; guard < 8; guard += 1) {
      const duration =
        phase === "travel"
          ? travelDuration
          : phase === "accumulate"
            ? accumulationDuration
            : phase === "discharge"
              ? dischargeDuration
              : cooldownDuration;

      if (timeSeconds - phaseStartSeconds < duration) {
        return;
      }

      phaseStartSeconds += duration;

      if (phase === "travel") {
        phase = "accumulate";
        continue;
      }

      if (phase === "accumulate") {
        phase = "discharge";
        pendingBurst = true;
        continue;
      }

      if (phase === "discharge") {
        phase = "cooldown";
        continue;
      }

      eventIndex += 1;
      beginCycle(phaseStartSeconds);
    }
  };

  const allocateParticle = (): SparkParticle => {
    for (const particle of particles) {
      if (!particle.active) {
        return particle;
      }
    }

    let replacement = particles[0]!;

    for (const particle of particles) {
      if (particle.age / particle.lifetime > replacement.age / replacement.lifetime) {
        replacement = particle;
      }
    }

    return replacement;
  };

  const spawnBurst = (originX: number, originY: number) => {
    const random = createSeededRandom(cycleSeed ^ 0xa53c9e17);
    const particleCount = majorDischarge
      ? 26 + Math.floor(random() * 15)
      : 15 + Math.floor(random() * 11);
    const aspectCorrection = canvas.width > 0 ? canvas.height / canvas.width : 1;
    const colours = [
      [0.48, 0.92, 1],
      [0.72, 0.58, 1],
      [1, 0.24, 0.7],
      [1, 0.96, 0.86],
    ] as const;

    for (let index = 0; index < particleCount; index += 1) {
      const particle = allocateParticle();
      const alongSignal = index < 4;
      const baseAngle = alongSignal
        ? (random() < 0.5 ? 0 : Math.PI) + (random() - 0.5) * 0.42
        : random() * NUMBER_TAU;
      const speed = (majorDischarge ? 0.18 : 0.14) + random() * (majorDischarge ? 0.24 : 0.2);
      const colour = colours[Math.floor(random() * colours.length)] ?? colours[0];

      particle.active = true;
      particle.x = originX + (random() - 0.5) * 0.008;
      particle.y = originY + (random() - 0.5) * 0.012;
      particle.velocityX = Math.cos(baseAngle) * speed * aspectCorrection * (0.78 + random() * 0.5);
      particle.velocityY = Math.sin(baseAngle) * speed * (0.78 + random() * 0.5);
      particle.age = 0;
      particle.lifetime = (majorDischarge ? 3.4 : 2.8) + random() * (majorDischarge ? 3.2 : 2.7);
      particle.size = (majorDischarge ? 10 : 8) + random() * (majorDischarge ? 15 : 12);
      particle.brightness = (majorDischarge ? 0.92 : 0.74) + random() * 0.46;
      particle.colourR = colour[0];
      particle.colourG = colour[1];
      particle.colourB = colour[2];
      particle.drag = 0.08 + random() * 0.19;
      particle.drift = (random() - 0.5) * 0.9;
      particle.turbulence = 0.003 + random() * 0.009;
      particle.flickerPhase = random() * NUMBER_TAU;
      particle.flickerRate = 5.5 + random() * 12;
    }
  };

  const resolveSignalOriginY = (originX: number): number => {
    const height = Math.max(1, canvas.height);
    const requiredBytes = height * 4;

    if (readbackData.length !== requiredBytes) {
      readbackData = new Uint8Array(requiredBytes);
    }

    const pixelX = clampNumber(
      Math.floor(originX * Math.max(0, canvas.width - 1)),
      0,
      Math.max(0, canvas.width - 1),
    );

    context.readPixels(pixelX, 0, 1, height, context.RGBA, context.UNSIGNED_BYTE, readbackData);

    let strongestScore = -1;
    let strongestY = Math.floor(height * 0.5);
    const lowerBound = Math.max(0, Math.floor(height * 0.025));
    const upperBound = Math.min(height, Math.ceil(height * 0.975));

    for (let y = lowerBound; y < upperBound; y += 1) {
      const offset = y * 4;
      const red = readbackData[offset] ?? 0;
      const green = readbackData[offset + 1] ?? 0;
      const blue = readbackData[offset + 2] ?? 0;
      const alpha = readbackData[offset + 3] ?? 0;
      const score = alpha * 2.25 + Math.max(red, green, blue) + (red + green + blue) * 0.18;

      if (score > strongestScore) {
        strongestScore = score;
        strongestY = y;
      }
    }

    return (strongestY + 0.5) / height;
  };

  const updateParticles = (
    deltaSeconds: number,
    timeSeconds: number,
    observerFrame: HeroSignalObserverFrame,
  ) => {
    const particleAspectRatio = canvas.height > 0 ? canvas.width / canvas.height : 1;

    for (const particle of particles) {
      if (!particle.active) {
        continue;
      }

      particle.age += deltaSeconds;

      if (particle.age >= particle.lifetime) {
        particle.active = false;
        continue;
      }

      const bend = particle.drift * deltaSeconds;
      const previousVelocityX = particle.velocityX;
      particle.velocityX += -particle.velocityY * bend;
      particle.velocityY += previousVelocityX * bend;

      const turbulence =
        Math.sin(
          timeSeconds * 3.4 + particle.flickerPhase + particle.age * particle.flickerRate * 0.37,
        ) *
        particle.turbulence *
        deltaSeconds;
      particle.velocityX += Math.cos(particle.flickerPhase) * turbulence;
      particle.velocityY += Math.sin(particle.flickerPhase * 1.31) * turbulence;

      if (observerFrame.influence > 0.001) {
        const observerDeltaX = (observerFrame.x - particle.x) * particleAspectRatio;
        const observerDeltaY = observerFrame.y - particle.y;
        const observerDistance = Math.hypot(observerDeltaX, observerDeltaY);

        if (observerDistance > 0.0001 && observerDistance < 0.34) {
          const observerField = smoothstepNumber(1 - observerDistance / 0.34);
          const observerForce =
            observerFrame.influence *
            observerField *
            (0.016 + observerFrame.speed * 0.026) *
            deltaSeconds;
          particle.velocityX +=
            (observerDeltaX / observerDistance) * (observerForce / particleAspectRatio);
          particle.velocityY += (observerDeltaY / observerDistance) * observerForce;
        }
      }

      if (observerFrame.dragStrength > 0.001) {
        const dragDeltaX = (observerFrame.dragX - particle.x) * particleAspectRatio;
        const dragDeltaY = observerFrame.dragY - particle.y;
        const dragDistance = Math.hypot(dragDeltaX, dragDeltaY);

        if (dragDistance > 0.0001 && dragDistance < 0.48) {
          const dragField = smoothstepNumber(1 - dragDistance / 0.48);
          const dragSpeed = clampNumber(
            Math.hypot(observerFrame.dragVelocityX, observerFrame.dragVelocityY) / 3.4,
            0,
            1,
          );
          const dragForce =
            observerFrame.dragStrength * dragField * (0.026 + dragSpeed * 0.052) * deltaSeconds;
          particle.velocityX += (dragDeltaX / dragDistance) * (dragForce / particleAspectRatio);
          particle.velocityY += (dragDeltaY / dragDistance) * dragForce;
        }
      }

      const dragFactor = Math.exp(-particle.drag * deltaSeconds);
      particle.velocityX *= dragFactor;
      particle.velocityY *= dragFactor;
      particle.x += particle.velocityX * deltaSeconds;
      particle.y += particle.velocityY * deltaSeconds;

      if (particle.x < -0.12 || particle.x > 1.12 || particle.y < -0.12 || particle.y > 1.12) {
        particle.active = false;
      }
    }
  };

  const update = (
    timeSeconds: number,
    audioFrame: SignalAudioFrame,
    motionAmount: number,
    observerFrame: HeroSignalObserverFrame,
  ): ElectricalFrame => {
    motionEnabled = motionAmount > 0.001;

    if (!motionEnabled) {
      initialized = false;
      clearParticles();
      currentFrame = {
        charge: [0.02, 0.62, 0, 0],
        discharge: [0.62, 1, 0, 0],
      };
      return currentFrame;
    }

    if (!initialized) {
      initialized = true;
      lastTimeSeconds = timeSeconds;
      beginCycle(timeSeconds);
    }

    const deltaSeconds = clampNumber(timeSeconds - lastTimeSeconds, 0, 0.05);
    lastTimeSeconds = timeSeconds;
    updateParticles(deltaSeconds, timeSeconds, observerFrame);
    advancePhase(timeSeconds);

    const phaseElapsed = Math.max(0, timeSeconds - phaseStartSeconds);
    const seedNormalized = cycleSeed / 4_294_967_295;
    let chargeX = targetX;
    let chargeStrength = 0;
    let accumulationStrength = 0;
    let explosionAge = 1;
    let explosionStrength = 0;

    if (phase === "travel") {
      const progress = clampNumber(phaseElapsed / travelDuration, 0, 1);
      const easedProgress = smootherStepNumber(progress);
      const seedPhase = seedNormalized * NUMBER_TAU * 7.3;
      const irregularity =
        (Math.sin(progress * NUMBER_TAU * 2.7 + seedPhase) * 0.024 +
          Math.sin(progress * NUMBER_TAU * 7.1 + seedPhase * 1.7) * 0.008) *
        Math.sin(Math.PI * progress);
      const travelProgress = clampNumber(easedProgress + irregularity, 0, 1);

      chargeX = startX + (targetX - startX) * travelProgress;
      chargeStrength =
        eventStrength *
        (0.58 + smoothstepNumber(progress) * 0.42) *
        (0.78 +
          Math.sin(timeSeconds * 12.4 + seedPhase + progress * 19) * 0.14 +
          audioFrame.flux * 0.12);
    } else if (phase === "accumulate") {
      const progress = clampNumber(phaseElapsed / accumulationDuration, 0, 1);

      chargeX = targetX;
      accumulationStrength = smootherStepNumber(progress);
      chargeStrength =
        eventStrength *
        (0.88 + accumulationStrength * 0.62) *
        (0.84 +
          Math.sin(timeSeconds * (10.5 + accumulationStrength * 8) + seedNormalized * 17) *
            (0.08 + accumulationStrength * 0.12));
    } else if (phase === "discharge") {
      explosionAge = clampNumber(phaseElapsed / dischargeDuration, 0, 1);
      explosionStrength = eventStrength * (1 - smoothstepNumber((explosionAge - 0.08) / 0.92));
      chargeStrength = eventStrength * (1 - smoothstepNumber(explosionAge / 0.24)) * 0.92;
      accumulationStrength = 1 - smoothstepNumber(explosionAge / 0.18);
    }

    currentFrame = {
      charge: [chargeX, targetX, Math.max(0, chargeStrength), accumulationStrength],
      discharge: [targetX, explosionAge, Math.max(0, explosionStrength), seedNormalized],
    };

    return currentFrame;
  };

  const renderParticles = () => {
    if (!motionEnabled) {
      return;
    }

    if (pendingBurst) {
      const originY = resolveSignalOriginY(targetX);
      spawnBurst(targetX, originY);
      pendingBurst = false;
    }

    let activeCount = 0;

    for (const particle of particles) {
      if (!particle.active) {
        continue;
      }

      const lifeProgress = clampNumber(particle.age / particle.lifetime, 0, 1);
      const edgeDistance = Math.min(particle.x, 1 - particle.x, particle.y, 1 - particle.y);
      const edgeFade = smoothstepNumber(edgeDistance / 0.14);
      const ageFade = 1 - smootherStepNumber((lifeProgress - 0.58) / 0.42);
      const entryFade = smoothstepNumber(particle.age / 0.06);
      const flicker =
        0.62 +
        0.38 * (0.5 + 0.5 * Math.sin(particle.age * particle.flickerRate + particle.flickerPhase));
      const alpha = particle.brightness * edgeFade * ageFade * entryFade;

      if (alpha <= 0.002) {
        continue;
      }

      const offset = activeCount * PARTICLE_STRIDE;
      particleBufferData[offset] = particle.x;
      particleBufferData[offset + 1] = particle.y;
      particleBufferData[offset + 2] = particle.velocityX;
      particleBufferData[offset + 3] = particle.velocityY;
      particleBufferData[offset + 4] = particle.size * (1 - lifeProgress * 0.34);
      particleBufferData[offset + 5] = particle.colourR;
      particleBufferData[offset + 6] = particle.colourG;
      particleBufferData[offset + 7] = particle.colourB;
      particleBufferData[offset + 8] = alpha;
      particleBufferData[offset + 9] = flicker;
      activeCount += 1;
    }

    if (activeCount === 0) {
      return;
    }

    context.enable(context.BLEND);
    context.blendEquation(context.FUNC_ADD);
    context.blendFunc(context.SRC_ALPHA, context.ONE);
    context.useProgram(program);
    context.bindVertexArray(vertexArray);
    context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
    context.bufferSubData(
      context.ARRAY_BUFFER,
      0,
      particleBufferData.subarray(0, activeCount * PARTICLE_STRIDE),
    );
    context.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    context.drawArrays(context.POINTS, 0, activeCount);
    context.bindBuffer(context.ARRAY_BUFFER, null);
    context.bindVertexArray(null);
    context.disable(context.BLEND);
  };

  const dispose = () => {
    clearParticles();
    context.deleteBuffer(vertexBuffer);
    context.deleteVertexArray(vertexArray);
    context.deleteProgram(program);
  };

  return { update, renderParticles, dispose };
}

type LivingSignalRenderer = {
  resize: (cssWidth: number, cssHeight: number) => void;
  render: (
    timeSeconds: number,
    audioFrame: SignalAudioFrame,
    motionAmount?: number,
    observerFrame?: HeroSignalObserverFrame,
  ) => void;
  locateSignalY: (
    normalizedX: number,
    normalizedY: number,
    maximumDistanceCssPixels: number,
  ) => number | null;
  dispose: () => void;
};

type UniformLocations = {
  resolution: WebGLUniformLocation;
  time: WebGLUniformLocation;
  motion: WebGLUniformLocation;
  audio: WebGLUniformLocation;
  dynamics: WebGLUniformLocation;
  audioTexture: WebGLUniformLocation;
  charge: WebGLUniformLocation;
  discharge: WebGLUniformLocation;
  observer: WebGLUniformLocation;
  observerVelocity: WebGLUniformLocation;
  verticalScale: WebGLUniformLocation;
  drag: WebGLUniformLocation;
  dragVelocity: WebGLUniformLocation;
};

function compileShader(context: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = context.createShader(type);

  if (!shader) {
    throw new Error("Unable to allocate a WebGL shader.");
  }

  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const log = context.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    context.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(
  context: WebGL2RenderingContext,
  vertexSource = VERTEX_SHADER_SOURCE,
  fragmentSource = FRAGMENT_SHADER_SOURCE,
): WebGLProgram {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
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
    const log = context.getProgramInfoLog(program) || "Unknown WebGL link error.";
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

export function createLivingSignalRenderer(canvas: HTMLCanvasElement): LivingSignalRenderer | null {
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
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
    context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);
    context.bindVertexArray(null);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, audioTexture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
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
      charge: getUniformLocation(context, program, "uCharge"),
      discharge: getUniformLocation(context, program, "uDischarge"),
      observer: getUniformLocation(context, program, "uObserver"),
      observerVelocity: getUniformLocation(context, program, "uObserverVelocity"),
      verticalScale: getUniformLocation(context, program, "uVerticalScale"),
      drag: getUniformLocation(context, program, "uDrag"),
      dragVelocity: getUniformLocation(context, program, "uDragVelocity"),
    };

    const electricalLifecycle = createElectricalLifecycle(context, canvas);
    let signalVerticalScale = 1;
    let hitTestData = new Uint8Array(0);

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
      const pixelBudgetRatio = Math.sqrt(MAX_RENDER_PIXELS / (safeWidth * safeHeight));
      const renderRatio = Math.max(1, Math.min(preferredRatio, pixelBudgetRatio));
      const width = Math.max(1, Math.floor(safeWidth * renderRatio));
      const height = Math.max(1, Math.floor(safeHeight * renderRatio));
      const rootFontSize =
        Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const referenceSignalHeight =
        window.innerWidth <= 768
          ? 13 * rootFontSize
          : clampNumber(window.innerHeight * 0.28, 13 * rootFontSize, 22 * rootFontSize);
      signalVerticalScale = clampNumber(referenceSignalHeight / safeHeight, 0.12, 1);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.viewport(0, 0, width, height);
    };

    const locateSignalY = (
      normalizedX: number,
      normalizedY: number,
      maximumDistanceCssPixels: number,
    ): number | null => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      const bounds = canvas.getBoundingClientRect();

      if (bounds.width <= 0 || bounds.height <= 0) {
        return null;
      }

      const requiredBytes = height * 4;

      if (hitTestData.length !== requiredBytes) {
        hitTestData = new Uint8Array(requiredBytes);
      }

      const pixelX = clampNumber(
        Math.floor(clampNumber(normalizedX, 0, 1) * Math.max(0, width - 1)),
        0,
        Math.max(0, width - 1),
      );
      const targetPixelY = clampNumber(
        Math.floor(clampNumber(normalizedY, 0, 1) * Math.max(0, height - 1)),
        0,
        Math.max(0, height - 1),
      );
      const renderRatioY = height / bounds.height;
      const searchRadius = Math.max(2, Math.ceil(maximumDistanceCssPixels * renderRatioY));
      const lowerBound = Math.max(0, targetPixelY - searchRadius);
      const upperBound = Math.min(height - 1, targetPixelY + searchRadius);

      context.readPixels(pixelX, 0, 1, height, context.RGBA, context.UNSIGNED_BYTE, hitTestData);

      let strongestScore = 0;
      let strongestY = -1;

      for (let y = lowerBound; y <= upperBound; y += 1) {
        const offset = y * 4;
        const red = hitTestData[offset] ?? 0;
        const green = hitTestData[offset + 1] ?? 0;
        const blue = hitTestData[offset + 2] ?? 0;
        const alpha = hitTestData[offset + 3] ?? 0;
        const luminance = red * 0.24 + green * 0.58 + blue * 0.18;
        const score = alpha * 2.6 + luminance + Math.max(red, green, blue) * 0.72;

        if (score > strongestScore) {
          strongestScore = score;
          strongestY = y;
        }
      }

      if (strongestY < 0 || strongestScore < 36) {
        return null;
      }

      const cssDistance = Math.abs(strongestY - targetPixelY) / renderRatioY;

      if (cssDistance > maximumDistanceCssPixels) {
        return null;
      }

      return (strongestY + 0.5) / height;
    };

    const render = (
      timeSeconds: number,
      audioFrame: SignalAudioFrame,
      motionAmount = 1,
      observerFrame = INACTIVE_OBSERVER_FRAME,
    ) => {
      const electricalFrame: ElectricalFrame = {
        charge: [0.02, 0.62, 0, 0],
        discharge: [0.62, 1, 0, 0],
      };

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
      context.uniform4f(
        uniforms.charge,
        electricalFrame.charge[0],
        electricalFrame.charge[1],
        electricalFrame.charge[2],
        electricalFrame.charge[3],
      );
      context.uniform4f(
        uniforms.discharge,
        electricalFrame.discharge[0],
        electricalFrame.discharge[1],
        electricalFrame.discharge[2],
        electricalFrame.discharge[3],
      );
      context.uniform4f(
        uniforms.observer,
        observerFrame.x,
        observerFrame.y,
        observerFrame.influence,
        observerFrame.speed,
      );
      context.uniform2f(
        uniforms.observerVelocity,
        observerFrame.velocityX,
        observerFrame.velocityY,
      );
      context.uniform1f(uniforms.verticalScale, signalVerticalScale);
      context.uniform4f(
        uniforms.drag,
        observerFrame.dragX,
        observerFrame.dragY,
        observerFrame.dragStrength,
        observerFrame.dragging,
      );
      context.uniform2f(
        uniforms.dragVelocity,
        observerFrame.dragVelocityX,
        observerFrame.dragVelocityY,
      );
      context.drawArrays(context.TRIANGLES, 0, 3);
      context.bindTexture(context.TEXTURE_2D, null);
      context.bindVertexArray(null);
    };

    const dispose = () => {
      electricalLifecycle.dispose();
      context.deleteTexture(audioTexture);
      context.deleteBuffer(vertexBuffer);
      context.deleteVertexArray(vertexArray);
      context.deleteProgram(program);
    };

    return { resize, render, locateSignalY, dispose };
  } catch (error) {
    canvas.dataset.rendererError = error instanceof Error ? error.message : String(error);
    return null;
  }
}
