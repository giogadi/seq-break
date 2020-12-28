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

class BiggieAndCrissCrossBuzzers extends GameTask {
    constructor() {
        super();
        this.state = 0;
        this.biggieIx = -1;
    }
    update(gameState, dt) {
        if (!gameState.newBeat) {
            return false;
        }
        let done = false;
        switch (this.state) {
            case 0: {
                const biggieSideLength = 3.0;
                let biggieSoundSeq = createConstantSequence(16, getFreq(NOTES.C, 1));
                let biggieSeqId = new SequenceId(SequenceType.SYNTH, 3);  // BASS
                let bounds = getCameraBounds(gameState);
                let biggiePos = new Vec2(bounds.max.x + 2*biggieSideLength, gameState.cameraPos.y);
                let b = new Biggie(
                    biggiePos, biggieSideLength, biggieSoundSeq, biggieSeqId, 'green');
                b.hp = 5;
                this.biggieIx = gameState.spawnEnemy(b);
                break;
            }
            case 24: {
                let buzzerSideLength = 0.5;
                let buzzerSeqId = new SequenceId(SequenceType.SYNTH, 0);
                let possibleFreqs = [NOTES.C, NOTES.D, NOTES.F, NOTES.G, NOTES.A].map(x => getFreq(x, 4));
                let buzzerSoundSeq = createConstantSequence(16, getFreq(NOTES.C, 4));
                for (let i = 0; i < buzzerSoundSeq.length; ++i) {
                    buzzerSoundSeq[i].freq = possibleFreqs[i % possibleFreqs.length];
                }                

                let halfDims = new Vec2(0.3 * gameState.viewWidthInUnits, 0.3 * gameState.viewHeightInUnits);
                let spawnBounds = new Bounds2(vecSub(gameState.cameraPos, halfDims), vecAdd(gameState.cameraPos, halfDims));
                let randPt = rand2dInBounds(spawnBounds);
                let cameraBounds = getCameraBounds(gameState);

                let spawnPt = new Vec2(cameraBounds.min.x - 1.0, randPt.y);
                for (let i = 0; i < 4; ++i) {
                    let initState = (i % 2 === 0) ? 4 : 0;
                    let e = new Buzzer(
                        vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
                        buzzerSeqId, 'yellow', initState);
                    e.mainAngle = 0.0;
                    e.speed = 10.0;
                    gameState.spawnEnemy(e);
                    spawnPt.x -= 2.0;
                }

                spawnPt = new Vec2(randPt.x, cameraBounds.min.y - 1.0);
                for (let i = 0; i < 4; ++i) {
                    let initState = (i % 2 === 0) ? 0 : 4;
                    let e = new Buzzer(
                        vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
                        buzzerSeqId, 'yellow', initState);
                    e.speed = 10.0;
                    gameState.spawnEnemy(e);
                    spawnPt.y -= 2.0;
                }
                break;
            }
            case 48: {
                if (gameState.enemies[this.biggieIx].alive) {
                    this.state = 23;
                } else {
                    done = true;
                }
                break;
            }
        }
        ++this.state;
        return done;
    }
}

class LaserRoom extends GameTask {
    constructor(bounds) {
        super();
        this.bounds = bounds;
        this.lasers = [];
    }
    update(g, dt) {
        if (!g.newBeat) {
            return false;
        }
        let freqs = [];
        for (let i = 0; i < this.lasers.length; ++i) {
            let laser = g.entities[this.lasers[i]];
            if (laser.alive && laser.steppedOn && laser.beat === 8) {
                freqs.push(laser.freq);
            }
        }
        const seqId = new SequenceId(SequenceType.SYNTH, 4);
        let seq = g.getSequence(seqId);
        if (freqs.length > 0) {
            if (freqs.length <= 4) {
                for (let i = 0; i < 4; ++i) {
                    let f = (i < freqs.length) ? freqs[i] : -1;
                    for (let j = 0; j < 4; ++j) {
                        seq[(g.currentBeatIx + i + 4*j) % seq.length].freq = f;
                    }
                }
            } else {
                for (let i = 0; i < seq.length; ++i) {
                    seq[(g.currentBeatIx + i) % seq.length].freq = freqs[i % freqs.length];
                }
            }
        }
        if (this.anyLaserStillAlive(g)) {
            return false;
        }
        let possibleNotes =
            [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A, NOTES.B_F].map(n => getFreq(n, 2));
        possibleNotes = possibleNotes.concat(
            [NOTES.C, NOTES.D, NOTES.E, NOTES.G, NOTES.A, NOTES.B_F].map(n => getFreq(n, 3)));
        this.lasers = [];
        let bounds = this.bounds;

        // Up-and-down
        let p1First = true;
        let laserIx = 0;
        for (; laserIx < 28; ++laserIx) {
            let p1 = new Vec2(randFromInterval(bounds.min.x, bounds.max.x), bounds.min.y - 1.0);
            let p2 = new Vec2(randFromInterval(bounds.min.x, bounds.max.x), bounds.max.y + 1.0);
            let f = possibleNotes[laserIx % possibleNotes.length];
            this.lasers.push(g.spawnEntity(new LaserBeam(p1First ? p1 : p2, p1First ? p2 : p1, f, false)));
            p1First = !p1First;
        }

        // left-to-right
        // for (; laserIx < 36; ++laserIx) {
        //     let p1 = new Vec2(bounds.min.x - 1.0, randFromInterval(bounds.min.y, bounds.max.y));
        //     let p2 = new Vec2(bounds.max.x + 1.0, randFromInterval(bounds.min.y, bounds.max.y));
        //     let f = possibleNotes[laserIx % possibleNotes.length];
        //     this.lasers.push(g.spawnEntity(new LaserBeam(p1First ? p1 : p2, p1First ? p2 : p1, f, true)));
        //     p1First = !p1First;
        // }
        return false;
    }
    anyLaserStillAlive(g) {
        for (let i = 0; i < this.lasers.length; ++i) {
            if (g.entities[this.lasers[i]].alive) {
                return true;
            }
        }
        return false;
    }
}

// TODO: Change the "static" spawn points to hard-coded into one task, not separate tasks.
function PRLevel1TaskList(gameState) {
    let taskList = [];

    taskList.push(new SetCameraFollowMode(new CameraFollowMode(false, false, true, true)));

    taskList.push(new SetStandardKickPattern());
    
    let possibleFreqs = [NOTES.C, NOTES.D, NOTES.F, NOTES.G, NOTES.A].map(x => getFreq(x, 4));
    const buzzerSideLength = 0.5;
    let buzzerSoundSeq = createConstantSequence(16, getFreq(NOTES.C, 4));
    for (let i = 0; i < buzzerSoundSeq.length; ++i) {
        buzzerSoundSeq[i].freq = possibleFreqs[i % possibleFreqs.length];
    }
    let buzzerSeqId = new SequenceId(SequenceType.SYNTH, 0);
    let spawnPt = { x: 11, y: 27.0 };
    for (let i = 0; i < 6; ++i) {
        let initBeatIx = (i % 2 === 0) ? 0 : 4;
        let e = new Buzzer(
            vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
            buzzerSeqId, 'yellow', initBeatIx);
        taskList.push(new SpawnEnemyNew(e));
        spawnPt.y -= 2.0;
    }

    spawnPt = { x: 13, y: 26.0 };
    for (let i = 0; i < 6; ++i) {
        let initBeatIx = (i % 2 === 0) ? 4 : 0;
        let e = new Buzzer(
            vecClone(spawnPt), buzzerSideLength, buzzerSoundSeq,
            buzzerSeqId, 'yellow', initBeatIx);
        taskList.push(new SpawnEnemyNew(e));
        spawnPt.y -= 2.0;
    }

    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(11.5, 25.5), gameState.sprites.firewheel, 8, 0, 4, true)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(12.5, 25.5), gameState.sprites.firewheel, 8, 4, 7, false)));

    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(9.5, 22.5), gameState.sprites.firewheel, 8, 0, 4, true)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(10.5, 22.5), gameState.sprites.firewheel, 8, 0, 4, false)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(11.5, 22.5), gameState.sprites.firewheel, 8, 0, 4, true)));

    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(11.5, 19.5), gameState.sprites.firewheel, 16, 0, 4, false)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(12.5, 19.5), gameState.sprites.firewheel, 16, 4, 8)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(13.5, 19.5), gameState.sprites.firewheel, 16, 8, 12)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(14.5, 19.5), gameState.sprites.firewheel, 16, 12, 0, true)));

    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(14.5, 16.5), gameState.sprites.firewheel, 12, 2, 6, true)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(15.5, 16.5), gameState.sprites.firewheel, 12, 6, 10, true)));
    taskList.push(new SpawnEnemyNew(new Firewheel(new Vec2(16.5, 16.5), gameState.sprites.firewheel, 12, 10, 2, false)));

    possibleFreqs = [NOTES.C, NOTES.D, NOTES.F, NOTES.G, NOTES.A].map(x => getFreq(x, 1));
    const seqId = new SequenceId(SequenceType.SYNTH, 1);

    taskList.push(new SpawnChoiceSwitchSet(
        [new ChoiceSwitchSpec(boundsFromCellIndex(11, 25), "red", seqId, 0, possibleFreqs[0]),
         new ChoiceSwitchSpec(boundsFromCellIndex(12, 25), "blue", seqId, 0, possibleFreqs[1])]
    ));

    taskList.push(new SpawnChoiceSwitchSet(
        [new ChoiceSwitchSpec(boundsFromCellIndex(9, 22), "red", seqId, 2, possibleFreqs[0]),
         new ChoiceSwitchSpec(boundsFromCellIndex(10, 22), "blue", seqId, 2, possibleFreqs[1]),
         new ChoiceSwitchSpec(boundsFromCellIndex(11, 22), "green", seqId, 2, possibleFreqs[2])]
    ));

    taskList.push(new SpawnChoiceSwitchSet(
        [new ChoiceSwitchSpec(boundsFromCellIndex(11, 19), "red", seqId, 4, possibleFreqs[0]),
         new ChoiceSwitchSpec(boundsFromCellIndex(12, 19), "blue", seqId, 4, possibleFreqs[1]),
         new ChoiceSwitchSpec(boundsFromCellIndex(13, 19), "green", seqId, 4, possibleFreqs[2]),
         new ChoiceSwitchSpec(boundsFromCellIndex(14, 19), "purple", seqId, 4, possibleFreqs[3])]
    ));

    taskList.push(new SpawnChoiceSwitchSet(
        [new ChoiceSwitchSpec(boundsFromCellIndex(14, 16), "red", seqId, 6, possibleFreqs[0]),
         new ChoiceSwitchSpec(boundsFromCellIndex(15, 16), "blue", seqId, 6, possibleFreqs[1]),
         new ChoiceSwitchSpec(boundsFromCellIndex(16, 16), "green", seqId, 6, possibleFreqs[2])]
    ));

    taskList.push(new WaitUntilPlayerEntersArea(
        new Bounds2(new Vec2(5.0, 1.0), new Vec2(18.0, 6.0))
    ));

    taskList.push(new SetCameraFollowMode(new CameraFollowMode(false, false, false, false)));

    taskList.push(new BiggieAndCrissCrossBuzzers());

    taskList.push(new SpawnItteSign(Directions.RIGHT));

    taskList.push(new SetCameraFollowMode(new CameraFollowMode(true, true, false, false)));

    taskList.push(new WaitUntilPlayerEntersArea(
        new Bounds2(new Vec2(28.0, 0.0), new Vec2(35.0, 12.0))));

    taskList.push(new CopySequence(new SequenceId(SequenceType.SYNTH, 1), new SequenceId(SequenceType.SYNTH, 2)));
    taskList.push(new ClearSequence(new SequenceId(SequenceType.SYNTH, 1)));
    taskList.push(new SetCameraFollowMode(new CameraFollowMode(false, false, false, false)));
    taskList.push(new StartXYModulator(
        new SequenceId(SequenceType.SYNTH, 2),
        ModulatorDest.GAIN_RELEASE, ModulatorDest.FILTER_ENV_INTENSITY));

    taskList.push(new WaitForLoopStart());
    taskList.push(new LaserRoom());

    return taskList;
}

class SetTestSequence extends GameTask {
    constructor(seqId) {
        super();
        this.seqId = seqId;
    }
    update(g, dt) {
        let s = g.getSequence(this.seqId);
        for (let i = 0; i < s.length; ++i) {
            // switch (i) {
            //     case 0: s[i].freq = getFreq(NOTES.C, 2); break;
            //     case 4: s[i].freq = getFreq(NOTES.E, 2); break;
            //     case 8: s[i].freq = getFreq(NOTES.G, 2); break;
            //     case 12: s[i].freq = getFreq(NOTES.B_F, 3); break;
            //     default: break;
            // }
            switch (i % 4) {
                case 0: s[i].freq = getFreq(NOTES.C, 2); break;
                case 1: s[i].freq = getFreq(NOTES.E, 2); break;
                case 2: s[i].freq = getFreq(NOTES.G, 2); break;
                case 3: s[i].freq = getFreq(NOTES.B_F, 3); break;
                default: break;
            }
        }
        return true;
    }
}

function testTaskList(g) {
    let taskList = [];
    taskList.push(new SetStandardKickPattern());
    // taskList.push(new SetTestSequence(new SequenceId(SequenceType.SYNTH, 1)));
    taskList.push(new CopySequence(new SequenceId(SequenceType.SYNTH, 1), new SequenceId(SequenceType.SYNTH, 2)));
    taskList.push(new ClearSequence(new SequenceId(SequenceType.SYNTH, 1)));
    taskList.push(new SetCameraFollowMode(new CameraFollowMode(true, false, false, false)));
    // taskList.push(new StartXYModulator(
    //     new SequenceId(SequenceType.SYNTH, 2),
    //     ModulatorDest.GAIN_RELEASE, ModulatorDest.FILTER_ENV_INTENSITY));

    taskList.push(new LaserRoom(g.tileMapInfo.laserRoomBounds));
    return taskList;
}

function defaultTaskList(gameState) {
    // return PRLevel1TaskList(gameState);
    return testTaskList(gameState);
}