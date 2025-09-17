// IMPORTS vía import map (ver index.html)
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ---------- Renderer ---------- */
const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

/* ---------- Scene & Camera ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2, 7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 20;

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(6, 3, 2);
scene.add(sun);

/* ---------- Starfield (2 capas + twinkle) ---------- */
function makeStarField({ count = 1800, radius = 90, size = 0.06, opacity = 0.9, seed = 0 }) {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const rand = (n) => Math.sin(n * 999.91 + seed) * 0.5 + 0.5;

    for (let i = 0; i < count; i++) {
        const r = radius * (0.7 + Math.random() * 0.6);
        const theta = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const phi = Math.acos(u);
        pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        phase[i] = rand(i);
    }
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("phase", new THREE.BufferAttribute(phase, 1));

    const mat = new THREE.PointsMaterial({ size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    const stars = new THREE.Points(geom, mat);
    stars.userData = { twinkleSpeed: 0.8 + Math.random() * 0.6, baseOpacity: opacity };
    return stars;
}
const starsFar = makeStarField({ count: 2000, radius: 120, size: 0.05, opacity: 0.85, seed: 1 });
const starsNear = makeStarField({ count: 900, radius: 80, size: 0.10, opacity: 0.75, seed: 2 });
scene.add(starsFar, starsNear);
function twinkle(points, time) {
    const sp = points.userData.twinkleSpeed;
    const base = points.userData.baseOpacity;
    points.material.opacity = base * (0.8 + 0.2 * Math.sin(time * sp));
}

/* ---------- Texturas (threejs.org/examples) ---------- */
const texLoader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function setColorTex(t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
function setDataTex(t) { t.anisotropy = maxAniso; return t; }

const URLS = {
    color: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    normal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
    specular: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
    lights: "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
    clouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
};
function loadTex(url, setup) {
    return setup(texLoader.load(url, undefined, undefined, e => console.error("No se pudo cargar:", url, e)));
}
const earthColor = loadTex(URLS.color, setColorTex);
const earthLights = loadTex(URLS.lights, setColorTex);
const earthNormal = loadTex(URLS.normal, setDataTex);
const earthSpec = loadTex(URLS.specular, setDataTex);
const cloudsAlpha = loadTex(URLS.clouds, setDataTex);

/* ---------- Planeta + Nubes + Glow ---------- */
const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 96),
    new THREE.MeshPhongMaterial({
        map: earthColor,
        normalMap: earthNormal,
        specularMap: earthSpec,
        specular: new THREE.Color(0x333333),
        shininess: 18,
        emissiveMap: earthLights,
        emissive: 0xffffff,
        emissiveIntensity: 0.52,
        dithering: true
    })
);
planet.rotation.z = THREE.MathUtils.degToRad(23.4);
scene.add(planet);

const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.01, 96, 96),
    new THREE.MeshPhongMaterial({ alphaMap: cloudsAlpha, transparent: true, depthWrite: false, opacity: 0.45, dithering: true })
);
clouds.rotation.z = planet.rotation.z;
scene.add(clouds);

const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 40, 128, 128, 120);
    grad.addColorStop(0, "rgba(0,229,255,0.25)");
    grad.addColorStop(1, "rgba(0,229,255,0.0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
})();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
glow.scale.set(3.2, 3.2, 1);
scene.add(glow);

/* ---------- Helpers para satélites ---------- */
// Color HSL
function colorFromHue(h) { const c = new THREE.Color(); c.setHSL(h, 0.55, 0.6); return c; }
// Glow sprite reutilizable
const SHIP_GLOW_TEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 120);
    gr.addColorStop(0, "rgba(0,229,255,0.45)");
    gr.addColorStop(1, "rgba(0,229,255,0.0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.premultiplyAlpha = true;
    return t;
})();

/* ---------- Satélites con diseños variados ---------- */
const satellites = [];                 // lista de pivots
const satelliteGroup = new THREE.Group();
scene.add(satelliteGroup);

/* ---- Tipos de nave ---- */
function buildTypeA() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.7, roughness: 0.35 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x111826, metalness: 0.5, roughness: 0.5 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0x0b1f3a, emissive: 0x4ad2ff, emissiveIntensity: 0.7 });

    const hue = Math.random();
    const panelCol = colorFromHue((hue + 0.6) % 1);
    const panelMat = new THREE.MeshStandardMaterial({ color: panelCol, metalness: 0.1, roughness: 0.6, emissive: panelCol.clone().multiplyScalar(0.1) });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.12), bodyMat);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.10, 24), accentMat);
    nose.rotation.z = Math.PI / 2; nose.position.x = 0.17;

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), winMat); win1.position.set(0.05, 0.03, 0.065);
    const win2 = win1.clone(); win2.position.z = -0.065;

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 12), accentMat); mast.position.set(-0.12, 0.09, 0);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.06, 24), accentMat); dish.position.set(-0.15, 0.14, 0); dish.rotation.z = -Math.PI / 4;

    const panelGeo = new THREE.PlaneGeometry(0.28, 0.10);
    const panelL = new THREE.Mesh(panelGeo, panelMat); panelL.position.set(0, 0, 0.12); panelL.rotation.y = Math.PI / 2;
    const panelR = new THREE.Mesh(panelGeo, panelMat); panelR.position.set(0, 0, -0.12); panelR.rotation.y = -Math.PI / 2;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 }));
    glow.scale.set(0.9, 0.9, 1);
    const light = new THREE.PointLight(0x88caff, 0.35, 1.5);

    const ship = new THREE.Group();
    ship.add(body, nose, win1, win2, mast, dish, panelL, panelR, glow, light);
    ship.userData = { body, panels: [panelL, panelR], dish, glow, light, type: "A" };
    return ship;
}

function buildTypeB() {
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 24), new THREE.MeshStandardMaterial({ color: 0xcfd8ff, metalness: 0.6, roughness: 0.35, emissive: 0x0a1020, emissiveIntensity: 0.25 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.01, 12, 48), new THREE.MeshStandardMaterial({ color: 0x8ab4ff, metalness: 0.2, roughness: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    const antennaM = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.5, roughness: 0.5 });
    const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 12), antennaM); ant1.position.set(0.0, 0.18, 0.0);
    const ant2 = ant1.clone(); ant2.position.set(0.16, 0, 0); ant2.rotation.z = Math.PI / 2;
    const ant3 = ant1.clone(); ant3.position.set(0, -0.18, 0);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.18 }));
    glow.scale.set(0.8, 0.8, 1);

    const ship = new THREE.Group();
    ship.add(hull, ring, ant1, ant2, ant3, glow);
    ship.userData = { body: hull, ring, glow, type: "B" };
    return ship;
}

function buildTypeC() {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 3), new THREE.MeshStandardMaterial({ color: 0xeaeaea, metalness: 0.5, roughness: 0.45 }));
    body.rotation.z = Math.PI / 2;
    const finM = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.2, roughness: 0.7 });
    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.06), finM); fin1.position.set(0, 0.05, 0);
    const fin2 = fin1.clone(); fin2.position.y = -0.05;
    const nav = new THREE.PointLight(0xff3355, 0.6, 1.2); nav.position.set(0.12, 0, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.20 }));
    glow.scale.set(0.85, 0.85, 1);

    const ship = new THREE.Group();
    ship.add(body, fin1, fin2, nav, glow);
    ship.userData = { body, fins: [fin1, fin2], glow, nav, type: "C" };
    return ship;
}

function buildTypeD() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0xd0e2ff, metalness: 0.4, roughness: 0.45, emissive: 0x08121f, emissiveIntensity: 0.2 }));
    const armM = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.3 });
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.02), armM);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.26), armM);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.005), new THREE.MeshStandardMaterial({ color: 0x001b2e, emissive: 0x5de0ff, emissiveIntensity: 0.8 }));
    win.position.set(0.09, 0.02, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.18 }));
    glow.scale.set(0.9, 0.9, 1);

    const ship = new THREE.Group();
    ship.add(body, arm1, arm2, win, glow);
    ship.userData = { body, arms: [arm1, arm2], glow, type: "D" };
    return ship;
}
const BUILDERS = [buildTypeA, buildTypeB, buildTypeC, buildTypeD];

/* ---- Creador con órbita inclinada/dirección/velocidad variables ---- */
function makeSatellite(radius, omegaRadPerSec) {
    const ship = BUILDERS[Math.floor(Math.random() * BUILDERS.length)]();

    const pivot = new THREE.Object3D();
    // inclinaciones aleatorias (grados -> rad)
    pivot.rotation.x = THREE.MathUtils.degToRad((Math.random() * 24) - 12);
    pivot.rotation.z = THREE.MathUtils.degToRad((Math.random() * 24) - 12);

    // dirección aleatoria
    const dir = Math.random() < 0.4 ? -1 : 1; // ~40% antihorario

    // el ship orbitará a distancia 'radius' sobre el pivot
    ship.position.set(radius, 0, 0);
    pivot.add(ship);
    satelliteGroup.add(pivot);

    // dibujar la órbita como línea en el plano del pivot
    const circlePts = [...Array(128)].map((_, k) => {
        const t = k / 127 * Math.PI * 2;
        return new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius);
    });
    const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(circlePts),
        new THREE.LineBasicMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.55 })
    );
    pivot.add(orbit);

    pivot.userData = {
        r: radius,
        ang: Math.random() * Math.PI * 2,
        spd: omegaRadPerSec,
        dir,
        body: ship,
        panels: ship.userData.panels,
        dish: ship.userData.dish,
        ring: ship.userData.ring,
        arms: ship.userData.arms,
        fins: ship.userData.fins,
        glow: ship.userData.glow,
        nav: ship.userData.nav,
        type: ship.userData.type,
        pulse: Math.random() * Math.PI * 2,
        core: ship.userData.body ?? ship // para raycaster
    };

    satellites.push(pivot);
}

/* ---- Crear varios satélites con “ley” tipo Kepler + random ---- */
function keplerOmega(r) { return 0.5 / Math.pow(r, 1.5); } // rad/s aprox
for (let i = 0; i < 10; i++) {
    const r = 1.8 + i * 0.32;
    const base = keplerOmega(r);
    const factor = THREE.MathUtils.lerp(0.7, 1.4, Math.random());
    makeSatellite(r, base * factor);
}

/* ---------- Raycaster Hover ---------- */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hovering = null;

function updateHover() {
    const pickables = satellites.map(p => p.userData.core);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pickables, false);

    // reset
    if (hovering && (!hits.length || hits[0].object !== hovering)) {
        const pivot = hovering.parent;
        const d = pivot.userData;
        if (d.panels) d.panels.forEach(p => { p.material.emissiveIntensity = 0.1; p.rotation.x = 0; });
        if (d.ring) d.ring.material.opacity = 0.6;
        if (d.glow) d.glow.material.opacity = 0.22;
        renderer.domElement.classList.remove("hoverable");
        hovering = null;
    }
    // set
    if (hits.length && hovering !== hits[0].object) {
        hovering = hits[0].object;
        const pivot = hovering.parent;
        const d = pivot.userData;
        if (d.panels) d.panels.forEach(p => { p.material.emissiveIntensity = 0.35; p.rotation.x = THREE.MathUtils.degToRad(6); });
        if (d.ring) d.ring.material.opacity = 0.9;
        if (d.glow) d.glow.material.opacity = 0.48;
        renderer.domElement.classList.add("hoverable");
    }
}
window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

/* ---------- Animate ---------- */
let t = 0;
let last = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    t += 0.005;

    planet.rotation.y += 0.0018;
    clouds.rotation.y += 0.0024;

    satellites.forEach(pivot => {
        const d = pivot.userData;

        // órbita sobre el pivot (inclinado) con dirección
        d.ang += d.dir * d.spd * dt;
        pivot.rotation.y = d.ang;

        // giro propio suave del “cuerpo”
        d.body.rotation.y += 0.01;

        // animaciones por tipo
        d.pulse += 0.04;

        if (d.panels) {
            const wob = Math.sin(d.pulse) * THREE.MathUtils.degToRad(3);
            if (!(hovering && hovering.parent === d.body)) {
                d.panels[0].rotation.x = wob;
                d.panels[1].rotation.x = -wob;
            }
        }
        if (d.ring) {
            d.ring.rotation.y += 0.02;
        }
        if (d.arms) {
            d.arms[0].rotation.y += 0.04;
            d.arms[1].rotation.x += 0.035;
        }
        if (d.fins) {
            const vib = Math.sin(d.pulse * 1.3) * THREE.MathUtils.degToRad(2);
            d.fins[0].rotation.z = vib;
            d.fins[1].rotation.z = -vib;
        }
        if (d.nav) {
            d.nav.intensity = 0.4 + 0.25 * Math.max(0, Math.sin(d.pulse * 0.9));
        }
        if (d.glow && !(hovering && hovering.parent === d.body)) {
            d.glow.material.opacity = 0.22 + Math.sin(d.pulse) * 0.03;
        }
    });

    twinkle(starsFar, t);
    twinkle(starsNear, t);
    updateHover();
    controls.update();
    renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
