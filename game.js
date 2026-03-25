import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/**
 * PROJECT: NEON - GAME ENGINE
 * Features: Procedural Generation, WebAudio Synthesis, Custom Physics, Game State Management
 */

class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5;
    }

    // Synthesize a "Cyber-Ping" sound for collecting items
    playCollectSound() {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.5, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    // Background ambient hum
    playAmbience() {
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 55; // Low A
        lfo.frequency.value = 0.5;
        lfoGain.gain.value = 10;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        const lowPass = this.ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 200;
        const g = this.ctx.createGain();
        g.gain.value = 0.1;
        osc.connect(lowPass);
        lowPass.connect(g);
        g.connect(this.masterGain);
        osc.start();
        lfo.start();
    }
}

class Game {
    constructor() {
        this.initScene();
        this.initPhysics();
        this.initWorld();
        this.initEventListeners();
        
        this.audio = new AudioManager();
        this.score = 0;
        this.maxCores = 5;
        this.isPaused = true;
        this.clock = new THREE.Clock();
        
        this.animate();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020205);
        this.scene.fog = new THREE.FogExp2(0x020205, 0.015);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.y = 1.7; // Human eye level

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new PointerLockControls(this.camera, document.body);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x4040ff, 0.5);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xff00ff, 1);
        sunLight.position.set(10, 20, 10);
        this.scene.add(sunLight);
    }

    initPhysics() {
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isSprinting = false;
        this.stamina = 100;
    }

    initWorld() {
        // Floor Grid
        const gridHelper = new THREE.GridHelper(1000, 100, 0xff00ff, 0x222244);
        this.scene.add(gridHelper);

        // Ground Plane (Physics)
        const floorGeo = new THREE.PlaneGeometry(1000, 1000);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Procedural "Neon" City Pillars
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 300; i++) {
            const h = 5 + Math.random() * 20;
            const material = new THREE.MeshStandardMaterial({ 
                color: Math.random() > 0.5 ? 0x00ffff : 0xff00ff,
                emissive: Math.random() > 0.5 ? 0x00ffff : 0xff00ff,
                emissiveIntensity: 0.5
            });
            const mesh = new THREE.Mesh(boxGeo, material);
            mesh.position.set(
                (Math.random() - 0.5) * 200,
                h / 2,
                (Math.random() - 0.5) * 200
            );
            mesh.scale.set(2 + Math.random() * 5, h, 2 + Math.random() * 5);
            this.scene.add(mesh);
        }

        // Energy Cores (Collectibles)
        this.cores = [];
        const coreGeo = new THREE.IcosahedronGeometry(0.5, 0);
        const coreMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 });
        for (let i = 0; i < this.maxCores; i++) {
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set((Math.random() - 0.5) * 100, 1, (Math.random() - 0.5) * 100);
            this.scene.add(core);
            this.cores.push(core);
        }
    }

    initEventListeners() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
                case 'Space': if (this.canJump) this.velocity.y += 15; this.canJump = false; break;
                case 'ShiftLeft': this.isSprinting = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
                case 'ShiftLeft': this.isSprinting = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // UI Handlers
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());
        document.getElementById('btn-resume').addEventListener('click', () => this.controls.lock());
        
        this.controls.addEventListener('lock', () => {
            this.isPaused = false;
            document.getElementById('main-menu').style.display = 'none';
            document.getElementById('pause-menu').style.display = 'none';
            document.getElementById('ui-layer').style.display = 'block';
        });

        this.controls.addEventListener('unlock', () => {
            this.isPaused = true;
            document.getElementById('pause-menu').style.display = 'flex';
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    startGame() {
        this.audio.playAmbience();
        this.controls.lock();
    }

    updatePhysics(delta) {
        if (this.isPaused) return;

        // Deceleration
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 4.0 * delta; // Gravity

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const speed = this.isSprinting && this.stamina > 0 ? 800.0 : 400.0;

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * delta;

        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);

        this.camera.position.y += (this.velocity.y * delta);

        if (this.camera.position.y < 1.7) {
            this.velocity.y = 0;
            this.camera.position.y = 1.7;
            this.canJump = true;
        }

        // Stamina Logic
        if (this.isSprinting && (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight)) {
            this.stamina = Math.max(0, this.stamina - delta * 30);
        } else {
            this.stamina = Math.min(100, this.stamina + delta * 15);
        }
        document.getElementById('stamina-fill').style.width = `${this.stamina}%`;
    }

    checkCollisions() {
        const playerPos = this.camera.position;
        this.cores.forEach((core, index) => {
            if (core.visible && playerPos.distanceTo(core.position) < 2) {
                core.visible = false;
                this.score++;
                this.audio.playCollectSound();
                document.getElementById('core-count').innerText = this.score;
                
                if (this.score >= this.maxCores) {
                    document.getElementById('objective-text').innerText = "All Cores Collected! Portal Active.";
                    document.getElementById('objective-tracker').style.borderColor = "#00ff00";
                }
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        if (!this.isPaused) {
            this.updatePhysics(delta);
            this.checkCollisions();

            // Animate cores (Spinning)
            this.cores.forEach(core => {
                if (core.visible) {
                    core.rotation.y += delta * 2;
                    core.position.y = 1 + Math.sin(this.clock.elapsedTime * 2) * 0.2;
                }
            });
        }

        this.renderer.render(this.scene, this.camera);
    }
}
/** * ADVANCED COMBAT & VFX MODULE 
 * Includes: Raycast Weaponry, Particle Physics, and AI State Machine
 */

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    explode(position, color, count = 20) {
        const geometry = new THREE.SphereGeometry(0.05, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color: color });

        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            // Random velocity vector
            particle.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            particle.userData.lifespan = 1.0; // seconds

            this.scene.add(particle);
            this.particles.push(particle);
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position.add(p.userData.velocity);
            p.userData.lifespan -= delta;
            p.scale.multiplyScalar(0.95); // Shrink over time

            if (p.userData.lifespan <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            }
        }
    }
}

class Enemy {
    constructor(scene, player, position) {
        this.scene = scene;
        this.player = player;
        this.health = 3;
        this.alive = true;

        // Visuals: Floating Octahedron
        const geo = new THREE.OctahedronGeometry(1, 0);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xff0000, 
            emissive: 0xff0000, 
            emissiveIntensity: 2,
            wireframe: true 
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        this.floatY = position.y;
    }

    update(delta, time) {
        if (!this.alive) return;

        // Hover animation
        this.mesh.position.y = this.floatY + Math.sin(time * 2) * 0.5;
        this.mesh.rotation.y += delta * 3;

        // Simple AI: Move toward player if within range
        const dist = this.mesh.position.distanceTo(this.player.position);
        if (dist < 30 && dist > 5) {
            const dir = new THREE.Vector3().subVectors(this.player.position, this.mesh.position).normalize();
            this.mesh.position.add(dir.multiplyScalar(delta * 4));
        }
    }

    takeDamage(particles) {
        this.health--;
        particles.explode(this.mesh.position, 0xff0000, 15);
        if (this.health <= 0) {
            this.alive = false;
            this.scene.remove(this.mesh);
            return true; // Enemy destroyed
        }
        return false;
    }
}

// UPDATE THE MAIN GAME CLASS WITH THESE METHODS
// 1. Add this to initScene():
this.raycaster = new THREE.Raycaster();
this.vfx = new ParticleSystem(this.scene);
this.enemies = [];
this.spawnEnemies();

// 2. Add these methods to the Game Class:
spawnEnemies() {
    for (let i = 0; i < 10; i++) {
        const pos = new THREE.Vector3(
            (Math.random() - 0.5) * 150,
            5,
            (Math.random() - 0.5) * 150
        );
        this.enemies.push(new Enemy(this.scene, this.camera, pos));
    }
}

shoot() {
    if (this.isPaused) return;

    // Play Synth Shoot Sound
    this.audio.playShootSound();

    // Raycast from center of screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const intersects = this.raycaster.intersectObjects(this.enemies.map(e => e.mesh));

    if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        const enemy = this.enemies.find(e => e.mesh === hitObject);
        if (enemy && enemy.alive) {
            const killed = enemy.takeDamage(this.vfx);
            if (killed) {
                this.score += 10;
                document.getElementById('core-count').innerText = this.score;
            }
        }
    }

    // Screen Shake Effect
    this.camera.position.x += (Math.random() - 0.5) * 0.1;
    this.camera.position.z += (Math.random() - 0.5) * 0.1;
}

// 3. Add to AudioManager Class:
playShootSound() {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
}

// 4. Update the animate() loop:
// Inside if(!this.isPaused) block:
this.vfx.update(delta);
this.enemies.forEach(enemy => enemy.update(delta, this.clock.elapsedTime));

// 5. Add Event Listener to initEventListeners():
window.addEventListener('mousedown', () => this.shoot());

// Start the game instance
new Game();

