'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.updateLayeredMaterialNodeImagery = updateLayeredMaterialNodeImagery;
exports.updateLayeredMaterialNodeElevation = updateLayeredMaterialNodeElevation;

var _LayeredMaterialConstants = require('../Renderer/LayeredMaterialConstants');

var _LayerUpdateStrategy = require('../Core/Layer/LayerUpdateStrategy');

var _LayerUpdateState = require('../Core/Layer/LayerUpdateState');

var _LayerUpdateState2 = _interopRequireDefault(_LayerUpdateState);

var _Layer = require('../Core/Layer/Layer');

var _CancelledCommandException = require('../Core/Scheduler/CancelledCommandException');

var _CancelledCommandException2 = _interopRequireDefault(_CancelledCommandException);

var _OGCWebServiceHelper = require('../Core/Scheduler/Providers/OGCWebServiceHelper');

var _OGCWebServiceHelper2 = _interopRequireDefault(_OGCWebServiceHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// max retry loading before changing the status to definitiveError
var MAX_RETRY = 4;

function initNodeImageryTexturesFromParent(node, parent, layer) {
    if (parent.material && parent.material.getColorLayerLevelById(layer.id) > _LayeredMaterialConstants.EMPTY_TEXTURE_ZOOM) {
        var coords = node.getCoordsForLayer(layer);
        var offsetTextures = node.material.getLayerTextureOffset(layer.id);

        var textureIndex = offsetTextures;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = (0, _getIterator3.default)(coords), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var c = _step.value;
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = (0, _getIterator3.default)(parent.material.getLayerTextures(_LayeredMaterialConstants.l_COLOR, layer.id)), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var texture = _step2.value;

                        if (c.isInside(texture.coords)) {
                            var result = c.offsetToParent(texture.coords);
                            node.material.textures[_LayeredMaterialConstants.l_COLOR][textureIndex] = texture;
                            node.material.offsetScale[_LayeredMaterialConstants.l_COLOR][textureIndex] = result;
                            textureIndex++;
                            break;
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

        var index = node.material.indexOfColorLayer(layer.id);
        node.material.layerTexturesCount[index] = coords.length;
        node.material.loadedTexturesCount[_LayeredMaterialConstants.l_COLOR] += coords.length;
    }
}

function initNodeElevationTextureFromParent(node, parent, layer) {
    // Inherit parent's elevation texture. Note that contrary to color layers the elevation level of the
    // node might not be EMPTY_TEXTURE_ZOOM in this init function. That's because we can have
    // multiple elevation layers (thus multiple calls to initNodeElevationTextureFromParent) but a given
    // node can only use 1 elevation texture
    if (parent.material && parent.material.getElevationLayerLevel() > node.material.getElevationLayerLevel()) {
        var coords = node.getCoordsForLayer(layer);

        var texture = parent.material.textures[_LayeredMaterialConstants.l_ELEVATION][0];
        var pitch = coords[0].offsetToParent(parent.material.textures[_LayeredMaterialConstants.l_ELEVATION][0].coords);
        var elevation = {
            texture: texture,
            pitch: pitch
        };

        // If the texture resolution has a poor precision for this node, we don't
        // extract min-max from the texture (too few information), we instead chose
        // to use parent's min-max.
        var useMinMaxFromParent = node.level - texture.coords.zoom > 6;
        if (!useMinMaxFromParent) {
            var _OGCWebServiceHelper$ = _OGCWebServiceHelper2.default.ioDXBIL.computeMinMaxElevation(texture.image.data, _OGCWebServiceHelper.SIZE_TEXTURE_TILE, _OGCWebServiceHelper.SIZE_TEXTURE_TILE, pitch),
                min = _OGCWebServiceHelper$.min,
                max = _OGCWebServiceHelper$.max;

            elevation.min = min;
            elevation.max = max;
        }

        node.setTextureElevation(elevation);
        node.material.elevationLayersId = parent.material.elevationLayersId;
    }
}

function getIndiceWithPitch(i, pitch, w) {
    // normalized
    var currentY = Math.floor(i / w) / w; // normalized

    // Return corresponding indice in parent tile using pitch
    var newX = pitch.x + i % w / w * pitch.z;
    var newY = pitch.y + currentY * pitch.w;
    var newIndice = Math.floor(newY * w) * w + Math.floor(newX * w);
    return newIndice;
}

function insertSignificantValuesFromParent(texture, node, parent, layer) {
    if (parent.material && parent.material.getElevationLayerLevel() > _LayeredMaterialConstants.EMPTY_TEXTURE_ZOOM) {
        var coords = node.getCoordsForLayer(layer);
        var textureParent = parent.material.textures[_LayeredMaterialConstants.l_ELEVATION][0];
        var pitch = coords[0].offsetToParent(parent.material.textures[_LayeredMaterialConstants.l_ELEVATION][0].coords);
        var tData = texture.image.data;
        var l = tData.length;

        for (var i = 0; i < l; ++i) {
            if (tData[i] === layer.noDataValue) {
                tData[i] = textureParent.image.data[getIndiceWithPitch(i, pitch, 256)];
            }
        }
    }
}

function nodeCommandQueuePriorityFunction(node) {
    // We know that 'node' is visible because commands can only be
    // issued for visible nodes.

    // TODO: need priorization of displayed nodes
    if (node.isDisplayed()) {
        // Then prefer displayed() node over non-displayed one
        return 100;
    } else {
        return 10;
    }
}

function refinementCommandCancellationFn(cmd) {
    if (!cmd.requester.parent || !cmd.requester.material) {
        return true;
    }
    if (cmd.force) {
        return false;
    }

    // Cancel the command if the tile already has a better texture.
    // This is only needed for elevation layers, because we may have several
    // concurrent layers but we can only use one texture.
    if (cmd.layer.type == 'elevation' && cmd.targetLevel <= cmd.requester.material.getElevationLayerLevel()) {
        return true;
    }

    return !cmd.requester.isDisplayed();
}

function checkNodeElevationTextureValidity(texture, noDataValue) {
    // We check if the elevation texture has some significant values through corners
    var tData = texture.image.data;
    var l = tData.length;
    return tData[0] > noDataValue && tData[l - 1] > noDataValue && tData[Math.sqrt(l) - 1] > noDataValue && tData[l - Math.sqrt(l)] > noDataValue;
}

function updateLayeredMaterialNodeImagery(context, layer, node) {
    if (!node.parent) {
        return;
    }

    var material = node.material;

    // Initialisation
    if (node.layerUpdateState[layer.id] === undefined) {
        node.layerUpdateState[layer.id] = new _LayerUpdateState2.default();

        if (!layer.tileInsideLimit(node, layer)) {
            // we also need to check that tile's parent doesn't have a texture for this layer,
            // because even if this tile is outside of the layer, it could inherit it's
            // parent texture
            if (!(!layer.noTextureParentOutsideLimit && node.parent && node.parent.material && node.parent.getIndexLayerColor && node.parent.getIndexLayerColor(layer.id) >= 0)) {
                node.layerUpdateState[layer.id].noMoreUpdatePossible();
                return;
            }
        }

        if (material.indexOfColorLayer(layer.id) === -1) {
            var texturesCount = layer.tileTextureCount ? layer.tileTextureCount(node, layer) : 1;

            var paramMaterial = {
                tileMT: layer.options.tileMatrixSet || node.getCoordsForLayer(layer)[0].crs(),
                texturesCount: texturesCount,
                visible: layer.visible,
                opacity: layer.opacity,
                fx: layer.fx,
                idLayer: layer.id
            };

            material.pushLayer(paramMaterial);
            var imageryLayers = context.view.getLayers(function (l) {
                return l.type === 'color';
            });
            var sequence = _Layer.ImageryLayers.getColorLayersIdOrderedBySequence(imageryLayers);
            material.setSequence(sequence);

            initNodeImageryTexturesFromParent(node, node.parent, layer);
        }
    }

    // Node is hidden, no need to update it
    if (!node.isDisplayed()) {
        return;
    }

    // TODO: move this to defineLayerProperty() declaration
    // to avoid mixing layer's network updates and layer's params
    // Update material parameters
    var layerIndex = material.indexOfColorLayer(layer.id);
    material.setLayerVisibility(layerIndex, layer.visible);
    material.setLayerOpacity(layerIndex, layer.opacity);

    // An update is pending / or impossible -> abort
    if (!layer.visible || !node.layerUpdateState[layer.id].canTryUpdate(void 0)) {
        return;
    }

    // does this tile needs a new texture?
    if (layer.canTileTextureBeImproved) {
        // if the layer has a custom method -> use it
        if (!layer.canTileTextureBeImproved(layer, node)) {
            node.layerUpdateState[layer.id].noMoreUpdatePossible();
            return;
        }
    } else if (!node.isColorLayerDownscaled(layer)) {
        // default decision method
        node.layerUpdateState[layer.id].noMoreUpdatePossible();
        return;
    }

    // is fetching data from this layer disabled?
    if (layer.frozen) {
        return;
    }

    var currentLevel = node.material.getColorLayerLevelById(layer.id);
    var zoom = node.getCoordsForLayer(layer)[0].zoom || node.level;
    var targetLevel = (0, _LayerUpdateStrategy.chooseNextLevelToFetch)(layer.updateStrategy.type, node, zoom, currentLevel, layer);
    if (targetLevel <= currentLevel) {
        return;
    }

    node.layerUpdateState[layer.id].newTry();
    var command = {
        /* mandatory */
        view: context.view,
        layer: layer,
        requester: node,
        priority: nodeCommandQueuePriorityFunction(node),
        earlyDropFunction: refinementCommandCancellationFn,
        targetLevel: targetLevel
    };

    return context.scheduler.execute(command).then(function (result) {
        if (node.material === null) {
            return;
        }

        if (Array.isArray(result)) {
            node.setTexturesLayer(result, _LayeredMaterialConstants.l_COLOR, layer.id);
        } else if (result.texture) {
            node.setTexturesLayer([result], _LayeredMaterialConstants.l_COLOR, layer.id);
        }

        node.layerUpdateState[layer.id].success();

        return result;
    }, function (err) {
        if (err instanceof _CancelledCommandException2.default) {
            node.layerUpdateState[layer.id].success();
        } else {
            var definitiveError = node.layerUpdateState[layer.id].errorCount > MAX_RETRY;
            node.layerUpdateState[layer.id].failure(Date.now(), definitiveError);
            if (!definitiveError) {
                window.setTimeout(function () {
                    context.view.notifyChange(false, node);
                }, node.layerUpdateState[layer.id].secondsUntilNextTry() * 1000);
            }
        }
    });
}

function updateLayeredMaterialNodeElevation(context, layer, node) {
    if (!node.parent) {
        return;
    }
    // TODO: we need either
    //  - compound or exclusive layers
    //  - support for multiple elevation layers

    // Elevation is currently handled differently from color layers.
    // This is caused by a LayeredMaterial limitation: only 1 elevation texture
    // can be used (where a tile can have N textures x M layers)
    var material = node.material;
    var currentElevation = material.getElevationLayerLevel();

    // Init elevation layer, and inherit from parent if possible
    if (node.layerUpdateState[layer.id] === undefined) {
        node.layerUpdateState[layer.id] = new _LayerUpdateState2.default();
        initNodeElevationTextureFromParent(node, node.parent, layer);
        currentElevation = material.getElevationLayerLevel();
    }

    // Try to update
    var ts = Date.now();

    // Possible conditions to *not* update the elevation texture
    if (layer.frozen || !node.isDisplayed() || !node.layerUpdateState[layer.id].canTryUpdate(ts)) {
        return;
    }

    // Does this tile needs a new texture?
    if (layer.canTileTextureBeImproved) {
        // if the layer has a custom method -> use it
        if (!layer.canTileTextureBeImproved(layer, node)) {
            node.layerUpdateState[layer.id].noMoreUpdatePossible();
            return;
        }
    }

    var c = node.getCoordsForLayer(layer)[0];
    var zoom = c.zoom || node.level;
    var targetLevel = (0, _LayerUpdateStrategy.chooseNextLevelToFetch)(layer.updateStrategy.type, node, zoom, currentElevation, layer);

    if (targetLevel <= currentElevation || !layer.tileInsideLimit(node, layer, targetLevel)) {
        node.layerUpdateState[layer.id].noMoreUpdatePossible();
        return _promise2.default.resolve();
    }

    // TODO
    if (material.elevationLayersId.length === 0) {
        material.elevationLayersId.push(layer.id);
    }
    node.layerUpdateState[layer.id].newTry();

    var command = {
        /* mandatory */
        view: context.view,
        layer: layer,
        requester: node,
        targetLevel: targetLevel,
        priority: nodeCommandQueuePriorityFunction(node),
        earlyDropFunction: refinementCommandCancellationFn
    };

    return context.scheduler.execute(command).then(function (terrain) {
        if (node.material === null) {
            return;
        }

        // Do not apply the new texture if its level is < than the current one.
        // This is only needed for elevation layers, because we may have several
        // concurrent layers but we can only use one texture.
        if (targetLevel <= node.material.getElevationLayerLevel()) {
            node.layerUpdateState[layer.id].noMoreUpdatePossible();
            return;
        }

        node.layerUpdateState[layer.id].success();

        if (terrain.texture && terrain.texture.flipY) {
            // DataTexture default to false, so make sure other Texture types
            // do the same (eg image texture)
            // See UV construction for more details
            terrain.texture.flipY = false;
            terrain.texture.needsUpdate = true;
        }

        if (terrain.texture && terrain.texture.image.data && !checkNodeElevationTextureValidity(terrain.texture, layer.noDataValue)) {
            // Quick check to avoid using elevation texture with no data value
            // If we have no data values, we use value from the parent tile
            // We should later implement multi elevation layer to choose the one to use at each level
            insertSignificantValuesFromParent(terrain.texture, node, node.parent, layer);
        }

        node.setTextureElevation(terrain);
    }, function (err) {
        if (err instanceof _CancelledCommandException2.default) {
            node.layerUpdateState[layer.id].success();
        } else {
            var definitiveError = node.layerUpdateState[layer.id].errorCount > MAX_RETRY;
            node.layerUpdateState[layer.id].failure(Date.now(), definitiveError);
            if (!definitiveError) {
                window.setTimeout(function () {
                    context.view.notifyChange(false, node);
                }, node.layerUpdateState[layer.id].secondsUntilNextTry() * 1000);
            }
        }
    });
}