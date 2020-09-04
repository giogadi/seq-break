function getJsonData(filename) {
    return new Promise(function(resolve, reject) {
        let request = new XMLHttpRequest();
        request.open(
            'GET', 'http://' + window.location.hostname + ":80/" + filename);
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

async function loadTileSet(name, desiredPixelsPerTile) {
    let filenamePrefix = "tiles/";
    let tileSetInfo = await getJsonData(filenamePrefix + name + '.json');

    let tileSetImg = new Image();
    const waitForImgLoad = () =>
        new Promise((resolve) => {
            tileSetImg.addEventListener('load', () => resolve(), {once: true});
        });
    tileSetImg.src = filenamePrefix + tileSetInfo.image;
    await waitForImgLoad();

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
    let o = findObjectInMapByName(tileMapInfo, 'start');
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
    let room1Info = findObjectInMapByName(tileMapInfo, 'room1');
    console.assert(room1Info !== null);
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
    let room1 = {
        bounds: room1Bounds,
        doorLocations: doorLocations
    };

    return {
        info: tileMapInfo,
        width: tileMapInfo.layers[0].width,
        height: tileMapInfo.layers[0].height,
        start: start,
        room: room1
    }
}

function setTile(tileMapInfo, tileMapCol, tileMapRow, tileSetTileId) {
    let tileMapIdx = tileMapInfo.width*tileMapRow + tileMapCol;
    tileMapInfo.info.layers[0].data[tileMapIdx] = tileSetTileId;
}