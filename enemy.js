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
        this.v = new Vec2(0.0, 0.0);
        this.heading = 0.0;
        this.sideLength = sideLength;
        this.seq = seq;
        this.sequenceId = sequenceId;
        this.color = color;
        this.renderLayer = 0;
        this.alive = true;
        this.hp = 1;

        this.checkMapCollisions = false;
        this.checkEnemyCollisions = false;
        this.checkCameraCollisions = false;

        // If < 0, not in hit stun.
        this.hitStunTimer = -1.0;
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
            if (this.hitStunTimer > (this.KNOCK_BACK_TIME + this.POST_KNOCK_BACK_STUN_TIME)) {
                this.hitStunTimer = -1.0;
            } else if (this.hitStunTimer > this.KNOCK_BACK_TIME) {
                this.v = new Vec2(0.0, 0.0);
            }
        }

        this.updatePosition(dt, g);
    }
    updatePosition(dt, g) {
        let newPos = vecAdd(this.pos, vecScale(this.v, dt));
        let newBounds = boundsFromRect(newPos, this.sideLength, this.sideLength);
        if ((this.checkMapCollisions && isBoxInCollisionWithMap(newPos, this.sideLength, this.sideLength, g.tileMapInfo, g.tileSet)) ||
            (this.checkEnemyCollisions && aabbCollidesWithSomeEnemy(newPos, this.sideLength, this.sideLength, g.enemies, this)) ||
            (this.checkCameraCollisions && !doesBounds1ContainBounds2(getCameraBounds(g), newBounds))) {
            this.v = vecScale(this.v, -1.0);
        } else {
            this.pos = newPos;
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
            this.v = vecScale(knockBackDir, this.KNOCK_BACK_SPEED);
        }
    }
}

function makeDeadEnemy() {
    let e = new Enemy({ x: 0.0, y: 0.0 }, 0.0, [], new SequenceId(SequenceType.SYNTH, 0), '');
    e.alive = false;
    return e;
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
    updatePosition(dt, g) {
        // Override parent
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
    updatePosition(dt, g) {
        // Override parent class because this one is doing the pos updating.
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

class NewRhythmEnemy extends Enemy {
    constructor(pos, sideLength, soundSeq, sequenceId, color) {
        super(pos, sideLength, soundSeq, sequenceId, color);
        
    }
    update(dt, g) {
        if (g.newBeat) {
            this.beatUpdate(g);
        }
    }
    beatUpdate(g) {}
}

class Buzzer extends NewRhythmEnemy {
    constructor(pos, sideLength, soundSeq, sequenceId, color, initState = 0) {
        super(pos, sideLength, soundSeq, sequenceId, color);
        this.state = initState;
    }
    static speed = 5.0;
    beatUpdate(g) {
        switch (this.state) {
            case 0: {
                this.v = new Vec2(0.0, 0.0);
                break;
            }
            case 2: {
                let zigAngle = (Math.PI / 180.0) * 20.0;
                let zigVec = unitVecFromAngle(0.5 * Math.PI - zigAngle);
                this.v = vecScale(zigVec, Buzzer.speed);
                break;
            }
            case 4: {
                this.v = new Vec2(0.0, 0.0);
                break;
            }
            case 6: {
                let zagAngle = (Math.PI / 180.0) * 20.0;
                let zagVec = unitVecFromAngle(0.5 * Math.PI + zagAngle);
                this.v = vecScale(zagVec, Buzzer.speed);
                break;
            }
            case 7: {
                this.state = -1;
            }
            default: {

            }
        }
        ++this.state;
    }
}

class Biggie extends NewRhythmEnemy {
    constructor(pos, sideLength, soundSeq, sequenceId, color, initState = 0) {
        super(pos, sideLength, soundSeq, sequenceId, color);
        this.state = initState;
    }
    static speed = 3.0;
    beatUpdate(g) {
        switch (this.state) {
            case 0: {
                this.v = new Vec2(0.0, Biggie.speed);
                break;
            }
            case 4: {
                this.v = new Vec2(0.0, 0.0);
                let cameraBounds = getCameraBounds(g);
                cameraBounds.min.y += 1.5;
                let enemyBounds = boundsFromRect(this.pos, this.sideLength, this.sideLength);
                if (doesBounds1ContainBounds2(cameraBounds, enemyBounds)) {
                    this.checkMapCollisions = true;
                    this.checkCameraCollisions = true;
                    this.state = 7;
                } else {
                    this.state = -5;
                }
                break;
            }
            case 12: {
                this.v = vecScale(randomUnitVec(), Biggie.speed);
                break;
            }
            case 16: {
                this.v = new Vec2(0.0, 0.0);
                this.state = 7;
                break;
            }
            default: {}
        }
        ++this.state;
    }
}