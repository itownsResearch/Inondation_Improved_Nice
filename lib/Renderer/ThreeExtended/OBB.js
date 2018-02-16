'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Coordinates = require('../../Core/Geographic/Coordinates');

var _Coordinates2 = _interopRequireDefault(_Coordinates);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function OBB(min, max) {
    THREE.Object3D.call(this);
    this.box3D = new THREE.Box3(min.clone(), max.clone());
    this.natBox = this.box3D.clone();
    this.update();
    this.z = { min: 0, max: 0 };
}

OBB.prototype = (0, _create2.default)(THREE.Object3D.prototype);
OBB.prototype.constructor = OBB;

OBB.prototype.clone = function () {
    var cOBB = new OBB(this.natBox.min, this.natBox.max);
    cOBB.position.copy(this.position);
    cOBB.quaternion.copy(this.quaternion);
    return cOBB;
};

OBB.prototype.update = function () {
    this.updateMatrixWorld(true);

    this.pointsWorld = this._cPointsWorld(this._points());
};

OBB.prototype.updateZ = function (min, max) {
    this.z = { min: min, max: max };
    this.box3D.min.z = this.natBox.min.z + min;
    this.box3D.max.z = this.natBox.max.z + max;
    this.update();
};

OBB.prototype._points = function () {
    var points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

    points[0].set(this.box3D.max.x, this.box3D.max.y, this.box3D.max.z);
    points[1].set(this.box3D.min.x, this.box3D.max.y, this.box3D.max.z);
    points[2].set(this.box3D.min.x, this.box3D.min.y, this.box3D.max.z);
    points[3].set(this.box3D.max.x, this.box3D.min.y, this.box3D.max.z);
    points[4].set(this.box3D.max.x, this.box3D.max.y, this.box3D.min.z);
    points[5].set(this.box3D.min.x, this.box3D.max.y, this.box3D.min.z);
    points[6].set(this.box3D.min.x, this.box3D.min.y, this.box3D.min.z);
    points[7].set(this.box3D.max.x, this.box3D.min.y, this.box3D.min.z);

    return points;
};

OBB.prototype._cPointsWorld = function (points) {
    var m = this.matrixWorld;

    for (var i = 0, max = points.length; i < max; i++) {
        points[i].applyMatrix4(m);
    }

    return points;
};

/**
 * Determines if the sphere is above the XY space of the box
 *
 * @param      {Sphere}   sphere  The sphere
 * @return     {boolean}  True if sphere is above the XY space of the box, False otherwise.
 */
OBB.prototype.isSphereAboveXYBox = function (sphere) {
    var localSpherePosition = this.worldToLocal(sphere.position);
    // get obb closest point to sphere center by clamping
    var x = Math.max(this.box3D.min.x, Math.min(localSpherePosition.x, this.box3D.max.x));
    var y = Math.max(this.box3D.min.y, Math.min(localSpherePosition.y, this.box3D.max.y));

    // this is the same as isPointInsideSphere.position
    var distance = Math.sqrt((x - localSpherePosition.x) * (x - localSpherePosition.x) + (y - localSpherePosition.y) * (y - localSpherePosition.y));

    return distance < sphere.radius;
};

// Allocate these variables once and for all
var tmp = {
    epsg4978: new _Coordinates2.default('EPSG:4978', 0, 0),
    cardinals: [],
    normal: new THREE.Vector3(),
    maxV: new THREE.Vector3(),
    minV: new THREE.Vector3(),
    translate: new THREE.Vector3(),
    cardinal3D: new THREE.Vector3(),
    transformNormalToZ: new THREE.Quaternion(),
    alignTileOnWorldXY: new THREE.Quaternion(),
    tangentPlaneAtOrigin: new THREE.Plane(),
    zUp: new THREE.Vector3(0, 0, 1)
};

for (var i = 0; i < 9; i++) {
    tmp.cardinals.push(_Coordinates.C.EPSG_4326_Radians(0, 0));
}

// get oriented bounding box of tile
OBB.extentToOBB = function (extent) {
    var minHeight = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var maxHeight = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    if (extent._crs != 'EPSG:4326') {
        throw new Error('The extent crs is not a Geographic Coordinates (EPSG:4326)');
    }

    // Calcule the center world position with the extent.
    extent.center(tmp.cardinals[8]);

    var bboxDimension = extent.dimensions(_Coordinates.UNIT.RADIAN);
    var phiStart = extent.west(_Coordinates.UNIT.RADIAN);
    var phiLength = bboxDimension.x;

    var thetaStart = extent.south(_Coordinates.UNIT.RADIAN);
    var thetaLength = bboxDimension.y;
    //      0---1---2
    //      |       |
    //      7   8   3
    //      |       |
    //      6---5---4
    tmp.cardinals[0]._values[0] = phiStart;
    tmp.cardinals[0]._values[1] = thetaStart;
    tmp.cardinals[1]._values[0] = phiStart + bboxDimension.x * 0.5;
    tmp.cardinals[1]._values[1] = thetaStart;
    tmp.cardinals[2]._values[0] = phiStart + phiLength;
    tmp.cardinals[2]._values[1] = thetaStart;
    tmp.cardinals[3]._values[0] = phiStart + phiLength;
    tmp.cardinals[3]._values[1] = thetaStart + bboxDimension.y * 0.5;
    tmp.cardinals[4]._values[0] = phiStart + phiLength;
    tmp.cardinals[4]._values[1] = thetaStart + thetaLength;
    tmp.cardinals[5]._values[0] = phiStart + bboxDimension.x * 0.5;
    tmp.cardinals[5]._values[1] = thetaStart + thetaLength;
    tmp.cardinals[6]._values[0] = phiStart;
    tmp.cardinals[6]._values[1] = thetaStart + thetaLength;
    tmp.cardinals[7]._values[0] = phiStart;
    tmp.cardinals[7]._values[1] = thetaStart + bboxDimension.y * 0.5;

    var cardinalsXYZ = [];
    var centersLongitude = tmp.cardinals[8].longitude(_Coordinates.UNIT.RADIAN);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(tmp.cardinals), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var cardinal = _step.value;

            cardinalsXYZ.push(cardinal.as('EPSG:4978').xyz());
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return this.cardinalsXYZToOBB(cardinalsXYZ, centersLongitude, true, minHeight, maxHeight);
};

/**
 * Computes the OBB of a portion of a ellipsoid.
 * @param {Vector3[]} cardinals - 8 cardinals of the portion + the center.
 * @param {number} centerLongitude - the longitude at the center of the portion
 * @param {boolean} isEllipsoid - should be true when computing for the globe, false otherwise
 * @param {number} minHeight
 * @param {number} maxHeight
 * @return {OBB}
 */
OBB.cardinalsXYZToOBB = function (cardinals, centerLongitude, isEllipsoid) {
    var minHeight = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    var maxHeight = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

    tmp.maxV.set(-1000, -1000, -1000);
    tmp.minV.set(1000, 1000, 1000);

    var halfMaxHeight = 0;
    tmp.normal.copy(cardinals[8]).normalize();
    tmp.tangentPlaneAtOrigin.set(tmp.normal, 0);

    // Compute the rotation transforming the tile so that it's normal becomes (0, 0, 1)
    tmp.transformNormalToZ.setFromUnitVectors(tmp.normal, tmp.zUp);
    // Compute the rotation to get the line [1,8,5] aligned on (0, 1, 0)
    tmp.alignTileOnWorldXY.setFromAxisAngle(tmp.zUp, -centerLongitude);
    var rotateTile = tmp.alignTileOnWorldXY.multiply(tmp.transformNormalToZ);

    var point5InPlaneX = void 0;
    for (var _i = 0; _i < cardinals.length; _i++) {
        var vec = tmp.tangentPlaneAtOrigin.projectPoint(cardinals[_i], tmp.cardinal3D);
        var d = vec.distanceTo(cardinals[_i].sub(cardinals[8]));
        halfMaxHeight = Math.max(halfMaxHeight, d * 0.5);
        vec.applyQuaternion(rotateTile);
        // compute tile's min/max
        tmp.maxV.max(vec);
        tmp.minV.min(vec);

        if (_i == 5) {
            point5InPlaneX = vec.x;
        }
    }

    var halfLength = Math.abs(tmp.maxV.y - tmp.minV.y) * 0.5;
    var halfWidth = Math.abs(tmp.maxV.x - tmp.minV.x) * 0.5;

    var max = new THREE.Vector3(halfLength, halfWidth, halfMaxHeight);
    var min = new THREE.Vector3(-halfLength, -halfWidth, -halfMaxHeight);

    // delta is the distance between line `([6],[4])` and the point `[5]`
    // These points [6],[5],[4] aren't aligned because of the ellipsoid shape
    var delta = isEllipsoid ? halfWidth - Math.abs(point5InPlaneX) : 0;
    tmp.translate.set(0, delta, -halfMaxHeight);

    var obb = new OBB(min, max);

    obb.lookAt(tmp.normal);
    obb.translateX(tmp.translate.x);
    obb.translateY(tmp.translate.y);
    obb.translateZ(tmp.translate.z);
    obb.update();

    // for 3D
    if (minHeight !== 0 || maxHeight !== 0) {
        obb.updateZ(minHeight, maxHeight);
    }
    return obb;
};
exports.default = OBB;