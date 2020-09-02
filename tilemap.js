let DUNGEON_TILE_SET_INFO = { "columns":30,
"image":"tiles/dungeon tileset calciumtrice simple.png",
"imageheight":512,
"imagewidth":480,
"margin":0,
"name":"dungeon",
"spacing":0,
"tilecount":960,
"tiledversion":"1.4.2",
"tileheight":16,
"tilewidth":16,
"type":"tileset",
"version":1.4
};

let SIMPLE_DUNGEON_TILE_SET_INFO = { "columns":19,
"image":"tiles/sheet.png",
"imageheight":208,
"imagewidth":304,
"margin":0,
"name":"dungeon_simple",
"spacing":0,
"tilecount":247,
"tiledversion":"1.4.2",
"tileheight":16,
"tilewidth":16,
"type":"tileset",
"version":1.4
};

let TEST_MAP = {
    columns: 8,
    rows: 6,
    data: [32, 34, 34, 34, 34, 33, 34, 35, 62, 64, 65, 64, 62, 63, 65, 64, 122, 129, 130, 131, 129, 131, 131, 180, 151, 184, 183, 184, 182, 185, 189, 135, 151, 183, 183, 188, 183, 184, 185, 136, 151, 183, 183, 185, 183, 186, 185, 135]
};

let TWO_AREAS_MAP = {
    data: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 3, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 20, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 20, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 23, 2, 2, 2, 2, 24, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 40, 40, 40, 40, 5, 7, 7, 7, 7, 7, 22, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 39, 40, 40, 40, 40, 40, 41, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 39, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rows: 13,
    columns: 36
};

async function loadTileSet(tileSetInfo, desiredPixelsPerTile) {
    let tileSetImg = new Image();
    const waitForImgLoad = () =>
        new Promise((resolve) => {
            tileSetImg.addEventListener('load', () => resolve(), {once: true});
        });
    tileSetImg.src = tileSetInfo.image;
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
    
    return {
        info: tileSetInfo,
        canvas: tileSetCanvas,
        canvasCtx: tileSetCanvasCtx,
        ppt: ppt
    }
}