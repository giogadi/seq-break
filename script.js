function generateRandomEnemies(numBeats, numEnemies, bounds) {
    let enemies = []
    const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
    // const possibleNotes = [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A];
    for (i = 0; i < numEnemies; ++i) {
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 3);
        // Example code for making enemies vulnerable at certain times, and they syncopate with each other.
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
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: false
        });
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
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: false
        });
        enemies.push({
            pos: rand2dInBounds(bounds),
            seq: sequence,
            synth_ix: 1,
            color: 'darkgoldenrod',
            alive: true
        });
    }
    for (i = 0; i < numEnemies; ++i) {
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: true
        });
        enemies.push({
            pos: rand2dInBounds(bounds),
            seq: sequence,
            synth_ix: 2,
            color: 'purple',
            alive: true
        });
    }
    return enemies;
}

class GameState {
    constructor(canvas, sound, tileSetImg) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sound = sound;

        this.playerSpeed = canvas.width / 2.5;
        this.playerSize = canvas.width  / 20.0;
        let b = this.bounds();
        this.playerPos = vecScale(vecAdd(b.min, b.max), 0.5);
        this.playerHeading = 0.0;

        this.BPM = 4 * 120.0;
        this.SECONDS_PER_BEAT = 60.0 / this.BPM;
        this.NUM_BEATS = 16;
        this.LOOP_TIME = this.NUM_BEATS * this.SECONDS_PER_BEAT;

        this.NUM_SYNTHS = 3;

        this.kickSequence = new Array(this.NUM_BEATS).fill(false);
        this.kickSequence[0] = this.kickSequence[4] = this.kickSequence[8] = this.kickSequence[12] = true;

        this.sequences = new Array(this.NUM_SYNTHS);
        for (let i = 0; i < this.NUM_SYNTHS; ++i) {
            this.sequences[i] = new Array(this.NUM_BEATS).fill({
                note: -1,
                sustain: false
            });
        }

        this.loopElapsedTime = 0.0;
        this.currentBeatIx = -1;

        this.enemySize = this.canvas.width / 20.0;
        this.enemies = generateRandomEnemies(this.NUM_BEATS, 10, b);

        this.controlDir = { x: 0.0, y: 0.0 };
        this.slashPressed = false;
        this.sustaining = false;
        this.scanning = false;

        this.prevTimeMillis = -1.0;

        // TEST
        let tileSetWidthTiles = 30;
        let tileSetHeightTiles = 32;
        let desiredPxPerTile = 100.0;
        this.tileSetCanvas = new OffscreenCanvas(tileSetWidthTiles * desiredPxPerTile, tileSetHeightTiles * desiredPxPerTile);
        this.tileSetCanvasCtx = this.tileSetCanvas.getContext('2d');
        this.tileSetCanvasCtx.mozImageSmoothingEnabled = false;
        this.tileSetCanvasCtx.webkitImageSmoothingEnabled = false;
        this.tileSetCanvasCtx.msImageSmoothingEnabled = false;
        this.tileSetCanvasCtx.imageSmoothingEnabled = false;
        this.tileSetCanvasCtx.drawImage(event.target, 0, 0, tileSetWidthTiles * desiredPxPerTile, tileSetHeightTiles * desiredPxPerTile);
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    bounds() {
        return {
            min: { x: 0.0, y: 0.0 },
            max: { x: canvas.width, y: canvas.height }
        }
    }
    onKeyDown(event) {
        if (event.repeat) {
            return;
        }
        switch (event.key) {
            case "w": this.controlDir.y -= 1.0; break;
            case "s": this.controlDir.y += 1.0; break;
            case "a": this.controlDir.x -= 1.0; break;
            case "d": this.controlDir.x += 1.0; break;
            case "j": this.slashPressed = true; break;
            case "k": this.scanning = true; break;
            case "l": this.sustaining = true; break;
        }
    }
    onKeyUp(event) {
        switch (event.key) {
            case "w": this.controlDir.y += 1.0; break;
            case "s": this.controlDir.y -= 1.0; break;
            case "a": this.controlDir.x += 1.0; break;
            case "d": this.controlDir.x -= 1.0; break;
            case "k": this.scanning = false; break;
            case "l": this.sustaining = false; break;
        }
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

function update(g, timeMillis) {
    if (g.prevTimeMillis < 0.0) {
        g.prevTimeMillis = timeMillis;
    }
    let dt = (timeMillis - g.prevTimeMillis) * 0.001;
    g.prevTimeMillis = timeMillis;

    g.loopElapsedTime += dt;
    if (g.loopElapsedTime >= g.LOOP_TIME) {
        // TODO: Can this cause inaccuracies/drift?
        g.loopElapsedTime = 0.0;
    }

    let newBeat = false;
    {
        let newBeatIx = Math.floor((g.loopElapsedTime / g.LOOP_TIME) * g.NUM_BEATS);
        console.assert(newBeatIx < g.NUM_BEATS);
        if (newBeatIx !== g.currentBeatIx) {
            newBeat = true;
            g.currentBeatIx = newBeatIx;
        }
    }

    let hitBox = null;
    let enemyHitBoxes = [];
    if (g.slashPressed || g.sustaining) {
        let headingVec = {
            x: Math.cos(g.playerHeading),
            y: Math.sin(g.playerHeading)
        };
        let leftVec = rotate90Ccw(headingVec);
        let front = vecScale(headingVec, 0.5*g.playerSize + g.playerSize);
        let back = vecScale(headingVec, 0.5*g.playerSize);
        let left = vecScale(leftVec, g.playerSize);
        let right = vecScale(left, -1.0);
        let frontLeft = vecAdd(g.playerPos, vecAdd(front, left));
        let backLeft = vecAdd(g.playerPos, vecAdd(back, left));
        let backRight = vecAdd(g.playerPos, vecAdd(back, right));
        let frontRight = vecAdd(g.playerPos, vecAdd(front, right));
        hitBox = [frontLeft, backLeft, backRight, frontRight];

        for (let i = 0; i < g.enemies.length; ++i) {
            let e = g.enemies[i];
            let s = 0.5*g.enemySize;
            let enemyHitBox = [
                vecAdd(e.pos, { x: -s, y: s }),
                vecAdd(e.pos, { x: -s, y: -s }),
                vecAdd(e.pos, { x: s, y: -s }),
                vecAdd(e.pos, { x: s, y: s })
            ];
            enemyHitBoxes.push(enemyHitBox);
            if (!e.alive) {
                continue;
            }
            if (doConvexPolygonsOverlap(hitBox, enemyHitBox) && e.seq[g.currentBeatIx].note >= 0) {
                let hitIx = (g.currentBeatIx + 1) % g.NUM_BEATS;
                g.sequences[e.synth_ix][hitIx] = e.seq[g.currentBeatIx];
                if (e.synth_ix !== 2) {
                    e.alive = false;
                }
            }
        }
    }

    // Find nearest enemy (of each type)
    let nearestEnemies = new Array(g.NUM_SYNTHS).fill(-1);
    let nearestDists = new Array(g.NUM_SYNTHS).fill(-1);
    if (g.scanning) {
        for (let i = 0; i < g.enemies.length; ++i) {
            let e = g.enemies[i];
            if (!e.alive) {
                continue;
            }
            let d = vecNorm(vecAdd(e.pos, vecScale(g.playerPos, -1.0)));
            if (nearestEnemies[e.synth_ix] == -1 ||
                d < nearestDists[e.synth_ix]) {
                nearestEnemies[e.synth_ix] = i;
                nearestDists[e.synth_ix] = d;
            }
        }
    }

    if (newBeat) {
        for (let i = 0; i < g.NUM_SYNTHS; ++i) {
            if (g.sequences[i][g.currentBeatIx].note >= 0) {
                synthPlayVoice(
                    g.sound.synths[i], 0, g.sequences[i][g.currentBeatIx].note,
                    g.sequences[i][g.currentBeatIx].sustain, g.sound.audioCtx);
            } else {
                synthReleaseVoice(g.sound.synths[i], 0, g.sound.audioCtx);
            }

            if (nearestEnemies[i] >= 0) {
                let e = g.enemies[nearestEnemies[i]];
                if (e.seq[g.currentBeatIx].note >= 0) {
                    synthPlayVoice(
                        g.sound.auxSynths[i], 0, e.seq[g.currentBeatIx].note,
                        e.seq[g.currentBeatIx].sustain, g.sound.audioCtx);
                } else {
                    synthReleaseVoice(g.sound.auxSynths[i], 0, g.sound.audioCtx);
                }
            } else {
                synthReleaseVoice(g.sound.auxSynths[i], 0, g.sound.audioCtx);
            }
        }
        if (g.kickSequence[g.currentBeatIx]) {
            playSoundFromBuffer(g.sound.audioCtx, g.sound.drumSounds[0]);
        }
    }

    let bounds = g.bounds();
    if (g.controlDir.x !== 0 || g.controlDir.y !== 0) {
        g.playerPos = vecAdd(
            g.playerPos, vecScale(vecNormalized(g.controlDir), g.playerSpeed * dt));
        g.playerPos.x = Math.max(Math.min(g.playerPos.x, bounds.max.x), bounds.min.x);
        g.playerPos.y = Math.max(Math.min(g.playerPos.y, bounds.max.y), bounds.min.y);
        g.playerHeading = Math.atan2(g.controlDir.y, g.controlDir.x);
    }

    g.canvasCtx.fillStyle = 'grey';
    g.canvasCtx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    // TEST
    let tiles = [32, 34, 34, 34, 34, 33, 34, 35, 62, 64, 65, 64, 62, 63, 65, 64, 122, 129, 130, 131, 129, 131, 131, 180, 151, 184, 183, 184, 182, 185, 189, 135, 151, 183, 183, 188, 183, 184, 185, 136, 151, 183, 183, 185, 183, 186, 185, 135];
    for (let i = 0; i < 8; ++i) {
        for (let j = 0; j < 6; ++j) {
            let tileIdx = tiles[j*8 + i] - 1;
            let tile_j = Math.floor(tileIdx / 30);
            let tile_i = tileIdx % 30;
            g.canvasCtx.drawImage(g.tileSetCanvas, tile_i * 100, tile_j * 100, 100, 100, i*100, j*100, 100, 100);
        }
    }

    // Draw Player
    g.canvasCtx.save();
    g.canvasCtx.fillStyle = 'red';
    g.canvasCtx.translate(g.playerPos.x, g.playerPos.y);
    g.canvasCtx.rotate(g.playerHeading);
    g.canvasCtx.translate(-g.playerPos.x, -g.playerPos.y);
    g.canvasCtx.fillRect(g.playerPos.x - 0.5*g.playerSize,
                            g.playerPos.y - 0.5*g.playerSize,
                            g.playerSize, g.playerSize);
    g.canvasCtx.translate(g.playerPos.x, g.playerPos.y);
    const EYE_SIZE = 0.25*g.playerSize;
    g.canvasCtx.fillStyle = 'black';
    g.canvasCtx.fillRect(0.5*g.playerSize - EYE_SIZE, -0.5*EYE_SIZE, EYE_SIZE, EYE_SIZE);
    g.canvasCtx.restore();

    // Draw Enemies
    g.canvasCtx.strokeStyle = 'white';
    for (i = 0; i < g.enemies.length; ++i) {
        let e = g.enemies[i];
        if (!e.alive) {
            continue;
        }
        g.canvasCtx.fillStyle = e.color;
        g.canvasCtx.fillRect(e.pos.x - 0.5*g.enemySize,
                                e.pos.y - 0.5*g.enemySize,
                                g.enemySize, g.enemySize);
        if (e.seq[g.currentBeatIx] < 0) {
            // draw a barrier
            g.canvasCtx.strokeRect(
                e.pos.x - 0.6*g.enemySize,
                e.pos.y - 0.6*g.enemySize,
                1.2*g.enemySize, 1.2*g.enemySize);
        }
        let isAClosestEnemy = false;
        for (let j = 0; j < nearestEnemies.length; ++j) {
            if (nearestEnemies[j] == i) {
                isAClosestEnemy = true;
            }
        }
        if (isAClosestEnemy) {
            g.canvasCtx.fillStyle = 'black';
            g.canvasCtx.fillRect(
                e.pos.x - 0.05*g.enemySize,
                e.pos.y - 0.05*g.enemySize,
                0.1*g.enemySize, 0.1*g.enemySize);
        }
        if (g.slashPressed) {
            let hb = enemyHitBoxes[i];
            g.canvasCtx.beginPath();
            g.canvasCtx.moveTo(hb[hb.length - 1].x, hb[hb.length - 1].y);
            for (let i = 0; i < hb.length; ++i) {
                g.canvasCtx.lineTo(hb[i].x, hb[i].y);
            }
            g.canvasCtx.stroke();
        }
    }

    // Draw slash
    if (g.slashPressed) {
        g.canvas.strokeStyle = 'black';
        console.assert(hitBox !== null);
        g.canvasCtx.beginPath();
        g.canvasCtx.moveTo(hitBox[hitBox.length - 1].x, hitBox[hitBox.length - 1].y);
        for (let i = 0; i < hitBox.length; ++i) {
            g.canvasCtx.lineTo(hitBox[i].x, hitBox[i].y);
        }
        g.canvasCtx.stroke();
    }

    drawSequence(g.canvasCtx, g.NUM_BEATS, g.currentBeatIx, g.canvas.width, g.canvas.height);

    g.slashPressed = false;

    window.requestAnimationFrame((t) => update(g, t));
}

async function main() {
    // Wait for user to press a key
    let msg = document.getElementById('message');
    // TODO: figure out how to make this work with a specific key (like Space).
    msg.innerHTML = 'Please press Spacebar.';
    const waitForAnyKey = () =>
        new Promise((resolve) => {
            window.addEventListener('keydown', () => resolve(), {once: true});
        });
    await waitForAnyKey();
    msg.innerHTML = '';

    let sound = await initSound();

    let tileSetImg = new Image();
    const waitForImgLoad = () =>
        new Promise((resolve) => {
            tileSetImg.addEventListener('load', () => resolve(), {once: true});
        });
    tileSetImg.src = 'tiles/dungeon tileset calciumtrice simple.png';
    await waitForImgLoad();

    let canvas = document.getElementById('canvas');
    
    let gameState = new GameState(canvas, sound, tileSetImg);

    window.requestAnimationFrame((t) => update(gameState, t));
}

main();