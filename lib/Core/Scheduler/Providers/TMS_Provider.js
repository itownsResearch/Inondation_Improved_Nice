'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _OGCWebServiceHelper = require('./OGCWebServiceHelper');

var _OGCWebServiceHelper2 = _interopRequireDefault(_OGCWebServiceHelper);

var _Extent = require('../../Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function TMS_Provider() {}

TMS_Provider.prototype.preprocessDataLayer = function (layer) {
    if (!layer.extent) {
        throw new Error('Missing extent property for layer \'' + layer.id + '\'');
    }
    if (!layer.projection) {
        throw new Error('Missing projection property for layer \'' + layer.id + '\'');
    }
    layer.extent = new (Function.prototype.bind.apply(_Extent2.default, [null].concat([layer.projection], (0, _toConsumableArray3.default)(layer.extent))))();
    if (!layer.options.zoom) {
        layer.options.zoom = {
            min: 0,
            max: 18
        };
    }
};

TMS_Provider.prototype.url = function (coTMS, layer) {
    /* eslint-disable no-template-curly-in-string */
    return layer.url.replace('${z}', coTMS.zoom).replace('${y}', coTMS.row).replace('${x}', coTMS.col);
    /* eslint-enable no-template-curly-in-string */
};

TMS_Provider.prototype.executeCommand = function (command) {
    var layer = command.layer;
    var tile = command.requester;
    var coordTMS = tile.getCoordsForLayer(layer)[0];
    var coordTMSParent = command.targetLevel < coordTMS.zoom ? _OGCWebServiceHelper2.default.WMTS_WGS84Parent(coordTMS, command.targetLevel) : undefined;

    var url = this.url(coordTMSParent || coordTMS, layer);

    return _OGCWebServiceHelper2.default.getColorTextureByUrl(url, layer.networkOptions).then(function (texture) {
        var result = {};
        result.texture = texture;
        result.texture.coords = coordTMSParent || coordTMS;
        result.pitch = coordTMSParent ? coordTMS.offsetToParent(coordTMSParent) : new THREE.Vector4(0, 0, 1, 1);
        if (layer.transparent) {
            texture.premultiplyAlpha = true;
        }
        return result;
    });
};

TMS_Provider.prototype.tileTextureCount = function (tile, layer) {
    return this.tileInsideLimit(tile, layer) ? 1 : 0;
};

TMS_Provider.prototype.tileInsideLimit = function (tile, layer, targetLevel) {
    // assume 1 TMS texture per tile (ie: tile geometry CRS is the same as layer's CRS)
    var tmsCoord = tile.getCoordsForLayer(layer)[0];

    if (targetLevel < tmsCoord.zoom) {
        tmsCoord = _OGCWebServiceHelper2.default.WMTS_WGS84Parent(tmsCoord, targetLevel);
    }

    return layer.options.zoom.min <= tmsCoord.zoom && tmsCoord.zoom <= layer.options.zoom.max;
};

exports.default = TMS_Provider;