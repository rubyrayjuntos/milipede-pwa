import * as THREE from "three";

/**
 * Fresnel-based rim glow: intensity rises as the view/normal dot product
 * approaches zero (grazing angles, i.e. silhouette edges), sharpened with a
 * high exponent so wireframe details stay crisp before UnrealBloomPass ever
 * touches the frame.
 */
export function createGlowMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCameraPos: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = instanceMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uCameraPos;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 viewDir = normalize(uCameraPos - vWorldPos);
        float cosTheta = dot(viewDir, normalize(vWorldNormal));
        float intensity = pow(clamp(1.0 - abs(cosTheta), 0.0, 1.0), 6.0);
        vec3 glow = uColor * (0.4 + intensity * 1.6);
        gl_FragColor = vec4(glow, intensity * 0.9 + 0.04);
      }
    `,
  });
}

export function createWireMaterial(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, wireframe: true, toneMapped: false });
}
