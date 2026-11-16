import { Color3, DynamicTexture, PBRMaterial, Scene, Texture } from "./engine";
export function surfaceMaterial(
  scene: Scene,
  name: string,
  surface: "asphalt" | "plaster" | "cng-enamel" | "rickshaw-art",
  repeatU = 1,
  repeatV = 1,
  tint = "#ffffff",
) {
  const m = material(scene, name, tint, 1, 1);
  const map = (suffix: string, gamma: boolean) => {
    const t = new Texture(
      `/assets/textures/${surface}-${suffix}.webp`,
      scene,
      false,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    t.uScale = repeatU;
    t.vScale = repeatV;
    t.gammaSpace = gamma;
    t.anisotropicFilteringLevel = 8;
    return t;
  };
  m.albedoTexture = map("color", true);
  m.bumpTexture = map("normal", false);
  m.bumpTexture.level = surface === "asphalt" ? 0.25 : 0.32;
  m.metallicTexture = map("orm", false);
  m.useRoughnessFromMetallicTextureGreen = true;
  m.useRoughnessFromMetallicTextureAlpha = false;
  m.useMetallnessFromMetallicTextureBlue = true;
  m.useAmbientOcclusionFromMetallicTextureRed = true;
  return m;
}
export let seed = 191;
export function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export function hex(s: string) {
  return Color3.FromHexString(s);
}
export function texture(
  scene: Scene,
  name: string,
  w: number,
  h: number,
  paint: (c: CanvasRenderingContext2D) => void,
) {
  const t = new DynamicTexture(
    name,
    { width: w, height: h },
    scene,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  paint(c);
  t.update();
  t.anisotropicFilteringLevel = 4;
  return t;
}
export function material(
  scene: Scene,
  name: string,
  color: string,
  rough = 0.85,
  metal = 0,
) {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = hex(color);
  m.roughness = rough;
  m.metallic = metal;
  return m;
}
export function weathered(
  scene: Scene,
  name: string,
  base: string,
  kind: "wall" | "road" | "wood" = "wall",
) {
  const m = material(scene, name, "#ffffff", kind === "road" ? 0.91 : 0.93);
  const diffuse = texture(scene, name, 512, 512, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 17000; i++) {
      const a = random();
      c.fillStyle = `rgba(${a > 0.5 ? "255,240,204" : "30,28,22"},${random() * 0.09})`;
      const x = random() * 512,
        y = random() * 512;
      c.fillRect(
        x,
        y,
        random() * 4 + 1,
        random() * (kind === "wood" ? 30 : 4) + 1,
      );
    }
    if (kind === "wall") {
      for (let i = 0; i < 95; i++) {
        const x = random() * 512,
          y = random() * 512;
        c.fillStyle = `rgba(41,45,31,${random() * 0.09})`;
        c.fillRect(x, y, random() * 30 + 1, random() * 210);
      }
      for (let y = 60; y < 512; y += 96) {
        c.fillStyle = "#382f2222";
        c.fillRect(0, y, 512, 2);
      }
    }
    if (kind === "road") {
      for (let i = 0; i < 35; i++) {
        c.strokeStyle = "#191e20";
        c.lineWidth = random() * 2 + 0.4;
        c.beginPath();
        let x = random() * 512,
          y = random() * 512;
        c.moveTo(x, y);
        for (let j = 0; j < 7; j++) {
          x += (random() - 0.5) * 60;
          y += random() * 29;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      for (let i = 0; i < 15; i++) {
        c.fillStyle = "#252b2c55";
        c.beginPath();
        c.ellipse(
          random() * 512,
          random() * 512,
          random() * 35 + 10,
          random() * 20 + 8,
          random(),
          0,
          7,
        );
        c.fill();
      }
    }
  });
  if (kind === "road") {
    diffuse.uScale = 14;
    diffuse.vScale = 20;
  }
  m.albedoTexture = diffuse;
  const normal = texture(
    scene,
    `${name} surface grain normal`,
    256,
    256,
    (c) => {
      c.fillStyle = "#8080ff";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 12000; i++) {
        const x = random() * 256,
          y = random() * 256;
        c.fillStyle = `rgb(${115 + random() * 25},${115 + random() * 25},252)`;
        c.fillRect(x, y, 1, kind === "wood" ? 6 : 1);
      }
    },
  );
  normal.uScale = kind === "road" ? 14 : 2;
  normal.vScale = kind === "road" ? 20 : 2;
  normal.level = 0.3;
  m.bumpTexture = normal;
  return m;
}
export function signTexture(
  scene: Scene,
  text: string,
  sub: string,
  bg = "#164b42",
  fg = "#ffe6a5",
  w = 1024,
  h = 256,
) {
  return texture(scene, `sign-${text}`, w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = fg;
    c.lineWidth = 3;
    c.strokeRect(12, 12, w - 24, h - 24);
    c.strokeRect(20, 20, w - 40, h - 40);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = fg;
    c.font = `800 ${text.length > 22 ? 48 : 70}px 'Noto Sans Bengali'`;
    c.fillText(text, w / 2, h * 0.4, w - 55);
    c.font = "400 26px 'Noto Sans Bengali'";
    c.fillText(sub, w / 2, h * 0.76, w - 40);
    for (let i = 0; i < 250; i++) {
      c.fillStyle = "#e6d6ab11";
      c.fillRect(random() * w, random() * h, random() * 70, random() * 2);
    }
  });
}
export function rickshawArt(scene: Scene) {
  return texture(
    scene,
    "Original Bangladeshi floral rickshaw panel",
    512,
    512,
    (c) => {
      c.fillStyle = "#102f69";
      c.fillRect(0, 0, 512, 512);
      c.lineWidth = 14;
      c.strokeStyle = "#ffe36b";
      c.strokeRect(16, 16, 480, 480);
      c.strokeStyle = "#ed4a4d";
      c.lineWidth = 6;
      c.strokeRect(32, 32, 448, 448);
      for (const [x, y] of [
        [120, 140],
        [392, 140],
        [140, 360],
        [372, 360],
      ]) {
        c.strokeStyle = "#72c952";
        c.lineWidth = 10;
        c.beginPath();
        c.moveTo(256, 440);
        c.quadraticCurveTo(x, 300, x, y);
        c.stroke();
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * 7;
          c.fillStyle = p % 2 ? "#f1a829" : "#ff557d";
          c.beginPath();
          c.ellipse(
            x + Math.cos(a) * 27,
            y + Math.sin(a) * 27,
            14,
            26,
            a,
            0,
            7,
          );
          c.fill();
        }
        c.fillStyle = "#ffed93";
        c.beginPath();
        c.arc(x, y, 13, 0, 7);
        c.fill();
      }
      c.fillStyle = "#f7da54";
      c.beginPath();
      c.arc(256, 205, 66, 0, 7);
      c.fill();
      c.fillStyle = "#13b4b0";
      c.beginPath();
      c.ellipse(256, 247, 98, 51, 0, 0, 7);
      c.fill();
      c.fillStyle = "#f36b34";
      c.beginPath();
      c.moveTo(222, 224);
      c.lineTo(290, 170);
      c.lineTo(322, 232);
      c.closePath();
      c.fill();
      c.fillStyle = "#fff4c0";
      c.textAlign = "center";
      c.font = "700 37px 'Noto Sans Bengali'";
      c.fillText("ঢাকার রং", 256, 452);
    },
  );
}
