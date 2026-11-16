import {
  Color4,
  ParticleSystem,
  PBRMaterial,
  Vector3,
  type DirectionalLight,
  type HemisphericLight,
  type Scene,
} from "./engine";
import { hex, texture } from "./art";
import type { Weather } from "./weatherOptions";

const presets = {
  day: {
    sun: "#ffe0ad",
    power: 2,
    direction: [0.65, -1, 0.5],
    sky: "#a1babe",
    fog: "#b5c3bb",
    haze: 0.011,
    fill: 0.32,
    reflection: 0.65,
    exposure: 1.03,
  },
  evening: {
    sun: "#ffb776",
    power: 2.2,
    direction: [-0.8, -0.38, 0.5],
    sky: "#916b63",
    fog: "#9f8582",
    haze: 0.014,
    fill: 0.42,
    reflection: 0.55,
    exposure: 1.2,
  },
  night: {
    sun: "#88a6ff",
    power: 0.4,
    direction: [-0.4, -1, 0.8],
    sky: "#111b34",
    fog: "#273657",
    haze: 0.018,
    fill: 0.35,
    reflection: 0.26,
    exposure: 1.04,
  },
  rain: {
    sun: "#c3d9e3",
    power: 0.78,
    direction: [0.2, -1, 0.3],
    sky: "#606e76",
    fog: "#77838b",
    haze: 0.026,
    fill: 0.56,
    reflection: 0.62,
    exposure: 1.08,
  },
} as const;

export function applyWeather(
  scene: Scene,
  sun: DirectionalLight,
  hemi: HemisphericLight,
  weather: Weather,
) {
  const preset = presets[weather];
  sun.diffuse = hex(preset.sun);
  sun.intensity = preset.power;
  sun.direction = new Vector3(...preset.direction).normalize();
  hemi.intensity = preset.fill;
  scene.fogColor = hex(preset.fog);
  scene.fogDensity = preset.haze;
  const sky = hex(preset.sky);
  scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
  scene
    .getMeshByName("Dhaka daylight atmosphere")
    ?.setEnabled(weather === "day");
  scene.environmentIntensity = preset.reflection;
  scene.imageProcessingConfiguration.exposure = preset.exposure;
  for (const material of scene.materials) {
    if (!(material instanceof PBRMaterial)) continue;
    if (material.name === "Street lamp lens") {
      material.emissiveColor = hex(
        weather === "night"
          ? "#ffcc78"
          : weather === "rain" || weather === "evening"
            ? "#695133"
            : "#000000",
      );
    }
    if (
      ["Photographic Dhaka asphalt", "Outer Dhaka worn asphalt"].includes(
        material.name,
      )
    ) {
      material.clearCoat.isEnabled = weather === "rain";
      material.clearCoat.intensity = 0.65;
      material.clearCoat.roughness = 0.32;
      material.albedoColor = hex(weather === "rain" ? "#a2aeb4" : "#ffffff");
    }
  }
}

export function makeRain(scene: Scene, origin: Vector3) {
  const rain = new ParticleSystem("Wind-driven rain", 440, scene);
  rain.particleTexture = texture(scene, "Rain streak", 16, 64, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "rgba(219,238,255,0)");
    gradient.addColorStop(0.76, "rgba(219,238,255,0.78)");
    gradient.addColorStop(1, "rgba(219,238,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(7, 0, 3, 64);
  });
  rain.emitter = origin;
  rain.minEmitBox.set(-8.5, 4.5, -8.5);
  rain.maxEmitBox.set(8.5, 6.6, 8.5);
  rain.direction1.set(-0.85, -12, -0.2);
  rain.direction2.set(-1.25, -14, 0.05);
  rain.minEmitPower = rain.maxEmitPower = 1;
  rain.minLifeTime = 0.38;
  rain.maxLifeTime = 0.52;
  rain.minSize = 0.23;
  rain.maxSize = 0.49;
  rain.minScaleX = rain.maxScaleX = 0.54;
  rain.minScaleY = 1.2;
  rain.maxScaleY = 1.95;
  rain.minInitialRotation = rain.maxInitialRotation = -0.095;
  rain.color1 = new Color4(0.82, 0.89, 1, 0.68);
  rain.color2 = new Color4(0.91, 0.94, 1, 0.88);
  rain.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  return rain;
}
