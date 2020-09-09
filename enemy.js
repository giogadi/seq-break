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
class ShooterEnemy extends Enemy {
    constructor(pos, sideLength, seq, synthIx, color, homing = true) {
        super(pos, sideLength, seq, synthIx, color);
        this.beatsSinceLastChange = -1;
        this.BEATS_PER_CHANGE = 4;
        this.STOP_BEATS = Math.floor(this.BEATS_PER_CHANGE / 2);
        this.SPEED = 3.0;
        this.BULLET_SPEED = 5.0;
        this.v = { x: 0.0, y: 0.0 };
        this.homing = homing;
    }
    update(dt, isNewBeat, currentBeatIx, tileMapInfo, tileSet, enemies, bullets) {
        if (isNewBeat) {
            ++this.beatsSinceLastChange;
            if (this.beatsSinceLastChange >= this.BEATS_PER_CHANGE) {
                this.v = { x: 0.0, y: 0.0 };
                // This puts the enemy in sync with the down beats if the enemy was spawned on an offbeat.
                if (currentBeatIx % 4 === 0) {
                    this.beatsSinceLastChange = 0;
                    if (Math.random() > 0.95) {
                        for (let bIx = 0; bIx < bullets.length; ++bIx) {
                            if (bullets[bIx].alive) {
                                continue;
                            }
                            let p = this.pos;
                            if (this.homing) {
                                bullets[bIx] = new HomingBullet(p, 0.2*this.sideLength);
                            } else {
                                let a = Math.random() * 2 * Math.PI;
                                let v = { x: this.BULLET_SPEED*Math.cos(a), y: this.BULLET_SPEED*Math.sin(a) };
                                bullets[bIx] = new ConstantBullet(p, 0.2*this.sideLength, v, true);
                            }
                            break;
                        }
                    }
                }
            } else if (this.beatsSinceLastChange == this.STOP_BEATS) {
                let a = Math.random() * 2 * Math.PI;
                this.v = { x: this.SPEED*Math.cos(a), y: this.SPEED*Math.sin(a) };
            }
        }
        let newPos = vecAdd(this.pos, vecScale(this.v, dt));
        if (isBoxInCollisionWithMap(newPos, this.sideLength, tileMapInfo, tileSet) ||
            aabbCollidesWithSomeEnemy(newPos, this.sideLength, enemies, this)) {
            this.v = vecScale(this.v, -1.0);
        } else {
            this.pos = vecAdd(this.pos, vecScale(this.v, dt));
        }
    }
}

function generateRandomEnemies(numBeats, numEnemies, bounds, enemySize, tileMapInfo, tileSet) {
    let enemies = []
    const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
    // const possibleNotes = [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A];
    for (i = 0; i < numEnemies; ++i) {
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
        enemies.push(new ShooterEnemy(randPos, enemySize, sequence, 0, 'green'));
        // enemies.push(new Enemy(randPos, enemySize, sequence, 0, 'green'));
    }
    for (i = 0; i < numEnemies; ++i) {
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
        enemies.push(new Enemy(randPos, enemySize, sequence, 1, 'darkgoldenrod'));
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