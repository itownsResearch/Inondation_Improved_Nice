'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _OGCWebServiceHelper = require('./OGCWebServiceHelper');

var _OGCWebServiceHelper2 = _interopRequireDefault(_OGCWebServiceHelper);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Generated On: 2015-10-5
 * Class: WMTS_Provider
 * Description: Fournisseur de données à travers un flux WMTS
 */

function WMTS_Provider() {}

WMTS_Provider.prototype.customUrl = function (layer, url, tilematrix, row, col) {
    var urld = url.replace('%TILEMATRIX', tilematrix.toString());
    urld = urld.replace('%ROW', row.toString());
    urld = urld.replace('%COL', col.toString());

    return urld;
};

WMTS_Provider.prototype.preprocessDataLayer = function (layer) {
    layer.fx = layer.fx || 0.0;

    layer.options = layer.options || {};

    if (layer.protocol === 'wmts') {
        var options = layer.options;
        options.version = options.version || '1.0.0';
        options.tileMatrixSet = options.tileMatrixSet || 'WGS84';
        options.mimetype = options.mimetype || 'image/png';
        options.style = options.style || 'normal';
        options.projection = options.projection || 'EPSG:3857';
        var newBaseUrl = '' + layer.url + ('?LAYER=' + options.name) + ('&FORMAT=' + options.mimetype) + '&SERVICE=WMTS' + ('&VERSION=' + options.version) + '&REQUEST=GetTile' + ('&STYLE=' + options.style) + ('&TILEMATRIXSET=' + options.tileMatrixSet);

        newBaseUrl += '&TILEMATRIX=%TILEMATRIX&TILEROW=%ROW&TILECOL=%COL';

        if (!layer.options.zoom) {
            var arrayLimits = (0, _keys2.default)(options.tileMatrixSetLimits);
            var size = arrayLimits.length;
            var maxZoom = Number(arrayLimits[size - 1]);


            layer.options.zoom = {
                min: maxZoom - size + 1,
                max: maxZoom
            };
        }
        layer.customUrl = newBaseUrl;
    }
    layer.options.zoom = layer.options.zoom || { min: 2, max: 20 };
};

/**
 * Return url wmts orthophoto
 * @param {{zoom:number,row:number,col:number}} coWMTS
 * @param {Layer} layer
 * @returns {string}
 */
WMTS_Provider.prototype.url = function (coWMTS, layer) {
    return this.customUrl(layer, layer.customUrl, coWMTS.zoom, coWMTS.row, coWMTS.col);
};

/**
 * return texture float alpha THREE.js of MNT
 * @param {TileMesh} tile
 * @param {Layer} layer
 * @param {number} targetZoom
 * @returns {Promise<portableXBIL>}
 */
WMTS_Provider.prototype.getXbilTexture = function (tile, layer, targetZoom) {
    var pitch = new THREE.Vector4(0.0, 0.0, 1.0, 1.0);
    var coordWMTS = tile.getCoordsForLayer(layer)[0];

    if (targetZoom && targetZoom !== coordWMTS.zoom) {
        coordWMTS = _OGCWebServiceHelper2.default.WMTS_WGS84Parent(coordWMTS, targetZoom, pitch);
    }

    var url = this.url(coordWMTS, layer);

    return _OGCWebServiceHelper2.default.getXBilTextureByUrl(url, layer.networkOptions).then(function (texture) {
        texture.coords = coordWMTS;
        return {
            texture: texture,
            pitch: pitch,
            min: !texture.min ? 0 : texture.min,
            max: !texture.max ? 0 : texture.max
        };
    });
};

/**
 * Return texture RGBA THREE.js of orthophoto
 * TODO : RGBA --> RGB remove alpha canal
 * @param {{zoom:number,row:number,col:number}} coordWMTS
 * @param {Layer} layer
 * @returns {Promise<Texture>}
 */
WMTS_Provider.prototype.getColorTexture = function (coordWMTS, layer) {
    var url = this.url(coordWMTS, layer);
    return _OGCWebServiceHelper2.default.getColorTextureByUrl(url, layer.networkOptions).then(function (texture) {
        var result = {};
        result.texture = texture;
        result.texture.coords = coordWMTS;
        result.pitch = new THREE.Vector4(0, 0, 1, 1);
        if (layer.transparent) {
            texture.premultiplyAlpha = true;
        }

        return result;
    });
};

WMTS_Provider.prototype.executeCommand = function (command) {
    var layer = command.layer;
    var tile = command.requester;

    var supportedFormats = {
        'image/png': this.getColorTextures.bind(this),
        'image/jpg': this.getColorTextures.bind(this),
        'image/jpeg': this.getColorTextures.bind(this),
        'image/x-bil;bits=32': this.getXbilTexture.bind(this)
    };

    var func = supportedFormats[layer.options.mimetype];
    if (func) {
        return func(tile, layer, command.targetLevel);
    } else {
        return _promise2.default.reject(new Error('Unsupported mimetype ' + layer.options.mimetype));
    }
};

WMTS_Provider.prototype.tileTextureCount = function (tile, layer) {
    var tileMatrixSet = layer.options.tileMatrixSet;
    _OGCWebServiceHelper2.default.computeTileMatrixSetCoordinates(tile, tileMatrixSet);
    return tile.getCoordsForLayer(layer).length;
};

WMTS_Provider.prototype.tileInsideLimit = function (tile, layer, targetLevel) {
    // This layer provides data starting at level = layer.options.zoom.min
    // (the zoom.max property is used when building the url to make
    //  sure we don't use invalid levels)
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(tile.getCoordsForLayer(layer)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var coord = _step.value;

            var c = coord;
            // override
            if (targetLevel < c.zoom) {
                c = _OGCWebServiceHelper2.default.WMTS_WGS84Parent(coord, targetLevel);
            }
            if (c.zoom < layer.options.zoom.min || c.zoom > layer.options.zoom.max) {
                return false;
            }
            if (layer.options.tileMatrixSetLimits) {
                if (c.row < layer.options.tileMatrixSetLimits[c.zoom].minTileRow || c.row > layer.options.tileMatrixSetLimits[c.zoom].maxTileRow || c.col < layer.options.tileMatrixSetLimits[c.zoom].minTileCol || c.col > layer.options.tileMatrixSetLimits[c.zoom].maxTileCol) {
                    return false;
                }
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

    return true;
};

WMTS_Provider.prototype.getColorTextures = function (tile, layer) {
    if (tile.material === null) {
        return _promise2.default.resolve();
    }
    var promises = [];
    var bcoord = tile.getCoordsForLayer(layer);

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = (0, _getIterator3.default)(bcoord), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var coordWMTS = _step2.value;

            promises.push(this.getColorTexture(coordWMTS, layer));
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

    return _promise2.default.all(promises);
};

exports.default = WMTS_Provider;