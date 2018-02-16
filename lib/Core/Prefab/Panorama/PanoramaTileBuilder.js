'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _OBB2 = require('../../../Renderer/ThreeExtended/OBB');

var _OBB3 = _interopRequireDefault(_OBB2);

var _Coordinates = require('../../Geographic/Coordinates');

var _Coordinates2 = _interopRequireDefault(_Coordinates);

var _Extent = require('../../Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function PanoramaTileBuilder(ratio) {
    this.tmp = {
        coords: new _Coordinates2.default('EPSG:4326', 0, 0),
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 0, 1)
    };

    if (!ratio) {
        throw new Error('ratio must be defined');
    }
    if (ratio === 2) {
        this.equirectangular = true;
        this.type = 's';
        this.radius = 100;
    } else {
        this.equirectangular = false; // cylindrical proj
        this.type = 'c';
        this.height = 200;
        this.radius = ratio * this.height / (2 * Math.PI);
    }
}

PanoramaTileBuilder.prototype.constructor = PanoramaTileBuilder;

// prepare params
// init projected object -> params.projected
var axisX = new THREE.Vector3(0, 1, 0);
PanoramaTileBuilder.prototype.Prepare = function (params) {
    var angle = (params.extent.north(_Coordinates.UNIT.RADIAN) + params.extent.south(_Coordinates.UNIT.RADIAN)) * 0.5;

    if (this.equirectangular) {
        params.quatNormalToZ = new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI * 0.5 - angle);
        params.projected = {
            theta: 0,
            phi: 0,
            radius: this.radius
        };
    } else {
        params.quatNormalToZ = new THREE.Quaternion().setFromAxisAngle(axisX, Math.PI * 0.5);
        params.projected = {
            theta: 0,
            radius: this.radius,
            y: 0
        };
    }
};

PanoramaTileBuilder.prototype.Center = function (extent) {
    var params = { extent: extent };
    this.Prepare(params);
    this.uProjecte(0.5, params);
    this.vProjecte(0.5, params);

    return this.VertexPosition(params).clone();
};

// get position 3D cartesian
PanoramaTileBuilder.prototype.VertexPosition = function (params) {
    if (this.equirectangular) {
        this.tmp.position.setFromSpherical(params.projected);
    } else {
        this.tmp.position.setFromCylindrical(params.projected);
    }

    this.tmp.position.set(this.tmp.position.z, this.tmp.position.x, this.tmp.position.y);

    return this.tmp.position;
};

// get normal for last vertex
PanoramaTileBuilder.prototype.VertexNormal = function () {
    return this.tmp.position.clone().negate().normalize();
};

// coord u tile to projected
PanoramaTileBuilder.prototype.uProjecte = function (u, params) {
    // both (theta, phi) and (y, z) are swapped in setFromSpherical
    params.projected.theta = Math.PI - THREE.Math.lerp(params.extent.east(_Coordinates.UNIT.RADIAN), params.extent.west(_Coordinates.UNIT.RADIAN), 1 - u);
};

// coord v tile to projected
PanoramaTileBuilder.prototype.vProjecte = function (v, params) {
    if (this.equirectangular) {
        params.projected.phi = Math.PI * 0.5 - THREE.Math.lerp(params.extent.north(_Coordinates.UNIT.RADIAN), params.extent.south(_Coordinates.UNIT.RADIAN), 1 - v);
    } else {
        params.projected.y = this.height * THREE.Math.lerp(params.extent.south(), params.extent.north(), v) / 180;
    }
};

// get oriented bounding box of tile
PanoramaTileBuilder.prototype.OBB = function (boundingBox) {
    return new _OBB3.default(boundingBox.min, boundingBox.max);
};

var axisY = new THREE.Vector3(0, 1, 0);
var axisZ = new THREE.Vector3(0, 0, 1);
var quatToAlignLongitude = new THREE.Quaternion();
var quatToAlignLatitude = new THREE.Quaternion();

PanoramaTileBuilder.prototype.computeSharableExtent = function (extent) {
    // Compute sharable extent to pool the geometries
    // the geometry in common extent is identical to the existing input
    // with a transformation (translation, rotation)
    var sizeLongitude = Math.abs(extent.west() - extent.east()) / 2;
    var sharableExtent = new _Extent2.default(extent.crs(), -sizeLongitude, sizeLongitude, extent.south(), extent.north());
    sharableExtent._internalStorageUnit = extent._internalStorageUnit;

    // compute rotation to transform tile to position it
    // this transformation take into account the transformation of the parents
    var rotLon = extent.west(_Coordinates.UNIT.RADIAN) - sharableExtent.west(_Coordinates.UNIT.RADIAN);
    var rotLat = Math.PI * 0.5 - (!this.equirectangular ? 0 : (extent.north(_Coordinates.UNIT.RADIAN) + extent.south(_Coordinates.UNIT.RADIAN)) * 0.5);
    quatToAlignLongitude.setFromAxisAngle(axisZ, -rotLon);
    quatToAlignLatitude.setFromAxisAngle(axisY, -rotLat);
    quatToAlignLongitude.multiply(quatToAlignLatitude);

    return {
        sharableExtent: sharableExtent,
        quaternion: quatToAlignLongitude,
        position: this.Center(extent)
    };
};

exports.default = PanoramaTileBuilder;