class RoomState {
    onStateStart() {

    }
    // If this returns TRUE, then this state is finished.
    update() {
        return true;
    }
    onStateEnd() {

    }
}

function makeKickWave() {
    enemies = [];
    let enemySize = 1.0;
    let seqId = new SequenceId(SequenceType.SAMPLE, 0);
    {
        let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
        sequence[0].note = 0;
        let p = { x: 4.0, y: 3.0 };
        enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
    }
    {
        let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
        sequence[4].note = 0;
        let p = { x: 12.0, y: 3.0 };
        enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
    }
    {
        let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
        sequence[8].note = 0;
        let p = { x: 12.0, y: 9.0 };
        enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
    }
    {
        let sequence = Array.from({length: 16}, e => { return { note: -1, sustain: false } });
        sequence[12].note = 0;
        let p = { x: 4.0, y: 9.0 };
        enemies.push(new Enemy(p, enemySize, sequence, seqId, 'purple'));
    }
    return enemies;
}

class OneRoomScript {
    constructor(gameState, numBeats) {
        // clear out default kick sequence
        let kickSeq = gameState.sampleSequences[0];
        for (let i = 0; i < kickSeq.length; ++i) {
            kickSeq[i].note = -1;
        }
        gameState.enemies = makeKickWave();
    }
    update() {
        
    }
}

class KillAllEnemiesRoomLogic {
    constructor(gameState, roomSpec) {
        this.gameState = gameState;
        this.roomSpec = roomSpec;
        this.ENEMY_SIZE = 1.0;
        // 0: untriggered
        // 1: waiting for enemies to die
        // 2: unlocked/finished
        this.state = 0;
    }
    untriggeredLogic() {
        if (!isPointInBounds(this.gameState.playerPos, this.roomSpec.bounds)) {
            return;
        }
        this.gameState.enemies = generateRandomEnemies(
            this.gameState.NUM_BEATS, this.gameState.currentBeatIx, this.roomSpec.bounds, this.ENEMY_SIZE,
            this.gameState.tileMapInfo, this.gameState.tileSet);
        const DOOR_TILE_ID = 205 + 1;
        for (let doorIx = 0; doorIx < this.roomSpec.doorLocations.length; ++doorIx) {
            let loc = this.roomSpec.doorLocations[doorIx];
            setTile(this.gameState.tileMapInfo, loc.x, loc.y, DOOR_TILE_ID);
        }
        this.state = 1;
    }
    triggeredLogic() {
        for (let eIx = 0; eIx < this.gameState.enemies.length; ++eIx) {
            if (this.gameState.enemies[eIx].alive) {
                return;
            }
        }
        const OPEN_TILE_ID = 6 + 1;
        for (let doorIx = 0; doorIx < this.roomSpec.doorLocations.length; ++doorIx) {
            let loc = this.roomSpec.doorLocations[doorIx];
            setTile(this.gameState.tileMapInfo, loc.x, loc.y, OPEN_TILE_ID);
        }
        this.state = 2;
    }
    update() {
        switch (this.state) {
            case 0: this.untriggeredLogic(); break;
            case 1: this.triggeredLogic(); break;
        }
    }
}