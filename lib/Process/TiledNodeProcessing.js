'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.requestNewTile = requestNewTile;
exports.processTiledGeometryNode = processTiledGeometryNode;

var _Extent = require('../Core/Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

var _CancelledCommandException = require('../Core/Scheduler/CancelledCommandException');

var _CancelledCommandException2 = _interopRequireDefault(_CancelledCommandException);

var _ObjectRemovalHelper = require('./ObjectRemovalHelper');

var _ObjectRemovalHelper2 = _interopRequireDefault(_ObjectRemovalHelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function subdivisionExtents(bbox) {
    var center = bbox.center();

    var northWest = new _Extent2.default(bbox.crs(), bbox.west(), center._values[0], center._values[1], bbox.north());
    var northEast = new _Extent2.default(bbox.crs(), center._values[0], bbox.east(), center._values[1], bbox.north());
    var southWest = new _Extent2.default(bbox.crs(), bbox.west(), center._values[0], bbox.south(), center._values[1]);
    var southEast = new _Extent2.default(bbox.crs(), center._values[0], bbox.east(), bbox.south(), center._values[1]);

    // scheme tiles store their coordinates in radians internally,
    // so we need to fix the new bboxes as well
    var result = [northWest, northEast, southWest, southEast];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(result), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var r = _step.value;

            r._internalStorageUnit = bbox._internalStorageUnit;
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

    return result;
}

function requestNewTile(view, scheduler, geometryLayer, extent, parent, level) {
    var command = {
        /* mandatory */
        view: view,
        requester: parent,
        layer: geometryLayer,
        priority: 10000,
        /* specific params */
        extent: extent,
        level: level,
        redraw: false,
        threejsLayer: geometryLayer.threejsLayer
    };

    return scheduler.execute(command).then(function (node) {
        node.add(node.OBB());
        geometryLayer.onTileCreated(geometryLayer, parent, node);
        return node;
    });
}

function subdivideNode(context, layer, node) {
    if (!node.pendingSubdivision && !node.children.some(function (n) {
        return n.layer == layer.id;
    })) {
        (function () {
            var extents = subdivisionExtents(node.extent);
            // TODO: pendingSubdivision mechanism is fragile, get rid of it
            node.pendingSubdivision = true;

            var promises = [];
            var children = [];
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = (0, _getIterator3.default)(extents), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var extent = _step2.value;

                    promises.push(requestNewTile(context.view, context.scheduler, layer, extent, node).then(function (child) {
                        children.push(child);
                        return node;
                    }));
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

            _promise2.default.all(promises).then(function () {
                var _iteratorNormalCompletion3 = true;
                var _didIteratorError3 = false;
                var _iteratorError3 = undefined;

                try {
                    for (var _iterator3 = (0, _getIterator3.default)(children), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                        var child = _step3.value;

                        node.add(child);
                        child.updateMatrixWorld(true);

                        child.material.uniforms.lightPosition.value = node.material.uniforms.lightPosition.value;
                        child.material.uniforms.lightingEnabled.value = node.material.uniforms.lightingEnabled.value;
                    }
                    // TODO
                    /*
                      if (child.material.elevationLayersId.length) {
                        // need to force update elevation when delta is important
                        if (child.level - child.material.getElevationLayerLevel() > 6) {
                            updateNodeElevation(_this.scene, params.tree, child, params.layersConfig, true);
                        }
                    }
                    */
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

                node.pendingSubdivision = false;
                context.view.notifyChange(false, node);
            }, function (err) {
                node.pendingSubdivision = false;
                if (!(err instanceof _CancelledCommandException2.default)) {
                    throw new Error(err);
                }
            });
        })();
    }
}

function processTiledGeometryNode(cullingTest, subdivisionTest) {
    return function (context, layer, node) {
        if (!node.parent) {
            return _ObjectRemovalHelper2.default.removeChildrenAndCleanup(layer.id, node);
        }
        // early exit if parent' subdivision is in progress
        if (node.parent.pendingSubdivision) {
            node.visible = false;
            node.setDisplayed(false);
            return undefined;
        }

        // do proper culling
        var isVisible = cullingTest ? !cullingTest(node, context.camera) : true;
        node.visible = isVisible;

        if (isVisible) {
            var requestChildrenUpdate = false;

            if (node.pendingSubdivision || subdivisionTest(context, layer, node)) {
                subdivideNode(context, layer, node);
                // display iff children aren't ready
                node.setDisplayed(node.pendingSubdivision);
                requestChildrenUpdate = true;
            } else {
                node.setDisplayed(true);
            }

            if (node.material.visible) {
                // update uniforms
                if (context.view.fogDistance != undefined) {
                    node.setFog(context.view.fogDistance);
                }

                if (!requestChildrenUpdate) {
                    return _ObjectRemovalHelper2.default.removeChildren(layer.id, node);
                }
            }

            // TODO: use Array.slice()
            return requestChildrenUpdate ? node.children.filter(function (n) {
                return n.layer == layer.id;
            }) : undefined;
        }

        node.setDisplayed(false);
        return _ObjectRemovalHelper2.default.removeChildren(layer.id, node);
    };
}