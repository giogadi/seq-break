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
        let sequenceId = new SequenceId(SequenceType.SYNTH, 0);
        enemies.push(makeMover(randPos, enemySize, sequence, sequenceId, 'green', -delayBeats));
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
        let sequenceId = new SequenceId(SequenceType.SYNTH, 1);
        // Further offset each enemy's logic by 1 downbeat so they don't all shoot at the same time.
        let delay = delayBeats + 4*i;
        enemies.push(makeStationaryShooter(randPos, enemySize, sequence, sequenceId, 'darkgoldenrod', -delay));
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

class GenerateRandomEnemies extends GameTask {
    constructor(bounds) {
        super();
        this.bounds = bounds;
    }
    update(gameState, dt) {
        gameState.enemies = generateRandomEnemies(
            gameState.NUM_BEATS, gameState.currentBeatIx, this.bounds,
            1.0, gameState.tileMapInfo, gameState.tileSet);
        return true;
    }
}

function lockRoomWithRandomEnemiesTask(gameTasks, roomSpec) {
    gameTasks.push(new WaitUntilPlayerEntersArea(roomSpec.bounds));
    const DOOR_TILE_ID = 205 + 1;
    gameTasks.push(new ChangeTiles(roomSpec.doorLocations, DOOR_TILE_ID));
    gameTasks.push(new GenerateRandomEnemies(roomSpec.bounds));
    gameTasks.push(new WaitUntilAllEnemiesDead());
    const OPEN_TILE_ID = 6 + 1;
    gameTasks.push(new ChangeTiles(roomSpec.doorLocations, OPEN_TILE_ID));
}

class SpawnKickWave extends GameTask {
    update(gameState, dt) {
        let enemySize = 1.0;
        let seqId = new SequenceId(SequenceType.SAMPLE, 0);
        {
            let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
            sequence[0].note = 0;
            let p = { x: 4.0, y: 3.0 };
            gameState.enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
            sequence[4].note = 0;
            let p = { x: 12.0, y: 3.0 };
            gameState.enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
            sequence[8].note = 0;
            let p = { x: 12.0, y: 9.0 };
            gameState.enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
            sequence[12].note = 0;
            let p = { x: 4.0, y: 9.0 };
            gameState.enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        return true;
    }
}

class StationaryShooterWave extends GameTask {
    update(gameState, dt) {
        let enemySize = 1.0;
        const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
        let seqId = new SequenceId(SequenceType.SYNTH, 1);
        let color = 'orange';
        {
            let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
            let sequence = Array.from({length: 16}, e => { return { note: randomNote, sustain: false } });
            sequence[0].note = 0;
            let p = { x: 4.0, y: 3.0 };
            gameState.enemies.push(makeStationaryShooter(p, enemySize, sequence, seqId, 'orange', -1));
        }
        {
            let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
            let sequence = Array.from({length: 16}, e => { return { note: randomNote, sustain: false } });
            sequence[4].note = 0;
            let p = { x: 12.0, y: 3.0 };
            gameState.enemies.push(makeStationaryShooter(p, enemySize, sequence, seqId, 'orange', -2));
        }
        {
            let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
            let sequence = Array.from({length: 16}, e => { return { note: randomNote, sustain: false } });
            sequence[8].note = 0;
            let p = { x: 12.0, y: 9.0 };
            gameState.enemies.push(makeStationaryShooter(p, enemySize, sequence, seqId, 'orange', -3));
        }
        {
            let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 2);
            let sequence = Array.from({length: 16}, e => { return { note: randomNote, sustain: false } });
            sequence[12].note = 0;
            let p = { x: 4.0, y: 9.0 };
            gameState.enemies.push(makeStationaryShooter(p, enemySize, sequence, seqId, 'orange', -4));
        }
        return true;
    }
}

function defaultTaskList(gameState) {
    let taskList = [];
    taskList.push(new SpawnKickWave());
    taskList.push(new OpenDroneFilterAsEnemiesDieUntilAllDead());
    taskList.push(new WaitForLoopStart());
    taskList.push(new StationaryShooterWave())
    return taskList;
}