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
    // for (i = 0; i < numEnemies; ++i) {
    //     let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
    //     let sequence = new Array(numBeats).fill({
    //         note: randomNote,
    //         sustain: true
    //     });
    //     enemies.push({
    //         pos: rand2dInBounds(bounds),
    //         seq: sequence,
    //         synth_ix: 2,
    //         color: 'purple',
    //         alive: true
    //     });
    // }
    return enemies;
}

class GameState {
    constructor(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sound = sound;
        this.tileSet = tileSet;
        this.tileMapInfo = tileMapInfo;

        this.pixelsPerUnit = pixelsPerUnit;
        this.widthInUnits = this.canvas.width / this.pixelsPerUnit;
        this.heightInUnits = this.canvas.height / this.pixelsPerUnit;

        this.playerSpeed = this.widthInUnits / 2.5;
        this.playerSize = this.widthInUnits / 20.0;
        this.playerPos = this.tileMapInfo.start;
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

        this.enemySize = this.widthInUnits / 20.0;
        this.enemies = [];

        this.controlDir = { x: 0.0, y: 0.0 };
        this.slashPressed = false;
        this.sustaining = false;
        this.scanning = false;

        this.prevTimeMillis = -1.0;

        this.roomLogic = new KillAllEnemiesRoomLogic(this, this.tileMapInfo.room, 10);
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
    bounds() {
        return {
            min: { x: 0.0, y: 0.0 },
            max: { x: this.tileMapInfo.width, y: this.tileMapInfo.height }
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

    if (g.roomLogic !== null) {
        g.roomLogic.update();
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

    let tileMap = g.tileMapInfo.info.layers[0];

    let bounds = g.bounds();
    if (g.controlDir.x !== 0 || g.controlDir.y !== 0) {
        let oldPos = g.playerPos;
        let newPos = vecAdd(
            g.playerPos, vecScale(vecNormalized(g.controlDir), g.playerSpeed * dt));
        let minTileOverlap = {
            x: Math.max(0, Math.floor(newPos.x - 0.5*g.playerSize)),
            y: Math.max(0, Math.floor(newPos.y - 0.5*g.playerSize))
        };
        let maxTileOverlap = {
            x: Math.min(tileMap.width-1, Math.floor(newPos.x + 0.5*g.playerSize)),
            y: Math.min(tileMap.height-1, Math.floor(newPos.y + 0.5*g.playerSize))
        };
        let collided = false;
        for (let col = minTileOverlap.x; col <= maxTileOverlap.x && !collided; ++col) {
            for (let row = minTileOverlap.y; row <= maxTileOverlap.y && !collided; ++row) {
                let tileSetIdx = tileMap.data[row*tileMap.width + col] - 1;
                if (g.tileSet.collisions[tileSetIdx]) {
                    collided = true;
                }
            }
        }
        if (!collided) {
            g.playerPos = newPos;
        }
        g.playerHeading = Math.atan2(g.controlDir.y, g.controlDir.x);
    }

    g.canvasCtx.fillStyle = 'grey';
    g.canvasCtx.fillRect(0, 0, g.canvas.width, g.canvas.height);    

    // View transform
    g.canvasCtx.save();
    let centerPosPx = { x: Math.floor(0.5 * g.canvas.width), y: Math.floor(0.5 * g.canvas.height) };
    let cameraPx = { x: Math.floor(g.playerPos.x * g.pixelsPerUnit), y: Math.floor(g.playerPos.y * g.pixelsPerUnit) };
    let centerToCamera = vecAdd(cameraPx, vecScale(centerPosPx, -1.0));
    g.canvasCtx.translate(-centerToCamera.x, -centerToCamera.y);

    // Draw map.
    let ppt = g.tileSet.ppt;
    for (let col = 0; col < tileMap.width; ++col) {
        for (let row = 0; row < tileMap.height; ++row) {
            let tileIdx = tileMap.data[row*tileMap.width + col] - 1;
            let tile_j = Math.floor(tileIdx / g.tileSet.info.columns);
            let tile_i = tileIdx % g.tileSet.info.columns;
            // TODO: is this call doing scaling? Scaling is costly and we want to avoid it if possible.
            g.canvasCtx.drawImage(g.tileSet.canvas, tile_i * ppt, tile_j * ppt, ppt, ppt, col*ppt, row*ppt, ppt, ppt);
        }
    }

    // TODO for all drawing code: try to make all the pixel values integers to avoid the subpixel stuff 
    // javascript does.

    // Draw Player
    let playerPosPx = vecScale(g.playerPos, g.pixelsPerUnit);
    let playerSizePx = g.playerSize * g.pixelsPerUnit;
    g.canvasCtx.save();
    g.canvasCtx.fillStyle = 'red';
    g.canvasCtx.translate(playerPosPx.x, playerPosPx.y);
    g.canvasCtx.rotate(g.playerHeading);
    g.canvasCtx.translate(-playerPosPx.x, -playerPosPx.y);
    g.canvasCtx.fillRect(playerPosPx.x - 0.5*playerSizePx,
                         playerPosPx.y - 0.5*playerSizePx,
                         playerSizePx, playerSizePx);
    g.canvasCtx.translate(playerPosPx.x, playerPosPx.y);
    const EYE_SIZE = 0.25*playerSizePx;
    g.canvasCtx.fillStyle = 'black';
    g.canvasCtx.fillRect(0.5*playerSizePx - EYE_SIZE, -0.5*EYE_SIZE, EYE_SIZE, EYE_SIZE);
    g.canvasCtx.restore();

    // Draw Enemies
    g.canvasCtx.strokeStyle = 'white';
    for (i = 0; i < g.enemies.length; ++i) {
        let e = g.enemies[i];
        if (!e.alive) {
            continue;
        }
        let posPx = vecScale(e.pos, g.pixelsPerUnit);
        let sizePx = g.enemySize * g.pixelsPerUnit;
        g.canvasCtx.fillStyle = e.color;
        g.canvasCtx.fillRect(
            posPx.x - 0.5*sizePx,
            posPx.y - 0.5*sizePx,
            sizePx, sizePx);
        if (e.seq[g.currentBeatIx] < 0) {
            // draw a barrier
            g.canvasCtx.strokeRect(
                posPx.x - 0.6*sizePx,
                posPx.y - 0.6*sizePx,
                1.2*sizePx, 1.2*sizePx);
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
                posPx.x - 0.05*sizePx,
                posPx.y - 0.05*sizePx,
                0.1*sizePx, 0.1*sizePx);
        }
        if (g.slashPressed) {
            let hb = enemyHitBoxes[i];
            let hbPx = [];
            for (let j = 0; j < hb.length; ++j) {
                hbPx.push(vecScale(hb[j], g.pixelsPerUnit));
            }
            g.canvasCtx.beginPath();
            g.canvasCtx.moveTo(hbPx[hbPx.length - 1].x, hbPx[hbPx.length - 1].y);
            for (let j = 0; j < hbPx.length; ++j) {
                g.canvasCtx.lineTo(hbPx[j].x, hbPx[j].y);
            }
            g.canvasCtx.stroke();
        }
    }

    // Draw slash
    if (g.slashPressed) {
        g.canvas.strokeStyle = 'black';
        console.assert(hitBox !== null);
        let hbPx = [];
        for (let j = 0; j < hitBox.length; ++j) {
            hbPx.push(vecScale(hitBox[j], g.pixelsPerUnit));
        }
        g.canvasCtx.beginPath();
        g.canvasCtx.moveTo(hbPx[hbPx.length - 1].x, hbPx[hbPx.length - 1].y);
        for (let j = 0; j < hbPx.length; ++j) {
            g.canvasCtx.lineTo(hbPx[j].x, hbPx[j].y);
        }
        g.canvasCtx.stroke();
    }

    g.canvasCtx.restore();

    drawSequence(g.canvasCtx, g.NUM_BEATS, g.currentBeatIx, g.canvas.width, g.canvas.height);

    g.slashPressed = false;

    window.requestAnimationFrame((t) => update(g, t));
}

// For now, assume we instantiate this when the room has been entered by the player.
class KillAllEnemiesRoomLogic {
    constructor(gameState, roomSpec, numEnemiesPerType) {
        this.gameState = gameState;
        this.roomSpec = roomSpec;
        this.numEnemiesPerType = numEnemiesPerType;
        // 0: untriggered
        // 1: waiting for enemies to die
        // 2: unlocked/finished
        this.state = 0;
    }
    untriggeredLogic() {
        if (!isPointInBounds(this.gameState.playerPos, this.roomSpec.bounds)) {
            return;
        }
        this.gameState.enemies = generateRandomEnemies(
            this.gameState.NUM_BEATS, this.numEnemiesPerType, this.roomSpec.bounds);
        const DOOR_TILE_ID = 205 + 1;
        for (let doorIx = 0; doorIx < this.roomSpec.doorLocations.length; ++doorIx) {
            let loc = this.roomSpec.doorLocations[doorIx];
            setTile(this.gameState.tileMapInfo, loc.x, loc.y, DOOR_TILE_ID);
        }
        this.state = 1;
    }
    triggeredLogic() {
        for (let eIx = 0; eIx < this.gameState.enemies.length; ++eIx) {
            if (this.gameState.enemies[eIx].alive) {
                return;
            }
        }
        const OPEN_TILE_ID = 6 + 1;
        for (let doorIx = 0; doorIx < this.roomSpec.doorLocations.length; ++doorIx) {
            let loc = this.roomSpec.doorLocations[doorIx];
            setTile(this.gameState.tileMapInfo, loc.x, loc.y, OPEN_TILE_ID);
        }
        this.state = 2;
    }
    update() {
        switch (this.state) {
            case 0: this.untriggeredLogic(); break;
            case 1: this.triggeredLogic(); break;
        }
    }
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
    
    let pixelsPerUnit = 50;

    let tileSet = await loadTileSet('dungeon_simple', pixelsPerUnit);
    let tileMapInfo = await loadTileMap('level1');

    let canvas = document.getElementById('canvas');
    
    let gameState = new GameState(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo);

    window.requestAnimationFrame((t) => update(gameState, t));
}

main();