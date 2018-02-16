'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.globeSchemeTile1 = exports.globeSchemeTile0 = undefined;

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.preGlobeUpdate = preGlobeUpdate;
exports.globeCulling = globeCulling;
exports.globeSubdivisionControl = globeSubdivisionControl;
exports.globeSchemeTileWMTS = globeSchemeTileWMTS;
exports.computeTileZoomFromDistanceCamera = computeTileZoomFromDistanceCamera;
exports.computeDistanceCameraFromTileZoom = computeDistanceCameraFromTileZoom;

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _MathExtended = require('../Core/Math/MathExtended');

var _MathExtended2 = _interopRequireDefault(_MathExtended);

var _Coordinates = require('../Core/Geographic/Coordinates');

var _OGCWebServiceHelper = require('../Core/Scheduler/Providers/OGCWebServiceHelper');

var _Extent = require('../Core/Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var cV = new THREE.Vector3();
var vhMagnitudeSquared = void 0;

var SSE_SUBDIVISION_THRESHOLD = void 0;

var worldToScaledEllipsoid = new THREE.Matrix4();

function _preSSE(view) {
    var canvasSize = view.mainLoop.gfxEngine.getWindowSize();
    var hypotenuse = canvasSize.length();
    var radAngle = view.camera.camera3D.fov * Math.PI / 180;

    // TODO: not correct -> see new preSSE
    // const HFOV = 2.0 * Math.atan(Math.tan(radAngle * 0.5) / context.camera.ratio);
    var HYFOV = 2.0 * Math.atan(Math.tan(radAngle * 0.5) * hypotenuse / canvasSize.x);

    return hypotenuse * (2.0 * Math.tan(HYFOV * 0.5));
}

function preGlobeUpdate(context, layer) {
    // We're going to use the method described here:
    //    https://cesiumjs.org/2013/04/25/Horizon-culling/
    // This method assumes that the globe is a unit sphere at 0,0,0 so
    // we setup a world-to-scaled-ellipsoid matrix4
    worldToScaledEllipsoid.getInverse(layer.object3d.matrixWorld);
    worldToScaledEllipsoid.premultiply(new THREE.Matrix4().makeScale(1 / (0, _Coordinates.ellipsoidSizes)().x, 1 / (0, _Coordinates.ellipsoidSizes)().y, 1 / (0, _Coordinates.ellipsoidSizes)().z));

    // pre-horizon culling
    // cV is camera's position in worldToScaledEllipsoid system
    cV.copy(context.camera.camera3D.position).applyMatrix4(worldToScaledEllipsoid);
    vhMagnitudeSquared = cV.lengthSq() - 1.0;

    // pre-sse
    context.camera.preSSE = _preSSE(context.view);

    var elevationLayers = context.view.getLayers(function (l, a) {
        return a && a.id == layer.id && l.type == 'elevation';
    });
    context.maxElevationLevel = -1;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(elevationLayers), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var e = _step.value;

            context.maxElevationLevel = Math.max(e.options.zoom.max, context.maxElevationLevel);
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

    if (context.maxElevationLevel == -1) {
        context.maxElevationLevel = Infinity;
    }
}

function pointHorizonCulling(pt) {
    // see https://cesiumjs.org/2013/04/25/Horizon-culling/
    var vT = pt.applyMatrix4(worldToScaledEllipsoid).sub(cV);

    var vtMagnitudeSquared = vT.lengthSq();

    var dot = -vT.dot(cV);

    var isOccluded = vhMagnitudeSquared < dot && vhMagnitudeSquared < dot * dot / vtMagnitudeSquared;

    return isOccluded;
}

function horizonCulling(node) {
    var points = node.OBB().pointsWorld;

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = (0, _getIterator3.default)(points), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var point = _step2.value;

            if (!pointHorizonCulling(point.clone())) {
                return true;
            }
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    return false;
}

function frustumCullingOBB(node, camera) {
    return camera.isBox3Visible(node.OBB().box3D, node.OBB().matrixWorld);
}

function globeCulling(minLevelForHorizonCulling) {
    return function (node, camera) {
        return !(frustumCullingOBB(node, camera) && (node.level < minLevelForHorizonCulling || horizonCulling(node)));
    };
}

var v = new THREE.Vector3();
function computeNodeSSE(camera, node) {
    v.setFromMatrixScale(node.matrixWorld);
    var boundingSphereCenter = node.boundingSphere.center.clone().applyMatrix4(node.matrixWorld);
    var distance = Math.max(0.0, camera.camera3D.position.distanceTo(boundingSphereCenter) - node.boundingSphere.radius * v.x);

    // Removed because is false computation, it doesn't consider the altitude of node
    // Added small oblique weight (distance is not enough, tile orientation is needed)
    /*
    var altiW = node.bbox.top() === 10000 ? 0. : node.bbox.bottom() / 10000.;
    var dotProductW = Math.min(altiW + Math.abs(this.camera3D.getWorldDirection().dot(node.centerSphere.clone().normalize())), 1.);
    if (this.camera3D.position.length() > 6463300) dotProductW = 1;
    var SSE = Math.sqrt(dotProductW) * this.preSSE * (node.geometricError / distance);
    */

    // TODO: node.geometricError is computed using a hardcoded 18 level
    // The computation of node.geometricError is surely false
    return camera.preSSE * (node.geometricError * v.x) / distance;
}

function globeSubdivisionControl(minLevel, maxLevel, sseThreshold, maxDeltaElevationLevel) {
    SSE_SUBDIVISION_THRESHOLD = sseThreshold;
    return function (context, layer, node) {
        if (node.level < minLevel) {
            return true;
        }
        if (maxLevel <= node.level) {
            return false;
        }
        // Prevent to subdivise the node if the current elevation level
        // we must avoid a tile, with level 20, inherits a level 3 elevation texture.
        // The induced geometric error is much too large and distorts the SSE
        var currentElevationLevel = node.material.getElevationLayerLevel();
        if (node.level < context.maxElevationLevel + maxDeltaElevationLevel && currentElevationLevel >= 0 && node.level - currentElevationLevel >= maxDeltaElevationLevel) {
            return false;
        }

        var sse = computeNodeSSE(context.camera, node);

        return SSE_SUBDIVISION_THRESHOLD < sse;
    };
}

// bbox longitude(0,360),latitude(-90,90)
var globeSchemeTile0 = exports.globeSchemeTile0 = 0;
// bbox longitude(-180,180),latitude(-90,90)
var globeSchemeTile1 = exports.globeSchemeTile1 = 1;

function globeSchemeTileWMTS(type) {
    var schemeT = [];

    if (type === 0) {
        // bbox longitude(0,360),latitude(-90,90)
        schemeT.push(new _Extent2.default('EPSG:4326', 0, _MathExtended2.default.PI, -_MathExtended2.default.PI_OV_TWO, _MathExtended2.default.PI_OV_TWO));
        schemeT.push(new _Extent2.default('EPSG:4326', _MathExtended2.default.PI, _MathExtended2.default.TWO_PI, -_MathExtended2.default.PI_OV_TWO, _MathExtended2.default.PI_OV_TWO));
    } else if (type == 1) {
        // bbox longitude(-180,180),latitude(-90,90)
        schemeT.push(new _Extent2.default('EPSG:4326', -_MathExtended2.default.PI, 0, -_MathExtended2.default.PI_OV_TWO, _MathExtended2.default.PI_OV_TWO));
        schemeT.push(new _Extent2.default('EPSG:4326', 0, _MathExtended2.default.PI, -_MathExtended2.default.PI_OV_TWO, _MathExtended2.default.PI_OV_TWO));
    }
    // store internally as Radians to avoid doing too much deg->rad conversions
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = (0, _getIterator3.default)(schemeT), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var bbox = _step3.value;

            bbox._internalStorageUnit = _Coordinates.UNIT.RADIAN;
        }
    } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
            }
        } finally {
            if (_didIteratorError3) {
                throw _iteratorError3;
            }
        }
    }

    return schemeT;
}

function computeTileZoomFromDistanceCamera(distance, view) {
    var sizeEllipsoid = (0, _Coordinates.ellipsoidSizes)().x;
    var preSinus = _OGCWebServiceHelper.SIZE_TEXTURE_TILE * (SSE_SUBDIVISION_THRESHOLD * 0.5) / view.camera.preSSE / sizeEllipsoid;

    var sinus = distance * preSinus;
    var zoom = Math.log(Math.PI / (2.0 * Math.asin(sinus))) / Math.log(2);

    var delta = Math.PI / Math.pow(2, zoom);
    var circleChord = 2.0 * sizeEllipsoid * Math.sin(delta * 0.5);


    // adjust with bounding sphere rayon
    sinus = (distance - circleChord * 0.5) * preSinus;
    zoom = Math.log(Math.PI / (2.0 * Math.asin(sinus))) / Math.log(2);

    return isNaN(zoom) ? 0 : Math.round(zoom);
}

function computeDistanceCameraFromTileZoom(zoom, view) {
    var delta = Math.PI / Math.pow(2, zoom);
    var circleChord = 2.0 * (0, _Coordinates.ellipsoidSizes)().x * Math.sin(delta * 0.5);
    var radius = circleChord * 0.5;


    return view.camera.preSSE * (radius / _OGCWebServiceHelper.SIZE_TEXTURE_TILE) / (SSE_SUBDIVISION_THRESHOLD * 0.5) + radius;
}