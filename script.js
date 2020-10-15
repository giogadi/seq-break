const ENABLE_SCANNING = false;
const ENABLE_SUSTAINING = false;
const ENABLE_SOUND = true;
const RENDER_HITBOX = false;

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

const Directions = {
    RIGHT: 0,
    DOWN: 1,
    LEFT: 2,
    UP: 3
}

function vecFromDirection(d) {
    switch (d) {
        case Directions.RIGHT: return { x: 1.0, y: 0.0 };
        case Directions.DOWN: return { x: 0.0, y: 1.0 };
        case Directions.LEFT: return { x: -1.0, y: 0.0 };
        case Directions.UP: return { x: 0.0, y: -1.0 };
    }
}

class GameState {
    constructor(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo, barrierImg, heroSprites) {
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
        this.heroSprites = heroSprites;

        this.pixelsPerUnit = pixelsPerUnit;
        this.viewWidthInUnits = this.canvas.width / this.pixelsPerUnit;
        this.viewHeightInUnits = this.canvas.height / this.pixelsPerUnit;

        this.playerSpeed = 6.0;
        this.playerSize = 1.0;
        this.playerPos = this.tileMapInfo.start;
        this.facingRight = true;
        this.slashDirection = Directions.RIGHT;

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

        this.sustaining = false;
        this.scanning = false;
        // If >= 0.0, invuln until INVULN_TIME
        this.invulnTimer = -1.0;
        this.INVULN_TIME = 1.0;
        this.BLINK_TIME = 0.1;

        this.SLASH_COOLDOWN_BEATS_NON_COMBO = 0;
        this.SLASH_COOLDOWN_BEATS_COMBO = 0;
        this.slashCooldownBeatsRemaining = 0;

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

        this.upPressed = false;
        this.downPressed = false;
        this.leftPressed = false;
        this.rightPressed = false;
        this.slashPressed = false;
        this.slashJustPressedThisFrame = false;

        kd.W.down(() => this.upPressed = true);
        kd.S.down(() => this.downPressed = true);
        kd.A.down(() => this.leftPressed = true);
        kd.D.down(() => this.rightPressed = true);
        kd.J.down(() => {
            this.slashJustPressedThisFrame = !this.slashPressed;
            this.slashPressed = true;
        });

        kd.W.up(() => this.upPressed = false);
        kd.S.up(() => this.downPressed = false);
        kd.A.up(() => this.leftPressed = false);
        kd.D.up(() => this.rightPressed = false);
        kd.J.up(() => {
            this.slashPressed = false;
            this.slashJustPressedThisFrame = false;
        });

        if (ENABLE_SCANNING) {
            kd.K.down(() => this.scanning = true);
            kd.K.up(() => this.scanning = false);
        }

        if (ENABLE_SUSTAINING) {
            kd.K.down(() => this.sustaining = true);
            kd.K.up(() => this.sustaining = false);
        }
    }
    bounds() {
        return {
            min: { x: 0.0, y: 0.0 },
            max: { x: this.tileMapInfo.width, y: this.tileMapInfo.height }
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
        console.log("ran out of enemies");
        return -1;
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
    kd.tick();
    let controlDir = { x: 0.0, y: 0.0 };
    if (g.upPressed) {
        controlDir.y -= 1.0;
    }
    if (g.downPressed) {
        controlDir.y += 1.0;
    }
    if (g.leftPressed) {
        controlDir.x -= 1.0;
        g.facingRight = false;
    }
    if (g.rightPressed) {
        controlDir.x += 1.0;
        g.facingRight = true;
    }

    // Update slash direction
    if (controlDir.x === 0.0) {
        if (controlDir.y > 0.0) {
            g.slashDirection = Directions.DOWN;
        } else if (controlDir.y < 0.0) {
            g.slashDirection = Directions.UP;
        }
    } else if (controlDir.y === 0.0) {
        if (controlDir.x > 0.0) {
            g.slashDirection = Directions.RIGHT;
        } else if (controlDir.x < 0.0) {
            g.slashDirection = Directions.LEFT;
        }
    } else {
        switch (g.slashDirection) {
            case Directions.RIGHT: {
                if (controlDir.x < 0.0) {
                    g.slashDirection = Directions.LEFT;
                }
                break;
            }
            case Directions.DOWN: {
                if (controlDir.y < 0.0) {
                    g.slashDirection = Directions.UP;
                }
                break;
            }
            case Directions.LEFT: {
                if (controlDir.x > 0.0) {
                    g.slashDirection = Directions.RIGHT;
                }
                break;
            }
            case Directions.UP: {
                if (controlDir.y > 0.0) {
                    g.slashDirection = Directions.DOWN;
                }
            }
        }
    }

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
    let doSlash = false;
    let potentialComboStart = false;
    if (g.slashCooldownBeatsRemaining > 0 && g.newBeat) {
        --g.slashCooldownBeatsRemaining;
    }
    if (g.slashJustPressedThisFrame) {
        if (g.slashCooldownBeatsRemaining <= 0) {
            doSlash = true;
            if (g.currentBeatIx % 2 === 0) {
                if (fracAheadOfCurrent < 0.6) {
                    potentialComboStart = true;
                } else {
                    console.log("LATE " + fracAheadOfCurrent);
                }
            }
            if (g.currentBeatIx % 2 === 1) {
                if (fracAheadOfCurrent > 0.6) {
                    potentialComboStart = true;
                } else {
                    console.log("EARLY " + fracAheadOfCurrent);
                }
            }
        }
    }
    let hitBox = null;
    let enemyHurtBoxes = [];
    let comboStart = false;
    if (doSlash || g.sustaining) {
        let headingVec = vecFromDirection(g.slashDirection);
        let hitBoxCenter = vecAdd(g.playerPos, vecScale(headingVec, g.playerSize));
        hitBox = getOOBBCornerPoints(hitBoxCenter, headingVec, 2*g.playerSize, g.playerSize);

        for (let i = 0; i < g.enemies.length; ++i) {
            let e = g.enemies[i];
            let enemyHurtBox = e.getHurtBox();
            enemyHurtBoxes.push(enemyHurtBox);
            if (!e.alive ||
                !doConvexPolygonsOverlap(hitBox, enemyHurtBox)) {
                continue;
            }
            if (potentialComboStart) {
                comboStart = true;
            }
            let seq = g.getSequence(e.sequenceId);
            let hitIx = -1;
            if (fracAheadOfCurrent < 0.5 && e.seq[g.currentBeatIx].freq >= 0) {    
                hitIx = g.currentBeatIx;
            } else {
                hitIx = (g.currentBeatIx + 1) % g.NUM_BEATS;
            }
            if (e.seq[hitIx].freq >= 0) {
                // TODO do this cleaner please
                if (hitIx === g.currentBeatIx && !g.newBeat) {
                    switch (e.sequenceId.type) {
                        case SequenceType.SYNTH: {
                            synthPlayVoice(
                                g.sound.synths[e.sequenceId.ix], 0, e.seq[hitIx].freq,
                                e.seq[hitIx].sustain, g.sound.audioCtx);
                            break;
                        }
                        case SequenceType.SAMPLE: {
                            playSoundFromBuffer(
                                g.sound.audioCtx, g.sound.drumSounds[e.sequenceId.ix]);
                            break;
                        }
                    }
                }
                e.hurtBase(g.playerPos);
                if (e.alive) {
                    seq[hitIx] = new SequenceElement(e.seq[hitIx].freq, e.seq[hitIx].sustain, 1);
                } else {
                    seq[hitIx] = e.seq[hitIx];
                }
            } else {
                // AGAIN, do this cleaner pls.
                if (hitIx === g.currentBeatIx && !g.newBeat) {
                    playSoundFromBuffer(
                        g.sound.audioCtx, g.sound.drumSounds[2]);
                } else {
                    // Get dat cowbell seq
                    let seq = g.getSequence(new SequenceId(SequenceType.SAMPLE, 2));
                    seq[hitIx] = new SequenceElement(0, false, 1);
                }
            }
        }

        if (comboStart) {
            g.slashCooldownBeatsRemaining = g.SLASH_COOLDOWN_BEATS_COMBO;
        } else {
            g.slashCooldownBeatsRemaining = g.SLASH_COOLDOWN_BEATS_NON_COMBO;
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
            }
        }
    }

    let tileMap = g.tileMapInfo.info.layers[0];

    // Player position update
    if (controlDir.x !== 0 || controlDir.y !== 0) {
        let oldPos = g.playerPos;
        let newPos = vecAdd(
            g.playerPos, vecScale(vecNormalized(controlDir), g.playerSpeed * dt));
        if (!isBoxInCollisionWithMap(newPos, g.playerSize, g.playerSize, g.tileMapInfo, g.tileSet)) {
            g.playerPos = newPos;
        }
    }

    // Enemy behavior update
    for (let eIx = 0; eIx < g.enemies.length; ++eIx) {
        if (!g.enemies[eIx].alive) {
            continue;
        }
        g.enemies[eIx].updateBase(dt, g);
    }

    // Handle player touching enemy
    if (g.invulnTimer < 0.0) {
        // TODO: now that Player doesn't rotate, we should simplify the collision calculation.
        let playerHurtBox = getOOBBCornerPoints(
            g.playerPos, {x: 1.0, y: 0.0}, g.playerSize, g.playerSize);
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
        let heroImg = null;
        if (doSlash) {
            if (g.facingRight) {
                heroImg = g.heroSprites.slashRight;
            } else {
                heroImg = g.heroSprites.slashLeft;
            }
        } else if (controlDir.x === 0.0 && controlDir.y === 0.0) {
            if (g.facingRight) {
                heroImg = g.heroSprites.idleRight;
            } else {
                heroImg = g.heroSprites.idleLeft;
            }
        } else {
            let anim = g.facingRight ? g.heroSprites.walkRightAnim : g.heroSprites.walkLeftAnim;
            heroImg = anim[g.heroSprites.walkAnimFrames[g.currentBeatIx % 4]];
        }
        g.canvasCtx.drawImage(
            heroImg,
            Math.floor(playerPosPx.x - 0.5*playerSizePx), Math.floor(playerPosPx.y - 0.5*playerSizePx),
            playerSizePx, playerSizePx);
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
            if (!e.alive || e.renderLayer < currentRenderLayer) {
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

            e.drawBase(g.canvasCtx, g.pixelsPerUnit);

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
    if (doSlash) {
        let playerPosPx = vecScale(g.playerPos, g.pixelsPerUnit);
        let playerSizePx = g.playerSize * g.pixelsPerUnit;
        let slashSize = 1.0 * g.pixelsPerUnit;
        let slashDist = 0.75 * playerSizePx;
        let slashWidth = 2.0 * playerSizePx;
        switch (g.slashDirection) {
            case Directions.RIGHT: {
                g.canvasCtx.drawImage(
                    g.heroSprites.airSlashRight,
                    Math.floor(playerPosPx.x + slashDist),
                    Math.floor(playerPosPx.y - 0.5*slashWidth),
                    slashSize, slashWidth);
                break;
            }
            case Directions.DOWN: {
                g.canvasCtx.drawImage(
                    g.heroSprites.airSlashDown,
                    Math.floor(playerPosPx.x - 0.5*slashWidth),
                    Math.floor(playerPosPx.y + slashDist),
                    slashWidth, slashSize);
                break;
            }
            case Directions.LEFT: {
                g.canvasCtx.drawImage(
                    g.heroSprites.airSlashLeft,
                    Math.floor(playerPosPx.x - (slashDist + playerSizePx)),
                    Math.floor(playerPosPx.y - 0.5*slashWidth),
                    slashSize, slashWidth);
                break;
            }
            case Directions.UP: {
                g.canvasCtx.drawImage(
                    g.heroSprites.airSlashUp,
                    Math.floor(playerPosPx.x - 0.5*slashWidth),
                    Math.floor(playerPosPx.y - (slashDist + playerSizePx)),
                    slashWidth, slashSize);
                break;
            }
        }
    }

    // Draw slash hitbox
    if (RENDER_HITBOX && doSlash) {
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

    window.requestAnimationFrame((t) => update(g, t));
}

async function loadHeroSprites() {
    let idleRight = await loadImgSync('sprites/hero-right.png');
    let idleLeft = await loadImgSync('sprites/hero-left.png');
    let walkRightAnim = [];
    let walkLeftAnim = [];
    for (let i = 1; i <= 3; ++i) {
        walkRightAnim.push(await loadImgSync('sprites/walk-right-' + i + '.png'));
        walkLeftAnim.push(await loadImgSync('sprites/walk-left-' + i + '.png'));
    }
    let slashLeft = await loadImgSync('sprites/slash-left.png');
    let slashRight = await loadImgSync('sprites/slash-right.png');
    let airSlashRight = await loadImgSync('sprites/air-slash/air-slash-right.png');
    let airSlashLeft = await loadImgSync('sprites/air-slash/air-slash-left.png');
    let airSlashUp = await loadImgSync('sprites/air-slash/air-slash-up.png');
    let airSlashDown = await loadImgSync('sprites/air-slash/air-slash-down.png');
    return {
        idleLeft: idleLeft,
        idleRight: idleRight,
        walkLeftAnim: walkLeftAnim,
        walkRightAnim: walkRightAnim,
        walkAnimFrames: [0, 1, 2, 1],
        slashLeft: slashLeft,
        slashRight: slashRight,
        airSlashLeft: airSlashLeft,
        airSlashRight: airSlashRight,
        airSlashUp: airSlashUp,
        airSlashDown: airSlashDown,
    };
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
    if (!ENABLE_SOUND) {
        sound.masterGain.gain.value = 0.0;
    }
    
    let pixelsPerUnit = 50;

    let tileSet = await loadTileSet('dungeon_simple', pixelsPerUnit);
    // let tileMapInfo = await loadTileMap('level1');
    let tileMapInfo = await loadTileMap('one_room_16x12');

    let barrierImg = await loadImgSync('glass-glare-16x16.png');

    let heroSprites = await loadHeroSprites();

    let canvas = document.getElementById('canvas');
    
    let gameState = new GameState(canvas, sound, tileSet, pixelsPerUnit, tileMapInfo, barrierImg, heroSprites);

    window.requestAnimationFrame((t) => update(gameState, t));
}

main();