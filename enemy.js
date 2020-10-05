function aabbCollidesWithSomeEnemy(center, width, height, enemies, ignoredEnemy = null) {
    for (let eIx = 0; eIx < enemies.length; ++eIx) {
        let e = enemies[eIx];
        if (!e.alive || e === ignoredEnemy) {
            continue;
        }
        if (doAABBsOverlap(center, width, height, e.pos, e.sideLength, e.sideLength)) {
            return true;
        }
    }
    return false;
}

class Enemy {
    constructor(pos, sideLength, seq, sequenceId, color) {
        this.pos = pos;
        this.heading = 0.0;
        this.sideLength = sideLength;
        this.seq = seq;
        this.sequenceId = sequenceId;
        this.color = color;
        this.renderLayer = 0;
        this.alive = true;
        this.hp = 1;
        // If < 0, not in hit stun.
        this.hitStunTimer = -1.0;
        this.knockBackVelocity = null;
        this.KNOCK_BACK_TIME = 0.1;
        this.POST_KNOCK_BACK_STUN_TIME = 0.2;
        this.BLINK_TIME = 0.1;
        this.KNOCK_BACK_SPEED = 10.0;
    }
    updateBase(dt, g) {
        if (this.hitStunTimer < 0.0) {
            // TODO: does this mess up RhythmEnemies, which expect to update every iteration?
            this.update(dt, g);
        } else {
            this.hitStunTimer += dt;
            if (this.hitStunTimer < this.KNOCK_BACK_TIME) {
                console.assert(this.knockBackVelocity !== null);
                let newPos = vecAdd(this.pos, vecScale(this.knockBackVelocity, dt));
                if (!isBoxInCollisionWithMap(newPos, this.sideLength, this.sideLength, g.tileMapInfo, g.tileSet) &&
                    !aabbCollidesWithSomeEnemy(newPos, this.sideLength, this.sideLength, g.enemies, this)) {
                        this.pos = newPos;
                }
            } else if (this.hitStunTimer < (this.KNOCK_BACK_TIME + this.POST_KNOCK_BACK_STUN_TIME)) {
                this.knockBackVelocity = null;
            } else {
                this.hitStunTimer = -1.0;
            }
        }
    }
    update(dt, gameState) {}
    drawBase(canvasCtx, pixelsPerUnit) {
        let blink = this.hitStunTimer >= 0.0 &&
            (Math.floor(this.hitStunTimer / this.BLINK_TIME) % 2 === 0);
        if (blink) {
            let sizePx = this.sideLength * pixelsPerUnit;
            canvasCtx.fillStyle = 'red';
            canvasCtx.fillRect(
                -0.5*sizePx,
                -0.5*sizePx,
                sizePx, sizePx);
        } else {
            this.draw(canvasCtx, pixelsPerUnit);
        }
    }
    draw(canvasCtx, pixelsPerUnit) {
        let sizePx = this.sideLength * pixelsPerUnit;
        canvasCtx.fillStyle = this.color;
        canvasCtx.fillRect(
            -0.5*sizePx,
            -0.5*sizePx,
            sizePx, sizePx);
    }
    getHitBox() {
        return getOOBBCornerPoints(
            this.pos, unitVecFromAngle(this.heading), this.sideLength, this.sideLength); 
    }
    getHurtBox() {
        return this.getHitBox();
    }
    hurtBase(playerPos) {
        --this.hp;
        if (this.hp <= 0) {
            this.alive = false;
        } else {
            this.hitStunTimer = 0.0;
            let knockBackDir = vecNormalized(vecSub(this.pos, playerPos));
            this.knockBackVelocity = vecScale(knockBackDir, this.KNOCK_BACK_SPEED);
        }
    }
}

function makeDeadEnemy() {
    let e = new Enemy({ x: 0.0, y: 0.0 }, 0.0, [], new SequenceId(SequenceType.SYNTH, 0), '');
    e.alive = false;
    return e;
}

class RhythmEnemyLogic {
    constructor() {}
    update(rhythmEnemy, gameState) {}
}
class RhythmEnemySetVelocity extends RhythmEnemyLogic {
    constructor(v) {
        super();
        this.v = v;
    }
    update(rhythmEnemy, g) {
        rhythmEnemy.v = this.v;
    }
}
class RhythmEnemyRandomDirection extends RhythmEnemyLogic {
    constructor(speed) {
        super();
        this.speed = speed;
    }
    update(rhythmEnemy, g) {
        let a = Math.random() * 2 * Math.PI;
        rhythmEnemy.v = { x: this.speed*Math.cos(a), y: this.speed*Math.sin(a) };
    }
}
class RhythmEnemyShootHoming extends RhythmEnemyLogic {
    constructor() {
        super();
    }
    // TODO: now that bullets and enemies are all in the same "queue", we need to make sure
    // that spawned bullets get updated on the same iteration they get spawned. This won't
    // happen currently.
    update(rhythmEnemy, g) {
        g.spawnEnemy(new HomingBullet(rhythmEnemy.pos, 0.2*rhythmEnemy.sideLength));
    }
}

// If you set the initBeatIx to < 0, that will delay actions until we get to 0.
// A way to help sync up with another sequence.
class RhythmEnemy extends Enemy {
    constructor(pos, sideLength, soundSeq, sequenceId, color, logicSeq, initBeatIx = 0) {
        super(pos, sideLength, soundSeq, sequenceId, color);
        this.logicSeq = logicSeq;
        this.v = { x: 0.0, y: 0.0 };
        this.currentBeatIx = initBeatIx;
    }
    update(dt, g) {
        if (g.newBeat) {
            ++this.currentBeatIx;
            if (this.currentBeatIx >= 0) {
                this.currentBeatIx = this.currentBeatIx % this.logicSeq.length;
                let logic = this.logicSeq[this.currentBeatIx];
                for (let actionIx = 0; actionIx < logic.length; ++actionIx) {
                    logic[actionIx].update(this, g);
                }
            }
        }
        let newPos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(newPos, this.sideLength, this.sideLength, g.tileMapInfo, g.tileSet) ||
            aabbCollidesWithSomeEnemy(newPos, this.sideLength, this.sideLength, g.enemies, this)) {
            this.v = vecScale(this.v, -1.0);
        } else {
            this.pos = newPos;
        }
    }
}

// TODO: make this a RhythmEnemy
class HomingBullet extends Enemy {
    constructor(pos, sideLength) {
        let sequenceId = new SequenceId(SequenceType.SAMPLE, 1);
        let seq = Array.from({length: 16}, e => { return new SequenceElement(0, false, 6); });
        super(pos, sideLength, seq, sequenceId, 'cyan');
        this.renderLayer = 1;
        this.SPEED = 5.0;
        this.beatsSinceLastChange = -1;
        this.BEATS_PER_LOOP = 4;
        this.STOP_BEATS = this.BEATS_PER_LOOP - 1
        this.v = { x: 0.0, y: 0.0 };
    }
    update(dt, g) {
        if (!this.alive) {
            return;
        }
        if (g.newBeat) {
            ++this.beatsSinceLastChange;
            if (this.beatsSinceLastChange >= this.BEATS_PER_LOOP) {
                this.v = { x: 0.0, y: 0.0 };
                // This puts the enemy in sync with the down beats if the enemy was spawned on an offbeat.
                if (g.currentBeatIx % 4 === 0) {
                    this.beatsSinceLastChange = 0;
                }
            } else if (this.beatsSinceLastChange == this.STOP_BEATS) {
                let dir = vecNormalized(vecAdd(g.playerPos, vecScale(this.pos, -1.0)));
                this.v = vecScale(dir, this.SPEED);
            }
        }
        this.pos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(this.pos, this.sideLength, this.sideLength, g.tileMapInfo, g.tileSet)) {
            this.alive = false;
        }
    }
}

// TODO: collision detection
class BigGuy extends Enemy {
    constructor(pos, soundSeq, sequenceId) {
        super(pos, 1.5, soundSeq, sequenceId, 'black');
        this.buttSize = 0.2 * this.sideLength;
        this.hp = 3;
    }
    update(dt, g) {
        const forwardSpeed = 1.5;
        const angularSpeed = 0.35 * Math.PI;
        let headingVec = unitVecFromAngle(this.heading);
        let toPlayerVec = vecNormalized(vecAdd(g.playerPos, vecScale(this.pos, -1.0)));
        let angleToPlayer = vecCross(headingVec, toPlayerVec);
        let angleSign = (angleToPlayer > 0.0) ? 1.0 : -1.0;
        let maxAngleChange = angularSpeed * dt;
        if (Math.abs(angleToPlayer) <= maxAngleChange &&
            vecDot(headingVec, toPlayerVec) > 0.0) {
            this.heading = Math.atan2(toPlayerVec.y, toPlayerVec.x);
        } else {
            this.heading += angleSign * maxAngleChange;
        }
        headingVec = unitVecFromAngle(this.heading);
        this.pos = vecAdd(this.pos, vecScale(headingVec, forwardSpeed * dt));
    }
    draw(canvasCtx, pixelsPerUnit) {
        let sizePx = this.sideLength * pixelsPerUnit;
        canvasCtx.fillStyle = this.color;
        canvasCtx.fillRect(
            -0.5*sizePx,
            -0.5*sizePx,
            sizePx, sizePx);
        canvasCtx.fillStyle = 'white';
        // Butt
        let buttSizePx = this.buttSize * pixelsPerUnit;
        canvasCtx.fillRect(
            -0.5*sizePx,
            -0.5 * buttSizePx,
            buttSizePx, buttSizePx);
    }
    getHurtBox() {
        let headingVec = unitVecFromAngle(this.heading);
        let buttPos = vecAdd(this.pos, vecScale(headingVec, -0.5 * this.sideLength + 0.5 * this.buttSize));
        return getOOBBCornerPoints(
            buttPos, unitVecFromAngle(this.heading), this.buttSize, this.buttSize);
    }
}

function makeStationaryShooter(pos, sideLength, soundSeq, sequenceId, color, initBeatIx = 0) {
    // Note: new Array(16).fill([]) doesn't work because that assigns all the elements
    // to the _same_ empty array!
    let logicSeq = new Array(32);
    for (let i = 0; i < logicSeq.length; ++i) {
        logicSeq[i] = [];
    }
    logicSeq[0].push(new RhythmEnemyShootHoming());
    let e = new RhythmEnemy(pos, sideLength, soundSeq, sequenceId, color, logicSeq, initBeatIx); 
    e.hp = 3;
    return e;
}

function makeMover(pos, sideLength, soundSeq, sequenceId, color, initBeatIx = 0) {
    let logicSeq = new Array(4);
    for (let i = 0; i < logicSeq.length; ++i) {
        logicSeq[i] = [];
    }
    logicSeq[0].push(new RhythmEnemySetVelocity({ x: 0.0, y: 0.0 }));
    logicSeq[2].push(new RhythmEnemyRandomDirection(3.0));
    let e = new RhythmEnemy(pos, sideLength, soundSeq, sequenceId, color, logicSeq, initBeatIx);
    e.hp = 2;
    return e;
}