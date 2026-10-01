"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type Map3DCameraSource = HTMLElement & {
  center?: unknown;
  heading?: number;
  tilt?: number;
  roll?: number;
  range?: number;
  fov?: number;
};

export type Geo3DOverlayPlacement = {
  longitude: number;
  latitude: number;
  altitudeM: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
  scale: number;
};

export type Geo3DOverlayBounds = {
  widthM: number;
  heightM: number;
  depthM: number;
};

export type Geo3DOverlayHandle = {
  bounds: Geo3DOverlayBounds;
  dispose: () => void;
};

function finite(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function coordinate(value: unknown, key: "lat" | "lng" | "altitude") {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate === "function") {
    try {
      const result = (candidate as () => unknown).call(value);
      return Number.isFinite(Number(result)) ? Number(result) : undefined;
    } catch {
      return undefined;
    }
  }
  return Number.isFinite(Number(candidate)) ? Number(candidate) : undefined;
}

function localMeters(
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
) {
  const northM = (latitude - centerLatitude) * 111_320;
  const cosLatitude = Math.max(
    0.2,
    Math.cos((centerLatitude * Math.PI) / 180),
  );
  const eastM = (longitude - centerLongitude) * 111_320 * cosLatitude;
  return { eastM, northM };
}

function applyModelOrientation(
  object: THREE.Object3D,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
) {
  const heading = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(-headingDeg),
  );
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(pitchDeg),
  );
  const roll = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(rollDeg),
  );

  // Google applies model rotations roll -> tilt -> heading. Quaternion
  // multiplication is therefore heading * tilt * roll.
  object.quaternion.copy(heading.multiply(tilt).multiply(roll));
}

function disposeMaterial(material: THREE.Material) {
  const record = material as unknown as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (
      value &&
      typeof value === "object" &&
      (value as { isTexture?: boolean }).isTexture &&
      typeof (value as THREE.Texture).dispose === "function"
    )
      (value as THREE.Texture).dispose();
  }
  material.dispose();
}

export async function createGeo3DThreeOverlay({
  host,
  map,
  modelBytes,
  getPlacement,
}: {
  host: HTMLElement;
  map: Map3DCameraSource;
  modelBytes: ArrayBuffer;
  getPlacement: () => Geo3DOverlayPlacement;
}): Promise<Geo3DOverlayHandle> {
  if (modelBytes.byteLength < 12)
    throw new Error("Rekixo overlay ko complete GLB bytes nahi mile");

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(modelBytes.slice(0), "");
  const root = gltf.scene || gltf.scenes[0];
  if (!root) throw new Error("Rekixo overlay GLB me renderable scene nahi hai");

  const sourceBounds = new THREE.Box3().setFromObject(root);
  if (sourceBounds.isEmpty())
    throw new Error("Rekixo overlay GLB bounds empty hain");
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const bounds = {
    widthM: sourceSize.x,
    heightM: sourceSize.y,
    depthM: sourceSize.z,
  };

  const scene = new THREE.Scene();
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7d8d, 2.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(-80, 120, 70);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xcbdcff, 1.25);
  fillLight.position.set(100, 55, -90);
  scene.add(fillLight);

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
  });

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20_000);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.dataset.rekixoGeoRenderer = "three-overlay";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  host.replaceChildren(renderer.domElement);

  let width = 0;
  let height = 0;
  let disposed = false;
  let animationFrame = 0;
  let previousFrameAt = 0;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const render = () => {
    if (disposed) return;
    resize();

    const placement = getPlacement();
    const center = map.center;
    const centerLatitude =
      coordinate(center, "lat") ?? placement.latitude;
    const centerLongitude =
      coordinate(center, "lng") ?? placement.longitude;
    const local = localMeters(
      placement.latitude,
      placement.longitude,
      centerLatitude,
      centerLongitude,
    );

    root.position.set(local.eastM, placement.altitudeM, -local.northM);
    root.scale.setScalar(Math.max(0.001, finite(placement.scale, 1)));
    applyModelOrientation(
      root,
      finite(placement.headingDeg, 0),
      finite(placement.pitchDeg, 0),
      finite(placement.rollDeg, 0),
    );

    const heading = THREE.MathUtils.degToRad(
      finite(map.heading, placement.headingDeg),
    );
    const tilt = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(finite(map.tilt, 68), 1, 89.5),
    );
    const range = THREE.MathUtils.clamp(finite(map.range, 190), 10, 20_000);
    const targetY = placement.altitudeM + 10;
    const horizontal = range * Math.sin(tilt);
    const vertical = Math.max(1, range * Math.cos(tilt));

    camera.fov = THREE.MathUtils.clamp(finite(map.fov, 35), 5, 80);
    camera.near = Math.max(0.05, range / 10_000);
    camera.far = Math.max(5_000, range * 20);
    camera.position.set(
      -Math.sin(heading) * horizontal,
      targetY + vertical,
      Math.cos(heading) * horizontal,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, targetY, 0);
    const cameraRoll = finite(map.roll, 0);
    if (cameraRoll)
      camera.rotateZ(THREE.MathUtils.degToRad(-cameraRoll));
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  };

  const frame = (now: number) => {
    if (disposed) return;
    // 30fps is enough for placement interaction and keeps an integrated GPU
    // from rendering a second 3D scene at 60fps beside Google's terrain.
    if (document.visibilityState === "visible" && now - previousFrameAt >= 32) {
      previousFrameAt = now;
      render();
    }
    animationFrame = window.requestAnimationFrame(frame);
  };

  const resizeObserver =
    typeof ResizeObserver === "function" ? new ResizeObserver(render) : null;
  resizeObserver?.observe(host);
  render();
  animationFrame = window.requestAnimationFrame(frame);

  return {
    bounds,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material))
          mesh.material.forEach(disposeMaterial);
        else if (mesh.material) disposeMaterial(mesh.material);
      });
      renderer.dispose();
      renderer.forceContextLoss();
      host.replaceChildren();
    },
  };
}
