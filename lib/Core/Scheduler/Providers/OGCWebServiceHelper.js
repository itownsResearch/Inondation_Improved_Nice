'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SIZE_TEXTURE_TILE = undefined;

var _log = require('babel-runtime/core-js/math/log2');

var _log2 = _interopRequireDefault(_log);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Fetcher = require('./Fetcher');

var _Fetcher2 = _interopRequireDefault(_Fetcher);

var _CacheRessource = require('./CacheRessource');

var _CacheRessource2 = _interopRequireDefault(_CacheRessource);

var _IoDriver_XBIL = require('./IoDriver_XBIL');

var _IoDriver_XBIL2 = _interopRequireDefault(_IoDriver_XBIL);

var _Projection = require('../../Geographic/Projection');

var _Projection2 = _interopRequireDefault(_Projection);

var _Extent = require('../../Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SIZE_TEXTURE_TILE = exports.SIZE_TEXTURE_TILE = 256;

// CacheRessource is necessary for neighboring PM textures
// The PM textures overlap several tiles WGS84, it is to avoid net requests
// Info : THREE.js have cache image https://github.com/mrdoob/three.js/blob/master/src/loaders/ImageLoader.js#L25
var cache = (0, _CacheRessource2.default)();
var cachePending = new _map2.default();
var ioDXBIL = new _IoDriver_XBIL2.default();
var projection = new _Projection2.default();

var getTextureFloat = function (buffer) {
    var texture = new THREE.DataTexture(buffer, SIZE_TEXTURE_TILE, SIZE_TEXTURE_TILE, THREE.AlphaFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
};

exports.default = {
    ioDXBIL: ioDXBIL,
    getColorTextureByUrl: function getColorTextureByUrl(url, networkOptions) {
        var cachedTexture = cache.getRessource(url);

        if (cachedTexture) {
            return _promise2.default.resolve(cachedTexture);
        }

        var _ref = cachePending.has(url) ? cachePending.get(url) : _Fetcher2.default.texture(url, networkOptions),
            texture = _ref.texture,
            promise = _ref.promise;

        texture.generateMipmaps = false;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.anisotropy = 16;

        cachePending.set(url, { texture: texture, promise: promise });

        return promise.then(function () {
            if (!cache.getRessource(url)) {
                cache.addRessource(url, texture);
            }
            cachePending.delete(url);
            return texture;
        });
    },
    getXBilTextureByUrl: function getXBilTextureByUrl(url, networkOptions) {
        var textureCache = cache.getRessource(url);

        if (textureCache !== undefined) {
            return _promise2.default.resolve(textureCache);
        }

        var pending = cachePending.get(url);
        if (pending) {
            return pending;
        }

        var promiseXBil = ioDXBIL.read(url, networkOptions).then(function (result) {
            // TODO  RGBA is needed for navigator with no support in texture float
            // In RGBA elevation texture LinearFilter give some errors with nodata value.
            // need to rewrite sample function in shader

            // loading concurrence
            var textureConcurrence = cache.getRessource(url);
            if (textureConcurrence) {
                cachePending.delete(url);
                return textureConcurrence;
            }

            var texture = getTextureFloat(result.floatArray);
            texture.generateMipmaps = false;
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearFilter;
            texture.min = result.min;
            texture.max = result.max;
            cache.addRessource(url, texture);
            cachePending.delete(url);

            return texture;
        });

        cachePending.set(url, promiseXBil);

        return promiseXBil;
    },
    computeTileMatrixSetCoordinates: function computeTileMatrixSetCoordinates(tile, tileMatrixSet) {
        // Are WMTS coordinates ready?
        if (!tile.wmtsCoords) {
            tile.wmtsCoords = {};
        }

        tileMatrixSet = tileMatrixSet || 'WGS84G';
        if (!(tileMatrixSet in tile.wmtsCoords)) {
            var tileCoord = projection.WGS84toWMTS(tile.extent);

            tile.wmtsCoords[tileMatrixSet] = projection.getCoordWMTS_WGS84(tileCoord, tile.extent, tileMatrixSet);
        }
    },
    computeTMSCoordinates: function computeTMSCoordinates(tile, extent) {
        if (tile.extent.crs() != extent.crs()) {
            throw new Error('Unsupported configuration. TMS is only supported when geometry has the same crs than TMS layer');
        }
        var c = tile.extent.center();
        var layerDimension = extent.dimensions();

        // Each level has 2^n * 2^n tiles...
        // ... so we count how many tiles of the same width as tile we can fit in the layer
        var tileCount = Math.round(layerDimension.x / tile.extent.dimensions().x);
        // ... 2^zoom = tilecount => zoom = log2(tilecount)
        var zoom = Math.floor((0, _log2.default)(tileCount));

        // Now that we have computed zoom, we can deduce x and y (or row / column)
        var x = (c.x() - extent.west()) / layerDimension.x;
        var y = (extent.north() - c.y()) / layerDimension.y;

        return [new _Extent2.default('TMS', zoom, Math.floor(y * tileCount), Math.floor(x * tileCount))];
    },
    WMTS_WGS84Parent: function WMTS_WGS84Parent(cWMTS, levelParent, pitch) {
        var diffLevel = cWMTS.zoom - levelParent;
        var diff = Math.pow(2, diffLevel);
        var invDiff = 1 / diff;

        var r = (cWMTS.row - cWMTS.row % diff) * invDiff;
        var c = (cWMTS.col - cWMTS.col % diff) * invDiff;

        if (pitch) {
            pitch.x = cWMTS.col * invDiff - c;
            pitch.y = cWMTS.row * invDiff - r;
            pitch.z = invDiff;
        }

        return new _Extent2.default(cWMTS.crs(), levelParent, r, c);
    }
};