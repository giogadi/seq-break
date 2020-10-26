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
        this.checkMapCollisions = true;
        this.checkEnemyCollisions = true;
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