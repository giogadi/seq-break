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

class Bullet {
    constructor(pos, sideLength, alive = true) {
        this.pos = pos;
        this.sideLength = sideLength;
        this.alive = alive;
    }
    update(dt, isNewBeat, currentBeatIx, tileMapInfo, tileSet, playerPos) {}
}

class ConstantBullet extends Bullet {
    constructor(pos, sideLength, v, alive = true) {
        super(pos, sideLength, alive);
        this.v = v;
    }
    update(dt, isNewBeat, currentBeatIx, tileMapInfo, tileSet, playerPos) {
        if (!this.alive) {
            return;
        }
        this.pos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(this.pos, this.sideLength, tileMapInfo, tileSet)) {
            this.alive = false;
        }
    }
}

class HomingBullet extends Bullet {
    constructor(pos, sideLength) {
        super(pos, sideLength, true);
        this.SPEED = 5.0;
        this.beatsSinceLastChange = -1;
        this.BEATS_PER_LOOP = 4;
        this.STOP_BEATS = this.BEATS_PER_LOOP - 1
        this.v = { x: 0.0, y: 0.0 };
    }
    update(dt, isNewBeat, currentBeatIx, tileMapInfo, tileSet, playerPos) {
        if (!this.alive) {
            return;
        }
        if (isNewBeat) {
            ++this.beatsSinceLastChange;
            if (this.beatsSinceLastChange >= this.BEATS_PER_LOOP) {
                this.v = { x: 0.0, y: 0.0 };
                // This puts the enemy in sync with the down beats if the enemy was spawned on an offbeat.
                if (currentBeatIx % 4 === 0) {
                    this.beatsSinceLastChange = 0;
                }
            } else if (this.beatsSinceLastChange == this.STOP_BEATS) {
                let dir = vecNormalized(vecAdd(playerPos, vecScale(this.pos, -1.0)));
                this.v = vecScale(dir, this.SPEED);
            }
        }
        this.pos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(this.pos, this.sideLength, tileMapInfo, tileSet)) {
            this.alive = false;
        }
    }
}

class Enemy {
    constructor(pos, sideLength, seq, synthIx, color) {
        this.pos = pos;
        this.sideLength = sideLength;
        this.seq = seq;
        this.synthIx = synthIx;
        this.color = color;
        this.alive = true;
    }
    update(dt, isNewBeat, currentBeatIx, tileMapInfo, tileSet, enemies, bullets) {}
}

class RhythmEnemyLogic {
    constructor() {}
    update(rhythmEnemy, bullets) {}
}
class RhythmEnemySetVelocity extends RhythmEnemyLogic {
    constructor(v) {
        super();
        this.v = v;
    }
    update(rhythmEnemy, bullets) {
        rhythmEnemy.v = this.v;
    }
}
class RhythmEnemyRandomDirection extends RhythmEnemyLogic {
    constructor(speed) {
        super();
        this.speed = speed;
    }
    update(rhythmEnemy, bullets) {
        let a = Math.random() * 2 * Math.PI;
        rhythmEnemy.v = { x: this.speed*Math.cos(a), y: this.speed*Math.sin(a) };
    }
}
class RhythmEnemyShootHoming extends RhythmEnemyLogic {
    constructor() {
        super();
    }
    update(rhythmEnemy, bullets) {
        for (let bIx = 0; bIx < bullets.length; ++bIx) {
            if (bullets[bIx].alive) {
                continue;
            }
            let p = rhythmEnemy.pos;
            bullets[bIx] = new HomingBullet(rhythmEnemy.pos, 0.2*rhythmEnemy.sideLength);
            break;
        }
    }
}

// If you set the initBeatIx to < 0, that will delay actions until we get to 0.
// A way to help sync up with another sequence.
class RhythmEnemy extends Enemy {
    constructor(pos, sideLength, soundSeq, synthIx, color, logicSeq, initBeatIx = 0) {
        super(pos, sideLength, soundSeq, synthIx, color);
        this.logicSeq = logicSeq;
        this.v = { x: 0.0, y: 0.0 };
        this.currentBeatIx = initBeatIx;
    }
    update(dt, isNewBeat, unusedCurrentBeatIx, tileMapInfo, tileSet, enemies, bullets) {
        if (isNewBeat) {
            ++this.currentBeatIx;
            if (this.currentBeatIx >= 0) {
                this.currentBeatIx = this.currentBeatIx % this.logicSeq.length;
                let logic = this.logicSeq[this.currentBeatIx];
                for (let actionIx = 0; actionIx < logic.length; ++actionIx) {
                    logic[actionIx].update(this, bullets);
                }
            }
        }
        let newPos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(newPos, this.sideLength, tileMapInfo, tileSet) ||
            aabbCollidesWithSomeEnemy(newPos, this.sideLength, enemies, this)) {
            this.v = vecScale(this.v, -1.0);
        } else {
            this.pos = newPos;
        }
    }
}

function makeStationaryShooter(pos, sideLength, soundSeq, synthIx, color, initBeatIx = 0) {
    // Note: new Array(16).fill([]) doesn't work because that assigns all the elements
    // to the _same_ empty array!
    let logicSeq = new Array(32);
    for (let i = 0; i < logicSeq.length; ++i) {
        logicSeq[i] = [];
    }
    logicSeq[0].push(new RhythmEnemyShootHoming());
    return new RhythmEnemy(pos, sideLength, soundSeq, synthIx, color, logicSeq, initBeatIx);
}

function makeMover(pos, sideLength, soundSeq, synthIx, color, initBeatIx = 0) {
    let logicSeq = new Array(4);
    for (let i = 0; i < logicSeq.length; ++i) {
        logicSeq[i] = [];
    }
    logicSeq[0].push(new RhythmEnemySetVelocity({ x: 0.0, y: 0.0 }));
    logicSeq[2].push(new RhythmEnemyRandomDirection(3.0));
    return new RhythmEnemy(pos, sideLength, soundSeq, synthIx, color, logicSeq, initBeatIx);
}

function generateRandomEnemies(numBeats, currentBeatIx, bounds, enemySize, tileMapInfo, tileSet) {
    console.assert(currentBeatIx >= 0);
    let enemies = []
    const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
    // const possibleNotes = [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A];

    // Delay enemy logic sequences so that they start on a downbeat.
    let downbeatOffset = currentBeatIx % 4;
    let delayBeats = 0;
    // 0 -> 0, 1 -> 3, 2 -> 2, 3 -> 1
    if (downbeatOffset !== 0) {
        delayBeats = 4 - downbeatOffset;
    }

    for (i = 0; i < 10; ++i) {
        let randPos = { x: 0.0, y: 0.0 };
        do {
            randPos = rand2dInBounds(bounds);
        } while (isBoxInCollisionWithMap(randPos, enemySize, tileMapInfo, tileSet) ||
                 aabbCollidesWithSomeEnemy(randPos, enemySize, enemies));

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
        enemies.push(makeMover(randPos, enemySize, sequence, 0, 'green', -delayBeats));
    }
    for (i = 0; i < 4; ++i) {
        let randPos = { x: 0.0, y: 0.0 };
        do {
            randPos = rand2dInBounds(bounds);
        } while (isBoxInCollisionWithMap(randPos, enemySize, tileMapInfo, tileSet) ||
                 aabbCollidesWithSomeEnemy(randPos, enemySize, enemies));
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 1);
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: false
        });
        // Further offset each enemy's logic by 1 downbeat so they don't all shoot at the same time.
        let delay = delayBeats + 4*i;
        enemies.push(makeStationaryShooter(randPos, enemySize, sequence, 1, 'darkgoldenrod', -delay));
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