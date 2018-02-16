'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.C = exports.UNIT = undefined;

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

exports.ellipsoidSizes = ellipsoidSizes;
exports.crsToUnit = crsToUnit;
exports.reasonnableEpsilonForUnit = reasonnableEpsilonForUnit;
exports.assertCrsIsValid = assertCrsIsValid;
exports.crsIsGeographic = crsIsGeographic;
exports.crsIsGeocentric = crsIsGeocentric;
exports.convertValueToUnit = convertValueToUnit;

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _proj = require('proj4');

var _proj2 = _interopRequireDefault(_proj);

var _MathExtended = require('../Math/MathExtended');

var _MathExtended2 = _interopRequireDefault(_MathExtended);

var _Ellipsoid = require('../Math/Ellipsoid');

var _Ellipsoid2 = _interopRequireDefault(_Ellipsoid);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Generated On: 2015-10-5
 * Class: Coordinates
 * Description: Coordonnées cartographiques
 */

_proj2.default.defs('EPSG:4978', '+proj=geocent +datum=WGS84 +units=m +no_defs');

var projectionCache = {};

function ellipsoidSizes() {
    return {
        x: 6378137,
        y: 6378137,
        z: 6356752.3142451793
    };
}

var ellipsoid = new _Ellipsoid2.default(ellipsoidSizes());

var UNIT = exports.UNIT = {
    RADIAN: 0,
    DEGREE: 1,
    METER: 2
};

function _unitFromProj4Unit(projunit) {
    if (projunit === 'degrees') {
        return UNIT.DEGREE;
    } else if (projunit === 'm') {
        return UNIT.METER;
    } else if (projunit === 'radians') {
        return UNIT.RADIAN;
    } else {
        return undefined;
    }
}

function crsToUnit(crs) {
    switch (crs) {
        case 'EPSG:4326':
            return UNIT.DEGREE;
        case 'EPSG:4978':
            return UNIT.METER;
        default:
            {
                var p = _proj2.default.defs(crs);
                if (!p) {
                    return undefined;
                }
                return _unitFromProj4Unit(p.units);
            }
    }
}

function reasonnableEpsilonForUnit(unit) {
    switch (unit) {
        case UNIT.RADIAN:
            return 0.00001;
        case UNIT.DEGREE:
            return 0.01;
        case UNIT.METER:
            return 0.001;
        default:
            return 0;
    }
}

function _crsToUnitWithError(crs) {
    var u = crsToUnit(crs);
    if (crs === undefined || u === undefined) {
        throw new Error('Invalid crs paramater value \'' + crs + '\'');
    }
    return u;
}

function assertCrsIsValid(crs) {
    _crsToUnitWithError(crs);
}

function crsIsGeographic(crs) {
    return _crsToUnitWithError(crs) != UNIT.METER;
}

function crsIsGeocentric(crs) {
    return _crsToUnitWithError(crs) == UNIT.METER;
}

function _assertIsGeographic(crs) {
    if (!crsIsGeographic(crs)) {
        throw new Error('Can\'t query crs ' + crs + ' long/lat');
    }
}

function _assertIsGeocentric(crs) {
    if (!crsIsGeocentric(crs)) {
        throw new Error('Can\'t query crs ' + crs + ' x/y/z');
    }
}

function instanceProj4(crsIn, crsOut) {
    if (projectionCache[crsIn]) {
        var _p = projectionCache[crsIn];
        if (_p[crsOut]) {
            return _p[crsOut];
        }
    } else {
        projectionCache[crsIn] = {};
    }
    var p = (0, _proj2.default)(crsIn, crsOut);
    projectionCache[crsIn][crsOut] = p;
    return p;
}

// Only support explicit conversions
function _convert(coordsIn, newCrs, target) {
    target = target || new Coordinates(newCrs, 0, 0);
    if (newCrs === coordsIn.crs) {
        var refUnit = crsToUnit(newCrs);
        if (coordsIn._internalStorageUnit != refUnit) {
            // custom internal unit
            if (coordsIn._internalStorageUnit == UNIT.DEGREE && refUnit == UNIT.RADIAN) {
                return target.set(newCrs, _MathExtended2.default.degToRad(coordsIn._values[0]), _MathExtended2.default.degToRad(coordsIn._values[1]), coordsIn._values[2]);
            } else if (coordsIn._internalStorageUnit == UNIT.RADIAN && refUnit == UNIT.DEGREE) {
                return target.set(newCrs, _MathExtended2.default.radToDeg(coordsIn._values[0]), _MathExtended2.default.radToDeg(coordsIn._values[1]), coordsIn._values[2]);
            }
        } else {
            return target.copy(coordsIn);
        }
    } else {
        if (coordsIn.crs === 'EPSG:4326' && newCrs === 'EPSG:4978') {
            var cartesian = ellipsoid.cartographicToCartesian(coordsIn, coordsIn.geodesicNormal);
            target.set(newCrs, cartesian);
            target._normal = coordsIn.geodesicNormal;
            return target;
        }

        if (coordsIn.crs === 'EPSG:4978' && newCrs === 'EPSG:4326') {
            var geo = ellipsoid.cartesianToCartographic({
                x: coordsIn._values[0],
                y: coordsIn._values[1],
                z: coordsIn._values[2]
            });
            return target.set(newCrs, geo.longitude, geo.latitude, geo.h);
        }

        if (coordsIn.crs in _proj2.default.defs && newCrs in _proj2.default.defs) {
            var val0 = coordsIn._values[0];
            var val1 = coordsIn._values[1];

            // Verify that coordinates are stored in reference unit.
            var _refUnit = crsToUnit(coordsIn.crs);
            if (coordsIn._internalStorageUnit != coordsIn.crs) {
                if (coordsIn._internalStorageUnit == UNIT.DEGREE && _refUnit == UNIT.RADIAN) {
                    val0 = coordsIn.longitude(UNIT.RADIAN);
                    val1 = coordsIn.latitude(UNIT.RADIAN);
                } else if (coordsIn._internalStorageUnit == UNIT.RADIAN && _refUnit == UNIT.DEGREE) {
                    val0 = coordsIn.longitude(UNIT.DEGREE);
                    val1 = coordsIn.latitude(UNIT.DEGREE);
                }
            }

            // there is a bug for converting anything from and to 4978 with proj4
            // https://github.com/proj4js/proj4js/issues/195
            // the workaround is to use an intermediate projection, like EPSG:4326
            if (newCrs == 'EPSG:4978') {
                var p = instanceProj4(coordsIn.crs, 'EPSG:4326').forward([val0, val1]);
                target.set('EPSG:4326', p[0], p[1], coordsIn._values[2]);
                return target.as('EPSG:4978');
            } else if (coordsIn.crs === 'EPSG:4978') {
                var coordsInInter = coordsIn.as('EPSG:4326');
                var _p2 = instanceProj4(coordsInInter.crs, newCrs).forward([coordsInInter._values[0], coordsInInter._values[1]]);
                target.set(newCrs, _p2[0], _p2[1], coordsInInter._values[2]);
                return target;
            } else if (coordsIn.crs == 'EPSG:4326' && newCrs == 'EPSG:3857') {
                val1 = THREE.Math.clamp(val1, -89.999999999, 89.999999999);
                var _p3 = instanceProj4(coordsIn.crs, newCrs).forward([val0, val1]);
                return target.set(newCrs, _p3[0], _p3[1], coordsIn._values[2]);
            } else {
                // here is the normal case with proj4
                var _p4 = instanceProj4(coordsIn.crs, newCrs).forward([val0, val1]);
                return target.set(newCrs, _p4[0], _p4[1], coordsIn._values[2]);
            }
        }

        throw new Error('Cannot convert from crs ' + coordsIn.crs + ' (unit=' + coordsIn._internalStorageUnit + ') to ' + newCrs);
    }
}

function convertValueToUnit(unitIn, unitOut, value) {
    if (unitOut == undefined || unitIn == unitOut) {
        return value;
    } else {
        if (unitIn == UNIT.DEGREE && unitOut == UNIT.RADIAN) {
            return _MathExtended2.default.degToRad(value);
        }
        if (unitIn == UNIT.RADIAN && unitOut == UNIT.DEGREE) {
            return _MathExtended2.default.radToDeg(value);
        }
        throw new Error('Cannot convert from unit ' + unitIn + ' to ' + unitOut);
    }
}

/**
 * Build a Coordinates object, given a {@link http://inspire.ec.europa.eu/theme/rs|crs} and a number of coordinates value. Coordinates can be in geocentric system, geographic system or an instance of {@link https://threejs.org/docs/#api/math/Vector3|THREE.Vector3}.
 * If crs = 'EPSG:4326', coordinates must be in geographic system.
 * If crs = 'EPSG:4978', coordinates must be in geocentric system.
 * @constructor
 * @param       {string} crs - Geographic or Geocentric coordinates system.
 * @param       {number|THREE.Vector3} coordinates - The globe coordinates to aim to.
 * @param       {number} coordinates.longitude - Geographic Coordinate longitude
 * @param       {number} coordinates.latitude - Geographic Coordinate latitude
 * @param       {number} coordinates.altitude - Geographic Coordinate altiude
 * @param       {number} coordinates.x - Geocentric Coordinate X
 * @param       {number} coordinates.y - Geocentric Coordinate Y
 * @param       {number} coordinates.z - Geocentric Coordinate Z
 * @example
 * new Coordinates('EPSG:4978', 20885167, 849862, 23385912); //Geocentric coordinates
 * // or
 * new Coordinates('EPSG:4326', 2.33, 48.24, 24999549); //Geographic coordinates
 */

function Coordinates(crs) {
    var _this = this;

    this._values = new Float64Array(3);

    for (var _len = arguments.length, coordinates = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        coordinates[_key - 1] = arguments[_key];
    }

    this.set.apply(this, [crs].concat(coordinates));

    Object.defineProperty(this, 'geodesicNormal', {
        configurable: true,
        get: function get() {
            _this._normal = _this._normal || computeGeodesicNormal(_this);
            return _this._normal;
        }
    });
}

var planarNormal = new THREE.Vector3(0, 0, 1);

function computeGeodesicNormal(coord) {
    if (coord.crs == 'EPSG:4326') {
        return ellipsoid.geodeticSurfaceNormalCartographic(coord);
    }
    // In globe mode (EPSG:4978), we compute the normal.
    if (coord.crs == 'EPSG:4978') {
        return ellipsoid.geodeticSurfaceNormal(coord);
    }
    // In planar mode, normal is the up vector.
    return planarNormal;
}

Coordinates.prototype.set = function (crs) {
    _crsToUnitWithError(crs);
    this.crs = crs;

    for (var _len2 = arguments.length, coordinates = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        coordinates[_key2 - 1] = arguments[_key2];
    }

    if (coordinates.length == 1 && coordinates[0] instanceof THREE.Vector3) {
        this._values[0] = coordinates[0].x;
        this._values[1] = coordinates[0].y;
        this._values[2] = coordinates[0].z;
    } else {
        for (var i = 0; i < coordinates.length && i < 3; i++) {
            this._values[i] = coordinates[i];
        }
        for (var _i = coordinates.length; _i < 3; _i++) {
            this._values[_i] = 0;
        }
    }
    this._normal = undefined;
    this._internalStorageUnit = crsToUnit(crs);
    return this;
};

Coordinates.prototype.clone = function (target) {
    var r = void 0;
    if (target) {
        Coordinates.call.apply(Coordinates, [target, this.crs].concat((0, _toConsumableArray3.default)(this._values)));
        r = target;
    } else {
        r = new (Function.prototype.bind.apply(Coordinates, [null].concat([this.crs], (0, _toConsumableArray3.default)(this._values))))();
    }
    if (this._normal) {
        r._normal = this._normal.clone();
    }
    r._internalStorageUnit = this._internalStorageUnit;
    return r;
};

Coordinates.prototype.copy = function (src) {
    this.set.apply(this, [src.crs].concat((0, _toConsumableArray3.default)(src._values)));
    this._internalStorageUnit = src._internalStorageUnit;
    return this;
};

/**
 * Returns the longitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.longitude(); // Longitude in geographic system
 * // returns 2.33
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.longitude(); // Longitude in geographic system
 * // returns 2.330201911389028
 *
 * @param      {number} [unit] - 0: Radians, 1: Degrees.
 * @return     {number} - The longitude of the position.
 */

Coordinates.prototype.longitude = function (unit) {
    _assertIsGeographic(this.crs);
    return convertValueToUnit(this._internalStorageUnit, unit, this._values[0]);
};

/**
 * Returns the latitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.latitude(); // Latitude in geographic system
 * // returns : 48.24
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.latitude(); // Latitude in geographic system
 * // returns : 48.24830764643365
 *
 * @param      {number} [unit] - 0: Radians, 1: Degrees.
 * @return     {number} - The latitude of the position.
 */

Coordinates.prototype.latitude = function (unit) {
    _assertIsGeographic(this.crs);
    return convertValueToUnit(this._internalStorageUnit, unit, this._values[1]);
};

/**
 * Returns the altitude in geographic coordinates. Coordinates must be in geographic system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coordinates = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * coordinates.altitude(); // Altitude in geographic system
 * // returns : 24999549
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 * coordinates.altitude(); // Altitude in geographic system
 * // returns : 24999548.046711832
 *
 * @return     {number} - The altitude of the position.
 */

Coordinates.prototype.altitude = function () {
    _assertIsGeographic(this.crs);
    return this._values[2];
};

/**
 * Set the altiude.
 * @example coordinates.setAltitude(number)
 * @param      {number} - Set the altitude.
 */

Coordinates.prototype.setAltitude = function (altitude) {
    _assertIsGeographic(this.crs);
    this._values[2] = altitude;
};

/**
* Returns the longitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
* @example
*
* const position = { x: 20885167, y: 849862, z: 23385912 };
* const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
* coordinates.x();  // Geocentric system
* // returns : 20885167
*
* // or
*
* const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
* const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
* const coordinates = coords.as('EPSG:4978'); // Geocentric system
* coordinates.x(); // Geocentric system
* // returns : 20888561.0301258
*
* @return     {number} - The longitude of the position.
*/

Coordinates.prototype.x = function () {
    _assertIsGeocentric(this.crs);
    return this._values[0];
};

/**
 * Returns the latitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.y();  // Geocentric system
 * // returns : 849862
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.y(); // Geocentric system
 * // returns : 849926.376770819
 *
 * @return     {number} - The latitude of the position.
 */

Coordinates.prototype.y = function () {
    _assertIsGeocentric(this.crs);
    return this._values[1];
};

/**
 * Returns the altitude in geocentric coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.z();  // Geocentric system
 * // returns : 23385912
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.z(); // Geocentric system
 * // returns : 23382883.536591515
 *
 * @return     {number} - The altitude of the position.
 */

Coordinates.prototype.z = function () {
    _assertIsGeocentric(this.crs);
    return this._values[2];
};

/**
 * Returns a position in cartesian coordinates. Coordinates must be in geocentric system (can be converted by using {@linkcode as()} ).
 * @example
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coordinates = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * coordinates.xyz();  // Geocentric system
 * // returns : Vector3
 * // x: 20885167
 * // y: 849862
 * // z: 23385912
 *
 * // or
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 * coordinates.xyz(); // Geocentric system
 * // returns : Vector3
 * // x: 20885167
 * // y: 849862
 * // z: 23385912
 *
 * @return     {Position} - position
 */

Coordinates.prototype.xyz = function (target) {
    _assertIsGeocentric(this.crs);
    var v = target || new THREE.Vector3();
    v.fromArray(this._values);
    return v;
};

/**
 * Returns coordinates in the wanted {@link http://inspire.ec.europa.eu/theme/rs|CRS}.
 * @example
 *
 * const position = { longitude: 2.33, latitude: 48.24, altitude: 24999549 };
 * const coords = new Coordinates('EPSG:4326', position.longitude, position.latitude, position.altitude); // Geographic system
 * const coordinates = coords.as('EPSG:4978'); // Geocentric system
 *
 * // or
 *
 * const position = { x: 20885167, y: 849862, z: 23385912 };
 * const coords = new Coordinates('EPSG:4978', position.x, position.y, position.z);  // Geocentric system
 * const coordinates = coords.as('EPSG:4326');  // Geographic system
 *
 * //or
 *
 * new Coordinates('EPSG:4326', longitude: 2.33, latitude: 48.24, altitude: 24999549).as('EPSG:4978'); // Geocentric system
 *
 * // or
 *
 * new Coordinates('EPSG:4978', x: 20885167, y: 849862, z: 23385912).as('EPSG:4326'); // Geographic system
 *
 * @param      {string} - {@link http://inspire.ec.europa.eu/theme/rs|crs} : Geocentric (ex: 'EPSG:4326') or Geographic (ex: 'EPSG:4978').
 * @return     {Position} - position
 */

Coordinates.prototype.as = function (crs, target) {
    if (crs === undefined || !crsToUnit(crs)) {
        throw new Error('Invalid crs paramater value \'' + crs + '\'');
    }
    return _convert(this, crs, target);
};

/**
 * Returns the normalized offset from top-left in extent of this Coordinates
 * e.g: extent.center().offsetInExtent(extent) would return (0.5, 0.5).
 * @param {Extent} extent
 * @param {Vector2} target optional Vector2 target. If not present a new one will be created
 * @return {Vector2} normalized offset in extent
 */
Coordinates.prototype.offsetInExtent = function (extent, target) {
    if (this.crs != extent.crs()) {
        throw new Error('unsupported mix');
    }

    var dimension = {
        x: Math.abs(extent.east() - extent.west()),
        y: Math.abs(extent.north() - extent.south())
    };

    var x = extent._internalStorageUnit == UNIT.METER ? this.x() : this.longitude(extent._internalStorageUnit);
    var y = extent._internalStorageUnit == UNIT.METER ? this.y() : this.latitude(extent._internalStorageUnit);

    var originX = (x - extent.west()) / dimension.x;
    var originY = (extent.north() - y) / dimension.y;

    target = target || new THREE.Vector2();
    target.set(originX, originY);
    return target;
};

var C = exports.C = {

    /**
     * Return a Coordinates object from a position object. The object just
     * needs to have x, y, z properties.
     *
     * @param {string} crs - The crs of the original position
     * @param {Object} position - the position to transform
     * @param {number} position.x - the x component of the position
     * @param {number} position.y - the y component of the position
     * @param {number} position.z - the z component of the position
     * @return {Coordinates}
     */
    EPSG_4326: function () {
        for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
            args[_key3] = arguments[_key3];
        }

        return new (Function.prototype.bind.apply(Coordinates, [null].concat(['EPSG:4326'], args)))();
    },
    EPSG_4326_Radians: function () {
        for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
            args[_key4] = arguments[_key4];
        }

        var result = new (Function.prototype.bind.apply(Coordinates, [null].concat(['EPSG:4326'], args)))();
        result._internalStorageUnit = UNIT.RADIAN;
        return result;
    }
};

exports.default = Coordinates;