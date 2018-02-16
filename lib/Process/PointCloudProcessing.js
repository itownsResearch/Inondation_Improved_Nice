'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _monotoneConvexHull2d = require('monotone-convex-hull-2d');

var _monotoneConvexHull2d2 = _interopRequireDefault(_monotoneConvexHull2d);

var _CancelledCommandException = require('../Core/Scheduler/CancelledCommandException');

var _CancelledCommandException2 = _interopRequireDefault(_CancelledCommandException);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Draw a cube with lines (12 lines).
function cube(size) {
    var h = size.clone().multiplyScalar(0.5);
    var geometry = new THREE.Geometry();
    geometry.vertices.push(new THREE.Vector3(-h.x, -h.y, -h.z), new THREE.Vector3(-h.x, h.y, -h.z), new THREE.Vector3(-h.x, h.y, -h.z), new THREE.Vector3(h.x, h.y, -h.z), new THREE.Vector3(h.x, h.y, -h.z), new THREE.Vector3(h.x, -h.y, -h.z), new THREE.Vector3(h.x, -h.y, -h.z), new THREE.Vector3(-h.x, -h.y, -h.z), new THREE.Vector3(-h.x, -h.y, h.z), new THREE.Vector3(-h.x, h.y, h.z), new THREE.Vector3(-h.x, h.y, h.z), new THREE.Vector3(h.x, h.y, h.z), new THREE.Vector3(h.x, h.y, h.z), new THREE.Vector3(h.x, -h.y, h.z), new THREE.Vector3(h.x, -h.y, h.z), new THREE.Vector3(-h.x, -h.y, h.z), new THREE.Vector3(-h.x, -h.y, -h.z), new THREE.Vector3(-h.x, -h.y, h.z), new THREE.Vector3(-h.x, h.y, -h.z), new THREE.Vector3(-h.x, h.y, h.z), new THREE.Vector3(h.x, h.y, -h.z), new THREE.Vector3(h.x, h.y, h.z), new THREE.Vector3(h.x, -h.y, -h.z), new THREE.Vector3(h.x, -h.y, h.z));
    geometry.computeLineDistances();
    return geometry;
}

// TODO: move this function to Camera, as soon as it's good enough (see https://github.com/iTowns/itowns/pull/381#pullrequestreview-49107682)
var temp = {
    points: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    box3: new THREE.Box3(),
    matrix4: new THREE.Matrix4()
};
function box3SurfaceOnScreen(camera, box3d, matrixWorld) {
    if (box3d.isEmpty()) {
        return 0;
    }

    temp.box3.copy(box3d);
    if (matrixWorld) {
        temp.matrix4.multiplyMatrices(camera._viewMatrix, matrixWorld);
    } else {
        temp.matrix4.copy(camera._viewMatrix);
    }

    // copy pasted / adapted from Box3.applyMatrix4
    // NOTE: I am using a binary pattern to specify all 2^3 combinations below
    temp.points[0].set(temp.box3.min.x, temp.box3.min.y, temp.box3.min.z).applyMatrix4(temp.matrix4); // 000
    temp.points[1].set(temp.box3.min.x, temp.box3.min.y, temp.box3.max.z).applyMatrix4(temp.matrix4); // 001
    temp.points[2].set(temp.box3.min.x, temp.box3.max.y, temp.box3.min.z).applyMatrix4(temp.matrix4); // 010
    temp.points[3].set(temp.box3.min.x, temp.box3.max.y, temp.box3.max.z).applyMatrix4(temp.matrix4); // 011
    temp.points[4].set(temp.box3.max.x, temp.box3.min.y, temp.box3.min.z).applyMatrix4(temp.matrix4); // 100
    temp.points[5].set(temp.box3.max.x, temp.box3.min.y, temp.box3.max.z).applyMatrix4(temp.matrix4); // 101
    temp.points[6].set(temp.box3.max.x, temp.box3.max.y, temp.box3.min.z).applyMatrix4(temp.matrix4); // 110
    temp.points[7].set(temp.box3.max.x, temp.box3.max.y, temp.box3.max.z).applyMatrix4(temp.matrix4); // 111

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(temp.points), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var pt = _step.value;

            // translate/scale to [0, width]x[0, height]
            pt.x = camera.width * (pt.x + 1) * 0.5;
            pt.y = camera.height * (1 - pt.y) * 0.5;
            pt.z = 0;
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

    var indices = (0, _monotoneConvexHull2d2.default)(temp.points.map(function (v) {
        return [v.x, v.y];
    }));
    var contour = indices.map(function (i) {
        return temp.points[i];
    });

    var area = THREE.ShapeUtils.area(contour);

    return Math.abs(area);
}

function initBoundingBox(elt, layer) {
    var size = elt.tightbbox.getSize();
    elt.obj.boxHelper = new THREE.LineSegments(cube(size), elt.childrenBitField ? new THREE.LineDashedMaterial({ color: 0, dashSize: 0.25, gapSize: 0.25 }) : new THREE.LineBasicMaterial({ color: 0 }));

    elt.obj.boxHelper.frustumCulled = false;
    elt.obj.boxHelper.position.copy(elt.tightbbox.min);
    elt.obj.boxHelper.position.add(size.multiplyScalar(0.5));
    elt.obj.boxHelper.updateMatrixWorld(true);
    elt.obj.boxHelper.autoUpdateMatrix = false;
    elt.obj.boxHelper.material.linewidth = 2;
    elt.obj.boxHelper.layers.mask = layer.bboxes.layers.mask;
    layer.bboxes.add(elt.obj.boxHelper);
    elt.obj.boxHelper.updateMatrixWorld();
}

function shouldDisplayNode(context, layer, elt) {
    var shouldBeLoaded = 0;

    if (layer.octreeDepthLimit >= 0 && layer.octreeDepthLimit < elt.name.length) {
        return { shouldBeLoaded: shouldBeLoaded, surfaceOnScreen: 0 };
    }

    var numPoints = elt.numPoints;

    var cl = elt.tightbbox ? elt.tightbbox : elt.bbox;

    var visible = context.camera.isBox3Visible(cl, layer.object3d.matrixWorld);


    if (visible) {
        if (cl.containsPoint(context.camera.camera3D.position)) {
            shouldBeLoaded = 1;
        } else {
            var _surfaceOnScreen = box3SurfaceOnScreen(context.camera, cl, layer.object3d.matrixWorld);

            // no point indicates shallow hierarchy, so we definitely want to load its children
            if (numPoints == 0) {
                shouldBeLoaded = 1;
            } else {
                var count = layer.overdraw * (_surfaceOnScreen / Math.pow(layer.pointSize, 2));
                shouldBeLoaded = Math.min(count / numPoints, 1);
            }

            elt.surfaceOnScreen = _surfaceOnScreen;
        }
    } else {
        shouldBeLoaded = -1;
    }

    return { shouldBeLoaded: shouldBeLoaded, surfaceOnScreen: 0 };
}

function markForDeletion(elt) {
    if (elt.obj) {
        elt.obj.material.visible = false;
    }

    if (!elt.notVisibleSince) {
        elt.notVisibleSince = Date.now();
        elt.shouldBeLoaded = -1;
    }
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = (0, _getIterator3.default)(elt.children), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var child = _step2.value;

            markForDeletion(child);
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

exports.default = {
    preUpdate: function preUpdate(context, layer) {
        // TODO: use changeSource
        layer.counters = {
            pointCount: 0,
            displayedCount: 0
        };

        // Bail-out if not ready
        if (!layer.root) {
            return [];
        }

        // Start updating from hierarchy root
        return [layer.root];
    },
    update: function update(context, layer, elt) {
        var _shouldDisplayNode = shouldDisplayNode(context, layer, elt),
            shouldBeLoaded = _shouldDisplayNode.shouldBeLoaded;

        elt.shouldBeLoaded = shouldBeLoaded;

        if (shouldBeLoaded > 0) {
            elt.notVisibleSince = undefined;

            // only load geometry if this elements has points
            if (elt.numPoints > 0) {
                if (elt.obj) {
                    elt.obj.material.visible = true;


                    elt.obj.geometry.setDrawRange(0, Math.floor(shouldBeLoaded * elt.obj.geometry.attributes.position.count));
                    layer.counters.pointCount += elt.obj.realPointCount;
                    layer.counters.displayedCount += Math.floor(shouldBeLoaded * elt.obj.geometry.attributes.position.count);
                    elt.obj.material.uniforms.size.value = layer.pointSize;
                } else if (!elt.promise) {
                    // TODO:
                    // - add command cancelation support
                    // - rework priority
                    elt.promise = context.scheduler.execute({
                        layer: layer,
                        requester: elt,
                        view: context.view,
                        priority: 1.0 / elt.name.length, // surfaceOnScreen,
                        redraw: true,
                        isLeaf: elt.childrenBitField == 0,
                        earlyDropFunction: function earlyDropFunction(cmd) {
                            return cmd.requester.shouldBeLoaded <= 0;
                        }
                    }).then(function (pts) {
                        if (layer.onPointsCreated) {
                            layer.onPointsCreated(layer, pts);
                        }

                        elt.obj = pts;
                        // store tightbbox to avoid ping-pong (bbox = larger => visible, tight => invisible)
                        elt.tightbbox = pts.tightbbox;
                        pts.geometry.setDrawRange(0, shouldBeLoaded * pts.geometry.attributes.position.count);

                        // make sure to add it here, otherwise it might never
                        // be added nor cleaned
                        layer.group.add(elt.obj);
                        elt.obj.updateMatrixWorld(true);

                        elt.obj.owner = elt;
                        elt.promise = null;
                    }, function (err) {
                        if (err instanceof _CancelledCommandException2.default) {
                            elt.promise = null;
                        }
                    });
                }
            }
        } else {
            // not visible / displayed
            markForDeletion(elt);
        }

        if (shouldBeLoaded >= 0.9 && elt.children && elt.children.length) {
            return elt.children;
        }
        return undefined;
    },
    postUpdate: function postUpdate(context, layer) {
        if (!layer.group) {
            return;
        }

        if (layer.counters.displayedCount > layer.pointBudget) {
            var reduction = layer.pointBudget / layer.counters.displayedCount;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = (0, _getIterator3.default)(layer.group.children), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var pts = _step3.value;

                    if (pts.material.visible) {
                        pts.geometry.setDrawRange(0, pts.geometry.drawRange.count * reduction);
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

            layer.counters.displayedCount *= reduction;
        }

        var now = Date.now();

        for (var i = layer.group.children.length - 1; i >= 0; i--) {
            var obj = layer.group.children[i];
            if (!obj.material.visible && now - obj.owner.notVisibleSince > 10000) {
                // remove from group
                layer.group.children.splice(i, 1);

                obj.material.dispose();
                obj.geometry.dispose();
                obj.material = null;
                obj.geometry = null;
                obj.owner.obj = null;
            }
        }
    },
    selectAt: function selectAt(view, layer, mouse) {
        if (!layer.root) {
            return;
        }

        // enable picking mode for points material
        view.scene.traverse(function (o) {
            if (o.isPoints && o.baseId) {
                o.material.enablePicking(true);
            }
        });

        // render 1 pixel
        // TODO: support more than 1 pixel selection
        var buffer = view.mainLoop.gfxEngine.renderViewTobuffer(view, view.mainLoop.gfxEngine.fullSizeRenderTarget, mouse.x, mouse.y, 1, 1);

        // see PointCloudProvider and the construction of unique_id
        var objId = buffer[0] << 8 | buffer[1];
        var index = buffer[2] << 8 | buffer[3];

        var result = void 0;
        view.scene.traverse(function (o) {
            if (o.isPoints && o.baseId) {
                // disable picking mode
                o.material.enablePicking(false);

                // if baseId matches objId, the clicked point belongs to `o`
                if (!result && o.baseId === objId) {
                    result = {
                        points: o,
                        index: index
                    };
                }
            }
        });

        return result;
    }
};