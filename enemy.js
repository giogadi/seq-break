function aabbCollidesWithSomeEnemy(center, sideLength, enemies, ignoredEnemy = null) {
    for (let eIx = 0; eIx < enemies.length; ++eIx) {
        let e = enemies[eIx];
        if (!e.alive || e === ignoredEnemy) {
            continue;
        }
        if (doAABBsOverlap(center, sideLength, e.pos, e.sideLength)) {
            return true;
        }
    }
    return false;
}

class Enemy {
    constructor(pos, sideLength, seq, sequenceId, color, renderLayer = 0) {
        this.pos = pos;
        this.sideLength = sideLength;
        this.seq = seq;
        this.sequenceId = sequenceId;
        this.color = color;
        this.renderLayer = renderLayer;
        this.alive = true;
    }
    update(dt, gameState) {}
}

function makeDeadEnemy() {
    let e = new Enemy({ x: 0.0, y: 0.0 }, 0.0, [], new SequenceId(SequenceType.SYNTH, 0), '', 0);
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
        super(pos, sideLength, soundSeq, sequenceId, color, 0);
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
        if (isBoxInCollisionWithMap(newPos, this.sideLength, g.tileMapInfo, g.tileSet) ||
            aabbCollidesWithSomeEnemy(newPos, this.sideLength, g.enemies, this)) {
            this.v = vecScale(this.v, -1.0);
        } else {
            this.pos = newPos;
        }
    }
}

class HomingBullet extends Enemy {
    constructor(pos, sideLength) {
        let sequenceId = new SequenceId(SequenceType.SAMPLE, 1);
        let seq = new Array(16).fill({ note: 0, sustain: false });
        super(pos, sideLength, seq, sequenceId, 'cyan', 1);
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
        if (isBoxInCollisionWithMap(this.pos, this.sideLength, g.tileMapInfo, g.tileSet)) {
            this.alive = false;
        }
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
    return new RhythmEnemy(pos, sideLength, soundSeq, sequenceId, color, logicSeq, initBeatIx);
}

function makeMover(pos, sideLength, soundSeq, sequenceId, color, initBeatIx = 0) {
    let logicSeq = new Array(4);
    for (let i = 0; i < logicSeq.length; ++i) {
        logicSeq[i] = [];
    }
    logicSeq[0].push(new RhythmEnemySetVelocity({ x: 0.0, y: 0.0 }));
    logicSeq[2].push(new RhythmEnemyRandomDirection(3.0));
    return new RhythmEnemy(pos, sideLength, soundSeq, sequenceId, color, logicSeq, initBeatIx);
}