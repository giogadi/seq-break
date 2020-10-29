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

class CameraFollowMode {
    constructor(followPlusX, followMinusX, followPlusY, followMinusY) {
        this.followPlusX = followPlusX;
        this.followMinusX = followMinusX;
        this.followPlusY = followPlusY;
        this.followMinusY = followMinusY;
    }
}

class SetCameraFollowMode extends GameTask {
    constructor(cameraFollowMode) {
        super();
        this.cameraFollowMode = cameraFollowMode;
    }
    update(gameState, dt) {
        gameState.cameraFollowMode = this.cameraFollowMode;
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

class WaitNumBeats extends GameTask {
    constructor(numBeats) {
        super();
        this.numBeats = numBeats;
    }
    update(gameState, dt) {
        if (gameState.newBeat) {
            --this.numBeats;
        }
        return this.numBeats <= 0;
    }
}

class Entity {
    constructor() {
        this.alive = false;
    }
    update(g) {}
    draw(g) {}
}

class ItteSign extends Entity {
    constructor(direction) {
        super();
        this.direction = direction;
        this.alive = true;
        this.beatsAlive = 0;
        this.shouldDraw = false;
    }
    update(g) {
        if (g.newBeat) {
            ++this.beatsAlive;
            if (this.beatsAlive > 32) {
                this.alive = false;
                return;
            }
            if (this.beatsAlive % 4 === 0) {
                this.shouldDraw = !this.shouldDraw;
            }
        }
        if (this.shouldDraw) {
            let img = null;
            switch(this.direction) {
                case Directions.UP: img = g.sprites.itteUp; break;
                case Directions.RIGHT: img = g.sprites.itteRight; break;
                case Directions.DOWN: img = g.sprites.itteDown; break;
                case Directions.LEFT: img = g.sprites.itteLeft; break;
            }
            g.canvasCtx.drawImage(
                img,
                Math.floor(0.2 * g.canvas.width), Math.floor(0.1 * g.canvas.height),
                4 * g.pixelsPerUnit, 2 * g.pixelsPerUnit);
        }
    }
}

class SpawnItteSign extends GameTask {
    constructor(direction) {
        super();
        this.direction = direction;
    }
    update(g, dt) {
        g.spawnEntity(new ItteSign(this.direction));
        return true;
    }
}