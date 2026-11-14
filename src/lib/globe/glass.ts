import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Liquid glass, rendered for real.
 *
 * Panels marked `data-glass` in the page are ordinary DOM elements with
 * nothing painted behind their text. This pass paints the glass for them,
 * inside the globe's own WebGL frame: for every pixel under a panel it
 * re-samples the scene through a lens.
 *
 *  - The panel is treated as a slab with a rounded, convex bezel. Across the
 *    bezel the surface tilts, so the lookup into the scene is bent inwards,
 *    hardest right at the rim and not at all in the flat middle. That is
 *    what makes the map visibly bend as it slides under an edge.
 *  - Red and blue are bent by slightly different amounts (dispersion), which
 *    leaves the faint colour fringe real glass has. Only in the bezel.
 *  - The flat middle is lightly frosted and tinted so text stays readable.
 *  - A thin specular line runs along the rim, brightest where the rim faces
 *    the light and, like a real bevel, again on the opposite corner.
 *
 * Because it is done in the scene's own frame rather than with
 * `backdrop-filter`, it refracts instead of merely blurring, and it works
 * the same in Safari, Firefox and Chrome.
 */

/** How many panels can be glass at once. */
const MAX_PANES = 6;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  #define MAX_PANES ${MAX_PANES}

  // All distances are CSS pixels
  const float BEZEL = 18.0;       // width of the curved rim
  const float REFRACTION = 22.0;  // how far the rim bends the view
  const float FROST = 11.0;       // blur radius of the glass body
  const float SHADOW = 28.0;      // reach of the shadow the panel casts

  uniform sampler2D tDiffuse;
  uniform vec2 uSize;             // canvas size in CSS pixels
  uniform int uCount;
  uniform vec4 uPanes[MAX_PANES]; // left, top, width, height
  uniform vec2 uShape[MAX_PANES]; // corner radius, presence (0 to 1)
  varying vec2 vUv;

  float roundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  // The scene at a point given in CSS pixels from the top-left corner
  vec3 scene(vec2 point) {
    vec2 uv = vec2(point.x, uSize.y - point.y) / uSize;
    return texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
  }

  void main() {
    vec2 point = vec2(vUv.x, 1.0 - vUv.y) * uSize;
    vec3 color = texture2D(tDiffuse, vUv).rgb;

    for (int i = 0; i < MAX_PANES; i++) {
      if (i >= uCount) break;

      vec2 halfSize = uPanes[i].zw * 0.5;
      vec2 p = point - (uPanes[i].xy + halfSize);
      float radius = min(uShape[i].x, min(halfSize.x, halfSize.y));
      float presence = uShape[i].y;
      float distance = roundedBox(p, halfSize, radius);

      if (distance > SHADOW || presence <= 0.0) continue;

      if (distance > 0.0) {
        // Outside the panel: the soft shadow it drops on the scene
        float falloff = 1.0 - distance / SHADOW;
        color *= 1.0 - 0.3 * presence * falloff * falloff;
        continue;
      }

      // Outward direction of the nearest edge
      vec2 e = vec2(1.0, 0.0);
      vec2 normal = normalize(vec2(
        roundedBox(p + e.xy, halfSize, radius) - roundedBox(p - e.xy, halfSize, radius),
        roundedBox(p + e.yx, halfSize, radius) - roundedBox(p - e.yx, halfSize, radius)
      ) + 1e-5);

      float depth = -distance;                    // pixels in from the rim
      float t = clamp(depth / BEZEL, 0.0, 1.0);   // 0 at the rim, 1 where it is flat
      // Slope of a convex, squircle-profiled bezel: steep at the rim,
      // easing to nothing where the slab goes flat
      float u = 1.0 - t;
      float slope = (u * u * u) / pow(1.0 - u * u * u * u + 0.02, 0.75);
      vec2 bend = -normal * min(slope, 3.0) * REFRACTION;

      // Frosted body: a small disc of samples around the refracted point
      vec3 glass = vec3(0.0);
      // The disc is turned by a different amount at every pixel, which
      // trades the repeating pattern a fixed disc leaves on small bright
      // things for a fine grain, as frosted glass has
      float turn = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      for (int k = 0; k < 12; k++) {
        float angle = turn + float(k) * 2.399963; // golden angle
        float reach = FROST * sqrt((float(k) + 0.5) / 12.0);
        glass += scene(point + bend + vec2(cos(angle), sin(angle)) * reach);
      }
      glass /= 12.0;

      // Dispersion: red bends a little less than green, blue a little more
      float fringe = u * u;
      glass.r = mix(glass.r, scene(point + bend * 0.86).r, fringe);
      glass.b = mix(glass.b, scene(point + bend * 1.16).b, fringe);

      // Body: a dark tint so light text reads on top. Like the real
      // material, it adapts: the brighter what lies behind, the deeper the
      // tint, while the bezel stays clearer so the lensing shows.
      float luma = dot(glass, vec3(0.2126, 0.7152, 0.0722));
      glass = mix(vec3(luma), glass, 1.2);
      float tint = mix(0.42, 0.86, smoothstep(0.02, 0.28, luma)) * mix(0.72, 1.0, t);
      glass = mix(glass, vec3(0.004, 0.010, 0.012), tint);
      glass += 0.010;

      // Specular rim: lit from the upper left, with the answering glint on
      // the lower right that a real bevel shows
      float facing = dot(normal, normalize(vec2(-0.55, -0.83)));
      float rim = 1.0 - smoothstep(0.0, 1.6, depth);
      glass += rim * (0.05 + 0.5 * pow(abs(facing), 1.6));
      // A wider, fainter wash of light across the lit side of the bezel
      glass += u * u * max(facing, 0.0) * 0.06;

      float edge = smoothstep(0.0, 1.0, depth);   // anti-aliased outline
      color = mix(color, glass, edge * presence);
    }

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export type GlassPane = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  /** 0 to 1: how much of the panel is there (it may be fading in or out). */
  presence: number;
};

export type GlassPass = {
  pass: ShaderPass;
  /** Tell the pass where the glass panels are this frame. */
  update: (panes: GlassPane[], width: number, height: number) => void;
};

export function createGlassPass(): GlassPass {
  const pass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uSize: { value: new THREE.Vector2(1, 1) },
        uCount: { value: 0 },
        uPanes: {
          value: Array.from({ length: MAX_PANES }, () => new THREE.Vector4())
        },
        uShape: {
          value: Array.from({ length: MAX_PANES }, () => new THREE.Vector2())
        }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER
    })
  );

  const { uniforms } = pass.material;
  return {
    pass,
    update(panes, width, height) {
      uniforms.uSize.value.set(width, height);
      const count = Math.min(panes.length, MAX_PANES);
      uniforms.uCount.value = count;
      for (let i = 0; i < count; i++) {
        const pane = panes[i];
        uniforms.uPanes.value[i].set(
          pane.left,
          pane.top,
          pane.width,
          pane.height
        );
        uniforms.uShape.value[i].set(pane.radius, pane.presence);
      }
    }
  };
}

/**
 * Find the glass panels currently on screen: every visible `[data-glass]`
 * element under `root`, with its box, corner radius and how opaque it and
 * its ancestors are.
 */
export function measureGlassPanes(root: HTMLElement): GlassPane[] {
  const panes: GlassPane[] = [];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  for (const element of root.querySelectorAll<HTMLElement>('[data-glass]')) {
    if (panes.length === MAX_PANES) break;
    const box = element.getBoundingClientRect();
    if (
      box.width === 0 ||
      box.right <= 0 ||
      box.left >= viewportWidth ||
      box.bottom <= 0 ||
      box.top >= viewportHeight
    ) {
      continue;
    }

    const style = getComputedStyle(element);
    let presence = parseFloat(style.opacity);
    for (
      let node = element.parentElement;
      node && node !== root && presence > 0;
      node = node.parentElement
    ) {
      presence *= parseFloat(getComputedStyle(node).opacity);
    }
    if (presence <= 0.003) continue;

    panes.push({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      radius: parseFloat(style.borderTopLeftRadius) || 0,
      presence
    });
  }
  return panes;
}
