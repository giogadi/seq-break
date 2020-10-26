class GameTask {
    // If this returns TRUE, then this state is finished.
    update(gameState, dt) {
        return true;
    }
}

class WaitUntilAllEnemiesDead extends GameTask {
    update(gameState, dt) {
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
    update(gameState, dt) {
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
    update(gameState, dt) {
        return isPointInBounds(gameState.playerPos, this.areaBounds);
    }
}

class OpenDroneFilterAsEnemiesDieUntilAllDead extends GameTask {
    constructor() {
        super();
        this.prevNumEnemies = null;
    }
    update(gameState, dt) {
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
        if (numEnemiesKilled > 0) {
            let filterVal = gameState.sound.droneFilter.frequency.value;
            gameState.sound.droneFilter.frequency.setValueAtTime(
                filterVal, gameState.sound.audioCtx.currentTime);
            gameState.sound.droneFilter.frequency.linearRampToValueAtTime(
                filterVal + 200*numEnemiesKilled, gameState.sound.audioCtx.currentTime + 1.0);
        }
        this.prevNumEnemies = newEnemyCount;
        return newEnemyCount === 0;
    }
}

class WaitForTime extends GameTask {
    constructor(waitTime) {
        super();
        this.waitTime = waitTime;
        this.timeElapsed = 0.0;
    }
    update(gameState, dt) {
        this.timeElapsed += dt;
        return this.timeElapsed >= this.waitTime;
    }
}

class WaitForLoopStart extends GameTask {
    constructor() {
        super();
    }
    update(gameState, dt) {
        return gameState.newBeat && gameState.currentBeatIx === 0;
    }
}

class LockCamera extends GameTask {
    update(gameState, dt) {
        gameState.followPlayer = false;
        return true;
    }
}

class UnlockCamera extends GameTask {
    update(gameState, dt) {
        gameState.followPlayer = true;
        return true;
    }
}

class SpawnEnemyNew extends GameTask {
    constructor(enemy) {
        super();
        this.enemy = enemy;
    }
    update(gameState, dt) {
        gameState.spawnEnemy(this.enemy);
        return true;
    }
}

class SetStandardKickPattern extends GameTask {
    update(gameState, dt) {
        let kickIx = 0;
        gameState.sampleSequences[kickIx][0].freq = gameState.sampleSequences[kickIx][4].freq = gameState.sampleSequences[kickIx][8].freq = gameState.sampleSequences[kickIx][12].freq = 0;
        return true;
    }
}