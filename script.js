const ENABLE_SCANNING = false;
const ENABLE_SUSTAINING = false;

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

class SequenceElement {
    constructor(freq, sustain = false, loopsUntilGone = 0) {
        this.freq = freq;
        this.sustain = sustain;
        this.velocity = 1.0;
        this.velocityDecreasePerLoop = 0.0;
        if (loopsUntilGone > 0) {
            this.velocityDecreasePerLoop = 1.0 / loopsUntilGone;
        }
    }
    update() {
        this.velocity -= this.velocityDecreasePerLoop;
        if (this.velocity <= 0.0) {
            this.reset();
        }
    }
    reset() {
        this.freq = -1;
        this.sustain = false;
        this.velocity = 1.0;
        this.velocityDecreasePerLoop = 0.0;
    }
}

function createConstantSequence(numBeats, freq, loopsUntilGone = 0) {
    let sequence = new Array(numBeats);
    for (let j = 0; j < numBeats; ++j) {
        sequence[j] = new SequenceElement(freq, false, loopsUntilGone);
    }
    return sequence;
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

        this.NUM_SYNTHS = this.sound.synths.length;

        // For now, sample sequence elements are interpreted in a binary way
        // (<0 for nothing, else play a note). sustain is ignored.
        this.sampleSequences = new Array(this.sound.drumSounds.length);
        for (let i = 0; i < this.sampleSequences.length; ++i) {
            this.sampleSequences[i] = [];
            for (let j = 0; j < this.NUM_BEATS; ++j) {
                this.sampleSequences[i][j] = new SequenceElement(-1);
            }
        }

        this.synthSequences = new Array(this.NUM_SYNTHS);
        for (let i = 0; i < this.NUM_SYNTHS; ++i) {
            this.synthSequences[i] = [];
            for (let j = 0; j < this.NUM_BEATS; ++j) {
                this.synthSequences[i][j] = new SequenceElement(-1);
            }
        }

        this.loopElapsedTime = 0.0;
        this.currentBeatIx = -1;
        this.newBeat = false;

        this.NUM_ENEMIES = 40;
        this.enemies = [];
        for (let i = 0; i < this.NUM_ENEMIES; ++i) {
            this.enemies.push(makeDeadEnemy());
        }

        this.controlDir = { x: 0.0, y: 0.0 };
        this.slashPressed = false;
        this.sustaining = false;
        this.scanning = false;
        // If >= 0.0, invuln until INVULN_TIME
        this.invulnTimer = -1.0;
        this.INVULN_TIME = 1.0;
        this.BLINK_TIME = 0.1;

        this.prevTimeMillis = -1.0;

        this.taskList = [];
        for (let i = 0; i < this.tileMapInfo.rooms.length; ++i) {
            lockRoomWithRandomEnemiesTask(this.taskList, this.tileMapInfo.rooms[i]);
        }

        // TODO THIS SUCKS AND IS BUSTED
        if (this.taskList.length === 0) {
            this.taskList = defaultTaskList(this);
        } else {
            this.sampleSequences[0][0].freq = this.sampleSequences[0][4].freq = this.sampleSequences[0][8].freq = this.sampleSequences[0][12].freq = 0;
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
            case "k": {
                if (ENABLE_SCANNING) {
                    this.scanning = true;
                }
                break;
            }
            case "l": {
                if (ENABLE_SUSTAINING) {
                    this.sustaining = true;
                }
                break;
            }
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
    spawnEnemy(enemy) {
        for (let i = 0; i < this.enemies.length; ++i) {
            let e = this.enemies[i];
            if (e.alive) {
                continue;
            }
            this.enemies[i] = enemy;
            return i;
        }
        return -1;
        console.log("ran out of enemies");
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

    g.newBeat = false;
    let fracAheadOfCurrent = -1;
    {
        let currentBeatContinuous = (g.loopElapsedTime / g.LOOP_TIME) * g.NUM_BEATS;
        let newBeatIx = Math.floor(currentBeatContinuous);
        fracAheadOfCurrent = currentBeatContinuous - newBeatIx;
        console.assert(newBeatIx < g.NUM_BEATS);
        if (newBeatIx !== g.currentBeatIx) {
            g.newBeat = true;
            g.currentBeatIx = newBeatIx;
        }
    }

    let needNewTask = true;
    while (g.taskList.length > 0 && needNewTask) {
        needNewTask = g.taskList[0].update(g, dt);
        if (needNewTask) {
            console.log("Finished task: " + g.taskList[0].constructor.name);
            g.taskList.shift();
            if (g.taskList.length > 0) {
                console.log("New task: " + g.taskList[0].constructor.name);
            }
        }
    }

    // Handle slash
    let hitBox = null;
    let enemyHurtBoxes = [];
    if (g.slashPressed || g.sustaining) {
        let headingVec = unitVecFromAngle(g.playerHeading);
        let hitBoxCenter = vecAdd(g.playerPos, vecScale(headingVec, g.playerSize));
        hitBox = getOOBBCornerPoints(hitBoxCenter, headingVec, 2*g.playerSize, g.playerSize);

        for (let i = 0; i < g.enemies.length; ++i) {
            let e = g.enemies[i];
            let enemyHurtBox = e.getHurtBox();
            enemyHurtBoxes.push(enemyHurtBox);
            if (!e.alive) {
                continue;
            }
            if (doConvexPolygonsOverlap(hitBox, enemyHurtBox)) {
                let seq = g.getSequence(e.sequenceId);
                let hitIx = -1;
                if (fracAheadOfCurrent < 0.5 && e.seq[g.currentBeatIx].freq >= 0 && seq[g.currentBeatIx].freq >= 0) {
                    hitIx = g.currentBeatIx;
                } else {
                    hitIx = (g.currentBeatIx + 1) % g.NUM_BEATS;
                }
                if (e.seq[hitIx].freq >= 0) {
                    seq[hitIx] = e.seq[hitIx];
                    // TODO do this cleaner please
                    if (hitIx === g.currentBeatIx && !g.newBeat) {
                        switch (e.sequenceId.type) {
                            case SequenceType.SYNTH: {
                                synthPlayVoice(
                                    g.sound.synths[e.sequenceId.ix], 0, seq[hitIx].freq,
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
                    }
                } else {
                    // AGAIN, do this cleaner pls.
                    if (hitIx === g.currentBeatIx && !g.newBeat) {
                        playSoundFromBuffer(
                            g.sound.audioCtx, g.sound.drumSounds[2]);
                    } else {
                        // Get dat cowbell seq
                        let seq = g.getSequence(new SequenceId(SequenceType.SAMPLE, 2));
                        seq[hitIx].freq = 0;
                    }
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
            if (nearestEnemies[e.synthIx] == -1 ||
                d < nearestDists[e.synthIx]) {
                nearestEnemies[e.synthIx] = i;
                nearestDists[e.synthIx] = d;
            }
        }
    }

    if (g.newBeat) {
        for (let i = 0; i < g.NUM_SYNTHS; ++i) {
            let seqElem = g.synthSequences[i][g.currentBeatIx];
            if (seqElem.freq >= 0) {
                synthPlayVoice(
                    g.sound.synths[i], 0, seqElem.freq, seqElem.sustain, g.sound.audioCtx, seqElem.velocity);
                seqElem.update();
            } else {
                // =======================
                // TODO
                // =======================
                // Yo, we crossed this out to allow for longer release times, but now the sustain feature is broken.
                // Figure out how to make both work in harmony.
                // synthReleaseVoice(g.sound.synths[i], 0, g.sound.audioCtx);
            }

            if (nearestEnemies[i] >= 0) {
                let e = g.enemies[nearestEnemies[i]];
                if (e.seq[g.currentBeatIx].freq >= 0) {
                    synthPlayVoice(
                        g.sound.auxSynths[i], 0, e.seq[g.currentBeatIx].freq,
                        e.seq[g.currentBeatIx].sustain, g.sound.audioCtx);
                } else {
                    synthReleaseVoice(g.sound.auxSynths[i], 0, g.sound.audioCtx);
                }
            } else {
                synthReleaseVoice(g.sound.auxSynths[i], 0, g.sound.audioCtx);
            }
        }

        for (let i = 0; i < g.sampleSequences.length; ++i) {
            let seqElem = g.sampleSequences[i][g.currentBeatIx];
            if (seqElem.freq >= 0) {
                playSoundFromBuffer(g.sound.audioCtx, g.sound.drumSounds[i], seqElem.velocity)
                seqElem.update();
                // TODOOOOOOOO. This clears out the block-cowbells.
                if (i === 2) {
                    seqElem.freq = -1;
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
        if (!isBoxInCollisionWithMap(newPos, g.playerSize, g.playerSize, g.tileMapInfo, g.tileSet)) {
            g.playerPos = newPos;
        }
        g.playerHeading = Math.atan2(g.controlDir.y, g.controlDir.x);
    }

    // Enemy behavior update
    for (let eIx = 0; eIx < g.enemies.length; ++eIx) {
        if (!g.enemies[eIx].alive) {
            continue;
        }
        g.enemies[eIx].update(dt, g);
    }

    // Handle player touching enemy
    if (g.invulnTimer < 0.0) {
        let playerHurtBox = getOOBBCornerPoints(
            g.playerPos, unitVecFromAngle(g.playerHeading), g.playerSize, g.playerSize);
        for (let eIx = 0; eIx < g.enemies.length; ++eIx) {
            let e = g.enemies[eIx];
            if (!e.alive) {
                continue;
            }
            let enemyHitBox = e.getHitBox();
            if (doConvexPolygonsOverlap(playerHurtBox, enemyHitBox)) {
                playSoundFromBuffer(g.sound.audioCtx, g.sound.drumSounds[2]);
                g.invulnTimer = 0.0;
                break;
            }
        }
    }

    let shouldDrawPlayer = true;
    if (g.invulnTimer >= 0.0) {
        g.invulnTimer += dt;
        if (g.invulnTimer < g.INVULN_TIME) {
            shouldDrawPlayer = Math.floor(g.invulnTimer / g.BLINK_TIME) % 2 === 0;
        } else {
            g.invulnTimer = -1.0;
        }
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
    if (shouldDrawPlayer) {
        let playerPosPx = vecScale(g.playerPos, g.pixelsPerUnit);
        let playerSizePx = g.playerSize * g.pixelsPerUnit;
        g.canvasCtx.save();
        g.canvasCtx.fillStyle = 'red';
        g.canvasCtx.translate(playerPosPx.x, playerPosPx.y);
        g.canvasCtx.rotate(g.playerHeading);
        g.canvasCtx.fillRect(-0.5*playerSizePx,
                            -0.5*playerSizePx,
                            playerSizePx, playerSizePx);
        const EYE_SIZE = 0.25*playerSizePx;
        g.canvasCtx.fillStyle = 'black';
        g.canvasCtx.fillRect(0.5*playerSizePx - EYE_SIZE, -0.5*EYE_SIZE, EYE_SIZE, EYE_SIZE);
        g.canvasCtx.restore();
    }

    // Draw Enemies
    g.canvasCtx.strokeStyle = 'white';
    g.canvasCtx.lineWidth = 2;
    let currentRenderLayer = -1;
    let nextRenderLayer = 0;
    while (currentRenderLayer !== nextRenderLayer) {
        currentRenderLayer = nextRenderLayer;
        for (i = 0; i < g.enemies.length; ++i) {
            let e = g.enemies[i];
            if (!e.alive) {
                continue;
            }
            if (e.renderLayer > currentRenderLayer) {
                if (nextRenderLayer === currentRenderLayer || e.renderLayer < nextRenderLayer) {
                    nextRenderLayer = e.renderLayer;
                }
                continue;
            }
            g.canvasCtx.save();

            let posPx = vecScale(e.pos, g.pixelsPerUnit);

            g.canvasCtx.translate(posPx.x, posPx.y);
            g.canvasCtx.rotate(e.heading);

            e.draw(g.canvasCtx, g.pixelsPerUnit);

            let sizePx = e.sideLength * g.pixelsPerUnit;
            if (e.seq[g.currentBeatIx].freq < 0) {
                // draw a barrier. First we draw some transparent "glass" and
                // then we draw an image of glassy glare on top.
                g.canvasCtx.fillStyle = 'rgba(156, 251, 255, 0.5)';
                g.canvasCtx.fillRect(
                    -0.7*sizePx,
                    -0.7*sizePx,
                    1.4*sizePx, 1.4*sizePx);
                g.canvasCtx.drawImage(g.barrierImg, 0, 0, 16, 16, -0.7*sizePx, -0.7*sizePx, 1.4*sizePx, 1.4*sizePx);
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
                    -0.05*sizePx,
                    -0.05*sizePx,
                    0.1*sizePx, 0.1*sizePx);
            }

            g.canvasCtx.restore();

            // DEBUG
            // if (g.slashPressed) {
            //     let hb = enemyHurtBoxes[i];
            //     let hbPx = [];
            //     for (let j = 0; j < hb.length; ++j) {
            //         hbPx.push(vecScale(hb[j], g.pixelsPerUnit));
            //     }
            //     g.canvasCtx.beginPath();
            //     g.canvasCtx.moveTo(hbPx[hbPx.length - 1].x, hbPx[hbPx.length - 1].y);
            //     for (let j = 0; j < hbPx.length; ++j) {
            //         g.canvasCtx.lineTo(hbPx[j].x, hbPx[j].y);
            //     }
            //     g.canvasCtx.stroke();
            // }
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

async function main() {
    // Wait for user to press a key
    let msg = document.getElementById('message');
    // TODO: figure out how to make this work with a specific key (like Space).
    msg.innerHTML = 'WSAD to move, "j" to attack. Press Space to start.';
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