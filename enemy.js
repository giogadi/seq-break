class Enemy {
    constructor(pos, seq, synthIx, color) {
        this.pos = pos;
        this.seq = seq;
        this.synthIx = synthIx;
        this.color = color;
        this.alive = true;
    }
    update(dt) {}
}
class ShooterEnemy extends Enemy {
    constructor(pos, seq, synthIx, color) {
        super(pos, seq, synthIx, color);
        this.beatsSinceLastChange = -1;
        this.BEATS_PER_CHANGE = 4;
        this.STOP_BEATS = Math.floor(this.BEATS_PER_CHANGE / 2);
        this.SPEED = 3.0;
        this.v = { x: 0.0, y: 0.0 };
    }
    update(dt, isNewBeat, currentBeatIx) {
        if (isNewBeat) {
            ++this.beatsSinceLastChange;
            if (this.beatsSinceLastChange >= this.BEATS_PER_CHANGE) {
                this.v = { x: 0.0, y: 0.0 };
                // This puts the enemy in sync with the down beats if the enemy was spawned on an offbeat.
                if (currentBeatIx % 4 === 0) {
                    this.beatsSinceLastChange = 0;
                }
            } else if (this.beatsSinceLastChange == this.STOP_BEATS) {
                let a = Math.random() * 2 * Math.PI;
                this.v = { x: this.SPEED*Math.cos(a), y: this.SPEED*Math.sin(a) };
            }
        }
        this.pos = vecAdd(this.pos, vecScale(this.v, dt));
    }
}

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
        enemies.push(new ShooterEnemy(rand2dInBounds(bounds), sequence, 0, 'green'));
    }
    for (i = 0; i < numEnemies; ++i) {
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 1);
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: false
        });
        enemies.push(new Enemy(rand2dInBounds(bounds), sequence, 1, 'darkgoldenrod'));
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