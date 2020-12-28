function getJsonData(filename) {
    return new Promise(function(resolve, reject) {
        let pathname = window.location.pathname;
        pathname = pathname.substring(0, pathname.lastIndexOf('/'));
        let request = new XMLHttpRequest();
        request.open(
            'GET', 'http://' + window.location.hostname + pathname + "/" + filename);
        request.responseType = 'json';
        request.onload = function() {
            resolve(request.response);
        }
        request.onerror = function() {
            reject(request.statusText);
        }
        request.send();
    });
}

async function loadImgSync(filename) {
    let img = new Image();
    const waitForImgLoad = () =>
        new Promise((resolve) => {
            img.addEventListener('load', () => resolve(), {once: true});
        });
    img.src = filename;
    await waitForImgLoad();
    return img;
}

async function loadTileSet(name, desiredPixelsPerTile) {
    let filenamePrefix = "tiles/";
    let tileSetInfo = await getJsonData(filenamePrefix + name + '.json');

    let tileSetImg = await loadImgSync(filenamePrefix + tileSetInfo.image);

    let ppt = desiredPixelsPerTile;
    let numTileRows = tileSetInfo.tilecount / tileSetInfo.columns;
    let tileSetCanvas = new OffscreenCanvas(
        tileSetInfo.columns * ppt, numTileRows * ppt);
    let tileSetCanvasCtx = tileSetCanvas.getContext('2d');
    tileSetCanvasCtx.mozImageSmoothingEnabled = false;
    tileSetCanvasCtx.webkitImageSmoothingEnabled = false;
    tileSetCanvasCtx.msImageSmoothingEnabled = false;
    tileSetCanvasCtx.imageSmoothingEnabled = false;
    tileSetCanvasCtx.drawImage(
        tileSetImg, 0, 0, tileSetInfo.columns * ppt,
        numTileRows * ppt);
    
    let collisions = new Array(numTileRows * tileSetInfo.columns).fill(false);
    for (let i = 0; i < tileSetInfo.tiles.length; ++i) {
        collisions[tileSetInfo.tiles[i].id] = true;
    }
    
    return {
        info: tileSetInfo,
        collisions: collisions,
        canvas: tileSetCanvas,
        canvasCtx: tileSetCanvasCtx,
        ppt: ppt
    }
}

function findObjectInMapByName(tileMapInfo, name) {
    console.assert(tileMapInfo.layers.length > 1);
    let layer = tileMapInfo.layers[1];
    for (let i = 0; i < layer.objects.length; ++i) {
        let o = layer.objects[i];
        if (o.name === name) {
            return o;
        }
    }
    return null;
}

function findObjectInMapById(tileMapInfo, id) {
    console.assert(tileMapInfo.layers.length > 1);
    let layer = tileMapInfo.layers[1];
    for (let i = 0; i < layer.objects.length; ++i) {
        let o = layer.objects[i];
        if (o.id === id) {
            return o;
        }
    }
    return null;
}

function getMapStartPoint(tileMapInfo) {
    let o = findObjectInMapByName(tileMapInfo, 'start2');
    if (o === null) {
        console.log('no start point found on tilemap!');
        return { x: 0, y: 0 };
    }
    return {
        x: o.x / tileMapInfo.tilewidth,
        y: o.y / tileMapInfo.tilewidth
    }
}

async function loadTileMap(name) {
    let filenamePrefix = "tiles/";
    let tileMapInfo = await getJsonData(filenamePrefix + name + '.json');
    let start = getMapStartPoint(tileMapInfo);
    console.assert(start !== null);

    let rooms = [];
    let room1Info = findObjectInMapByName(tileMapInfo, 'room1');
    if (room1Info !== null) {
        let room1Bounds = {
            min: { x: room1Info.x / tileMapInfo.tilewidth, y: room1Info.y / tileMapInfo.tilewidth },
            max: {
                x: (room1Info.x + room1Info.width) / tileMapInfo.tilewidth,
                y: (room1Info.y + room1Info.height) / tileMapInfo.tilewidth }
        };
        let doorLocations = [];
        for (let propIx = 0; propIx < room1Info.properties.length; ++propIx) {
            let p = room1Info.properties[propIx];
            if (p.name.startsWith('door')) {
                let o = findObjectInMapById(tileMapInfo, p.value);
                console.assert(o !== null);
                doorLocations.push({
                    x: o.x / tileMapInfo.tilewidth, y: o.y / tileMapInfo.tilewidth
                });
            }
        }
        rooms.push({
            bounds: room1Bounds,
            doorLocations: doorLocations
        });
    }

    let laserRoomBounds = null;
    let laserRoomInfo = findObjectInMapByName(tileMapInfo, 'lasers');
    if (laserRoomInfo !== null) {
        laserRoomBounds = {
            min: { x: laserRoomInfo.x / tileMapInfo.tilewidth, y: laserRoomInfo.y / tileMapInfo.tilewidth },
            max: {
                x: (laserRoomInfo.x + laserRoomInfo.width) / tileMapInfo.tilewidth,
                y: (laserRoomInfo.y + laserRoomInfo.height) / tileMapInfo.tilewidth }
        };
    }

    return {
        info: tileMapInfo,
        width: tileMapInfo.layers[0].width,
        height: tileMapInfo.layers[0].height,
        start: start,
        rooms: rooms,
        laserRoomBounds: laserRoomBounds
    }
}

function setTile(tileMapInfo, tileMapCol, tileMapRow, tileSetTileId) {
    let tileMapIdx = tileMapInfo.width*tileMapRow + tileMapCol;
    tileMapInfo.info.layers[0].data[tileMapIdx] = tileSetTileId;
}

function isBoxInCollisionWithMap(center, width, height, tileMapInfo, tileSet) {
    let tileMap = tileMapInfo.info.layers[0];
    let minTileOverlap = {
        x: Math.max(0, Math.floor(center.x - 0.5 * width)),
        y: Math.max(0, Math.floor(center.y - 0.5 * height))
    };
    let maxTileOverlap = {
        x: Math.min(tileMap.width-1, Math.floor(center.x + 0.5 * width)),
        y: Math.min(tileMap.height-1, Math.floor(center.y + 0.5 * height))
    };
    for (let col = minTileOverlap.x; col <= maxTileOverlap.x; ++col) {
        for (let row = minTileOverlap.y; row <= maxTileOverlap.y; ++row) {
            let tileSetIdx = tileMap.data[row*tileMap.width + col] - 1;
            if (tileSet.collisions[tileSetIdx]) {
                return true;
            }
        }
    }
    return false;
}