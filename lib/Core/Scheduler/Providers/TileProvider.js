'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Provider = require('./Provider');

var _Provider2 = _interopRequireDefault(_Provider);

var _TileGeometry = require('../../TileGeometry');

var _TileGeometry2 = _interopRequireDefault(_TileGeometry);

var _TileMesh = require('../../TileMesh');

var _TileMesh2 = _interopRequireDefault(_TileMesh);

var _CancelledCommandException = require('../CancelledCommandException');

var _CancelledCommandException2 = _interopRequireDefault(_CancelledCommandException);

var _TiledNodeProcessing = require('../../../Process/TiledNodeProcessing');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function TileProvider() {
    _Provider2.default.call(this, null);
    this.cacheGeometry = new _map2.default();
}

TileProvider.prototype = (0, _create2.default)(_Provider2.default.prototype);

TileProvider.prototype.constructor = TileProvider;

TileProvider.prototype.preprocessDataLayer = function (layer, view, scheduler) {
    if (!layer.schemeTile) {
        throw new Error('Cannot init tiled layer without schemeTile for layer ' + layer.id);
    }

    layer.level0Nodes = [];
    layer.onTileCreated = layer.onTileCreated || function () {};

    var promises = [];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(layer.schemeTile), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var root = _step.value;

            promises.push((0, _TiledNodeProcessing.requestNewTile)(view, scheduler, layer, root, undefined, 0));
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

    return _promise2.default.all(promises).then(function (level0s) {
        layer.level0Nodes = level0s;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = (0, _getIterator3.default)(level0s), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var level0 = _step2.value;

                layer.object3d.add(level0);
                level0.updateMatrixWorld();
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
    });
};

var worldQuaternion = new THREE.Quaternion();
TileProvider.prototype.executeCommand = function (command) {
    var _this = this;

    var extent = command.extent;
    if (command.requester && !command.requester.material) {
        // request has been deleted
        return _promise2.default.reject(new _CancelledCommandException2.default(command));
    }
    var layer = command.layer;
    var builder = layer.builder;
    var parent = command.requester;
    var level = command.level === undefined ? parent.level + 1 : command.level;

    var _builder$computeShara = builder.computeSharableExtent(extent),
        sharableExtent = _builder$computeShara.sharableExtent,
        quaternion = _builder$computeShara.quaternion,
        position = _builder$computeShara.position;

    var south = sharableExtent.south().toFixed(6);
    var segment = layer.segments || 16;
    var key = builder.type + '_' + (layer.disableSkirt ? 0 : 1) + '_' + segment + '_' + level + '_' + south;

    var geometry = this.cacheGeometry.get(key);
    // build geometry if doesn't exist
    if (!geometry) {
        var paramsGeometry = {
            extent: sharableExtent,
            level: level,
            segment: segment,
            disableSkirt: layer.disableSkirt
        };

        geometry = new _TileGeometry2.default(paramsGeometry, builder);
        this.cacheGeometry.set(key, geometry);

        geometry._count = 0;
        geometry.dispose = function () {
            geometry._count--;
            if (geometry._count == 0) {
                THREE.BufferGeometry.prototype.dispose.call(geometry);
                _this.cacheGeometry.delete(key);
            }
        };
    }

    // build tile
    var params = {
        layerId: layer.id,
        extent: extent,
        level: level,
        materialOptions: layer.materialOptions
    };

    geometry._count++;
    var tile = new _TileMesh2.default(geometry, params);
    tile.layer = layer.id;
    tile.layers.set(command.threejsLayer);

    if (parent) {
        position.applyMatrix4(layer.object3d.matrixWorld);
        parent.worldToLocal(position);
        worldQuaternion.setFromRotationMatrix(parent.matrixWorld).inverse().multiply(layer.object3d.quaternion);
        quaternion.premultiply(worldQuaternion);
    }

    tile.position.copy(position);
    tile.quaternion.copy(quaternion);

    tile.material.transparent = layer.opacity < 1.0;
    tile.material.uniforms.opacity.value = layer.opacity;
    tile.setVisibility(false);
    tile.updateMatrix();

    if (parent) {
        tile.setBBoxZ(parent.OBB().z.min, parent.OBB().z.max);
    } else if (layer.materialOptions && layer.materialOptions.useColorTextureElevation) {
        tile.setBBoxZ(layer.materialOptions.colorTextureElevationMinZ, layer.materialOptions.colorTextureElevationMaxZ);
    }

    return _promise2.default.resolve(tile);
};

exports.default = TileProvider;