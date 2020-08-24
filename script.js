// VECTOR STUFF
function norm(v) {
    return Math.sqrt(v.x*v.x + v.y*v.y);
}

function scale(v, s) {
    return { x: v.x * s, y: v.y * s };
}

function normalized(v) {
    let d = norm(v);
    console.assert(d > 0.00001, v);
    return scale(v, 1.0 / d);
}

function add(u, v) {
    return {
        x: u.x + v.x,
        y: u.y + v.y
    }
}

function rand2dInBounds(bounds) {
    return {
        x: bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
        y: bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y)
    };
}

// SOUND SHIT
function initSynth(audioCtx) {
    let osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    return {
        osc: osc,
        gain: gainNode
    };
}

// OTHER
function generateRandomEnemies(numEnemies, bounds) {
    let enemies = []
    for (i = 0; i < numEnemies; ++i) {
        enemies.push({
            pos: rand2dInBounds(bounds)
        });
    }
    return enemies;
}

// GLOBAL STATE
let canvas = document.getElementById("canvas");
let canvasCtx = canvas.getContext('2d');
let audioCtx = null;
let synth = null;

const bounds = {
    min: { x: 0.0, y: 0.0 },
    max: { x: canvas.width, y: canvas.height }
};
const playerSpeed = canvas.width / 2.5;
const playerSize = canvas.width / 20.0;
let playerPos = {
    x: 0.5 * (bounds.min.x + bounds.max.x),
    y: 0.5 * (bounds.min.y + bounds.max.y)
}

let playerDir = { x: 0, y: 0 };
let prevTimeMillis = -1.0;

const enemySize = canvas.width / 20.0;
let enemies = generateRandomEnemies(10, bounds);

let slashPressed = false;

const BPM = 4 * 120.0;
const SECONDS_PER_BEAT = 60.0 / BPM;
const NUM_BEATS = 16;
const LOOP_TIME = NUM_BEATS * SECONDS_PER_BEAT;
let sequence = new Array(NUM_BEATS);
sequence.fill(false);
let loopElapsedTime = 0.0;
let currentBeatIx = -1;

// EVENT HANDLING
function onKeyDown(event) {
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        synth = initSynth(audioCtx);
    }
    if (event.repeat) {
        return;
    }
    switch (event.key) {
        case "w": playerDir.y += 1.0; break;
        case "s": playerDir.y -= 1.0; break;
        case "a": playerDir.x -= 1.0; break;
        case "d": playerDir.x += 1.0; break;
        case "j": slashPressed = true; break;
    }
}

function onKeyUp(event) {
    if (event.repeat) {
        return;
    }
    switch (event.key) {
        case "w": playerDir.y -= 1.0; break;
        case "s": playerDir.y += 1.0; break;
        case "a": playerDir.x += 1.0; break;
        case "d": playerDir.x -= 1.0; break;
    }
}

// UPDATE LOOP
function update(timeMillis) {
    if (prevTimeMillis < 0) {
        prevTimeMillis = timeMillis;
        window.requestAnimationFrame(update);
        return;
    }
    let dt = (timeMillis - prevTimeMillis) * 0.001;
    prevTimeMillis = timeMillis;

    loopElapsedTime += dt;
    if (loopElapsedTime >= LOOP_TIME) {
        // TODO: Can this cause inaccuracies/drift?
        loopElapsedTime = 0.0;
    }

    let newBeat = false;
    {
        let newBeatIx = Math.floor((loopElapsedTime / LOOP_TIME) * NUM_BEATS);
        console.assert(newBeatIx < NUM_BEATS);
        if (newBeatIx !== currentBeatIx) {
            newBeat = true;
            currentBeatIx = newBeatIx;
        }
    }

    if (slashPressed) {
        slashPressed = false;
        let oldCount = enemies.length;
        enemies = enemies.filter(e => norm(add(e.pos, scale(playerPos, -1.0))) > 0.5*playerSize + 0.5*enemySize);
        if (enemies.length < oldCount) {
            sequence[currentBeatIx] = true;
        }
    }

    if (audioCtx !== null) {
        if (newBeat && sequence[currentBeatIx]) {
            synth.gain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.01);
            synth.gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.1);
        }
    }
    
    if (playerDir.x !== 0 || playerDir.y !== 0) {
        playerPos = add(playerPos, scale(normalized(playerDir), playerSpeed * dt));
        playerPos.x = Math.max(Math.min(playerPos.x, bounds.max.x), bounds.min.x);
        playerPos.y = Math.max(Math.min(playerPos.y, bounds.max.y), bounds.min.y);
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill bg
    canvasCtx.fillStyle = 'grey';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Player
    canvasCtx.fillStyle = 'red';
    canvasCtx.fillRect(playerPos.x - 0.5*playerSize,
                       canvas.height - playerPos.y - 0.5*playerSize,
                       playerSize, playerSize);

    // Draw Enemies
    canvasCtx.fillStyle = 'green';
    for (i = 0; i < enemies.length; ++i) {
        let e = enemies[i];
        canvasCtx.fillRect(e.pos.x - 0.5*enemySize,
                           canvas.height - e.pos.y - 0.5*enemySize,
                           enemySize, enemySize);
    }

    window.requestAnimationFrame(update);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.requestAnimationFrame(update);