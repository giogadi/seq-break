function vecDot(u, v) {
    return u.x*v.x + u.y*v.y;
}

function vecCross(u, v) {
    return u.x*v.y - u.y*v.x;
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

function vecSub(u, v) {
    return {
        x: u.x - v.x,
        y: u.y - v.y
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

function isPointInBounds(point, bounds) {
    return point.x >= bounds.min.x && point.x <= bounds.max.x &&
        point.y >= bounds.min.y && point.y <= bounds.max.y;
}

function doAABBsOverlap(center1, width1, height1, center2, width2, height2) {
    if (center1.x + 0.5*width1 < center2.x - 0.5*width2 ||
        center1.y + 0.5*height1 < center2.y - 0.5*height2 ||
        center1.x - 0.5*width1 > center2.x + 0.5*width2 ||
        center1.y - 0.5*height1 > center2.y + 0.5*height2) {
        return false;
    }
    return true;
}

function unitVecFromAngle(angle) {
    return {
        x: Math.cos(angle),
        y: Math.sin(angle)
    };
}

// headingVec faces in the direction of height. width and height are full (not half)
function getOOBBCornerPoints(center, headingVec, width, height) {
    let leftVec = rotate90Ccw(headingVec);
    let top = vecScale(headingVec, 0.5 * height);
    let bottom = vecScale(headingVec, -0.5 * height);
    let left = vecScale(leftVec, 0.5 * width);
    let right = vecScale(leftVec, -0.5 * width);
    let topLeft = vecAdd(center, vecAdd(top, left));
    let bottomLeft = vecAdd(center, vecAdd(bottom, left));
    let bottomRight = vecAdd(center, vecAdd(bottom, right));
    let topRight = vecAdd(center, vecAdd(top, right));
    return [topLeft, bottomLeft, bottomRight, topRight];
}

// normalizes angles to [0, 2pi]
// Assumes we're never more than 1 rotation off "normal".
function normalizeAngle(angle) {
    if (angle >= 2*Math.PI) {
        return angle - 2*Math.PI;
    } else if (angle < 0.0) {
        return angle + 2*Math.PI;
    }
}