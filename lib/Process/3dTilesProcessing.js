'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.$3dTilesCulling = $3dTilesCulling;
exports.pre3dTilesUpdate = pre3dTilesUpdate;
exports.init3dTilesLayer = init3dTilesLayer;
exports.process3dTilesNode = process3dTilesNode;
exports.$3dTilesSubdivisionControl = $3dTilesSubdivisionControl;

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function requestNewTile(view, scheduler, geometryLayer, metadata, parent, redraw) {
    var command = {
        /* mandatory */
        view: view,
        requester: parent,
        layer: geometryLayer,
        priority: parent ? 1.0 / (parent.distance + 1) : 100,
        /* specific params */
        metadata: metadata,
        redraw: redraw
    };

    return scheduler.execute(command);
}

function subdivideNode(context, layer, node, cullingTest) {
    if (node.additiveRefinement) {
        // Additive refinement can only fetch visible children.
        _subdivideNodeAdditive(context, layer, node, cullingTest);
    } else {
        // Substractive refinement on the other hand requires to replace
        // node with all of its children
        _subdivideNodeSubstractive(context, layer, node);
    }
}

var tmpMatrix = new THREE.Matrix4();
function _subdivideNodeAdditive(context, layer, node, cullingTest) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        var _loop = function () {
            var child = _step.value;

            // child being downloaded => skip
            if (child.promise || child.loaded) {
                return 'continue';
            }

            // 'child' is only metadata (it's *not* a THREE.Object3D). 'cullingTest' needs
            // a matrixWorld, so we compute it: it's node's matrixWorld x child's transform
            var overrideMatrixWorld = node.matrixWorld;
            if (child.transform) {
                overrideMatrixWorld = tmpMatrix.multiplyMatrices(node.matrixWorld, child.transform);
            }

            var isVisible = cullingTest ? !cullingTest(context.camera, child, overrideMatrixWorld) : true;

            // child is not visible => skip
            if (!isVisible) {
                return 'continue';
            }
            child.promise = requestNewTile(context.view, context.scheduler, layer, child, node, true).then(function (tile) {
                node.add(tile);
                tile.updateMatrixWorld();
                context.view.notifyChange(true);
                child.loaded = true;
                delete child.promise;
            });
        };

        for (var _iterator = (0, _getIterator3.default)(layer.tileIndex.index[node.tileId].children), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _ret = _loop();

            if (_ret === 'continue') continue;
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
}

function _subdivideNodeSubstractive(context, layer, node) {
    if (!node.pendingSubdivision && node.children.filter(function (n) {
        return n.layer == layer.id;
    }).length == 0) {
        var _ret2 = function () {
            var childrenTiles = layer.tileIndex.index[node.tileId].children;
            if (childrenTiles === undefined || childrenTiles.length === 0) {
                return {
                    v: void 0
                };
            }
            node.pendingSubdivision = true;

            var promises = [];

            var _loop2 = function (i) {
                promises.push(requestNewTile(context.view, context.scheduler, layer, childrenTiles[i], node, false).then(function (tile) {
                    childrenTiles[i].loaded = true;
                    node.add(tile);
                    tile.updateMatrixWorld();
                    if (node.additiveRefinement) {
                        context.view.notifyChange(true);
                    }
                    layer.tileIndex.index[tile.tileId].loaded = true;
                }));
            };

            for (var i = 0; i < childrenTiles.length; i++) {
                _loop2(i);
            }
            _promise2.default.all(promises).then(function () {
                node.pendingSubdivision = false;
                context.view.notifyChange(true);
            });
        }();

        if ((typeof _ret2 === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret2)) === "object") return _ret2.v;
    }
}

function $3dTilesCulling(camera, node, tileMatrixWorld) {
    // For viewer Request Volume https://github.com/AnalyticalGraphicsInc/3d-tiles-samples/tree/master/tilesets/TilesetWithRequestVolume
    if (node.viewerRequestVolume) {
        var nodeViewer = node.viewerRequestVolume;
        if (nodeViewer.region) {
            // TODO
            return true;
        }
        if (nodeViewer.box) {
            // TODO
            return true;
        }
        if (nodeViewer.sphere) {
            var worldCoordinateCenter = nodeViewer.sphere.center.clone();
            worldCoordinateCenter.applyMatrix4(tileMatrixWorld);
            // To check the distance between the center sphere and the camera
            if (!(camera.camera3D.position.distanceTo(worldCoordinateCenter) <= nodeViewer.sphere.radius)) {
                return true;
            }
        }
    }

    // For bounding volume
    if (node.boundingVolume) {
        var boundingVolume = node.boundingVolume;
        if (boundingVolume.region) {
            return !camera.isBox3Visible(boundingVolume.region.box3D, tileMatrixWorld.clone().multiply(boundingVolume.region.matrix));
        }
        if (boundingVolume.box) {
            return !camera.isBox3Visible(boundingVolume.box, tileMatrixWorld);
        }
        if (boundingVolume.sphere) {
            return !camera.isSphereVisible(boundingVolume.sphere, tileMatrixWorld);
        }
    }
    return false;
}

// Cleanup all 3dtiles|three.js starting from a given node n.
// n's children can be of 2 types:
//   - have a 'content' attribute -> it's a tileset and must
//     be cleaned with cleanup3dTileset()
//   - doesn't have 'content' -> it's a raw Object3D object,
//     and must be cleaned with _cleanupObject3D()
function cleanup3dTileset(layer, n) {
    var depth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    // If this layer is not using additive refinement, we can only
    // clean a tile if all its neighbours are cleaned as well because
    // a tile can only be in 2 states:
    //   - displayed and no children displayed
    //   - hidden and all of its children displayed
    // So here we implement a conservative measure: if T is cleanable
    // we actually only clean its children tiles.
    var canCleanCompletely = n.additiveRefinement || depth > 0;

    for (var i = 0; i < n.children.length; i++) {
        // skip non-tiles elements
        if (!n.children[i].content) {
            if (canCleanCompletely) {
                n.children[i].traverse(_cleanupObject3D);
            }
        } else {
            cleanup3dTileset(layer, n.children[i], depth + 1);
        }
    }

    if (canCleanCompletely) {
        if (n.dispose) {
            n.dispose();
        }
        delete n.content;
        layer.tileIndex.index[n.tileId].loaded = false;
        n.remove.apply(n, (0, _toConsumableArray3.default)(n.children));

        // and finally remove from parent
        if (depth == 0 && n.parent) {
            n.parent.remove(n);
        }
    } else {
        var tiles = n.children.filter(function (n) {
            return n.tileId != undefined;
        });
        n.remove.apply(n, (0, _toConsumableArray3.default)(tiles));
    }
}

// This function is used to cleanup a Object3D hierarchy.
// (no 3dtiles spectific code here because this is managed by cleanup3dTileset)
function _cleanupObject3D(n) {
    // all children of 'n' are raw Object3D
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = (0, _getIterator3.default)(n.children), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _child = _step2.value;

            _cleanupObject3D(_child);
        }
        // free resources
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

    if (n.material) {
        n.material.dispose();
    }
    if (n.geometry) {
        n.geometry.dispose();
    }
    n.remove.apply(n, (0, _toConsumableArray3.default)(n.children));
}

function pre3dTilesUpdate(context, layer) {
    if (!layer.visible) {
        return [];
    }

    // pre-sse
    var hypotenuse = Math.sqrt(context.camera.width * context.camera.width + context.camera.height * context.camera.height);
    var radAngle = context.camera.camera3D.fov * Math.PI / 180;

    // TODO: not correct -> see new preSSE
    // const HFOV = 2.0 * Math.atan(Math.tan(radAngle * 0.5) / context.camera.ratio);
    var HYFOV = 2.0 * Math.atan(Math.tan(radAngle * 0.5) * hypotenuse / context.camera.width);
    context.camera.preSSE = hypotenuse * (2.0 * Math.tan(HYFOV * 0.5));

    // once in a while, garbage collect
    if (Math.random() > 0.98) {
        // Make sure we don't clean root tile
        layer.root.cleanableSince = undefined;

        // Browse
        var now = Date.now();

        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)(layer._cleanableTiles), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var elt = _step3.value;

                if (now - elt.cleanableSince > layer.cleanupDelay) {
                    cleanup3dTileset(layer, elt);
                }
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

        layer._cleanableTiles = layer._cleanableTiles.filter(function (n) {
            return layer.tileIndex.index[n.tileId].loaded && n.cleanableSince;
        });
    }

    return [layer.root];
}

// Improved zoom geometry
function computeNodeSSE(camera, node) {
    if (node.boundingVolume.region) {
        var cameraLocalPosition = camera.camera3D.position.clone();
        cameraLocalPosition.x -= node.boundingVolume.region.matrixWorld.elements[12];
        cameraLocalPosition.y -= node.boundingVolume.region.matrixWorld.elements[13];
        cameraLocalPosition.z -= node.boundingVolume.region.matrixWorld.elements[14];
        var distance = node.boundingVolume.region.box3D.distanceToPoint(cameraLocalPosition);
        node.distance = distance;
        return camera.preSSE * (node.geometricError / distance);
    }
    if (node.boundingVolume.box) {
        var _cameraLocalPosition = camera.camera3D.position.clone();
        _cameraLocalPosition.x -= node.matrixWorld.elements[12];
        _cameraLocalPosition.y -= node.matrixWorld.elements[13];
        _cameraLocalPosition.z -= node.matrixWorld.elements[14];
        var _distance = node.boundingVolume.box.distanceToPoint(_cameraLocalPosition);
        node.distance = _distance;
        return camera.preSSE * (node.geometricError / _distance);
    }
    if (node.boundingVolume.sphere) {
        var _cameraLocalPosition2 = camera.camera3D.position.clone();
        _cameraLocalPosition2.x -= node.matrixWorld.elements[12];
        _cameraLocalPosition2.y -= node.matrixWorld.elements[13];
        _cameraLocalPosition2.z -= node.matrixWorld.elements[14];
        var _distance2 = node.boundingVolume.sphere.distanceToPoint(_cameraLocalPosition2);
        node.distance = _distance2;
        return camera.preSSE * (node.geometricError / _distance2);
    }
    return Infinity;
}

function init3dTilesLayer(view, scheduler, layer) {
    return requestNewTile(view, scheduler, layer, layer.tileset.root, undefined, true).then(function (tile) {
        delete layer.tileset;
        layer.object3d.add(tile);
        tile.updateMatrixWorld();
        layer.tileIndex.index[tile.tileId].loaded = true;
        layer.root = tile;
    });
}

function setDisplayed(node, display) {
    // The geometry of the tile is not in node, but in node.content
    // To change the display state, we change node.content.visible instead of
    // node.material.visible
    if (node.content) {
        node.content.visible = display;
    }
}

function markForDeletion(layer, elt) {
    if (!elt.cleanableSince) {
        elt.cleanableSince = Date.now();
        layer._cleanableTiles.push(elt);
    }
}

function process3dTilesNode(cullingTest, subdivisionTest) {
    return function (context, layer, node) {
        // early exit if parent's subdivision is in progress
        if (node.parent.pendingSubdivision && !node.parent.additiveRefinement) {
            node.visible = false;
            return undefined;
        }

        // do proper culling
        var isVisible = cullingTest ? !cullingTest(context.camera, node, node.matrixWorld) : true;
        node.visible = isVisible;

        if (isVisible) {
            node.cleanableSince = undefined;

            var returnValue = void 0;
            if (node.pendingSubdivision || subdivisionTest(context, layer, node)) {
                subdivideNode(context, layer, node, cullingTest);
                // display iff children aren't ready
                setDisplayed(node, node.pendingSubdivision || node.additiveRefinement);
                returnValue = node.children.filter(function (n) {
                    return n.layer == layer.id;
                });
            } else {
                setDisplayed(node, true);

                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;
                var _iteratorError4 = undefined;

                try {
                    for (var _iterator4 = (0, _getIterator3.default)(node.children.filter(function (n) {
                        return n.layer == layer.id;
                    })), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                        var n = _step4.value;

                        n.visible = false;
                        markForDeletion(layer, n);
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
            }
            // toggle wireframe
            if (node.content && node.content.visible) {
                node.content.traverse(function (o) {
                    if (o.material) {
                        o.material.wireframe = layer.wireframe;
                    }
                });
            }
            return returnValue;
        }

        markForDeletion(layer, node);

        return undefined;
    };
}

function $3dTilesSubdivisionControl(context, layer, node) {
    if (layer.tileIndex.index[node.tileId].children === undefined) {
        return false;
    }
    var sse = computeNodeSSE(context.camera, node);
    return sse > layer.sseThreshold;
}