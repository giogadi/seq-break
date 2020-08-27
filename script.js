// VECTOR STUFF
function dot(u, v) {
    return u.x*v.x + u.y*v.y;
}

function norm(v) {
    return Math.sqrt(dot(v, v));
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

// 90 degrees rotated counter-clockwise from v.
function rotate90Ccw(v) {
    return { x: -v.y, y: v.x };
}

function rand2dInBounds(bounds) {
    return {
        x: bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
        y: bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y)
    };
}

// Positive if point is on same side of plane as plane's normal vec
function pointPlaneSignedDist(p, plane_p, plane_n) {
    return dot(add(p, scale(plane_p, -1.0)), plane_n);
}

// poly's are arrays of 2d points (ccw)
function findSeparatingPlaneInPoly1Faces(poly1, poly2) {
    // poly1 faces to poly2 points
    for (let i = 0; i < poly1.length; ++i) {
        let u = poly1[i];
        let v = (i == 0) ? poly1[poly1.length - 1] : poly1[i - 1];
        let face_n = rotate90Ccw(add(v, scale(u, -1.0)));
        let valid_sep_plane = true;
        for (let j = 0; j < poly2.length; ++j) {
            if (pointPlaneSignedDist(poly2[j], u, face_n) <= 0.0) {
                valid_sep_plane = false;
                break;
            }
        }
        if (valid_sep_plane) {
            return true;
        }
    }
    return false;
}

function doConvexPolygonsOverlap(poly1, poly2) {
    return !findSeparatingPlaneInPoly1Faces(poly1, poly2) &&
           !findSeparatingPlaneInPoly1Faces(poly2, poly1);
}

// SOUND SHIT
const BASE_FREQS = [
    55.0000, // A
    58.2705, // A#
    61.7354, // B
    65.4064, // C
    69.2957, // C#
    73.4162, // D
    77.7817, // D#
    82.4069, // E
    87.3071, // F
    92.4986, // F#
    97.9989, // G
    103.826, // G#
];

const NOTES = {
    A: 0,
    A_S: 1,
    B_F: 1,
    B: 2,
    C: 3,
    C_S: 4,
    D_F: 4,
    D: 5,
    D_S: 6,
    E_F: 6,
    E: 7,
    F: 8,
    F_S: 9,
    G_F: 9,
    G: 10,
    G_S: 11,
    A_F: 11
};

function getFreq(note, octave) {
    return BASE_FREQS[note] * (1 << octave);
}

function initSynth(audioCtx) {
    let osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(getFreq(NOTES.A, 3), audioCtx.currentTime);
    filterNode = audioCtx.createBiquadFilter();
    osc.connect(filterNode);
    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    filterNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    return {
        osc: osc,
        filter: filterNode,
        gain: gainNode
    };
}

function getSoundData(filename) {
    return new Promise(function(resolve, reject) {
        let request = new XMLHttpRequest();
        request.open(
            'GET', 'http://' + window.location.hostname + ":80/" + filename);
        request.responseType = 'arraybuffer';
        request.onload = function() {
            resolve(request.response);
        }
        request.onerror = function() {
            reject(request.statusText);
        }
        request.send();
    });
}

function initSound(numSynths) {
    let soundNames = ['kick', 'snare'];
    let sounds = soundNames.map(function(soundName) {
        return getSoundData(soundName + '.wav')
    });
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return Promise.all(sounds).then(function(loadedSounds) {
        return Promise.all(loadedSounds.map(function(loadedSound) {
            return audioCtx.decodeAudioData(loadedSound);
        }));
    }).then(function(decodedSounds) {
        let synths = [];
        for (let i = 0; i < numSynths; ++i) {
            synths.push(initSynth(audioCtx));
        }
        let auxSynths = [];
        for (let i = 0; i < numSynths; ++i) {
            auxSynths.push(initSynth(audioCtx));
        }
        return {
            audioCtx: audioCtx,
            drumSounds: decodedSounds,
            synths: synths,
            auxSynths: auxSynths
        }
    });
}

function playSoundFromBuffer(audioCtx, buffer) {
    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}

// OTHER
function generateRandomEnemies(numBeats, numEnemies, bounds) {
    let enemies = []
    const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
    // const possibleNotes = [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A];
    for (i = 0; i < numEnemies; ++i) {
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 3);
        // let sequence = new Array(numBeats).fill(-1);
        // if (i % 2 == 0) {
        //     // Down-beats
        //     for (let j = 0; j < sequence.length; j += 4) {
        //         sequence[j] = sequence[j+1] = randomNote;
        //     }
        // } else {
        //     // Up-beats
        //     for (let j = 2; j < sequence.length; j += 4) {
        //         sequence[j] = sequence[j+1] = randomNote;
        //     }
        // }
        let sequence = new Array(numBeats).fill(randomNote);
        enemies.push({
            pos: rand2dInBounds(bounds),
            seq: sequence,
            synth_ix: 0,
            color: 'green',
            alive: true
        });
    }
    for (i = 0; i < numEnemies; ++i) {
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 1);
        let sequence = new Array(numBeats).fill(randomNote);
        enemies.push({
            pos: rand2dInBounds(bounds),
            seq: sequence,
            synth_ix: 1,
            color: 'darkgoldenrod',
            alive: true
        });
    }
    return enemies;
}

// GLOBAL STATE
let canvas = document.getElementById("canvas");
let canvasCtx = canvas.getContext('2d');

let sound = null;
let soundInitStarted = false;
function sound_init_callback(s) {
    sound = s;
    console.log(s);
} 

let NUM_SYNTHS = 2;

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
let playerHeading = 0.0;

let movementDir = { x: 0, y: 0 };
let prevTimeMillis = -1.0;

let slashPressed = false;
let scanning = false;

const BPM = 4 * 120.0;
const SECONDS_PER_BEAT = 60.0 / BPM;
const NUM_BEATS = 16;
const LOOP_TIME = NUM_BEATS * SECONDS_PER_BEAT;
let kickSequence = new Array(NUM_BEATS).fill(false);
kickSequence[0] = kickSequence[4] = kickSequence[8] = kickSequence[12] = true;
let sequences = new Array(NUM_SYNTHS);
for (let i = 0; i < NUM_SYNTHS; ++i) {
    sequences[i] = new Array(NUM_BEATS).fill(-1);
}
let loopElapsedTime = 0.0;
let currentBeatIx = -1;

const enemySize = canvas.width / 20.0;
let enemies = generateRandomEnemies(NUM_BEATS, 10, bounds);

// EVENT HANDLING
function onKeyDown(event) {
    if (!soundInitStarted) {
        soundInitStarted = true;
        initSound(NUM_SYNTHS).then(sound_init_callback);
    }
    if (event.repeat) {
        return;
    }
    switch (event.key) {
        case "w": movementDir.y -= 1.0; break;
        case "s": movementDir.y += 1.0; break;
        case "a": movementDir.x -= 1.0; break;
        case "d": movementDir.x += 1.0; break;
        case "j": slashPressed = true; break;
        case "k": scanning = true; break;
    }
}

function onKeyUp(event) {
    if (event.repeat) {
        return;
    }
    switch (event.key) {
        case "w": movementDir.y += 1.0; break;
        case "s": movementDir.y -= 1.0; break;
        case "a": movementDir.x += 1.0; break;
        case "d": movementDir.x -= 1.0; break;
        case "k": scanning = false; break;
    }
}

// TODO: This doesn't actually center the cells horizontally but it's whatever.
function drawSequence(canvasCtx, numBeats, currentBeatIx, canvasWidth, canvasHeight) {    
    let widthPadding = 0.1 * canvasWidth;
    let cellSize = canvasWidth / 25.0;
    let cellSpacing = (canvasWidth - (2 * widthPadding)) / numBeats;
    let heightPadding = 0.1 * canvasHeight;
    let currentPos = {
        x: widthPadding,
        y: canvasHeight - heightPadding - cellSize
    };
    for (i = 0; i < numBeats; ++i) {
        if (i == currentBeatIx) {
            canvasCtx.fillStyle = 'blue';
        } else {
            canvasCtx.fillStyle = 'white';
        }
        canvasCtx.fillRect(currentPos.x, currentPos.y, cellSize, cellSize);
        currentPos.x += cellSpacing;
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

    let hitBox = null;
    let enemyHitBoxes = [];
    if (slashPressed) {
        let headingVec = {
            x: Math.cos(playerHeading),
            y: Math.sin(playerHeading)
        };
        let leftVec = rotate90Ccw(headingVec);
        let front = scale(headingVec, 0.5*playerSize + playerSize);
        let back = scale(headingVec, 0.5*playerSize);
        let left = scale(leftVec, playerSize);
        let right = scale(left, -1.0);
        let frontLeft = add(playerPos, add(front, left));
        let backLeft = add(playerPos, add(back, left));
        let backRight = add(playerPos, add(back, right));
        let frontRight = add(playerPos, add(front, right));
        hitBox = [frontLeft, backLeft, backRight, frontRight];

        for (let i = 0; i < enemies.length; ++i) {
            let e = enemies[i];
            let s = 0.5*enemySize;
            let enemyHitBox = [
                add(e.pos, { x: -s, y: s }),
                add(e.pos, { x: -s, y: -s }),
                add(e.pos, { x: s, y: -s }),
                add(e.pos, { x: s, y: s })
            ];
            enemyHitBoxes.push(enemyHitBox);
            if (!e.alive) {
                continue;
            }
            if (doConvexPolygonsOverlap(hitBox, enemyHitBox) && e.seq[currentBeatIx] >= 0) {
                let hitIx = (currentBeatIx + 1) % NUM_BEATS;
                sequences[e.synth_ix][hitIx] = e.seq[currentBeatIx];
                e.alive = false;
            }
        }
    }

    // Find nearest enemy (of each type)
    let nearestEnemies = new Array(NUM_SYNTHS).fill(-1);
    let nearestDists = new Array(NUM_SYNTHS).fill(-1);
    if (scanning) {
        for (let i = 0; i < enemies.length; ++i) {
            let e = enemies[i];
            if (!e.alive) {
                continue;
            }
            let d = norm(add(e.pos, scale(playerPos, -1.0)));
            if (nearestEnemies[e.synth_ix] == -1 ||
                d < nearestDists[e.synth_ix]) {
                nearestEnemies[e.synth_ix] = i;
                nearestDists[e.synth_ix] = d;
            }
        }
    }

    if (sound !== null && newBeat) {
        console.assert(sound.synths.length == NUM_SYNTHS, sound.synths.length);
        for (let i = 0; i < NUM_SYNTHS; ++i) {
            if (sequences[i][currentBeatIx] >= 0) {
                sound.synths[i].osc.frequency.setValueAtTime(sequences[i][currentBeatIx], sound.audioCtx.currentTime);
                sound.synths[i].gain.gain.linearRampToValueAtTime(1.0, sound.audioCtx.currentTime + 0.01);
                sound.synths[i].gain.gain.linearRampToValueAtTime(0.0, sound.audioCtx.currentTime + 0.1);
            }

            if (nearestEnemies[i] >= 0) {
                let e = enemies[nearestEnemies[i]];
                if (e.seq[currentBeatIx] >= 0) {
                    sound.auxSynths[i].osc.frequency.setValueAtTime(e.seq[currentBeatIx], sound.audioCtx.currentTime);
                    sound.auxSynths[i].gain.gain.linearRampToValueAtTime(1.0, sound.audioCtx.currentTime + 0.01);
                    sound.auxSynths[i].gain.gain.linearRampToValueAtTime(0.0, sound.audioCtx.currentTime + 0.1);
                }
            }
        }
        if (kickSequence[currentBeatIx]) {
            playSoundFromBuffer(sound.audioCtx, sound.drumSounds[0]);
        }
    }
    
    if (movementDir.x !== 0 || movementDir.y !== 0) {
        playerPos = add(playerPos, scale(normalized(movementDir), playerSpeed * dt));
        playerPos.x = Math.max(Math.min(playerPos.x, bounds.max.x), bounds.min.x);
        playerPos.y = Math.max(Math.min(playerPos.y, bounds.max.y), bounds.min.y);
        playerHeading = Math.atan2(movementDir.y, movementDir.x);
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill bg
    canvasCtx.fillStyle = 'grey';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Player
    canvasCtx.save();
    canvasCtx.fillStyle = 'red';
    canvasCtx.translate(playerPos.x, playerPos.y);
    canvasCtx.rotate(playerHeading);
    canvasCtx.translate(-playerPos.x, -playerPos.y);
    canvasCtx.fillRect(playerPos.x - 0.5*playerSize,
                       playerPos.y - 0.5*playerSize,
                       playerSize, playerSize);
    canvasCtx.translate(playerPos.x, playerPos.y);
    const EYE_SIZE = 0.25*playerSize;
    canvasCtx.fillStyle = 'black';
    canvasCtx.fillRect(0.5*playerSize - EYE_SIZE, -0.5*EYE_SIZE, EYE_SIZE, EYE_SIZE);
    canvasCtx.restore();

    // Draw Enemies
    canvasCtx.strokeStyle = 'white';
    for (i = 0; i < enemies.length; ++i) {
        let e = enemies[i];
        if (!e.alive) {
            continue;
        }
        canvasCtx.fillStyle = e.color;
        canvasCtx.fillRect(e.pos.x - 0.5*enemySize,
                           e.pos.y - 0.5*enemySize,
                           enemySize, enemySize);
        if (e.seq[currentBeatIx] < 0) {
            // draw a barrier
            canvasCtx.strokeRect(
                e.pos.x - 0.6*enemySize,
                e.pos.y - 0.6*enemySize,
                1.2*enemySize, 1.2*enemySize);
        }
        let isAClosestEnemy = false;
        for (let j = 0; j < nearestEnemies.length; ++j) {
            if (nearestEnemies[j] == i) {
                isAClosestEnemy = true;
            }
        }
        if (isAClosestEnemy) {
            canvasCtx.fillStyle = 'black';
            canvasCtx.fillRect(
                e.pos.x - 0.05*enemySize,
                e.pos.y - 0.05*enemySize,
                0.1*enemySize, 0.1*enemySize);
        }
        if (slashPressed) {
            let hb = enemyHitBoxes[i];
            canvasCtx.beginPath();
            canvasCtx.moveTo(hb[hb.length - 1].x, hb[hb.length - 1].y);
            for (let i = 0; i < hb.length; ++i) {
                canvasCtx.lineTo(hb[i].x, hb[i].y);
            }
            canvasCtx.stroke();
        }
    }

    // Draw slash
    if (slashPressed) {
        canvas.strokeStyle = 'black';
        console.assert(hitBox !== null);
        canvasCtx.beginPath();
        canvasCtx.moveTo(hitBox[hitBox.length - 1].x, hitBox[hitBox.length - 1].y);
        for (let i = 0; i < hitBox.length; ++i) {
            canvasCtx.lineTo(hitBox[i].x, hitBox[i].y);
        }
        canvasCtx.stroke();
    }

    drawSequence(canvasCtx, NUM_BEATS, currentBeatIx, canvas.width, canvas.height);

    slashPressed = false;
    window.requestAnimationFrame(update);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.requestAnimationFrame(update);