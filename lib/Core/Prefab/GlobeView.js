'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GLOBE_VIEW_EVENTS = undefined;

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.createGlobeLayer = createGlobeLayer;

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _View = require('../View');

var _View2 = _interopRequireDefault(_View);

var _MainLoop = require('../MainLoop');

var _ColorLayersOrdering = require('../../Renderer/ColorLayersOrdering');

var _RendererConstant = require('../../Renderer/RendererConstant');

var _RendererConstant2 = _interopRequireDefault(_RendererConstant);

var _GlobeControls = require('../../Renderer/ThreeExtended/GlobeControls');

var _GlobeControls2 = _interopRequireDefault(_GlobeControls);

var _LayeredMaterial = require('../../Renderer/LayeredMaterial');

var _Layer = require('../Layer/Layer');

var _Atmosphere = require('./Globe/Atmosphere');

var _Atmosphere2 = _interopRequireDefault(_Atmosphere);

var _CoordStars = require('../Geographic/CoordStars');

var _CoordStars2 = _interopRequireDefault(_CoordStars);

var _Coordinates = require('../Geographic/Coordinates');

var _TiledNodeProcessing = require('../../Process/TiledNodeProcessing');

var _LayeredMaterialNodeProcessing = require('../../Process/LayeredMaterialNodeProcessing');

var _GlobeTileProcessing = require('../../Process/GlobeTileProcessing');

var _BuilderEllipsoidTile = require('./Globe/BuilderEllipsoidTile');

var _BuilderEllipsoidTile2 = _interopRequireDefault(_BuilderEllipsoidTile);

var _SubdivisionControl = require('../../Process/SubdivisionControl');

var _SubdivisionControl2 = _interopRequireDefault(_SubdivisionControl);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Fires when the view is completely loaded. Controls and view's functions can be called then.
 * @event GlobeView#initialized
 * @property target {view} dispatched on view
 * @property type {string} initialized
 */
/**
 * Fires when a layer is added
 * @event GlobeView#layer-added
 * @property layerId {string} the id of the layer
 * @property target {view} dispatched on view
 * @property type {string} layers-added
 */
/**
 * Fires when a layer is removed
 * @event GlobeView#layer-removed
 * @property layerId {string} the id of the layer
 * @property target {view} dispatched on view
 * @property type {string} layers-added
 */
/**
 * Fires when the layers oder has changed
 * @event GlobeView#layers-order-changed
 * @property new {object}
 * @property new.sequence {array}
 * @property new.sequence.0 {number} the new layer at position 0
 * @property new.sequence.1 {number} the new layer at position 1
 * @property new.sequence.2 {number} the new layer at position 2
 * @property previous {object}
 * @property previous.sequence {array}
 * @property previous.sequence.0 {number} the previous layer at position 0
 * @property previous.sequence.1 {number} the previous layer at position 1
 * @property previous.sequence.2 {number} the previous layer at position 2
 * @property target {view} dispatched on view
 * @property type {string} layers-order-changed
 */

/**
 * Globe's EVENT
 * @property GLOBE_INITIALIZED {string} emit one time when globe is initialized
 * @property LAYER_ADDED {string} emit when layer id added in viewer
 * @property LAYER_REMOVED {string} emit when layer id removed in viewer
 * @property COLOR_LAYERS_ORDER_CHANGED {string} emit when  color layers order change
 */

var GLOBE_VIEW_EVENTS = exports.GLOBE_VIEW_EVENTS = {
    GLOBE_INITIALIZED: 'initialized',
    LAYER_ADDED: 'layer-added',
    LAYER_REMOVED: 'layer-removed',
    COLOR_LAYERS_ORDER_CHANGED: _ColorLayersOrdering.COLOR_LAYERS_ORDER_CHANGED
};

function createGlobeLayer(id, options) {

    function _commonAncestorLookup(a, b) {
        if (!a || !b) {
            return undefined;
        }
        if (a.level == b.level) {
            if (a.id == b.id) {
                return a;
            } else if (a.level != 0) {
                return _commonAncestorLookup(a.parent, b.parent);
            } else {
                return undefined;
            }
        } else if (a.level < b.level) {
            return _commonAncestorLookup(a, b.parent);
        } else {
            return _commonAncestorLookup(a.parent, b);
        }
    }
    // Configure tiles


    var wgs84TileLayer = new _Layer.GeometryLayer(id, options.object3d || new THREE.Group());
    wgs84TileLayer.schemeTile = (0, _GlobeTileProcessing.globeSchemeTileWMTS)(_GlobeTileProcessing.globeSchemeTile1);
    wgs84TileLayer.extent = wgs84TileLayer.schemeTile[0].clone();
    for (var i = 1; i < wgs84TileLayer.schemeTile.length; i++) {
        wgs84TileLayer.extent.union(wgs84TileLayer.schemeTile[i]);
    }
    wgs84TileLayer.preUpdate = function (context, layer, changeSources) {
        _SubdivisionControl2.default.preUpdate(context, layer);

        (0, _GlobeTileProcessing.preGlobeUpdate)(context, layer);
        if (changeSources.has(undefined) || changeSources.size == 0) {
            return layer.level0Nodes;
        }
        var commonAncestor = void 0;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = (0, _getIterator3.default)(changeSources.values()), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var source = _step.value;

                if (source.isCamera) {
                    // if the change is caused by a camera move, no need to bother
                    // to find common ancestor: we need to update the whole tree:
                    // some invisible tiles may now be visible
                    return layer.level0Nodes;
                }
                if (source.layer === layer.id) {
                    if (!commonAncestor) {
                        commonAncestor = source;
                    } else {
                        commonAncestor = _commonAncestorLookup(commonAncestor, source);
                        if (!commonAncestor) {
                            return layer.level0Nodes;
                        }
                    }
                    if (commonAncestor.material == null) {
                        commonAncestor = undefined;
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

        if (commonAncestor) {
            return [commonAncestor];
        } else {
            return layer.level0Nodes;
        }
    };

    wgs84TileLayer.update = (0, _TiledNodeProcessing.processTiledGeometryNode)((0, _GlobeTileProcessing.globeCulling)(2), function (context, layer, node) {
        if (_SubdivisionControl2.default.hasEnoughTexturesToSubdivide(context, layer, node)) {
            return (0, _GlobeTileProcessing.globeSubdivisionControl)(2, options.maxSubdivisionLevel || 18, options.sseSubdivisionThreshold || 1.0, options.maxDeltaElevationLevel || 4)(context, layer, node);
        }
        return false;
    });
    wgs84TileLayer.builder = new _BuilderEllipsoidTile2.default();
    wgs84TileLayer.onTileCreated = function (layer, parent, node) {
        node.material.setLightingOn(layer.lighting.enable);
        node.material.uniforms.lightPosition.value = layer.lighting.position;
        if (layer.noTextureColor) {
            node.material.uniforms.noTextureColor.value.copy(layer.noTextureColor);
        }
    };
    wgs84TileLayer.type = 'geometry';
    wgs84TileLayer.protocol = 'tile';
    wgs84TileLayer.visible = true;
    wgs84TileLayer.lighting = {
        enable: false,
        position: { x: -0.5, y: 0.0, z: 1.0 }
    };
    return wgs84TileLayer;
}

/**
 * Creates the viewer Globe (the globe of iTowns).
 * The first parameter is the coordinates on wich the globe will be centered at the initialization.
 * The second one is the HTML div in wich the scene will be created.
 * @constructor
 * @example view = new GlobeView(viewer, positionOnGlobe);
 * // positionOnGlobe in latitude, longitude and altitude
 * @augments View
 * @param {HTMLDivElement} viewerDiv - Where to instanciate the Three.js scene in the DOM
 * @param {object} coordCarto
 * @param {object=} options - see {@link View}
 */
function GlobeView(viewerDiv, coordCarto) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    THREE.Object3D.DefaultUp.set(0, 0, 1);
    var size = (0, _Coordinates.ellipsoidSizes)().x;
    // Setup View
    _View2.default.call(this, 'EPSG:4978', viewerDiv, options);

    // Configure camera
    var positionCamera = new _Coordinates.C.EPSG_4326(coordCarto.longitude, coordCarto.latitude, coordCarto.altitude);

    this.camera.setPosition(positionCamera);
    this.camera.camera3D.lookAt({ x: 0, y: 0, z: 0 });
    this.camera.camera3D.near = Math.max(15.0, 0.000002352 * size);
    this.camera.camera3D.far = size * 10;
    this.camera.camera3D.updateProjectionMatrix();
    this.camera.camera3D.updateMatrixWorld(true);

    var wgs84TileLayer = createGlobeLayer('globe', options);

    var sun = new THREE.DirectionalLight();
    sun.position.set(-0.5, 0, 1);
    sun.updateMatrixWorld(true);
    wgs84TileLayer.object3d.add(sun);

    this.addLayer(wgs84TileLayer);

    // Atmosphere
    this.atmosphere = new _Atmosphere2.default();

    var atmosphereLayer = this.mainLoop.gfxEngine.getUniqueThreejsLayer();
    this.atmosphere.traverse(function (obj) {
        obj.layers.set(atmosphereLayer);
    });
    this.camera.camera3D.layers.enable(atmosphereLayer);

    wgs84TileLayer.object3d.add(this.atmosphere);
    this.atmosphere.updateMatrixWorld(true);

    // Configure controls
    var positionTargetCamera = positionCamera.clone();
    positionTargetCamera.setAltitude(0);

    if (options.noControls) {
        this.camera.camera3D.lookAt(positionTargetCamera.as('EPSG:4978').xyz());
    } else {
        this.controls = new _GlobeControls2.default(this, positionTargetCamera.as('EPSG:4978').xyz(), size);
        this.controls.handleCollision = typeof options.handleCollision !== 'undefined' ? options.handleCollision : true;
    }

    this._renderState = _RendererConstant2.default.FINAL;
    this._fullSizeDepthBuffer = null;

    var renderer = this.mainLoop.gfxEngine.renderer;

    this.addFrameRequester(_MainLoop.MAIN_LOOP_EVENTS.BEFORE_RENDER, function () {
        if (_this._fullSizeDepthBuffer != null) {
            // clean depth buffer
            _this._fullSizeDepthBuffer = null;
        }
        var v = new THREE.Vector3();
        v.setFromMatrixPosition(wgs84TileLayer.object3d.matrixWorld);
        var len = v.distanceTo(_this.camera.camera3D.position);
        v.setFromMatrixScale(wgs84TileLayer.object3d.matrixWorld);
        var lim = v.x * size * 1.1;

        // TODO: may be move in camera update
        // Compute fog distance, this function makes it possible to have a shorter distance
        // when the camera approaches the ground
        _this.fogDistance = size * 160.0 * Math.pow((len - size * 0.99) * 0.25 / size, 1.5);

        if (len < lim) {
            var t = Math.pow(Math.cos((lim - len) / (lim - v.x * size * 0.9981) * Math.PI * 0.5), 1.5);
            var color = new THREE.Color(0x93d5f8);
            renderer.setClearColor(color.multiplyScalar(1.0 - t), renderer.getClearAlpha());
        } else if (len >= lim) {
            renderer.setClearColor(0x030508, renderer.getClearAlpha());
        }
    });

    this.wgs84TileLayer = wgs84TileLayer;

    var fn = function () {
        _this.mainLoop.removeEventListener('command-queue-empty', fn);
        _this.dispatchEvent({ type: GLOBE_VIEW_EVENTS.GLOBE_INITIALIZED });
    };

    this.mainLoop.addEventListener('command-queue-empty', fn);

    this.notifyChange(true);
}

GlobeView.prototype = (0, _create2.default)(_View2.default.prototype);
GlobeView.prototype.constructor = GlobeView;

GlobeView.prototype.addLayer = function (layer) {
    if (layer.type == 'color') {
        var colorLayerCount = this.getLayers(function (l) {
            return l.type === 'color';
        }).length;
        layer.sequence = colorLayerCount;
        layer.update = _LayeredMaterialNodeProcessing.updateLayeredMaterialNodeImagery;
        if (layer.protocol === 'rasterizer') {
            layer.reprojection = 'EPSG:4326';
        }
    } else if (layer.type == 'elevation') {
        if (layer.protocol === 'wmts' && layer.options.tileMatrixSet !== 'WGS84G') {
            throw new Error('Only WGS84G tileMatrixSet is currently supported for WMTS elevation layers');
        }
        layer.update = _LayeredMaterialNodeProcessing.updateLayeredMaterialNodeElevation;
    }
    var layerId = layer.id;
    var layerPromise = _View2.default.prototype.addLayer.call(this, layer, this.wgs84TileLayer);

    this.dispatchEvent({
        type: GLOBE_VIEW_EVENTS.LAYER_ADDED,
        layerId: layerId
    });

    return layerPromise;
};

/**
 * Removes a specific imagery layer from the current layer list. This removes layers inserted with attach().
 * @example
 * view.removeLayer('layerId');
 * @param      {string}   layerId      The identifier
 * @return     {boolean}
 */
GlobeView.prototype.removeLayer = function (layerId) {
    var layer = this.getLayers(function (l) {
        return l.id === layerId;
    })[0];
    if (layer && layer.type === 'color' && this.wgs84TileLayer.detach(layer)) {
        var cO = function (object) {
            if (object.removeColorLayer) {
                object.removeColorLayer(layerId);
            }
        };

        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = (0, _getIterator3.default)(this.wgs84TileLayer.level0Nodes), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var root = _step2.value;

                root.traverse(cO);
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

        var imageryLayers = this.getLayers(function (l) {
            return l.type === 'color';
        });
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)(imageryLayers), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var color = _step3.value;

                if (color.sequence > layer.sequence) {
                    color.sequence--;
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

        this.notifyChange(true);
        this.dispatchEvent({
            type: GLOBE_VIEW_EVENTS.LAYER_REMOVED,
            layerId: layerId
        });

        return true;
    } else {
        throw new Error(layerId + ' isn\'t color layer');
    }
};

GlobeView.prototype.selectNodeAt = function (mouse) {
    // update the picking ray with the camera and mouse position
    var selectedId = this.screenCoordsToNodeId(mouse);

    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = (0, _getIterator3.default)(this.wgs84TileLayer.level0Nodes), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var n = _step4.value;

            n.traverse(function (node) {
                // only take of selectable nodes
                if (node.setSelected) {
                    node.setSelected(node.id === selectedId);

                    if (node.id === selectedId) {
                        // eslint-disable-next-line no-console
                        console.info(node);
                    }
                }
            });
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

    this.notifyChange(true);
};

GlobeView.prototype.screenCoordsToNodeId = function (mouse) {
    var dim = this.mainLoop.gfxEngine.getWindowSize();

    mouse = mouse || new THREE.Vector2(Math.floor(dim.x / 2), Math.floor(dim.y / 2));

    var previousRenderState = this._renderState;
    this.changeRenderState(_RendererConstant2.default.ID);

    // Prepare state
    var prev = this.camera.camera3D.layers.mask;
    this.camera.camera3D.layers.mask = 1 << this.wgs84TileLayer.threejsLayer;

    var buffer = this.mainLoop.gfxEngine.renderViewTobuffer(this, this.mainLoop.gfxEngine.fullSizeRenderTarget, mouse.x, dim.y - mouse.y, 1, 1);

    this.changeRenderState(previousRenderState);
    this.camera.camera3D.layers.mask = prev;

    var depthRGBA = new THREE.Vector4().fromArray(buffer).divideScalar(255.0);

    // unpack RGBA to float
    var unpack = (0, _LayeredMaterial.unpack1K)(depthRGBA, Math.pow(256, 3));

    return Math.round(unpack);
};

GlobeView.prototype.readDepthBuffer = function (x, y, width, height) {
    var g = this.mainLoop.gfxEngine;
    var previousRenderState = this._renderState;
    this.changeRenderState(_RendererConstant2.default.DEPTH);
    var buffer = g.renderViewTobuffer(this, g.fullSizeRenderTarget, x, y, width, height);
    this.changeRenderState(previousRenderState);
    return buffer;
};

var matrix = new THREE.Matrix4();
var screen = new THREE.Vector2();
var pickWorldPosition = new THREE.Vector3();
var ray = new THREE.Ray();
var direction = new THREE.Vector3();
GlobeView.prototype.getPickingPositionFromDepth = function (mouse) {
    var l = this.mainLoop;
    var viewPaused = l.scheduler.commandsWaitingExecutionCount() == 0 && l.renderingState == _MainLoop.RENDERING_PAUSED;
    var g = l.gfxEngine;
    var dim = g.getWindowSize();
    var camera = this.camera.camera3D;

    mouse = mouse || dim.clone().multiplyScalar(0.5);
    mouse.x = Math.floor(mouse.x);
    mouse.y = Math.floor(mouse.y);

    var prev = camera.layers.mask;
    camera.layers.mask = 1 << this.wgs84TileLayer.threejsLayer;

    // Render/Read to buffer
    var buffer = void 0;
    if (viewPaused) {
        this._fullSizeDepthBuffer = this._fullSizeDepthBuffer || this.readDepthBuffer(0, 0, dim.x, dim.y);
        var id = ((dim.y - mouse.y - 1) * dim.x + mouse.x) * 4;
        buffer = this._fullSizeDepthBuffer.slice(id, id + 4);
    } else {
        buffer = this.readDepthBuffer(mouse.x, dim.y - mouse.y - 1, 1, 1);
    }

    screen.x = mouse.x / dim.x * 2 - 1;
    screen.y = -(mouse.y / dim.y) * 2 + 1;

    // Origin
    ray.origin.copy(camera.position);

    // Direction
    ray.direction.set(screen.x, screen.y, 0.5);
    // Unproject
    matrix.multiplyMatrices(camera.matrixWorld, matrix.getInverse(camera.projectionMatrix));
    ray.direction.applyMatrix4(matrix);
    ray.direction.sub(ray.origin);

    direction.set(0, 0, 1.0);
    direction.applyMatrix4(matrix);
    direction.sub(ray.origin);

    var angle = direction.angleTo(ray.direction);
    var orthoZ = g.depthBufferRGBAValueToOrthoZ(buffer, camera);
    var length = orthoZ / Math.cos(angle);

    pickWorldPosition.addVectors(camera.position, ray.direction.setLength(length));

    camera.layers.mask = prev;

    if (pickWorldPosition.length() > 10000000) {
        return undefined;
    }

    return pickWorldPosition;
};

GlobeView.prototype.changeRenderState = function (newRenderState) {
    if (this._renderState == newRenderState || !this.wgs84TileLayer.level0Nodes) {
        return;
    }

    // build traverse function
    var changeStateFunction = function () {
        return function (object3D) {
            if (object3D.changeState) {
                object3D.changeState(newRenderState);
            }
        };
    }();

    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = (0, _getIterator3.default)(this.wgs84TileLayer.level0Nodes), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var n = _step5.value;

            n.traverseVisible(changeStateFunction);
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

    this._renderState = newRenderState;
};

GlobeView.prototype.setRealisticLightingOn = function (value) {
    var coSun = _CoordStars2.default.getSunPositionInScene(new Date().getTime(), 48.85, 2.35).normalize();

    this.lightingPos = coSun.normalize();

    var lighting = this.wgs84TileLayer.lighting;
    lighting.enable = value;
    lighting.position = coSun;

    this.atmosphere.setRealisticOn(value);
    this.atmosphere.updateLightingPos(coSun);

    this.updateMaterialUniform('lightingEnabled', value);
    this.updateMaterialUniform('lightPosition', coSun);
    this.notifyChange(true);
};

GlobeView.prototype.setLightingPos = function (pos) {
    var lightingPos = pos || _CoordStars2.default.getSunPositionInScene(this.ellipsoid, new Date().getTime(), 48.85, 2.35);

    this.updateMaterialUniform('lightPosition', lightingPos.clone().normalize());
    this.notifyChange(true);
};

GlobeView.prototype.updateMaterialUniform = function (uniformName, value) {
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
        for (var _iterator6 = (0, _getIterator3.default)(this.wgs84TileLayer.level0Nodes), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var n = _step6.value;

            n.traverse(function (obj) {
                if (!obj.material || !obj.material.uniforms) {
                    return;
                }
                if (uniformName in obj.material.uniforms) {
                    obj.material.uniforms[uniformName].value = value;
                }
            });
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
};

exports.default = GlobeView;