'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _defineProperty = require('babel-runtime/core-js/object/define-property');

var _defineProperty2 = _interopRequireDefault(_defineProperty);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Coordinates = require('../Geographic/Coordinates');

var _Coordinates2 = _interopRequireDefault(_Coordinates);

var _Projection = require('../Geographic/Projection');

var _Projection2 = _interopRequireDefault(_Projection);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var projection = new _Projection2.default();
/**
 * Extent is a SIG-area (so 2D)
 * It can use explicit coordinates (e.g: lon/lat) or implicit (WMTS coordinates)
 */

var CARDINAL = {
    WEST: 0,
    EAST: 1,
    SOUTH: 2,
    NORTH: 3
};

function _isTiledCRS(crs) {
    return crs.indexOf('WMTS:') == 0 || crs == 'TMS';
}

function Extent(crs) {
    var _this = this;

    for (var _len = arguments.length, values = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        values[_key - 1] = arguments[_key];
    }

    this._crs = crs;

    if (_isTiledCRS(crs)) {
        if (values.length == 3) {
            this._zoom = values[0];
            this._row = values[1];
            this._col = values[2];

            if (this._zoom < 0) {
                throw new Error('invlid WTMS values ' + values);
            }

            (0, _defineProperty2.default)(this, 'zoom', { get: function get() {
                    return _this._zoom;
                } }, { set: function set(z) {
                    _this._zoom = z;
                } });
            (0, _defineProperty2.default)(this, 'row', { get: function get() {
                    return _this._row;
                } }, { set: function set(r) {
                    _this._row = r;
                } });
            (0, _defineProperty2.default)(this, 'col', { get: function get() {
                    return _this._col;
                } }, { set: function set(c) {
                    _this._col = c;
                } });
        } else {
            throw new Error('Unsupported constructor args \'' + values + '\'');
        }
    } else {
        this._internalStorageUnit = (0, _Coordinates.crsToUnit)(crs);

        if (values.length === 2 && values[0] instanceof _Coordinates2.default && values[1] instanceof _Coordinates2.default) {
            this._values = new Float64Array(4);
            for (var i = 0; i < values.length; i++) {
                for (var j = 0; j < 2; j++) {
                    this._values[2 * i + j] = values[i]._values[j];
                }
            }
        } else if (values.length == 1 && values[0].west != undefined) {
            this._values = new Float64Array(4);
            this._values[CARDINAL.WEST] = values[0].west;
            this._values[CARDINAL.EAST] = values[0].east;
            this._values[CARDINAL.SOUTH] = values[0].south;
            this._values[CARDINAL.NORTH] = values[0].north;
        } else if (values.length == 4) {
            this._values = new Float64Array(4);
            (0, _keys2.default)(CARDINAL).forEach(function (key) {
                var cardinal = CARDINAL[key];
                _this._values[cardinal] = values[cardinal];
            });
        } else {
            throw new Error('Unsupported constructor args \'' + values + '\'');
        }
    }
}

Extent.prototype.clone = function () {
    if (_isTiledCRS(this._crs)) {
        return new Extent(this._crs, this.zoom, this.row, this.col);
    } else {
        var result = new (Function.prototype.bind.apply(Extent, [null].concat([this._crs], (0, _toConsumableArray3.default)(this._values))))();
        result._internalStorageUnit = this._internalStorageUnit;
        return result;
    }
};

Extent.prototype.as = function (crs) {
    (0, _Coordinates.assertCrsIsValid)(crs);

    if (_isTiledCRS(this._crs)) {
        if (this._crs == 'WMTS:PM') {
            // Convert this to the requested crs by using 4326 as an intermediate state.
            var nbCol = Math.pow(2, this.zoom);
            var size = 360 / nbCol;
            // convert column PM to longitude EPSG:4326 degree
            var west = 180 - size * (nbCol - this.col);
            var east = 180 - size * (nbCol - (this.col + 1));
            var nbRow = nbCol;
            var sizeRow = 1.0 / nbRow;
            // convert row PM to Y PM
            var Yn = 1 - sizeRow * (nbRow - this.row);
            var Ys = 1 - sizeRow * (nbRow - (this.row + 1));
            // convert Y PM to latitude EPSG:4326 degree
            var north = THREE.Math.radToDeg(projection.YToWGS84(Yn));
            var south = THREE.Math.radToDeg(projection.YToWGS84(Ys));
            // create intermediate EPSG:4326 and convert in new crs
            return new Extent('EPSG:4326', { west: west, east: east, south: south, north: north }).as(crs);
        } else if (this._crs == 'WMTS:WGS84G' && crs == 'EPSG:4326') {
            var _nbRow = Math.pow(2, this.zoom);
            var _size = 180 / _nbRow;
            var _north = _size * (_nbRow - this.row) - 90;
            var _south = _size * (_nbRow - (this.row + 1)) - 90;
            var _west = 180 - _size * (2 * _nbRow - this.col);
            var _east = 180 - _size * (2 * _nbRow - (this.col + 1));

            return new Extent(crs, { west: _west, east: _east, south: _south, north: _north });
        } else {
            throw new Error('Unsupported yet');
        }
    }

    if (this._crs != crs) {
        // Compute min/max in x/y by projecting 8 cardinal points,
        // and then taking the min/max of each coordinates.
        var cardinals = [];
        var c = this.center();
        cardinals.push(new _Coordinates2.default(this._crs, this.west(), this.north()));
        cardinals.push(new _Coordinates2.default(this._crs, c._values[0], this.north()));
        cardinals.push(new _Coordinates2.default(this._crs, this.east(), this.north()));
        cardinals.push(new _Coordinates2.default(this._crs, this.east(), c._values[1]));
        cardinals.push(new _Coordinates2.default(this._crs, this.east(), this.south()));
        cardinals.push(new _Coordinates2.default(this._crs, c._values[0], this.south()));
        cardinals.push(new _Coordinates2.default(this._crs, this.west(), this.south()));
        cardinals.push(new _Coordinates2.default(this._crs, this.west(), c._values[1]));

        var _north2 = -Infinity;
        var _south2 = Infinity;
        var _east2 = -Infinity;
        var _west2 = Infinity;
        // loop over the coordinates
        for (var i = 0; i < cardinals.length; i++) {
            // add the internalStorageUnit to the coordinate.
            cardinals[i]._internalStorageUnit = this._internalStorageUnit;
            // convert the coordinate.
            cardinals[i] = cardinals[i].as(crs);
            _north2 = Math.max(_north2, cardinals[i]._values[1]);
            _south2 = Math.min(_south2, cardinals[i]._values[1]);
            _east2 = Math.max(_east2, cardinals[i]._values[0]);
            _west2 = Math.min(_west2, cardinals[i]._values[0]);
        }
        return new Extent(crs, { north: _north2, south: _south2, east: _east2, west: _west2 });
    }

    return new Extent(crs, {
        west: this.west((0, _Coordinates.crsToUnit)(crs)),
        east: this.east((0, _Coordinates.crsToUnit)(crs)),
        north: this.north((0, _Coordinates.crsToUnit)(crs)),
        south: this.south((0, _Coordinates.crsToUnit)(crs))
    });
};

Extent.prototype.offsetToParent = function (other) {
    if (this.crs() != other.crs()) {
        throw new Error('unsupported mix');
    }
    if (_isTiledCRS(this.crs())) {
        var diffLevel = this._zoom - other.zoom;
        var diff = Math.pow(2, diffLevel);
        var invDiff = 1 / diff;

        var r = (this._row - this._row % diff) * invDiff;
        var c = (this._col - this._col % diff) * invDiff;

        return new THREE.Vector4(this._col * invDiff - c, this._row * invDiff - r, invDiff, invDiff);
    }

    var dimension = {
        x: Math.abs(other.east() - other.west()),
        y: Math.abs(other.north() - other.south())
    };

    var originX = (this.west(other._internalStorageUnit) - other.west()) / dimension.x;
    var originY = (other.north() - this.north(other._internalStorageUnit)) / dimension.y;

    var scaleX = Math.abs(this.east(other._internalStorageUnit) - this.west(other._internalStorageUnit)) / dimension.x;

    var scaleY = Math.abs(this.north(other._internalStorageUnit) - this.south(other._internalStorageUnit)) / dimension.y;

    return new THREE.Vector4(originX, originY, scaleX, scaleY);
};

Extent.prototype.west = function (unit) {
    if ((0, _Coordinates.crsIsGeographic)(this.crs())) {
        return (0, _Coordinates.convertValueToUnit)(this._internalStorageUnit, unit, this._values[0]);
    } else {
        return this._values[CARDINAL.WEST];
    }
};

Extent.prototype.east = function (unit) {
    if ((0, _Coordinates.crsIsGeographic)(this.crs())) {
        return (0, _Coordinates.convertValueToUnit)(this._internalStorageUnit, unit, this._values[1]);
    } else {
        return this._values[CARDINAL.EAST];
    }
};

Extent.prototype.north = function (unit) {
    if ((0, _Coordinates.crsIsGeographic)(this.crs())) {
        return (0, _Coordinates.convertValueToUnit)(this._internalStorageUnit, unit, this._values[3]);
    } else {
        return this._values[CARDINAL.NORTH];
    }
};

Extent.prototype.south = function (unit) {
    if ((0, _Coordinates.crsIsGeographic)(this.crs())) {
        return (0, _Coordinates.convertValueToUnit)(this._internalStorageUnit, unit, this._values[2]);
    } else {
        return this._values[CARDINAL.SOUTH];
    }
};

Extent.prototype.crs = function () {
    return this._crs;
};

Extent.prototype.center = function (target) {
    if (_isTiledCRS(this._crs)) {
        throw new Error('Invalid operation for WMTS bbox');
    }
    var c = void 0;
    if (target) {
        _Coordinates2.default.call(target, this._crs, this._values[0], this._values[2]);
        c = target;
    } else {
        c = new _Coordinates2.default(this._crs, this._values[0], this._values[2]);
    }
    c._internalStorageUnit = this._internalStorageUnit;
    var dim = this.dimensions();
    c._values[0] += dim.x * 0.5;
    c._values[1] += dim.y * 0.5;
    return c;
};

Extent.prototype.dimensions = function (unit) {
    return {
        x: Math.abs(this.east(unit) - this.west(unit)),
        y: Math.abs(this.north(unit) - this.south(unit))
    };
};

/**
 * Return true if coord is inside the bounding box.
 *
 * @param {Coordinates} coord
 * @param {number} epsilon coord is inside the extent (+/- epsilon)
 * @return {boolean}
 */
Extent.prototype.isPointInside = function (coord) {
    var epsilon = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

    var c = this.crs() == coord.crs ? coord : coord.as(this.crs());
    // TODO this ignores altitude
    if ((0, _Coordinates.crsIsGeographic)(this.crs())) {
        return c.longitude(this._internalStorageUnit) <= this.east() + epsilon && c.longitude(this._internalStorageUnit) >= this.west() - epsilon && c.latitude(this._internalStorageUnit) <= this.north() + epsilon && c.latitude(this._internalStorageUnit) >= this.south() - epsilon;
    } else {
        return c.x() <= this.east() + epsilon && c.x() >= this.west() - epsilon && c.y() <= this.north() + epsilon && c.y() >= this.south() - epsilon;
    }
};

Extent.prototype.isInside = function (other, epsilon) {
    if (_isTiledCRS(this.crs())) {
        if (this._zoom == other._zoom) {
            return this._row == other._row && this._col == other._col;
        } else if (this._zoom < other._zoom) {
            return false;
        } else {
            var diffLevel = this._zoom - other._zoom;
            var diff = Math.pow(2, diffLevel);
            var invDiff = 1 / diff;

            var r = (this._row - this._row % diff) * invDiff;
            var c = (this._col - this._col % diff) * invDiff;
            return r == other._row && c == other._col;
        }
    } else {
        var o = other.as(this._crs);
        epsilon = epsilon == undefined ? (0, _Coordinates.reasonnableEpsilonForUnit)(o._internalStorageUnit) : epsilon;
        // compare use crs' default storage unit
        return this.east(o._internalStorageUnit) - o.east() <= epsilon && o.west() - this.west(o._internalStorageUnit) <= epsilon && this.north(o._internalStorageUnit) - o.north() <= epsilon && o.south() - this.south(o._internalStorageUnit) <= epsilon;
    }
};

Extent.prototype.offsetScale = function (bbox) {
    if (bbox.crs() != this.crs()) {
        throw new Error('unsupported offscale between 2 diff crs');
    }

    var dimension = {
        x: Math.abs(this.east() - this.west()),
        y: Math.abs(this.north() - this.south())
    };

    var originX = (bbox.west(this._internalStorageUnit) - this.west()) / dimension.x;
    var originY = (bbox.north(this._internalStorageUnit) - this.north()) / dimension.y;

    var scaleX = Math.abs(bbox.east(this._internalStorageUnit) - bbox.west(this._internalStorageUnit)) / dimension.x;
    var scaleY = Math.abs(bbox.north(this._internalStorageUnit) - bbox.south(this._internalStorageUnit)) / dimension.y;

    return new THREE.Vector4(originX, originY, scaleX, scaleY);
};

/**
 * @documentation: Return true if this bounding box intersect with the bouding box parameter
 * @param {type} bbox
 * @returns {Boolean}
 */
Extent.prototype.intersectsExtent = function (bbox) {
    var other = bbox.as(this.crs());
    return !(this.west() >= other.east(this._internalStorageUnit) || this.east() <= other.west(this._internalStorageUnit) || this.south() >= other.north(this._internalStorageUnit) || this.north() <= other.south(this._internalStorageUnit));
};

/**
 * @documentation: Return the intersection of this extent with another one
 * @param {type} other
 * @returns {Boolean}
 */
Extent.prototype.intersect = function (other) {
    if (!this.intersectsExtent(other)) {
        return new Extent(this.crs(), 0, 0, 0, 0);
    }
    return new Extent(this.crs(), Math.max(this.west(), other.west(this._internalStorageUnit)), Math.min(this.east(), other.east(this._internalStorageUnit)), Math.max(this.south(), other.south(this._internalStorageUnit)), Math.min(this.north(), other.north(this._internalStorageUnit)));
};

Extent.prototype.set = function (west, east, south, north) {
    this._values[CARDINAL.WEST] = west;
    this._values[CARDINAL.EAST] = east;
    this._values[CARDINAL.SOUTH] = south;
    this._values[CARDINAL.NORTH] = north;
};

Extent.prototype.union = function (extent) {
    if (extent.crs() != this.crs()) {
        throw new Error('unsupported union between 2 diff crs');
    }
    var west = extent.west(this._internalStorageUnit);
    if (west < this.west()) {
        this._values[CARDINAL.WEST] = west;
    }

    var east = extent.east(this._internalStorageUnit);
    if (east > this.east()) {
        this._values[CARDINAL.EAST] = east;
    }

    var south = extent.south(this._internalStorageUnit);
    if (south < this.south()) {
        this._values[CARDINAL.SOUTH] = south;
    }

    var north = extent.north(this._internalStorageUnit);
    if (north > this.north()) {
        this._values[CARDINAL.NORTH] = north;
    }
};

/**
 * expandByPoint perfoms the minimal extension
 * for the point to belong to this Extent object
 * @param {Coordinates} coordinates  The coordinates to belong
 */
Extent.prototype.expandByPoint = function (coordinates) {
    var coords = coordinates.as(this.crs());
    var unit = coords._internalStorageUnit;
    var we = (0, _Coordinates.convertValueToUnit)(unit, this._internalStorageUnit, coords._values[0]);
    if (we < this.west()) {
        this._values[CARDINAL.WEST] = we;
    }
    if (we > this.east()) {
        this._values[CARDINAL.EAST] = we;
    }
    var sn = (0, _Coordinates.convertValueToUnit)(unit, this._internalStorageUnit, coords._values[1]);
    if (sn < this.south()) {
        this._values[CARDINAL.SOUTH] = sn;
    }
    if (sn > this.north()) {
        this._values[CARDINAL.NORTH] = sn;
    }
};

exports.default = Extent;