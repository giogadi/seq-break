function vecDot(u, v) {
    return u.x*v.x + u.y*v.y;
}

function vecNorm(v) {
    return Math.sqrt(vecDot(v, v));
}

function vecScale(v, s) {
    return { x: v.x * s, y: v.y * s };
}

function vecNormalized(v) {
    let d = vecNorm(v);
    console.assert(d > 0.00001, v);
    return vecScale(v, 1.0 / d);
}

function vecAdd(u, v) {
    return {
        x: u.x + v.x,
        y: u.y + v.y
    }
}

// 90 degrees rotated counter-clockwise from v.
function rotate90Ccw(v) {
    return { x: -v.y, y: v.x };
}

function rand2dInBounds(bounds) {
    return {
        x: bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
        y: bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y)
    };
}

// Positive if point is on same side of plane as plane's normal vec
function pointPlaneSignedDist(p, plane_p, plane_n) {
    return vecDot(vecAdd(p, vecScale(plane_p, -1.0)), plane_n);
}

// poly's are arrays of 2d points (ccw)
function findSeparatingPlaneInPoly1Faces(poly1, poly2) {
    // poly1 faces to poly2 points
    for (let i = 0; i < poly1.length; ++i) {
        let u = poly1[i];
        let v = (i == 0) ? poly1[poly1.length - 1] : poly1[i - 1];
        let face_n = rotate90Ccw(vecAdd(v, vecScale(u, -1.0)));
        let valid_sep_plane = true;
        for (let j = 0; j < poly2.length; ++j) {
            if (pointPlaneSignedDist(poly2[j], u, face_n) <= 0.0) {
                valid_sep_plane = false;
                break;
            }
        }
        if (valid_sep_plane) {
            return true;
        }
    }
    return false;
}

function doConvexPolygonsOverlap(poly1, poly2) {
    return !findSeparatingPlaneInPoly1Faces(poly1, poly2) &&
           !findSeparatingPlaneInPoly1Faces(poly2, poly1);
}