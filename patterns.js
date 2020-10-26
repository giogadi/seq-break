// Returns null if no valid point was found
//
// playerAABB: { center, width, height }
function sampleCollisionFreeAABBPos(
    sampleBounds, boxWidth, boxHeight, maxNumTries, enemies, playerAABB = null, tileMapInfo = null, tileSet = null) {
    let checkTileMap = tileMapInfo !== null && tileSet !== null;
    for (let i = 0; i < maxNumTries; ++i) {
        let randPos = rand2dInBounds(sampleBounds);
        if ((!checkTileMap ||
             !isBoxInCollisionWithMap(randPos, boxWidth, boxHeight, tileMapInfo, tileSet)) &&
            (playerAABB === null ||
             !doAABBsOverlap(randPos, boxWidth, boxHeight, playerAABB.center, playerAABB.width, playerAABB.height)) &&
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

function PRLevel1TaskList() {
    let taskList = [];

    taskList.push(new SetStandardKickPattern());
    
    const buzzerSideLength = 0.5;
    let buzzerSoundSeq = createConstantSequence(16, getFreq(NOTES.C, 4));
    let buzzerSeqId = new SequenceId(SequenceType.SYNTH, 0);
    let spawnPt = { x: 11, y: 27.0 };
    for (let i = 0; i < 8; ++i) {
        let initBeatIx = (i % 2 === 0) ? 0 : 4;
        let e = new Buzzer(
            vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
            buzzerSeqId, 'yellow', initBeatIx);
        taskList.push(new SpawnEnemyNew(e));
        spawnPt.y -= 2.0;
    }

    spawnPt = { x: 13, y: 26.0 };
    for (let i = 0; i < 8; ++i) {
        let initBeatIx = (i % 2 === 0) ? 4 : 0;
        let e = new Buzzer(
            vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
            buzzerSeqId, 'yellow', initBeatIx);
        taskList.push(new SpawnEnemyNew(e));
        spawnPt.y -= 2.0;
    }

    taskList.push(new WaitUntilPlayerEntersArea(
        new Bounds2(new Vec2(0, 22.5), new Vec2(23, 23.5))
    ));

    taskList.push(new LockCamera());

    {
        const biggieSideLength = 3.0;
        let biggieSoundSeq = createConstantSequence(16, getFreq(NOTES.C, 4));
        let biggieSeqId = new SequenceId(SequenceType.SYNTH, 0);
        let b = new Biggie(
            new Vec2(11.0, 16.0), biggieSideLength, biggieSoundSeq, biggieSeqId, 'green');
        b.hp = 5;
        taskList.push(new SpawnEnemyNew(b));
    }

    return taskList;
}

function defaultTaskList(gameState) {
    // let taskList = [];
    // taskList.push(new SetStandardKickPattern());
    // taskList.push(new InfiniteWaves());
    // taskList.push(new SpawnKickWave());
    // taskList.push(new OpenDroneFilterAsEnemiesDieUntilAllDead());
    // taskList.push(new WaitForLoopStart());
    // taskList.push(new StationaryShooterWave())
    // taskList.push(new WaitUntilAllEnemiesDead());
    // taskList.push(new BigGuyWave());
    // taskList.push(new WaitUntilAllEnemiesDead());
    // taskList.push(new WaitForLoopStart());
    // taskList.push(new MoverWave());
    // taskList.push(new DumbWave());
    // return taskList;

    return PRLevel1TaskList();
}