const hero = document.querySelector("[data-home-hero]");
const canvas = document.querySelector("[data-hero-canvas]");

if (hero && canvas) {
  initScene().catch(() => {
    document.documentElement.style.setProperty("--hero-tilt-x", "0");
    document.documentElement.style.setProperty("--hero-tilt-y", "0");
  });
}

async function initScene() {
  if (!window.WebGLRenderingContext) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || window.innerWidth < 760;
  const useLite = reducedMotion || lowPower;
  const THREE = await import("/vendor/three/build/three.module.js");
  const root = document.documentElement;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const depthPanels = [...document.querySelectorAll(".depth-panel")];

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !useLite,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, useLite ? 1.2 : 1.8));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x040b18, useLite ? 0.14 : 0.09);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 1.2, 8.5);

  scene.add(new THREE.AmbientLight(0x88bbff, 1.2));

  const tealLight = new THREE.PointLight(0x22d3ee, 26, 32, 1.7);
  tealLight.position.set(2.5, 2.8, 4.5);
  scene.add(tealLight);

  const emberLight = new THREE.PointLight(0xf97316, 18, 28, 1.8);
  emberLight.position.set(-3.5, -1.2, 3.8);
  scene.add(emberLight);

  const group = new THREE.Group();
  scene.add(group);

  const samuraiBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 4.2, 0.18),
    new THREE.MeshPhysicalMaterial({
      color: 0xc4f7ff,
      metalness: 0.94,
      roughness: 0.14,
      emissive: 0x0c4254,
      emissiveIntensity: 0.5
    })
  );
  samuraiBlade.rotation.z = 0.26;
  samuraiBlade.position.set(-1.7, 0.4, -0.4);
  group.add(samuraiBlade);

  const mythicCore = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.1, 0.28, useLite ? 96 : 160, 20),
    new THREE.MeshPhysicalMaterial({
      color: 0x56d7ff,
      metalness: 0.7,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: 0x0f7ea6
    })
  );
  group.add(mythicCore);

  const cityRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 18, 120),
    new THREE.MeshPhysicalMaterial({
      color: 0xff8a3c,
      metalness: 0.48,
      roughness: 0.22,
      transparent: true,
      opacity: 0.92
    })
  );
  cityRing.rotation.x = Math.PI / 2.25;
  group.add(cityRing);

  const carArc = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 2.2, 8, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      metalness: 0.52,
      roughness: 0.18,
      emissive: 0x0d233f
    })
  );
  carArc.rotation.z = Math.PI / 2.7;
  carArc.position.set(1.85, -0.65, -0.8);
  group.add(carArc);

  const shards = [];
  const shardGeometry = new THREE.BoxGeometry(0.22, 1.1, 0.22);
  const shardCount = useLite ? 12 : 22;
  for (let index = 0; index < shardCount; index += 1) {
    const shard = new THREE.Mesh(
      shardGeometry,
      new THREE.MeshPhysicalMaterial({
        color: index % 2 === 0 ? 0x22d3ee : 0xf97316,
        metalness: 0.62,
        roughness: 0.22
      })
    );
    const angle = (index / shardCount) * Math.PI * 2;
    const radius = 3 + (index % 4) * 0.22;
    shard.position.set(Math.cos(angle) * radius, (index % 5 - 2) * 0.36, Math.sin(angle) * radius * 0.42);
    shard.rotation.set(angle * 0.5, angle * 0.8, angle * 0.3);
    group.add(shard);
    shards.push(shard);
  }

  const particleCount = useLite ? 90 : 180;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    particlePositions[index * 3] = (Math.random() - 0.5) * 14;
    particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 8;
    particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xb8fbff,
      size: useLite ? 0.06 : 0.045,
      transparent: true,
      opacity: 0.85
    })
  );
  scene.add(particles);

  const syncPanelDepth = () => {
    const viewportHeight = window.innerHeight || 1;
    depthPanels.forEach((panel) => {
      const rect = panel.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = (center - viewportHeight / 2) / viewportHeight;
      const depth = Math.max(-24, Math.min(24, distance * 68));
      panel.style.setProperty("--panel-depth", depth.toFixed(2));
    });
  };

  const syncHeroShift = () => {
    root.style.setProperty("--hero-tilt-x", pointer.x.toFixed(3));
    root.style.setProperty("--hero-tilt-y", pointer.y.toFixed(3));
    root.style.setProperty("--hero-shift-x", `${(pointer.x * 20).toFixed(2)}px`);
    root.style.setProperty("--hero-shift-y", `${(pointer.y * 14).toFixed(2)}px`);
  };

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    pointer.tx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
    pointer.ty = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
  }, { passive: true });

  hero.addEventListener("pointerleave", () => {
    pointer.tx = 0;
    pointer.ty = 0;
  }, { passive: true });

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
    camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
    syncPanelDepth();
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("scroll", syncPanelDepth, { passive: true });
  syncPanelDepth();

  if (window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.from(".hero-main > *", {
      opacity: 0,
      y: 32,
      stagger: 0.08,
      duration: 0.9,
      ease: "power3.out"
    });
    window.gsap.from(".depth-panel", {
      y: 48,
      opacity: 0,
      duration: 1,
      stagger: 0.14,
      ease: "power3.out",
      scrollTrigger: {
        trigger: "main",
        start: "top 82%"
      }
    });
  }

  if (reducedMotion) {
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  let frameId = 0;

  const tick = () => {
    const elapsed = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    syncHeroShift();

    group.rotation.y = elapsed * 0.18 + pointer.x * 0.35;
    group.rotation.x = Math.sin(elapsed * 0.42) * 0.18 + pointer.y * 0.2;
    group.position.y = Math.sin(elapsed * 0.84) * 0.18;
    mythicCore.rotation.x = elapsed * 0.45;
    mythicCore.rotation.z = elapsed * 0.3;
    cityRing.rotation.z = elapsed * 0.22;
    carArc.rotation.y = Math.sin(elapsed * 0.56) * 0.44;
    samuraiBlade.position.y = 0.4 + Math.sin(elapsed * 0.9) * 0.1;

    shards.forEach((shard, index) => {
      shard.rotation.y += 0.003 + index * 0.00012;
      shard.position.y += Math.sin(elapsed * 1.2 + index) * 0.002;
    });

    particles.rotation.y = elapsed * 0.04;
    camera.position.x += ((pointer.x * 0.9) - camera.position.x) * 0.04;
    camera.position.y += ((1.2 - pointer.y * 0.4) - camera.position.y) * 0.04;
    camera.lookAt(0, 0.1, 0);

    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(tick);
  };

  frameId = window.requestAnimationFrame(tick);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      return;
    }
    if (!document.hidden && !frameId) {
      frameId = window.requestAnimationFrame(tick);
    }
  });
}
