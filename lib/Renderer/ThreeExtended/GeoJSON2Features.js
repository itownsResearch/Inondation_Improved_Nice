'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _Coordinates = require('../../Core/Geographic/Coordinates');

var _Coordinates2 = _interopRequireDefault(_Coordinates);

var _Extent = require('../../Core/Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Generated On: 2016-09-28
 * Class: FeatureToolBox
 * Description:
 */
function readCRS(json) {
    if (json.crs) {
        if (json.crs.type.toLowerCase() == 'epsg') {
            return 'EPSG:' + json.crs.properties.code;
        } else if (json.crs.type.toLowerCase() == 'name') {
            var epsgIdx = json.crs.properties.name.toLowerCase().indexOf('epsg:');
            if (epsgIdx >= 0) {
                // authority:version:code => EPSG:[...]:code
                var codeStart = json.crs.properties.name.indexOf(':', epsgIdx + 5);
                if (codeStart > 0) {
                    return 'EPSG:' + json.crs.properties.name.substr(codeStart + 1);
                }
            }
        }
        throw new Error('Unsupported CRS type \'' + json.crs + '\'');
    }
    // assume default crs
    return 'EPSG:4326';
}

function readCoordinates(crsIn, crsOut, coordinates, extent) {
    // coordinates is a list of pair [[x1, y1], [x2, y2], ..., [xn, yn]]
    var out = [];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(coordinates), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var pair = _step.value;

            // TODO: 1 is a default z value, makes this configurable
            var coords = new _Coordinates2.default(crsIn, pair[0], pair[1], 1);
            if (crsIn === crsOut) {
                out.push(coords);
            } else {
                out.push(coords.as(crsOut));
            }
            // expand extent if present
            if (extent) {
                extent.expandByPoint(out[out.length - 1]);
            }
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

    return out;
}

// Helper struct that returns an object { type: "", coordinates: [...], extent}:
// - type is the geom type
// - Coordinates is an array of Coordinate
// - extent is optional, it's coordinates's extent
// Multi-* geometry types are merged in one.
var GeometryToCoordinates = {
    point: function point(crsIn, crsOut, coordsIn, filteringExtent, options) {
        var extent = options.buildExtent ? new _Extent2.default(crsOut, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        var coordinates = readCoordinates(crsIn, crsOut, coordsIn, extent);
        if (filteringExtent) {
            coordinates = coordinates.filter(function (c) {
                return filteringExtent.isPointInside(c);
            });
        }
        return { type: 'point', coordinates: coordinates, extent: extent };
    },
    polygon: function polygon(crsIn, crsOut, coordsIn, filteringExtent, options) {
        var extent = options.buildExtent ? new _Extent2.default(crsOut, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        var coordinates = readCoordinates(crsIn, crsOut, coordsIn, extent);
        if (filteringExtent && !filteringExtent.isPointInside(coordinates[0])) {
            return;
        }
        return { type: 'polygon', coordinates: coordinates, extent: extent };
    },
    lineString: function lineString(crsIn, crsOut, coordsIn, filteringExtent, options) {
        var extent = options.buildExtent ? new _Extent2.default(crsOut, Infinity, -Infinity, Infinity, -Infinity) : undefined;
        var coordinates = readCoordinates(crsIn, crsOut, coordsIn, extent);
        if (filteringExtent && !filteringExtent.isPointInside(coordinates[0])) {
            return;
        }
        return { type: 'linestring', coordinates: coordinates, extent: extent };
    },
    merge: function merge() {
        var result = void 0;
        var offset = 0;

        for (var _len = arguments.length, geoms = Array(_len), _key = 0; _key < _len; _key++) {
            geoms[_key] = arguments[_key];
        }

        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = (0, _getIterator3.default)(geoms), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var geom = _step2.value;

                if (!geom) {
                    continue;
                }
                if (!result) {
                    result = geom;
                    // instance extent if present

                    if (geom.extent) {
                        result.extent = geom.extent.clone();
                    }
                    result.featureVertices = {};
                } else {
                    // merge coordinates
                    result.coordinates = result.coordinates.concat(geom.coordinates);
                    // union extent if present
                    if (geom.extent) {
                        result.extent.union(geom.extent);
                    }
                }
                result.featureVertices[geom.featureIndex || 0] = { offset: offset, count: geom.coordinates.length, extent: geom.extent };
                offset = result.coordinates.length;
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

        return result;
    },
    multiLineString: function multiLineString(crsIn, crsOut, coordsIn, filteringExtent, options) {
        var result = void 0;
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)(coordsIn), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var line = _step3.value;

                var l = this.lineString(crsIn, crsOut, line, filteringExtent, options);
                if (!l) {
                    return;
                }
                // only test the first line
                filteringExtent = undefined;
                result = this.merge(result, l);
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

        return result;
    },
    multiPolygon: function multiPolygon(crsIn, crsOut, coordsIn, filteringExtent, options) {
        var result = void 0;
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
            for (var _iterator4 = (0, _getIterator3.default)(coordsIn), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                var polygon = _step4.value;

                var p = this.polygon(crsIn, crsOut, polygon[0], filteringExtent, options);
                if (!p) {
                    return;
                }
                // only test the first poly
                filteringExtent = undefined;
                result = this.merge(result, p);
            }
        } catch (err) {
            _didIteratorError4 = true;
            _iteratorError4 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                    _iterator4.return();
                }
            } finally {
                if (_didIteratorError4) {
                    throw _iteratorError4;
                }
            }
        }

        return result;
    }
};

function readGeometry(crsIn, crsOut, json, filteringExtent, options) {
    if (json.coordinates.length == 0) {
        return;
    }
    switch (json.type.toLowerCase()) {
        case 'point':
            return GeometryToCoordinates.point(crsIn, crsOut, [json.coordinates], filteringExtent, options);
        case 'multipoint':
            return GeometryToCoordinates.point(crsIn, crsOut, json.coordinates, filteringExtent, options);
        case 'linestring':
            return GeometryToCoordinates.lineString(crsIn, crsOut, json.coordinates, filteringExtent, options);
        case 'multilinestring':
            return GeometryToCoordinates.multiLineString(crsIn, crsOut, json.coordinates, filteringExtent, options);
        case 'polygon':
            return GeometryToCoordinates.polygon(crsIn, crsOut, json.coordinates[0], filteringExtent, options);
        case 'multipolygon':
            return GeometryToCoordinates.multiPolygon(crsIn, crsOut, json.coordinates, filteringExtent, options);
        case 'geometrycollection':
        default:
            throw new Error('Unhandled geometry type ' + json.type);
    }
}

function readFeature(crsIn, crsOut, json, filteringExtent, options) {
    if (options.filter && !options.filter(json.properties)) {
        return;
    }
    var feature = {};
    feature.geometry = readGeometry(crsIn, crsOut, json.geometry, filteringExtent, options);

    if (!feature.geometry) {
        return;
    }
    feature.properties = json.properties || {};
    // copy other properties
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = (0, _getIterator3.default)((0, _keys2.default)(json)), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var key = _step5.value;

            if (['type', 'geometry', 'properties'].indexOf(key.toLowerCase()) < 0) {
                feature.properties[key] = json[key];
            }
        }
    } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
            }
        } finally {
            if (_didIteratorError5) {
                throw _iteratorError5;
            }
        }
    }

    return feature;
}

function concatGeometries(result, geometry) {
    var idx = result.geometries.length;
    geometry.forEach(function (f, index) {
        f.properties._idx = index;f.properties._meshIdx = idx;
    });
    var g = geometry.map(function (p) {
        return p.geometry;
    });
    var p = GeometryToCoordinates.merge.apply(GeometryToCoordinates, (0, _toConsumableArray3.default)(g));
    result.geometries.push(p);
    if (p.extent) {
        if (result.extent) {
            result.extent.union(p.extent);
        } else {
            result.extent = p.extent.clone();
        }
    }
}

function readFeatureCollection(crsIn, crsOut, json, filteringExtent, options) {
    var collec = [];

    var featureIndex = 0;
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
        for (var _iterator6 = (0, _getIterator3.default)(json.features), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var feature = _step6.value;

            var f = readFeature(crsIn, crsOut, feature, filteringExtent, options);
            if (f) {
                f.geometry.featureIndex = featureIndex;
                collec.push(f);
                featureIndex++;
            }
        }
    } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
            }
        } finally {
            if (_didIteratorError6) {
                throw _iteratorError6;
            }
        }
    }

    if (collec.length) {
        // sort by types
        var geom = {
            points: collec.filter(function (c) {
                return c.geometry.type === 'point';
            }),
            lines: collec.filter(function (c) {
                return c.geometry.type === 'linestring';
            }),
            polygons: collec.filter(function (c) {
                return c.geometry.type === 'polygon';
            })
        };
        var result = { geometries: [] };
        if (geom.points.length) {
            concatGeometries(result, geom.points);
        }
        if (geom.lines.length) {
            concatGeometries(result, geom.lines);
        }
        if (geom.polygons.length) {
            concatGeometries(result, geom.polygons);
        }
        // remember individual features properties
        // eslint-disable-next-line arrow-body-style
        result.features = collec.map(function (c) {
            return { properties: c.properties };
        });
        if (result.geometries.length) {
            return result;
        }
    }
}

exports.default = {
    parse: function parse(crsOut, json, filteringExtent) {
        var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

        options.crsIn = options.crsIn || readCRS(json);
        switch (json.type.toLowerCase()) {
            case 'featurecollection':
                return readFeatureCollection(options.crsIn, crsOut, json, filteringExtent, options);
            case 'feature':
                return readFeature(options.crsIn, crsOut, json, filteringExtent, options);
            default:
                throw new Error('Unsupported GeoJSON type: \'' + json.type);
        }
    }
};