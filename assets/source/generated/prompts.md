# Generated game texture provenance

Mode: **built-in imagegen**, not CLI/API fallback.

Output: `assets/source/generated/dhaka-surface-atlas-v2.png`.

Visual reference inputs: the user-supplied `images (3).jpg`, `Bangladeshi_style_Rickshaw.jpg`, `images.jpg`. These are reference inputs, not edit targets. The atlas is an original game material asset, without people, political identities, text or real vehicle branding.

## Prompt sent

Use case: photorealistic-natural. Asset type: one game-ready PBR base-color texture atlas for a Bengali 3D Dhaka street game. The supplied images are visual reference only, not edit targets. Produce a square 2048 by 2048 image as a precise 2 by 2 grid of four square material swatches, edge-to-edge, no margins, separators, text, logos, lettering, people, faces, politicians, vehicles, objects, watermarks, scene perspective or baked shadows. Each quadrant is a flat orthographic close-up of a surface with uniform neutral diffuse lighting and real photographic microtexture, not an illustration. Top left: charcoal coarse Dhaka asphalt with small aggregate, irregular fine cracks and subtle patchwork, realistic restrained contrast. Top right: warm grey/beige aged concrete plaster with damp vertical staining, worn lime patches and fine pitting, inspired by Dhaka street building walls. Bottom left: authentic green CNG painted metal, subtle enamel grain, small natural scratches, chipped edges texture but not any recognisable vehicle parts. Bottom right: dense hand-painted Bangladeshi rickshaw tin-panel artwork inspired by the ornate rickshaw reference: small colourful floral rosettes, curling leaves, red turquoise cobalt yellow, a repeated fine ornamental pattern with metallic paint wear. Texture only. No real political imagery or lettering. Each quadrant should tile convincingly within itself. This atlas will be mapped to real 3D geometry, do not render a game scene.

## Game conversion

`assets/source/build-surface-maps.mjs` produces four local material sets in `public/assets/textures`: 1024² WebP albedo plus 512² computed normal and ORM maps. The normal/roughness estimates are derived from image luminance; they are not a measured scan. Their combined runtime download is approximately 3.1 MB.
