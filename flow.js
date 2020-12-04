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
        this.alive = true;
        this.screenSpace = false;
    }
    update(g, dt) {}
    draw(g) {}
}

function createDeadEntity() {
    let e = new Entity();
    e.alive = false;
    return e;
}

class ItteSign extends Entity {
    constructor(direction) {
        super();
        this.direction = direction;
        this.screenSpace = true;
        this.beatsAlive = 0;
        this.shouldDraw = false;
    }
    draw(g) {
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

class ChoiceSwitchSpec {
    constructor(bounds, color, seqId, beatIx, freq) {
        this.bounds = bounds;
        this.color = color;
        this.seqId = seqId;
        this.beatIx = beatIx;
        this.freq = freq;
    }
}

class ChoiceSwitchSet extends Entity {
    constructor(switchSpecs) {
        super();
        this.switches = switchSpecs;
        this.selectedIx = -1;
    }
    draw(g) {
        if (this.selectedIx < 0) {
            for (let i = 0; i < this.switches.length; ++i) {
                let s = this.switches[i];
                if (isPointInBounds(g.playerPos, s.bounds)) {
                    let seq = g.getSequence(s.seqId);
                    seq[s.beatIx].freq = seq[s.beatIx + 8].freq = s.freq;
                    this.selectedIx = i;
                    break;
                }
            }
        }

        if (this.selectedIx >= 0) {
            let s = this.switches[this.selectedIx];
            g.canvasCtx.fillStyle = s.color;
            g.canvasCtx.globalAlpha = 0.25;
            g.canvasCtx.fillRect(
                s.bounds.min.x * g.pixelsPerUnit, s.bounds.min.y * g.pixelsPerUnit,
                (s.bounds.max.x - s.bounds.min.x) * g.pixelsPerUnit,
                (s.bounds.max.y - s.bounds.min.y) * g.pixelsPerUnit);
            g.canvasCtx.globalAlpha = 1.0;
        }
    }
}

class SpawnChoiceSwitchSet extends GameTask {
    constructor(switchSpecs) {
        super();
        this.switchSpecs = switchSpecs;
    }
    update(g, dt) {
        g.spawnEntity(new ChoiceSwitchSet(this.switchSpecs));
        return true;
    }
}

class LaserBeam extends Entity {
    constructor(p1, p2) {
        super();
        this.p1 = p1;
        this.p2 = p2;
        this.t = 0.0;
    }
    static TIME_TO_TRACE = 0.5;
    static TIME_TO_ACTIVE = 1.0;
    static TIME_TO_INACTIVE = 2.0;
    update(g, dt) {
        this.t += dt;
        if (this.t >= LaserBeam.TIME_TO_INACTIVE) {
            this.alive = false;
            return;
        } else if (this.t >= LaserBeam.TIME_TO_ACTIVE) {
            if (g.invulnTimer < 0.0) {
                // TODO: cache this
                let playerHurtBox = getOOBBCornerPoints(
                    g.playerPos, {x: 1.0, y: 0.0}, g.playerCollisionWidth, g.playerCollisionHeight);
                let plane_p = vecClone(this.p1);
                let plane_n = vecNormalized(rotate90Ccw(vecSub(this.p2, this.p1)));
                let d = pointPlaneSignedDist(playerHurtBox[0], plane_p, plane_n);
                for (let i = 1; i < playerHurtBox.length; ++i) {
                    let new_d = pointPlaneSignedDist(playerHurtBox[i], plane_p, plane_n);
                    if ((new_d > 0) !== (d > 0)) {
                        g.invulnTimer = 0.0;
                        break;
                    }
                }
            }
        }
    }
    draw(g, dt) {
        let fraction = 1.0;
        let color = 'red';
        if (this.t <= LaserBeam.TIME_TO_ACTIVE) {
            fraction = this.t / LaserBeam.TIME_TO_TRACE;
            color = 'gray'
        }
        g.canvasCtx.strokeStyle = color;
        g.canvasCtx.beginPath();
        g.canvasCtx.moveTo(this.p1.x * g.pixelsPerUnit, this.p1.y * g.pixelsPerUnit);
        let endPt = vecAdd(this.p1, vecScale(vecSub(this.p2, this.p1), fraction));
        g.canvasCtx.lineTo(endPt.x * g.pixelsPerUnit, endPt.y * g.pixelsPerUnit);
        g.canvasCtx.stroke();
    }
}