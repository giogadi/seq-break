class GameTask {
    // If this returns TRUE, then this state is finished.
    update(gameState) {
        return true;
    }
}

class WaitUntilAllEnemiesDead extends GameTask {
    update(gameState) {
        for (let eIx = 0; eIx < gameState.enemies.length; ++eIx) {
            if (gameState.enemies[eIx].alive) {
                return false;
            }
        }
        return true;
    }
}

class ChangeTiles extends GameTask {
    constructor(tileLocations, newTileId) {
        super();
        this.tileLocations = tileLocations;
        this.newTileId = newTileId;
    }
    update(gameState) {
        for (let locationIx = 0; locationIx < this.tileLocations.length; ++locationIx) {
            let loc = this.tileLocations[locationIx];
            setTile(gameState.tileMapInfo, loc.x, loc.y, this.newTileId);
        }
        return true;
    }
}

class WaitUntilPlayerEntersArea extends GameTask {
    constructor(areaBounds) {
        super();
        this.areaBounds = areaBounds;
    }
    update(gameState) {
        return isPointInBounds(gameState.playerPos, this.areaBounds);
    }
}

class GenerateRandomEnemies extends GameTask {
    constructor(bounds) {
        super();
        this.bounds = bounds;
    }
    update(gameState) {
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
    update(gameState) {
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

class OpenDroneFilterAsEnemiesDieUntilAllDead extends GameTask {
    constructor() {
        super();
        this.prevNumEnemies = null;
    }
    update(gameState) {
        // TODO: this does _not_ account for enemies being spawned while this task is active.
        let newEnemyCount = 0;
        for (let i = 0; i < gameState.enemies.length; ++i) {
            if (gameState.enemies[i].alive) {
                ++newEnemyCount;
            }
        }
        if (this.prevNumEnemies === null) {
            this.prevNumEnemies = newEnemyCount;
        }
        let numEnemiesKilled = this.prevNumEnemies - newEnemyCount;
        if (numEnemiesKilled <= 0) {
            return;
        }
        let filterVal = gameState.sound.droneFilter.frequency.value;
        gameState.sound.droneFilter.frequency.setValueAtTime(
            filterVal, gameState.sound.audioCtx.currentTime);
        gameState.sound.droneFilter.frequency.linearRampToValueAtTime(
            filterVal + 200*numEnemiesKilled, gameState.sound.audioCtx.currentTime + 1.0);
        this.prevNumEnemies = newEnemyCount;
    }
}

function defaultTaskList(gameState) {
    let taskList = [];
    taskList.push(new SpawnKickWave());
    taskList.push(new OpenDroneFilterAsEnemiesDieUntilAllDead());
    return taskList;
}