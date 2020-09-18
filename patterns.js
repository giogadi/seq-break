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
        let randPos = sampleCollisionFreeAABBPos(
            bounds, enemySize, enemySize, 50, enemies, tileMapInfo, tileSet);
        console.assert(randPos !== null);

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
        let sequence = new Array(numBeats);
        for (let j = 0; j < sequence.length; ++j) {
            sequence[j] = new SequenceElement(randomNote);
        }
        let sequenceId = new SequenceId(SequenceType.SYNTH, 0);
        enemies.push(makeMover(randPos, enemySize, sequence, sequenceId, 'green', -delayBeats));
    }
    for (i = 0; i < 4; ++i) {
        let randPos = sampleCollisionFreeAABBPos(
            bounds, enemySize, enemySize, 50, enemies, tileMapInfo, tileSet);
        console.assert(randPos !== null);

        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 1);
        let sequence = new Array(numBeats);
        for (let j = 0; j < sequence.length; ++j) {
            sequence[j] = new SequenceElement(randomNote);
        }
        let sequenceId = new SequenceId(SequenceType.SYNTH, 1);
        // Further offset each enemy's logic by 1 downbeat so they don't all shoot at the same time.
        let delay = delayBeats + 4*i;
        enemies.push(makeStationaryShooter(randPos, enemySize, sequence, sequenceId, 'darkgoldenrod', -delay));
    }
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
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(-1); });
            sequence[0].freq = 0;
            let p = { x: 4.0, y: 3.0 };
            gameState.spawnEnemy(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(-1); });
            sequence[4].freq = 0;
            let p = { x: 12.0, y: 3.0 };
            gameState.spawnEnemy(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(-1); });
            sequence[8].freq = 0;
            let p = { x: 12.0, y: 9.0 };
            gameState.spawnEnemy(new Enemy(p, enemySize, sequence, seqId, 'purple'));
        }
        {
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(-1); });
            sequence[12].freq = 0;
            let p = { x: 4.0, y: 9.0 };
            gameState.spawnEnemy(new Enemy(p, enemySize, sequence, seqId, 'purple'));
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
        let positions = [
            { x: 4.0, y: 3.0 },
            { x: 12.0, y: 3.0},
            { x: 12.0, y: 9.0},
            { x: 4.0, y: 9.0 }
        ];
        for (let i = 0; i < positions.length; ++i) {
            let note = getFreq(possibleNotes[i % possibleNotes.length], 1);
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(note); });
            gameState.spawnEnemy(makeStationaryShooter(positions[i], enemySize, sequence, seqId, 'orange', -1));
        }
        return true;
    }
}

class BigGuyWave extends GameTask {
    update(gameState, dt) {
        {
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(getFreq(NOTES.C, 0))});
            let p = { x: 4.0, y: 3.0 };
            gameState.spawnEnemy(new BigGuy(p, sequence, new SequenceId(SequenceType.SYNTH, 3)));
        }

        {
            let sequence = Array.from({length: 16}, e => { return new SequenceElement(getFreq(NOTES.C, 0))});
            let p = { x: 12.0, y: 9.0 };
            gameState.spawnEnemy(new BigGuy(p, sequence, new SequenceId(SequenceType.SYNTH, 3)));
        }
        return true;
    }
}

class MoverWave extends GameTask {
    update(gameState, dt) {
        const enemySize = 1.0;
        const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
        // Delay enemy logic sequences so that they start on a downbeat.
        let downbeatOffset = gameState.currentBeatIx % 4;
        let delayBeats = 0;
        // 0 -> 0, 1 -> 3, 2 -> 2, 3 -> 1
        if (downbeatOffset !== 0) {
            delayBeats = 4 - downbeatOffset;
        }
        const bounds = {
            min: { x: 0.0, y: 0.0 },
            max: { x: 15.0, y: 9.0 }
        }
        for (let i = 0; i < 10; ++i) {
            let randPos = sampleCollisionFreeAABBPos(
                bounds, enemySize, enemySize, 50, gameState.enemies, gameState.tileMapInfo, gameState.tileSet);
            console.assert(randPos !== null);
    
            let note = getFreq(possibleNotes[i % possibleNotes.length], 3);
            // let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 3);
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
            let sequence = new Array(16);
            for (let j = 0; j < 16; ++j) {
                sequence[j] = new SequenceElement(note);
            }
            let sequenceId = new SequenceId(SequenceType.SYNTH, 0);
            gameState.spawnEnemy(makeMover(randPos, enemySize, sequence, sequenceId, 'green', -delayBeats));
        }
        return true;
    }
}

// Returns null if no valid point was found
function sampleCollisionFreeAABBPos(
    sampleBounds, boxWidth, boxHeight, maxNumTries, enemies, tileMapInfo = null, tileSet = null) {
    let checkTileMap = tileMapInfo !== null && tileSet !== null;
    for (let i = 0; i < maxNumTries; ++i) {
        let randPos = rand2dInBounds(sampleBounds);
        if ((!checkTileMap ||
             !isBoxInCollisionWithMap(randPos, boxWidth, boxHeight, tileMapInfo, tileSet)) &&
            !aabbCollidesWithSomeEnemy(randPos, boxWidth, boxHeight, enemies)) {
            return randPos;
        }
    }
    return null;
}

function getDownBeatDelay(currentBeatIx) {
    let downbeatOffset = currentBeatIx % 4;
    let delayBeats = 0;
    // 0 -> 0, 1 -> 3, 2 -> 2, 3 -> 1
    if (downbeatOffset !== 0) {
        delayBeats = 4 - downbeatOffset;
    }
    return delayBeats;
}

class InfiniteWaves extends GameTask {
    constructor() {
        super();
        this.bounds = {
            min: { x: 0.0, y: 0.0 },
            max: { x: 15.0, y: 9.0 }
        };
    }
    update(g, dt) {
        let allEnemiesDead = true;
        for (let i = 0; i < g.enemies.length; ++i) {
            if (g.enemies[i].alive) {
                allEnemiesDead = false;
                break;
            }
        }

        if (allEnemiesDead) {
            this.makeRandomEnemies(g, this.bounds);
        }
        return false;
    }
    makeRandomEnemies(g, bounds) {
        const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
        const downBeatDelay = getDownBeatDelay(g.currentBeatIx);

        // Shooters
        let numEnemies = Math.random() * 4;
        let enemySize = 1.0;
        let seqId = new SequenceId(SequenceType.SYNTH, 1);
        for (let i = 0; i < numEnemies; ++i) {
            let randPos = sampleCollisionFreeAABBPos(
                bounds, enemySize, enemySize, 50, g.enemies, g.tileMapInfo, g.tileSet);
            console.assert(randPos !== null);

            let note = getFreq(possibleNotes[i % possibleNotes.length], 1);
            let seq = createConstantSequence(16, note);
            g.spawnEnemy(makeStationaryShooter(randPos, enemySize, seq, seqId, 'darkgoldenrod', -downBeatDelay));
        }

        // Big guys
        numEnemies = Math.random() * 2;
        // TODO: This is actually not being passed to bigguy's constructor, BE CAREFUL
        enemySize = 1.5;
        seqId = new SequenceId(SequenceType.SYNTH, 3);
        for (let i = 0; i < numEnemies; ++i) {
            let randPos = sampleCollisionFreeAABBPos(
                bounds, enemySize, enemySize, 50, g.enemies, g.tileMapInfo, g.tileSet);
            console.assert(randPos !== null);

            let note = getFreq(possibleNotes[i % possibleNotes.length], 0);
            let seq = createConstantSequence(16, note);
            g.spawnEnemy(new BigGuy(randPos, seq, seqId));
        }

        // Movers
        numEnemies = Math.random() * 8;
        enemySize = 1.0;
        seqId = new SequenceId(SequenceType.SYNTH, 0);
        for (let i = 0; i < numEnemies; ++i) {
            let randPos = sampleCollisionFreeAABBPos(
                bounds, enemySize, enemySize, 50, g.enemies, g.tileMapInfo, g.tileSet);
            console.assert(randPos !== null);

            let note = getFreq(possibleNotes[i % possibleNotes.length], 3);
            let seq = createConstantSequence(16, note);
            g.spawnEnemy(makeMover(randPos, enemySize, seq, seqId, 'green', -downBeatDelay));
        }
    }
}

class SetStandardKickPattern extends GameTask {
    update(gameState, dt) {
        gameState.sampleSequences[0][0].freq = gameState.sampleSequences[0][4].freq = gameState.sampleSequences[0][8].freq = gameState.sampleSequences[0][12].freq = 0;
        return true;
    }
}

function defaultTaskList(gameState) {
    let taskList = [];
    taskList.push(new SetStandardKickPattern());
    // taskList.push(new SpawnKickWave());
    // taskList.push(new OpenDroneFilterAsEnemiesDieUntilAllDead());
    // taskList.push(new WaitForLoopStart());
    // taskList.push(new StationaryShooterWave())
    // taskList.push(new WaitUntilAllEnemiesDead());
    // taskList.push(new BigGuyWave());
    // taskList.push(new WaitUntilAllEnemiesDead());
    // taskList.push(new WaitForLoopStart());
    // taskList.push(new MoverWave());
    taskList.push(new InfiniteWaves());
    return taskList;
}