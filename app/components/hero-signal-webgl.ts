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

const float TAU = 6.28318530718;

struct SignalField {
  float wave;
  float energy;
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

float gaussian(float position, float centre, float width) {
  float distanceFromCentre = (position - centre) / width;
  return exp(-distanceFromCentre * distanceFromCentre);
}

SignalField createSignalField(float x, float timeSeconds) {
  float rms = uAudio.x;
  float low = uAudio.y;
  float mid = uAudio.z;
  float high = uAudio.w;

  float noisePhase = (valueNoise(vec2(x * 5.4, timeSeconds * 0.16)) - 0.5) * 1.35;
  float structural = sin(TAU * (x * 0.72 + timeSeconds * 0.052) + noisePhase);
  float body = sin(
    TAU * (x * (2.55 + low * 0.28) - timeSeconds * 0.135) +
    sin(TAU * (x * 0.68 + timeSeconds * 0.041)) * 0.72 +
    noisePhase * 0.52
  );
  float harmonic = sin(
    TAU * (x * (7.4 + mid * 1.3) + timeSeconds * 0.34) +
    structural * 0.58
  );
  float detail = sin(
    TAU * (x * (18.5 + high * 5.0) - timeSeconds * 0.76) +
    body * 0.48 +
    noisePhase * 0.7
  );

  float localBreathing = 0.5 + 0.5 * sin(
    TAU * (x * 1.28 - timeSeconds * 0.046) +
    sin(TAU * (x * 0.39 + timeSeconds * 0.021)) * 0.85
  );

  float packetCentreA = 0.5 + 0.34 * sin(timeSeconds * 0.087);
  float packetCentreB = 0.5 + 0.43 * sin(timeSeconds * 0.053 + 2.2);
  float packetA = gaussian(x, packetCentreA, 0.075 + mid * 0.025);
  float packetB = gaussian(x, packetCentreB, 0.13 + low * 0.035);
  float interference = 0.5 + 0.5 * sin(
    TAU * (x * 3.2 + timeSeconds * 0.11) +
    sin(TAU * (x * 1.1 - timeSeconds * 0.036))
  );

  float energy = clamp(
    0.18 +
    localBreathing * 0.22 +
    packetA * (0.2 + rms * 0.23) +
    packetB * (0.12 + low * 0.15) +
    interference * mid * 0.14 +
    high * 0.08,
    0.0,
    1.0
  );

  float composite =
    structural * 0.34 +
    body * 0.37 +
    harmonic * (0.19 + mid * 0.04) +
    detail * (0.07 + high * 0.05);

  float packetOscillation =
    packetA * sin(TAU * (x * 11.2 - timeSeconds * 0.27) + body * 0.8) * 0.032 +
    packetB * sin(TAU * (x * 4.8 + timeSeconds * 0.16) + structural) * 0.024;

  float amplitude = 0.032 + energy * (0.075 + rms * 0.035);
  float wave = composite * amplitude + packetOscillation;

  return SignalField(wave, energy);
}

float strokeMask(float distanceToLine, float halfWidth) {
  float antialiasWidth = max(fwidth(distanceToLine) * 1.35, 0.75 / uResolution.y);
  return 1.0 - smoothstep(
    halfWidth,
    halfWidth + antialiasWidth,
    distanceToLine
  );
}

void main() {
  float timeSeconds = mix(7.25, uTime, uMotion);
  float x = clamp(vUv.x, 0.0, 1.0);
  SignalField field = createSignalField(x, timeSeconds);
  SignalField neighbour = createSignalField(
    clamp(x + 0.0024, 0.0, 1.0),
    timeSeconds + 0.018
  );

  float localSlope = neighbour.wave - field.wave;
  float spectralSplit = 0.0012 + field.energy * 0.0033 + abs(localSlope) * 0.15;
  float corePosition = 0.5 + field.wave;
  float cyanPosition = corePosition + localSlope * 0.72 - spectralSplit;
  float pinkPosition = corePosition - localSlope * 0.54 + spectralSplit;

  float coreDistance = abs(vUv.y - corePosition);
  float cyanDistance = abs(vUv.y - cyanPosition);
  float pinkDistance = abs(vUv.y - pinkPosition);

  float coreWidth = max(0.00075, 0.72 / uResolution.y);
  float spectralWidth = max(0.00062, 0.58 / uResolution.y);

  float core = strokeMask(coreDistance, coreWidth);
  float cyan = strokeMask(cyanDistance, spectralWidth);
  float pink = strokeMask(pinkDistance, spectralWidth);

  float coreGlow = exp(-coreDistance * uResolution.y / 8.5);
  float cyanGlow = exp(-cyanDistance * uResolution.y / 12.0);
  float pinkGlow = exp(-pinkDistance * uResolution.y / 12.5);

  float edgeFade = smoothstep(0.0, 0.075, x) * (1.0 - smoothstep(0.925, 1.0, x));
  float centreWeight = 1.0 - abs(x * 2.0 - 1.0);
  float coreStrength = mix(0.78, 1.0, pow(centreWeight, 0.7));

  vec3 white = vec3(1.0, 0.985, 0.955);
  vec3 cyanColour = vec3(0.36, 0.87, 1.0);
  vec3 pinkColour = vec3(1.0, 0.19, 0.66);
  vec3 violetColour = vec3(0.66, 0.5, 1.0);

  vec3 colour = white * core * coreStrength * 2.2;
  colour += cyanColour * cyan * (0.44 + field.energy * 0.24);
  colour += pinkColour * pink * (0.42 + field.energy * 0.28);
  colour += white * coreGlow * (0.055 + field.energy * 0.035);
  colour += cyanColour * cyanGlow * (0.025 + uAudio.z * 0.04);
  colour += pinkColour * pinkGlow * (0.027 + uAudio.w * 0.045);
  colour += violetColour * min(cyanGlow, pinkGlow) * field.energy * 0.035;

  float alpha = max(
    core,
    max(cyan * 0.58, pink * 0.56)
  );
  alpha = max(
    alpha,
    coreGlow * 0.2 + cyanGlow * 0.08 + pinkGlow * 0.09
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
    const log = context.getShaderInfoLog(shader) || "Unknown shader compilation error.";
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

    if (!vertexArray || !vertexBuffer) {
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
      context.deleteBuffer(vertexBuffer);
      context.deleteVertexArray(vertexArray);
      context.deleteProgram(program);
      return null;
    }

    context.enableVertexAttribArray(positionLocation);
    context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);
    context.bindVertexArray(null);
    context.bindBuffer(context.ARRAY_BUFFER, null);

    const uniforms: UniformLocations = {
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      motion: getUniformLocation(context, program, "uMotion"),
      audio: getUniformLocation(context, program, "uAudio"),
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
      context.uniform2f(
        uniforms.resolution,
        canvas.width,
        canvas.height,
      );
      context.uniform1f(uniforms.time, timeSeconds);
      context.uniform1f(uniforms.motion, motionAmount);
      context.uniform4f(
        uniforms.audio,
        audioFrame.rms,
        audioFrame.low,
        audioFrame.mid,
        audioFrame.high,
      );
      context.drawArrays(context.TRIANGLES, 0, 3);
      context.bindVertexArray(null);
    };

    const dispose = () => {
      context.deleteBuffer(vertexBuffer);
      context.deleteVertexArray(vertexArray);
      context.deleteProgram(program);
    };

    return { resize, render, dispose };
  } catch {
    return null;
  }
}
