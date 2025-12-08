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

/* ---------- Starfield Mejorado (colores, tamaños variados, mejor twinkle) ---------- */
function makeStarField({ count = 1800, radius = 90, minSize = 0.04, maxSize = 0.12, opacity = 0.9, seed = 0 }) {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phase = new Float32Array(count);
    const rand = (n) => Math.sin(n * 999.91 + seed) * 0.5 + 0.5;

    // Colores estelares basados en temperatura (azul caliente -> rojo frío)
    const starColors = [
        new THREE.Color(0xaaccff), // Azul (caliente)
        new THREE.Color(0xffffff), // Blanco
        new THREE.Color(0xfff8e7), // Blanco cálido
        new THREE.Color(0xffd699), // Amarillo/naranja
        new THREE.Color(0xffaa77), // Naranja
    ];

    for (let i = 0; i < count; i++) {
        const r = radius * (0.7 + Math.random() * 0.6);
        const theta = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const phi = Math.acos(u);
        pos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
        phase[i] = rand(i);
        sizes[i] = THREE.MathUtils.lerp(minSize, maxSize, Math.pow(Math.random(), 2));

        // Asignar color basado en probabilidad (más estrellas blancas/amarillas)
        const colorIdx = Math.floor(Math.pow(Math.random(), 0.7) * starColors.length);
        const col = starColors[Math.min(colorIdx, starColors.length - 1)];
        colors[i * 3 + 0] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute("phase", new THREE.BufferAttribute(phase, 1));

    const mat = new THREE.PointsMaterial({
        size: maxSize,
        transparent: true,
        opacity,
        depthWrite: false,
        sizeAttenuation: true,
        vertexColors: true // Activar colores por vértice
    });
    const stars = new THREE.Points(geom, mat);
    stars.userData = { twinkleSpeed: 0.8 + Math.random() * 0.6, baseOpacity: opacity };
    return stars;
}
const starsFar = makeStarField({ count: 3000, radius: 120, minSize: 0.03, maxSize: 0.08, opacity: 0.9, seed: 1 });
const starsNear = makeStarField({ count: 1200, radius: 80, minSize: 0.06, maxSize: 0.15, opacity: 0.85, seed: 2 });
const starsVeryFar = makeStarField({ count: 2000, radius: 150, minSize: 0.02, maxSize: 0.05, opacity: 0.7, seed: 3 });
scene.add(starsFar, starsNear, starsVeryFar);

function twinkle(points, time) {
    const sp = points.userData.twinkleSpeed;
    const base = points.userData.baseOpacity;
    // Twinkle más dinámico con múltiples frecuencias
    const twinkleVal = 0.75 + 0.25 * Math.sin(time * sp) * Math.cos(time * sp * 0.7);
    points.material.opacity = base * twinkleVal;
}

/* ---------- Nebulosas de Fondo ---------- */
function createNebula(x, y, z, scale, color1, color2, opacity = 0.15) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Gradiente radial con colores de nebulosa
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(0.4, color2);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Añadir ruido/textura
    for (let i = 0; i < 800; i++) {
        const px = Math.random() * 512;
        const py = Math.random() * 512;
        const dist = Math.sqrt((px - 256) ** 2 + (py - 256) ** 2);
        if (dist < 220) {
            const alpha = Math.random() * 0.3 * (1 - dist / 220);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const nebula = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity
    }));
    nebula.position.set(x, y, z);
    nebula.scale.set(scale, scale, 1);
    return nebula;
}

// Crear varias nebulosas con colores distintos - MÁS VISIBLES
const nebulas = [
    createNebula(-35, 15, -50, 100, "rgba(180,100,255,0.5)", "rgba(100,40,180,0.25)", 0.35),
    createNebula(45, -20, -55, 90, "rgba(255,120,180,0.45)", "rgba(180,60,120,0.2)", 0.30),
    createNebula(25, 35, -60, 80, "rgba(100,180,255,0.4)", "rgba(50,120,200,0.18)", 0.28),
    createNebula(-40, -25, -52, 75, "rgba(150,255,220,0.4)", "rgba(80,180,150,0.18)", 0.25),
];
nebulas.forEach(n => scene.add(n));

/* ---------- Shooting Stars (Estrellas Fugaces) ---------- */
const shootingStars = [];
const SHOOTING_STAR_POOL_SIZE = 5;

function createShootingStar() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 puntos (inicio y fin del trail)
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geometry, material);
    line.userData = {
        active: false,
        progress: 0,
        speed: 0,
        startPos: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        trailLength: 0
    };
    return line;
}

// Pool de shooting stars
for (let i = 0; i < SHOOTING_STAR_POOL_SIZE; i++) {
    const ss = createShootingStar();
    shootingStars.push(ss);
    scene.add(ss);
}

function activateShootingStar() {
    const inactive = shootingStars.find(s => !s.userData.active);
    if (!inactive) return;

    const d = inactive.userData;
    d.active = true;
    d.progress = 0;
    d.speed = 15 + Math.random() * 25; // Velocidad variable
    d.trailLength = 3 + Math.random() * 5;

    // Posición inicial en el hemisferio visible
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const radius = 40 + Math.random() * 30;
    d.startPos.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) + 10,
        radius * Math.sin(phi) * Math.sin(theta) - 30
    );

    // Dirección hacia abajo y adelante
    d.direction.set(
        (Math.random() - 0.5) * 0.5,
        -0.8 - Math.random() * 0.2,
        0.3 + Math.random() * 0.3
    ).normalize();

    inactive.material.opacity = 0.9;
}

function updateShootingStars(dt) {
    shootingStars.forEach(ss => {
        const d = ss.userData;
        if (!d.active) return;

        d.progress += dt * d.speed;

        // Calcular posiciones del trail
        const headPos = d.startPos.clone().addScaledVector(d.direction, d.progress);
        const tailPos = d.startPos.clone().addScaledVector(d.direction, Math.max(0, d.progress - d.trailLength));

        const positions = ss.geometry.attributes.position.array;
        positions[0] = tailPos.x;
        positions[1] = tailPos.y;
        positions[2] = tailPos.z;
        positions[3] = headPos.x;
        positions[4] = headPos.y;
        positions[5] = headPos.z;
        ss.geometry.attributes.position.needsUpdate = true;

        // Fade out gradual
        const maxDist = 60;
        if (d.progress > maxDist * 0.7) {
            ss.material.opacity = 0.9 * (1 - (d.progress - maxDist * 0.7) / (maxDist * 0.3));
        }

        // Desactivar cuando termine
        if (d.progress > maxDist) {
            d.active = false;
            ss.material.opacity = 0;
        }
    });
}

// Timer para activar shooting stars
let shootingStarTimer = 0;
function triggerShootingStars(dt) {
    shootingStarTimer += dt;
    if (shootingStarTimer > 2 + Math.random() * 4) {
        activateShootingStar();
        shootingStarTimer = 0;
    }
}

/* ---------- Polvo Cósmico (Partículas Flotantes) ---------- */
function createCosmicDust(count = 400) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

        velocities[i * 3] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        size: 0.03,
        color: 0x8888aa,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const dust = new THREE.Points(geometry, material);
    dust.userData = { velocities, count };
    return dust;
}

const cosmicDust = createCosmicDust(500);
scene.add(cosmicDust);

function updateCosmicDust(time) {
    const positions = cosmicDust.geometry.attributes.position.array;
    const vel = cosmicDust.userData.velocities;
    const count = cosmicDust.userData.count;

    for (let i = 0; i < count; i++) {
        // Movimiento browniano suave
        positions[i * 3] += vel[i * 3] + Math.sin(time + i) * 0.002;
        positions[i * 3 + 1] += vel[i * 3 + 1] + Math.cos(time * 0.7 + i) * 0.002;
        positions[i * 3 + 2] += vel[i * 3 + 2] + Math.sin(time * 0.5 + i * 0.5) * 0.002;

        // Wrap around
        for (let j = 0; j < 3; j++) {
            if (positions[i * 3 + j] > 25) positions[i * 3 + j] = -25;
            if (positions[i * 3 + j] < -25) positions[i * 3 + j] = 25;
        }
    }
    cosmicDust.geometry.attributes.position.needsUpdate = true;
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
    new THREE.SphereGeometry(1.012, 96, 96),
    new THREE.MeshPhongMaterial({
        alphaMap: cloudsAlpha,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
        dithering: true,
        side: THREE.DoubleSide
    })
);
clouds.rotation.z = planet.rotation.z;
scene.add(clouds);

// Segunda capa de nubes para efecto volumétrico
const clouds2 = new THREE.Mesh(
    new THREE.SphereGeometry(1.018, 64, 64),
    new THREE.MeshPhongMaterial({
        alphaMap: cloudsAlpha,
        transparent: true,
        depthWrite: false,
        opacity: 0.25,
        dithering: true
    })
);
clouds2.rotation.z = planet.rotation.z;
clouds2.rotation.y = Math.PI * 0.3; // Offset para variación
scene.add(clouds2);

/* ---------- Atmósfera Fresnel (Shader 3D real) ---------- */
const fresnelVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fresnelFragmentShader = `
    uniform vec3 glowColor;
    uniform float intensity;
    uniform float power;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        vec3 viewDirection = normalize(-vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), power);
        gl_FragColor = vec4(glowColor, fresnel * intensity);
    }
`;

// Atmósfera exterior (halo azul)
const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
        glowColor: { value: new THREE.Color(0x00b4ff) },
        intensity: { value: 0.8 },
        power: { value: 3.5 }
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
});

const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 64, 64),
    atmosphereMaterial
);
scene.add(atmosphere);

// Atmósfera interior (rim light sutil)
const innerAtmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: fresnelVertexShader,
    fragmentShader: fresnelFragmentShader,
    uniforms: {
        glowColor: { value: new THREE.Color(0x88ddff) },
        intensity: { value: 0.4 },
        power: { value: 2.0 }
    },
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
});

const innerAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 64, 64),
    innerAtmosphereMaterial
);
scene.add(innerAtmosphere);

// Sprite glow adicional para efecto de halo externo
const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(256, 256, 80, 256, 256, 256);
    grad.addColorStop(0, "rgba(100,200,255,0.15)");
    grad.addColorStop(0.5, "rgba(50,150,255,0.05)");
    grad.addColorStop(1, "rgba(0,100,200,0.0)");
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
})();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
glow.scale.set(4.0, 4.0, 1);
scene.add(glow);

/* ---------- Luna Orbitando (MÁS DESTACADA) ---------- */
const moonTexture = texLoader.load("https://threejs.org/examples/textures/planets/moon_1024.jpg", (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
});

const moonPivot = new THREE.Object3D();
scene.add(moonPivot);

const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 48, 48), // Más grande
    new THREE.MeshPhongMaterial({
        map: moonTexture,
        shininess: 8
    })
);
moon.position.set(4.2, 0, 0); // Un poco más lejos para que destaque
moonPivot.add(moon);

// Glow sutil para la luna
const moonGlowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grad.addColorStop(0, "rgba(200,200,220,0.2)");
    grad.addColorStop(0.5, "rgba(180,180,200,0.08)");
    grad.addColorStop(1, "rgba(150,150,180,0.0)");
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
})();
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonGlowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
}));
moonGlow.scale.set(1.4, 1.4, 1);
moonGlow.position.copy(moon.position);
moonPivot.add(moonGlow);

// Inclinación orbital de la Luna
moonPivot.rotation.x = THREE.MathUtils.degToRad(5.1);
moonPivot.rotation.z = THREE.MathUtils.degToRad(6);

// Variables para animación lunar
let moonAngle = 0;
const moonOrbitSpeed = 0.08; // rad/s

/* ---------- Helpers para satélites ---------- */
// Color HSL
function colorFromHue(h) { const c = new THREE.Color(); c.setHSL(h, 0.55, 0.6); return c; }

// Glow sprite reutilizable (mejorado)
const SHIP_GLOW_TEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(128, 128, 5, 128, 128, 128);
    gr.addColorStop(0, "rgba(100,220,255,0.6)");
    gr.addColorStop(0.3, "rgba(50,180,255,0.3)");
    gr.addColorStop(0.7, "rgba(0,150,255,0.1)");
    gr.addColorStop(1, "rgba(0,100,200,0.0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.premultiplyAlpha = true;
    return t;
})();

// Textura de thruster (propulsor)
const THRUSTER_TEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 60);
    gr.addColorStop(0, "rgba(255,200,100,0.9)");
    gr.addColorStop(0.2, "rgba(255,150,50,0.7)");
    gr.addColorStop(0.5, "rgba(255,80,20,0.4)");
    gr.addColorStop(1, "rgba(200,50,0,0.0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
})();

// Crear thruster sprite
function createThruster(scale = 0.15) {
    const thruster = new THREE.Sprite(new THREE.SpriteMaterial({
        map: THRUSTER_TEX,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.7
    }));
    thruster.scale.set(scale, scale * 1.5, 1);
    return thruster;
}

/* ---------- Satélites con diseños variados ---------- */
const satellites = [];                 // lista de pivots
const satelliteGroup = new THREE.Group();
scene.add(satelliteGroup);

/* ---- Tipos de nave ---- */
function buildTypeA() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.75, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x111826, metalness: 0.6, roughness: 0.4 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0x0b1f3a, emissive: 0x4ad2ff, emissiveIntensity: 0.85 });

    const hue = Math.random();
    const panelCol = colorFromHue((hue + 0.6) % 1);
    const panelMat = new THREE.MeshStandardMaterial({ color: panelCol, metalness: 0.15, roughness: 0.5, emissive: panelCol.clone().multiplyScalar(0.15) });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.12), bodyMat);

    // Detalle adicional: ridges en el cuerpo
    const ridge1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.01, 0.13), accentMat);
    ridge1.position.y = 0.04;
    const ridge2 = ridge1.clone(); ridge2.position.y = -0.04;

    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.10, 24), accentMat);
    nose.rotation.z = Math.PI / 2; nose.position.x = 0.17;

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.012), winMat); win1.position.set(0.05, 0.035, 0.067);
    const win2 = win1.clone(); win2.position.z = -0.067;
    const win3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), winMat); win3.position.set(-0.02, 0.035, 0.067);
    const win4 = win3.clone(); win4.position.z = -0.067;

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 12), accentMat); mast.position.set(-0.12, 0.10, 0);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.07, 24), accentMat); dish.position.set(-0.15, 0.16, 0); dish.rotation.z = -Math.PI / 4;

    const panelGeo = new THREE.PlaneGeometry(0.32, 0.12);
    const panelL = new THREE.Mesh(panelGeo, panelMat); panelL.position.set(0, 0, 0.14); panelL.rotation.y = Math.PI / 2;
    const panelR = new THREE.Mesh(panelGeo, panelMat); panelR.position.set(0, 0, -0.14); panelR.rotation.y = -Math.PI / 2;

    // Grid lines en paneles solares
    const gridMat = new THREE.LineBasicMaterial({ color: 0x333366, transparent: true, opacity: 0.5 });

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.28 }));
    glow.scale.set(1.0, 1.0, 1);
    const light = new THREE.PointLight(0x88caff, 0.45, 1.8);

    // Thruster
    const thruster = createThruster(0.12);
    thruster.position.set(-0.15, 0, 0);

    const ship = new THREE.Group();
    ship.add(body, ridge1, ridge2, nose, win1, win2, win3, win4, mast, dish, panelL, panelR, glow, light, thruster);
    ship.userData = { body, panels: [panelL, panelR], dish, glow, light, thruster, type: "A" };
    return ship;
}

// TIPO B: Estación espacial modular (sin anillos)
function buildTypeB() {
    // Módulo central cilíndrico
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.6, roughness: 0.35 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.20, 16), coreMat);
    core.rotation.z = Math.PI / 2;

    // Módulos laterales (habitáculos)
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e8, metalness: 0.5, roughness: 0.4 });
    const module1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), moduleMat);
    module1.position.set(0, 0.10, 0);
    const module2 = module1.clone(); module2.position.y = -0.10;

    // Paneles solares grandes (dorados)
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xdaa520, metalness: 0.3, roughness: 0.5, emissive: 0x553300, emissiveIntensity: 0.15 });
    const panel1 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.08), panelMat);
    panel1.position.set(0, 0, 0.12); panel1.rotation.y = Math.PI / 2;
    const panel2 = panel1.clone(); panel2.position.z = -0.12; panel2.rotation.y = -Math.PI / 2;

    // Antena de comunicaciones
    const antMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 8), antMat);
    antenna.position.set(0.12, 0.08, 0);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.4, roughness: 0.5 });
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.03, 16), dishMat);
    dish.position.set(0.14, 0.08, 0); dish.rotation.z = -Math.PI / 2;

    // Luz de navegación verde
    const navLight = new THREE.PointLight(0x00ff88, 0.5, 1.0);
    navLight.position.set(0.10, 0, 0);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.20 }));
    glow.scale.set(0.8, 0.8, 1);

    const thruster = createThruster(0.08);
    thruster.position.set(-0.12, 0, 0);

    const ship = new THREE.Group();
    ship.add(core, module1, module2, panel1, panel2, antenna, dish, navLight, glow, thruster);
    ship.userData = { body: core, panels: [panel1, panel2], glow, thruster, type: "B" };
    return ship;
}

function buildTypeC() {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.25, 4), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.55, roughness: 0.4 }));
    body.rotation.z = Math.PI / 2;

    // Detalles del fuselaje
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.3, roughness: 0.5 }));
    stripe.rotation.z = Math.PI / 2;
    stripe.position.x = 0.02;

    const finM = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.3, roughness: 0.6 });
    const fin1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.07), finM); fin1.position.set(0, 0.06, 0);
    const fin2 = fin1.clone(); fin2.position.y = -0.06;
    const fin3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.012), finM); fin3.position.set(0, 0, 0.06);
    const fin4 = fin3.clone(); fin4.position.z = -0.06;

    const nav = new THREE.PointLight(0xff3355, 0.7, 1.4); nav.position.set(0.14, 0, 0);
    const navBulb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.0 }));
    navBulb.position.set(0.14, 0, 0);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25 }));
    glow.scale.set(0.95, 0.95, 1);

    // Thruster grande
    const thruster = createThruster(0.14);
    thruster.position.set(-0.16, 0, 0);

    const ship = new THREE.Group();
    ship.add(body, stripe, fin1, fin2, fin3, fin4, nav, navBulb, glow, thruster);
    ship.userData = { body, fins: [fin1, fin2, fin3, fin4], glow, nav, thruster, type: "C" };
    return ship;
}

function buildTypeD() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0xd0e2ff, metalness: 0.45, roughness: 0.4, emissive: 0x08121f, emissiveIntensity: 0.25 }));

    // Detalles en el cubo
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, metalness: 0.7, roughness: 0.3 });
    const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.20, 0.03), detailMat); corner1.position.set(0.08, 0, 0.08);
    const corner2 = corner1.clone(); corner2.position.set(-0.08, 0, 0.08);
    const corner3 = corner1.clone(); corner3.position.set(0.08, 0, -0.08);
    const corner4 = corner1.clone(); corner4.position.set(-0.08, 0, -0.08);

    const armM = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.65, roughness: 0.25 });
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.025, 0.025), armM);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.30), armM);

    // Múltiples ventanas
    const winMat = new THREE.MeshStandardMaterial({ color: 0x001b2e, emissive: 0x5de0ff, emissiveIntensity: 0.9 });
    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.005), winMat); win1.position.set(0.10, 0.02, 0);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), winMat); win2.position.set(0.10, -0.03, 0);
    const win3 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.035, 0.05), winMat); win3.position.set(0, 0.02, 0.10);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHIP_GLOW_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 }));
    glow.scale.set(1.0, 1.0, 1);

    // Thrusters múltiples
    const thruster1 = createThruster(0.08);
    thruster1.position.set(-0.12, 0.05, 0.05);
    const thruster2 = createThruster(0.08);
    thruster2.position.set(-0.12, -0.05, -0.05);

    const ship = new THREE.Group();
    ship.add(body, corner1, corner2, corner3, corner4, arm1, arm2, win1, win2, win3, glow, thruster1, thruster2);
    ship.userData = { body, arms: [arm1, arm2], glow, thrusters: [thruster1, thruster2], type: "D" };
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
        new THREE.LineBasicMaterial({ color: 0x2a4a7a, transparent: true, opacity: 0.18 }) // Mucho más sutil
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

/* ---- Crear satélites (REDUCIDOS) ---- */
function keplerOmega(r) { return 0.5 / Math.pow(r, 1.5); }
for (let i = 0; i < 5; i++) { // Solo 5 satélites
    const r = 1.8 + i * 0.55; // Más espaciados
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

/* ---------- Click para Info de Satélites ---------- */
const tooltip = document.getElementById("satelliteTooltip");

// Datos únicos para cada satélite
const satelliteData = [
    { name: "Explorer-1", mission: "Primer satélite de EE.UU., descubrió los cinturones de Van Allen.", agency: "NASA" },
    { name: "ISS-Harmony", mission: "Módulo de conexión de la Estación Espacial Internacional.", agency: "NASA/ESA" },
    { name: "Hubble-II", mission: "Telescopio espacial de nueva generación para observación profunda.", agency: "NASA" },
    { name: "Starlink-7X", mission: "Constelación de internet satelital de alta velocidad.", agency: "SpaceX" },
    { name: "Sentinel-3B", mission: "Monitoreo oceánico y climático de la Tierra.", agency: "ESA" },
];

// Asignar datos únicos a cada satélite
satellites.forEach((pivot, idx) => {
    const d = pivot.userData;
    const data = satelliteData[idx % satelliteData.length];
    d.name = data.name;
    d.mission = data.mission;
    d.agency = data.agency;
    d.altitude = Math.round((d.r - 1) * 6371);
    d.velocity = Math.round(d.spd * 7.8 * 1000) / 1000;
});

let selectedSatellite = null;

function updateTooltipPosition() {
    if (!selectedSatellite) return;

    // Obtener posición 3D del satélite
    const worldPos = new THREE.Vector3();
    selectedSatellite.userData.body.getWorldPosition(worldPos);

    // Convertir a coordenadas de pantalla
    const screenPos = worldPos.clone().project(camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

    // Offset para no tapar el satélite
    tooltip.style.left = (x + 20) + "px";
    tooltip.style.top = (y - 20) + "px";
}

function showTooltip(pivot) {
    const d = pivot.userData;
    const typeNames = { "A": "Satélite Clásico", "B": "Estación Espacial", "C": "Cohete Orbital", "D": "CubeSat" };

    tooltip.innerHTML = `
        <h4>🛰️ ${d.name}</h4>
        <p class="mission">${d.mission}</p>
        <p>Agencia: <span class="stat">${d.agency}</span></p>
        <p>Tipo: <span class="stat">${typeNames[d.type]}</span></p>
        <p>Altitud: <span class="stat">${d.altitude} km</span></p>
        <p>Velocidad: <span class="stat">${d.velocity} km/s</span></p>
    `;

    tooltip.classList.add("visible");
    selectedSatellite = pivot;
    updateTooltipPosition();
}

function hideTooltip() {
    tooltip.classList.remove("visible");
    selectedSatellite = null;
}

window.addEventListener("click", (e) => {
    if (cinematicMode) return;

    const pickables = satellites.map(p => p.userData.core);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pickables, false);

    if (hits.length) {
        // Encontrar el pivot correcto buscando en el array de satellites
        const hitCore = hits[0].object;
        const pivot = satellites.find(p => p.userData.core === hitCore);

        if (pivot) {
            if (selectedSatellite === pivot) {
                hideTooltip();
            } else {
                showTooltip(pivot);
            }
        }
    } else {
        hideTooltip();
    }
});

/* ---------- Modo Cinematográfico MEJORADO ---------- */
let cinematicMode = false;
let cinematicTime = 0;
const cinematicIndicator = document.getElementById("cinematicIndicator");
const controlsBox = document.getElementById("controlsBox");
const letterboxBars = document.querySelectorAll(".letterbox-bar");

// Posiciones más alejadas (más zoom out)
const cinematicPath = [
    { pos: [0, 3, 12], duration: 5 },
    { pos: [10, 4, 6], duration: 6 },
    { pos: [6, 1, -10], duration: 5 },
    { pos: [-8, 6, 8], duration: 6 },
    { pos: [0, 12, 5], duration: 5 },
    { pos: [5, 2, 11], duration: 5 },
    { pos: [-6, 3, -9], duration: 5 },
];

function toggleCinematicMode() {
    cinematicMode = !cinematicMode;
    cinematicTime = 0;

    if (cinematicMode) {
        controls.enabled = false;
        cinematicIndicator.classList.add("visible");
        controlsBox.classList.add("hidden");
        letterboxBars.forEach(bar => bar.classList.add("active"));
        hideTooltip();
    } else {
        controls.enabled = true;
        cinematicIndicator.classList.remove("visible");
        controlsBox.classList.remove("hidden");
        letterboxBars.forEach(bar => bar.classList.remove("active"));
    }
}

function updateCinematicCamera(dt) {
    if (!cinematicMode) return;

    cinematicTime += dt;

    // Calcular duración total del ciclo
    const totalDuration = cinematicPath.reduce((sum, p) => sum + p.duration, 0);
    const loopTime = cinematicTime % totalDuration;

    // Encontrar segmento actual
    let elapsed = 0;
    let currentIdx = 0;
    for (let i = 0; i < cinematicPath.length; i++) {
        if (loopTime < elapsed + cinematicPath[i].duration) {
            currentIdx = i;
            break;
        }
        elapsed += cinematicPath[i].duration;
    }

    const current = cinematicPath[currentIdx];
    const next = cinematicPath[(currentIdx + 1) % cinematicPath.length];
    const segmentProgress = (loopTime - elapsed) / current.duration;

    // Interpolación suave (ease in-out)
    const smooth = segmentProgress * segmentProgress * (3 - 2 * segmentProgress);

    // Interpolar posición
    camera.position.x = THREE.MathUtils.lerp(current.pos[0], next.pos[0], smooth);
    camera.position.y = THREE.MathUtils.lerp(current.pos[1], next.pos[1], smooth);
    camera.position.z = THREE.MathUtils.lerp(current.pos[2], next.pos[2], smooth);

    // Siempre mirar al planeta
    camera.lookAt(0, 0, 0);
}

window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") {
        toggleCinematicMode();
    }
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

    // Luna orbitando
    moonAngle += moonOrbitSpeed * dt;
    moonPivot.rotation.y = moonAngle;
    moon.rotation.y += 0.003; // Rotación propia lenta (luna siempre muestra misma cara)

    satellites.forEach(pivot => {
        const d = pivot.userData;

        // órbita sobre el pivot (inclinado) con dirección
        d.ang += d.dir * d.spd * dt;
        pivot.rotation.y = d.ang;

        // giro propio suave del "cuerpo"
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

    // Actualizar efectos espaciales
    twinkle(starsFar, t);
    twinkle(starsNear, t);
    twinkle(starsVeryFar, t * 0.7);

    // Shooting stars
    triggerShootingStars(dt);
    updateShootingStars(dt);

    // Polvo cósmico
    updateCosmicDust(t);

    // Rotación sutil de nebulosas
    nebulas.forEach((n, i) => {
        n.material.rotation += 0.0001 * (i % 2 === 0 ? 1 : -1);
    });

    // Segunda capa de nubes
    clouds2.rotation.y += 0.0018;

    // Modo cinematográfico
    updateCinematicCamera(dt);

    if (!cinematicMode) {
        updateHover();
        updateTooltipPosition(); // Tooltip sigue al satélite
        controls.update();
    }

    renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

