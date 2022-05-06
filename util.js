// Shuffle xs in [startIndex, endIndex)
function shuffleArray(xs, startIndex, endIndex) {
    for (let i = startIndex; i < endIndex - 1; ++i) {
        let swapIx = Math.floor(randFromInterval(i, endIndex));
        let tmp = xs[i];
        xs[i] = xs[swapIx];
        xs[swapIx] = tmp;
    }
}

function lerp(min, max, t) {
    return min + t * (max - min);
}