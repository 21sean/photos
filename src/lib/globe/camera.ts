import * as THREE from 'three';

/**
 * Camera altitude (in globe radii above the surface) at which the globe's
 * silhouette is `diameter` pixels wide on a canvas `canvasHeight` pixels
 * tall.
 */
export function altitudeForDiameter(
  diameter: number,
  canvasHeight: number,
  fovDegrees: number
): number {
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fovDegrees / 2));
  // Half-angle of the cone that just wraps the sphere, seen from the camera
  const theta = Math.atan((diameter / canvasHeight) * tanHalfFov);
  return 1 / Math.sin(theta) - 1;
}

/**
 * Shift where the globe sits on screen without moving the camera: the
 * projection is skewed so the scene's centre lands `dx`/`dy` pixels away
 * from the middle of the canvas (right and down are positive).
 */
export function setScreenOffset(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  dx: number,
  dy: number
): void {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(width, height, -dx, -dy, width, height);
  }
}
