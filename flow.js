// function makeKickWave() {
//     {
//         let sequence = new Array(16).fill()
//     }
// }

class OneRoomScript {
    constructor(gameState, numBeats) {
        const possibleNotes = [NOTES.C, NOTES.E, NOTES.G, NOTES.B_F];
        let randomNote = getFreq(possibleNotes[Math.floor(Math.random() * possibleNotes.length)], 1);
        let sequence = new Array(numBeats).fill({
            note: randomNote,
            sustain: false
        });
        let p = { x: 4.0, y: 3.0 };
        let enemySize = 1.0;
        
        gameState.enemies.push(makeStationaryShooter(p, enemySize, sequence, 1, 'darkgoldenrod'));
        //gameState.enemies.push(makeMover(p, enemySize, sequence, 1, 'darkgoldenrod'));
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