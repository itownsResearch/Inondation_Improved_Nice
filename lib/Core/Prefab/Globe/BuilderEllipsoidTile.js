'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Coordinates = require('../../Geographic/Coordinates');

var _Projection = require('../../Geographic/Projection');

var _Projection2 = _interopRequireDefault(_Projection);

var _OBB = require('../../../Renderer/ThreeExtended/OBB');

var _OBB2 = _interopRequireDefault(_OBB);

var _Extent = require('../../Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var axisZ = new THREE.Vector3(0, 0, 1);
var axisY = new THREE.Vector3(0, 1, 0);

function BuilderEllipsoidTile() {
    this.projector = new _Projection2.default();

    this.tmp = {
        coords: [_Coordinates.C.EPSG_4326_Radians(0, 0), _Coordinates.C.EPSG_4326_Radians(0, 0)],
        position: new THREE.Vector3()
    };

    this.type = 'e';
}

BuilderEllipsoidTile.prototype.constructor = BuilderEllipsoidTile;

// prepare params
// init projected object -> params.projected

BuilderEllipsoidTile.prototype.Prepare = function (params) {
    params.nbRow = Math.pow(2.0, params.level + 1.0);

    var st1 = this.projector.WGS84ToOneSubY(params.extent.south());

    if (!isFinite(st1)) {
        st1 = 0;
    }

    var sizeTexture = 1.0 / params.nbRow;

    var start = st1 % sizeTexture;

    params.deltaUV1 = (st1 - start) * params.nbRow;

    // transformation to align tile's normal to z axis
    params.quatNormalToZ = new THREE.Quaternion().setFromAxisAngle(axisY, -(Math.PI * 0.5 - params.extent.center().latitude()));

    // let's avoid building too much temp objects
    params.projected = { longitudeRad: 0, latitudeRad: 0 };
};

// get center tile in cartesian 3D
BuilderEllipsoidTile.prototype.Center = function (extent) {
    return extent.center(this.tmp.coords[0]).as('EPSG:4978', this.tmp.coords[1]).xyz();
};

// get position 3D cartesian
BuilderEllipsoidTile.prototype.VertexPosition = function (params) {
    this.tmp.coords[0].set('EPSG:4326', params.projected.longitudeRad, params.projected.latitudeRad);
    this.tmp.coords[0]._internalStorageUnit = _Coordinates.UNIT.RADIAN;

    this.tmp.coords[0].as('EPSG:4978', this.tmp.coords[1]).xyz(this.tmp.position);
    return this.tmp.position;
};

// get normal for last vertex
BuilderEllipsoidTile.prototype.VertexNormal = function () {
    return this.tmp.coords[1].geodesicNormal;
};

// coord u tile to projected
BuilderEllipsoidTile.prototype.uProjecte = function (u, params) {
    params.projected.longitudeRad = this.projector.UnitaryToLongitudeWGS84(u, params.extent);
};

// coord v tile to projected
BuilderEllipsoidTile.prototype.vProjecte = function (v, params) {
    params.projected.latitudeRad = this.projector.UnitaryToLatitudeWGS84(v, params.extent);
};

// Compute uv 1, if isn't defined the uv1 isn't computed
BuilderEllipsoidTile.prototype.getUV_PM = function (params) {
    var t = this.projector.WGS84ToOneSubY(params.projected.latitudeRad) * params.nbRow;

    if (!isFinite(t)) {
        t = 0;
    }

    return t - params.deltaUV1;
};

var quatToAlignLongitude = new THREE.Quaternion();
var quatToAlignLatitude = new THREE.Quaternion();

BuilderEllipsoidTile.prototype.computeSharableExtent = function (extent) {
    // Compute sharable extent to pool the geometries
    // the geometry in common extent is identical to the existing input
    // with a transformation (translation, rotation)

    // TODO: It should be possible to use equatorial plan symetrie,
    // but we should be reverse UV on tile
    // Common geometry is looking for only on longitude
    var sizeLongitude = Math.abs(extent.west() - extent.east()) / 2;
    var sharableExtent = new _Extent2.default(extent.crs(), -sizeLongitude, sizeLongitude, extent.south(), extent.north());
    sharableExtent._internalStorageUnit = extent._internalStorageUnit;

    // compute rotation to transform tile to position it on ellipsoid
    // this transformation take into account the transformation of the parents
    var rotLon = extent.west() - sharableExtent.west();
    var rotLat = Math.PI * 0.5 - extent.center().latitude();
    quatToAlignLongitude.setFromAxisAngle(axisZ, rotLon);
    quatToAlignLatitude.setFromAxisAngle(axisY, rotLat);
    quatToAlignLongitude.multiply(quatToAlignLatitude);

    return {
        sharableExtent: sharableExtent,
        quaternion: quatToAlignLongitude,
        position: this.Center(extent)
    };
};

// use for region for adaptation boundingVolume
BuilderEllipsoidTile.prototype.OBB = function (boundingBox) {
    return new _OBB2.default(boundingBox.min, boundingBox.max);
};

exports.default = BuilderEllipsoidTile;