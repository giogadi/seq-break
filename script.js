const SequenceType = {
    SYNTH: 0,
    SAMPLE: 1
};

class SequenceId {
    constructor(sequenceType, sequenceIx) {
        this.type = sequenceType;
        this.ix = sequenceIx;
    }
}

class GameState {
    constructor(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo, barrierImg) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.canvasCtx.mozImageSmoothingEnabled = false;
        this.canvasCtx.webkitImageSmoothingEnabled = false;
        this.canvasCtx.msImageSmoothingEnabled = false;
        this.canvasCtx.imageSmoothingEnabled = false;
        this.sound = sound;
        this.tileSet = tileSet;
        this.tileMapInfo = tileMapInfo;
        this.barrierImg = barrierImg;

        this.pixelsPerUnit = pixelsPerUnit;
        this.viewWidthInUnits = this.canvas.width / this.pixelsPerUnit;
        this.viewHeightInUnits = this.canvas.height / this.pixelsPerUnit;

        this.playerSpeed = 6.0;
        this.playerSize = 1.0;
        this.playerPos = this.tileMapInfo.start;
        this.playerHeading = 0.0;

        this.BPM = 4 * 120.0;
        this.SECONDS_PER_BEAT = 60.0 / this.BPM;
        this.NUM_BEATS = 16;
        this.LOOP_TIME = this.NUM_BEATS * this.SECONDS_PER_BEAT;

        this.NUM_SYNTHS = 3;

        // For now, sample sequence elements are interpreted in a binary way
        // (<0 for nothing, else play a note). sustain is ignored.
        this.sampleSequences = new Array(this.sound.drumSounds.length);
        for (let i = 0; i < this.sampleSequences.length; ++i) {
            this.sampleSequences[i] = [];
            for (let j = 0; j < this.NUM_BEATS; ++j) {
                this.sampleSequences[i][j] = { note: -1, sustain: false };
            }
        }
        this.sampleSequences[0][0].note = this.sampleSequences[0][4].note = this.sampleSequences[0][8].note = this.sampleSequences[0][12].note = 0;

        this.synthSequences = new Array(this.NUM_SYNTHS);
        for (let i = 0; i < this.NUM_SYNTHS; ++i) {
            this.synthSequences[i] = [];
            for (let j = 0; j < this.NUM_BEATS; ++j) {
                this.synthSequences[i][j] = { note: -1, sustain: false }
            }
        }

        this.loopElapsedTime = 0.0;
        this.currentBeatIx = -1;

        this.enemies = [];
        const NUM_BULLETS = 20;
        this.bullets = [];
        for (let i = 0; i < NUM_BULLETS; ++i) {
            this.bullets.push(new Bullet({ x: 0, y: 0 }, 0, false));
        }

        this.controlDir = { x: 0.0, y: 0.0 };
        this.slashPressed = false;
        this.sustaining = false;
        this.scanning = false;

        this.prevTimeMillis = -1.0;

        this.roomLogics = [];
        for (let i = 0; i < this.tileMapInfo.rooms.length; ++i) {
            this.roomLogics.push(new KillAllEnemiesRoomLogic(this, this.tileMapInfo.rooms[i]));
        }

        // TODO THIS SUCKS AND IS BUSTED
        if (this.roomLogics.length === 0) {
            this.roomLogics.push(new OneRoomScript(this, this.NUM_BEATS));
        }
        
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
    getSequence(sequenceId) {
        switch (sequenceId.type) {
            case SequenceType.SYNTH: {
                return this.synthSequences[sequenceId.ix];
            }
            case SequenceType.SAMPLE: {
                return this.sampleSequences[sequenceId.ix];
            }
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
    let fracAheadOfCurrent = -1;
    {
        let currentBeatContinuous = (g.loopElapsedTime / g.LOOP_TIME) * g.NUM_BEATS;
        let newBeatIx = Math.floor(currentBeatContinuous);
        fracAheadOfCurrent = currentBeatContinuous - newBeatIx;
        console.assert(newBeatIx < g.NUM_BEATS);
        if (newBeatIx !== g.currentBeatIx) {
            newBeat = true;
            g.currentBeatIx = newBeatIx;
        }
    }

    for (let roomIx = 0; roomIx < g.roomLogics.length; ++roomIx) {
        g.roomLogics[roomIx].update();
    }

    // Handle slash
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
            let s = 0.5 * e.sideLength;
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
            if (doConvexPolygonsOverlap(hitBox, enemyHitBox)) {
                let hitIx = -1;
                if (fracAheadOfCurrent < 0.5) {
                    hitIx = g.currentBeatIx;
                } else {
                    hitIx = (g.currentBeatIx + 1) % g.NUM_BEATS;
                }
                if (e.seq[hitIx].note >= 0) {
                    let seq = g.getSequence(e.sequenceId);
                    seq[hitIx] = e.seq[hitIx];
                    // TODO do this cleaner please
                    if (hitIx === g.currentBeatIx && !newBeat) {
                        switch (e.sequenceId.type) {
                            case SequenceType.SYNTH: {
                                synthPlayVoice(
                                    g.sound.synths[e.sequenceId.ix], 0, seq[hitIx].note,
                                    seq[hitIx].sustain, g.sound.audioCtx);
                                break;
                            }
                            case SequenceType.SAMPLE: {
                                playSoundFromBuffer(
                                    g.sound.audioCtx, g.sound.drumSounds[e.sequenceId.ix]);
                                break;
                            }
                        }
                    }
                    // TODO BLAGH
                    if (e.sequenceId.type !== SequenceType.SYNTH || e.sequenceId.ix !== 2) {
                        e.alive = false;
                        // wtf. linearRampToValueAtTime() starts from the *previous event* time,
                        // not the current time. bizarre.
                        g.sound.droneFilter.frequency.setValueAtTime(
                            g.sound.droneFilter.frequency.value, g.sound.audioCtx.currentTime);
                        let newVal = g.sound.droneFilter.frequency.value + 200;
                        g.sound.droneFilter.frequency.linearRampToValueAtTime(
                            newVal, g.sound.audioCtx.currentTime + 1.0);
                    }
                } else {
                    // AGAIN, do this cleaner pls.
                    if (hitIx === g.currentBeatIx && !newBeat) {
                        playSoundFromBuffer(
                            g.sound.audioCtx, g.sound.drumSounds[2]);
                    } else {
                        // Get dat cowbell seq
                        let seq = g.getSequence(new SequenceId(SequenceType.SAMPLE, 2));
                        seq[hitIx].note = 0;
                    }
                }
            }
        }
        let playSnare = false;
        for (let i = 0; i < g.bullets.length; ++i) {
            let b = g.bullets[i];
            let s = 0.5 * b.sideLength;
            let bulletHitBox = [
                vecAdd(b.pos, { x: -s, y: s }),
                vecAdd(b.pos, { x: -s, y: -s }),
                vecAdd(b.pos, { x: s, y: -s }),
                vecAdd(b.pos, { x: s, y: s })
            ];
            if (!b.alive) {
                continue;
            }
            if (doConvexPolygonsOverlap(hitBox, bulletHitBox)) {
                playSnare = true;
                b.alive = false;
            }
        }
        if (playSnare) {
            let hitIx = (g.currentBeatIx + 1) % g.NUM_BEATS;
            g.sampleSequences[1][hitIx].note = 0;
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
            if (nearestEnemies[e.synthIx] == -1 ||
                d < nearestDists[e.synthIx]) {
                nearestEnemies[e.synthIx] = i;
                nearestDists[e.synthIx] = d;
            }
        }
    }

    if (newBeat) {
        for (let i = 0; i < g.NUM_SYNTHS; ++i) {
            if (g.synthSequences[i][g.currentBeatIx].note >= 0) {
                synthPlayVoice(
                    g.sound.synths[i], 0, g.synthSequences[i][g.currentBeatIx].note,
                    g.synthSequences[i][g.currentBeatIx].sustain, g.sound.audioCtx);
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

        for (let i = 0; i < g.sampleSequences.length; ++i) {
            if (g.sampleSequences[i][g.currentBeatIx].note >= 0) {
                playSoundFromBuffer(g.sound.audioCtx, g.sound.drumSounds[i])
                // TODOOOOOOOO. This clears out the block-cowbells.
                if (i === 2) {
                    g.sampleSequences[i][g.currentBeatIx].note = -1;
                }
            }
        }
    }

    let tileMap = g.tileMapInfo.info.layers[0];

    // Player position update
    if (g.controlDir.x !== 0 || g.controlDir.y !== 0) {
        let oldPos = g.playerPos;
        let newPos = vecAdd(
            g.playerPos, vecScale(vecNormalized(g.controlDir), g.playerSpeed * dt));
        if (!isBoxInCollisionWithMap(newPos, g.playerSize, g.tileMapInfo, g.tileSet)) {
            g.playerPos = newPos;
        }
        g.playerHeading = Math.atan2(g.controlDir.y, g.controlDir.x);
    }

    // Enemy behavior update
    for (let eIx = 0; eIx < g.enemies.length; ++eIx) {
        if (!g.enemies[eIx].alive) {
            continue;
        }
        g.enemies[eIx].update(dt, newBeat, g.currentBeatIx, g.tileMapInfo, g.tileSet, g.enemies, g.bullets);
    }

    // Bullet update
    for (let bIx = 0; bIx < g.bullets.length; ++bIx) {
        g.bullets[bIx].update(dt, newBeat, g.currentBeatIx, g.tileMapInfo, g.tileSet, g.playerPos);
    }

    g.canvasCtx.fillStyle = 'grey';
    g.canvasCtx.fillRect(0, 0, g.canvas.width, g.canvas.height);    

    // View transform
    g.canvasCtx.save();
    let centerPosPx = { x: Math.floor(0.5 * g.canvas.width), y: Math.floor(0.5 * g.canvas.height) };
    let cameraPx = { x: Math.floor(g.playerPos.x * g.pixelsPerUnit), y: Math.floor(g.playerPos.y * g.pixelsPerUnit) };
    // let cameraPx = centerPosPx;
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
    g.canvasCtx.lineWidth = 2;
    for (i = 0; i < g.enemies.length; ++i) {
        let e = g.enemies[i];
        if (!e.alive) {
            continue;
        }
        let posPx = vecScale(e.pos, g.pixelsPerUnit);
        let sizePx = e.sideLength * g.pixelsPerUnit;
        g.canvasCtx.fillStyle = e.color;
        g.canvasCtx.fillRect(
            posPx.x - 0.5*sizePx,
            posPx.y - 0.5*sizePx,
            sizePx, sizePx);
        if (e.seq[g.currentBeatIx].note < 0) {
            // draw a barrier. First we draw some transparent "glass" and
            // then we draw an image of glassy glare on top.
            g.canvasCtx.fillStyle = 'rgba(156, 251, 255, 0.5)';
            g.canvasCtx.fillRect(
                posPx.x - 0.7*sizePx,
                posPx.y - 0.7*sizePx,
                1.4*sizePx, 1.4*sizePx);
            g.canvasCtx.drawImage(g.barrierImg, 0, 0, 16, 16, posPx.x - 0.7*sizePx, posPx.y - 0.7*sizePx, 1.4*sizePx, 1.4*sizePx);
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

    // Draw bullets
    for (let bIx = 0; bIx < g.bullets.length; ++bIx) {
        let b = g.bullets[bIx];
        if (!b.alive) {
            continue;
        }
        g.canvasCtx.fillStyle = 'cyan';
        let posPx = vecScale(b.pos, g.pixelsPerUnit);
        let sizePx = b.sideLength * g.pixelsPerUnit;
        g.canvasCtx.fillRect(posPx.x - 0.5*sizePx, posPx.y - 0.5*sizePx, sizePx, sizePx);
    }

    g.canvasCtx.restore();

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
    
    let pixelsPerUnit = 50;

    let tileSet = await loadTileSet('dungeon_simple', pixelsPerUnit);
    // let tileMapInfo = await loadTileMap('level1');
    let tileMapInfo = await loadTileMap('one_room_16x12');

    let barrierImg = new Image();
    const waitForImgLoad = () =>
        new Promise((resolve) => {
            barrierImg.addEventListener('load', () => resolve(), {once: true});
        });
    barrierImg.src = 'glass-glare-16x16.png';
    await waitForImgLoad();

    let canvas = document.getElementById('canvas');
    
    let gameState = new GameState(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo, barrierImg);

    window.requestAnimationFrame((t) => update(gameState, t));
}

main();