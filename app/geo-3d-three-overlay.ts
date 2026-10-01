"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type Map3DCameraSource = HTMLElement & {
  center?: unknown;
  cameraPosition?: unknown;
  heading?: number;
  tilt?: number;
  roll?: number;
  range?: number;
  fov?: number;
  stopCameraAnimation?: () => void;
  flyCameraTo?: (options: {
    endCamera: {
      center: { lat: number; lng: number; altitude: number };
      altitudeMode: "RELATIVE_TO_GROUND";
      range: number;
      tilt: number;
      heading: number;
    };
    durationMillis: number;
  }) => void | Promise<void>;
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
  rotateViewBy: (deltaHeadingDeg: number) => void;
  focusView: (headingDeg: number, tiltDeg?: number, rangeM?: number) => void;
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

  // Preserve the GLB's authored PBR material colors. Architectural models are
  // often textureless and encode their visual identity in baseColorFactor, so
  // over-bright lights + cinematic tone mapping can wash those colors out.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x596575, 0.95));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(-80, 120, 70);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xcbdcff, 0.4);
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
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.dataset.rekixoGeoRenderer = "three-overlay";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  renderer.domElement.style.cursor = "grab";
  renderer.domElement.style.userSelect = "none";
  host.replaceChildren(renderer.domElement);

  let width = 0;
  let height = 0;
  let disposed = false;
  let animationFrame = 0;
  let previousFrameAt = 0;

  type PointerSample = { x: number; y: number };
  const activePointers = new Map<number, PointerSample>();
  let primaryPointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let pinchDistance = 0;
  let orbitHeading: number | null = null;
  let orbitTilt: number | null = null;
  let orbitRange: number | null = null;
  let mapCameraFrame = 0;
  let smoothInteractionUntil = 0;

  const modelSpanM = Math.max(
    bounds.widthM,
    bounds.heightM,
    bounds.depthM,
  );
  const minOrbitRangeM = Math.max(34, modelSpanM * 1.25);
  const maxOrbitRangeM = 1_200;
  const overlayFovDeg = THREE.MathUtils.clamp(finite(map.fov, 35), 20, 55);

  const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;
  const clampTilt = (value: number) => THREE.MathUtils.clamp(value, 28, 82);
  const clampRange = (value: number) =>
    THREE.MathUtils.clamp(value, minOrbitRangeM, maxOrbitRangeM);

  const markSmoothInteraction = () => {
    smoothInteractionUntil = performance.now() + 220;
  };

  const syncOrbitFromMap = () => {
    orbitHeading = normalizeHeading(finite(map.heading, getPlacement().headingDeg));
    orbitTilt = clampTilt(finite(map.tilt, 68));
    orbitRange = clampRange(finite(map.range, 190));
  };

  const pinGoogleCenterToBuilding = () => {
    const placement = getPlacement();
    const centerAltitude = coordinate(map.center, "altitude");
    map.center =
      centerAltitude === undefined
        ? { lat: placement.latitude, lng: placement.longitude }
        : {
            lat: placement.latitude,
            lng: placement.longitude,
            altitude: centerAltitude,
          };
  };

  const writeOrbitToGoogleMap = () => {
    mapCameraFrame = 0;
    if (
      orbitHeading === null ||
      orbitTilt === null ||
      orbitRange === null
    )
      return;
    map.heading = orbitHeading;
    map.tilt = orbitTilt;
    map.range = orbitRange;
  };

  const queueOrbitToGoogleMap = () => {
    if (mapCameraFrame) return;
    mapCameraFrame = window.requestAnimationFrame(writeOrbitToGoogleMap);
  };

  const flyToBuildingCamera = (
    heading: number,
    tilt: number,
    range: number,
  ) => {
    const placement = getPlacement();
    const safeHeading = normalizeHeading(heading);
    const safeTilt = clampTilt(tilt);
    const safeRange = clampRange(range);
    orbitHeading = safeHeading;
    orbitTilt = safeTilt;
    orbitRange = safeRange;
    const endCamera = {
      center: {
        lat: placement.latitude,
        lng: placement.longitude,
        altitude:
          placement.altitudeM +
          Math.max(2, (bounds.heightM * Math.max(0.001, placement.scale)) / 2),
      },
      altitudeMode: "RELATIVE_TO_GROUND" as const,
      range: safeRange,
      tilt: safeTilt,
      heading: safeHeading,
    };
    if (typeof map.flyCameraTo === "function") {
      void map.flyCameraTo({ endCamera, durationMillis: 0 });
    } else {
      pinGoogleCenterToBuilding();
      map.heading = safeHeading;
      map.tilt = safeTilt;
      map.range = safeRange;
    }
    markSmoothInteraction();
  };

  const applyBuildingCenteredCamera = (
    heading: number,
    tilt: number,
    range: number,
  ) => {
    orbitHeading = normalizeHeading(heading);
    orbitTilt = clampTilt(tilt);
    orbitRange = clampRange(range);
    markSmoothInteraction();
    queueOrbitToGoogleMap();
  };

  const pointerSeparation = () => {
    const points = Array.from(activePointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const continueWithRemainingPointer = () => {
    if (activePointers.size !== 1) {
      primaryPointerId = null;
      return;
    }
    const [id, point] = Array.from(activePointers.entries())[0];
    primaryPointerId = id;
    lastPointerX = point.x;
    lastPointerY = point.y;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser has already cancelled a touch.
    }
    renderer.domElement.style.cursor = "grabbing";
    markSmoothInteraction();
    map.stopCameraAnimation?.();
    pinGoogleCenterToBuilding();
    if (orbitHeading === null || orbitTilt === null || orbitRange === null)
      syncOrbitFromMap();
    if (activePointers.size === 1) {
      primaryPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      pinchDistance = 0;
    } else {
      primaryPointerId = null;
      pinchDistance = pointerSeparation();
    }
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const distance = pointerSeparation();
      if (distance > 0 && pinchDistance > 0) {
        const currentRange =
          orbitRange ?? clampRange(finite(map.range, 190));
        applyBuildingCenteredCamera(
          orbitHeading ?? normalizeHeading(finite(map.heading, 0)),
          orbitTilt ?? clampTilt(finite(map.tilt, 68)),
          currentRange * (pinchDistance / distance),
        );
      }
      pinchDistance = distance;
      event.preventDefault();
      return;
    }

    if (primaryPointerId !== event.pointerId) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (dx || dy) {
      const currentHeading =
        orbitHeading ?? normalizeHeading(finite(map.heading, 0));
      const currentTilt = orbitTilt ?? clampTilt(finite(map.tilt, 68));
      applyBuildingCenteredCamera(
        currentHeading - dx * 0.3,
        currentTilt - dy * 0.11,
        orbitRange ?? clampRange(finite(map.range, 190)),
      );
    }
    event.preventDefault();
  };

  const releasePointer = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that already released capture.
    }
    pinchDistance = activePointers.size >= 2 ? pointerSeparation() : 0;
    continueWithRemainingPointer();
    if (activePointers.size === 0) {
      renderer.domElement.style.cursor = "grab";
    }
    markSmoothInteraction();
    event.preventDefault();
  };

  const onWheel = (event: WheelEvent) => {
    if (orbitHeading === null || orbitTilt === null || orbitRange === null)
      syncOrbitFromMap();
    const currentRange = orbitRange ?? clampRange(finite(map.range, 190));
    const factor = Math.exp(
      THREE.MathUtils.clamp(event.deltaY, -180, 180) * 0.00105,
    );
    pinGoogleCenterToBuilding();
    applyBuildingCenteredCamera(
      orbitHeading ?? normalizeHeading(finite(map.heading, 0)),
      orbitTilt ?? clampTilt(finite(map.tilt, 68)),
      currentRange * factor,
    );
    event.preventDefault();
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", releasePointer);
  renderer.domElement.addEventListener("pointercancel", releasePointer);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

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

    // Rekixo preview is intentionally building-centric: the GLB origin is the
    // immutable geographic anchor. Camera orbit must move around this fixed
    // pivot; it must never translate the model as Google changes camera center.
    root.position.set(0, placement.altitudeM, 0);
    root.scale.setScalar(Math.max(0.001, finite(placement.scale, 1)));
    applyModelOrientation(
      root,
      finite(placement.headingDeg, 0),
      finite(placement.pitchDeg, 0),
      finite(placement.rollDeg, 0),
    );

    const scale = Math.max(0.001, finite(placement.scale, 1));
    const targetY =
      placement.altitudeM + Math.max(2, (bounds.heightM * scale) / 2);
    const center = map.center;
    const cameraPosition = map.cameraPosition;
    const centerLat = coordinate(center, "lat");
    const centerLng = coordinate(center, "lng");
    const centerAlt = coordinate(center, "altitude");
    const cameraLat = coordinate(cameraPosition, "lat");
    const cameraLng = coordinate(cameraPosition, "lng");
    const cameraAlt = coordinate(cameraPosition, "altitude");
    const hasExactGoogleCamera =
      centerLat !== undefined &&
      centerLng !== undefined &&
      centerAlt !== undefined &&
      cameraLat !== undefined &&
      cameraLng !== undefined &&
      cameraAlt !== undefined;

    const range = clampRange(finite(map.range, orbitRange ?? 190));
    camera.fov = THREE.MathUtils.clamp(finite(map.fov, overlayFovDeg), 20, 55);
    camera.near = Math.max(0.05, range / 10_000);
    camera.far = Math.max(5_000, range * 20);

    if (hasExactGoogleCamera) {
      const cosLatitude = Math.max(
        0.2,
        Math.cos((centerLat * Math.PI) / 180),
      );
      const eastM = (cameraLng - centerLng) * 111_320 * cosLatitude;
      const northM = (cameraLat - centerLat) * 111_320;
      const upM = cameraAlt - centerAlt;
      camera.position.set(eastM, targetY + upM, -northM);
    } else {
      const headingDeg = normalizeHeading(
        finite(map.heading, orbitHeading ?? placement.headingDeg),
      );
      const tiltDeg = clampTilt(finite(map.tilt, orbitTilt ?? 68));
      const heading = THREE.MathUtils.degToRad(headingDeg);
      const tilt = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(tiltDeg, 1, 89.5),
      );
      const horizontal = range * Math.sin(tilt);
      const vertical = Math.max(1, range * Math.cos(tilt));
      camera.position.set(
        -Math.sin(heading) * horizontal,
        targetY + vertical,
        Math.cos(heading) * horizontal,
      );
    }

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
    // Google's terrain animates near 60fps. Match that while interacting so
    // the transparent GLB layer does not visibly lag one frame behind; drop
    // back to 30fps only when idle to protect integrated GPUs.
    const interactive =
      activePointers.size > 0 || now < smoothInteractionUntil;
    const minFrameInterval = interactive ? 15 : 32;
    if (
      document.visibilityState === "visible" &&
      now - previousFrameAt >= minFrameInterval
    ) {
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
    rotateViewBy: (deltaHeadingDeg: number) => {
      if (orbitHeading === null || orbitTilt === null || orbitRange === null)
        syncOrbitFromMap();
      flyToBuildingCamera(
        (orbitHeading ?? 0) + finite(deltaHeadingDeg, 0),
        orbitTilt ?? 68,
        orbitRange ?? 190,
      );
    },
    focusView: (headingDeg: number, tiltDeg = 68, rangeM = 190) => {
      flyToBuildingCamera(headingDeg, tiltDeg, rangeM);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      if (mapCameraFrame) window.cancelAnimationFrame(mapCameraFrame);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", releasePointer);
      renderer.domElement.removeEventListener("pointercancel", releasePointer);
      renderer.domElement.removeEventListener("wheel", onWheel);
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
