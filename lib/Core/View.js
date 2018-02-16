'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _three = require('three');

var _Camera = require('../Renderer/Camera');

var _Camera2 = _interopRequireDefault(_Camera);

var _MainLoop = require('./MainLoop');

var _MainLoop2 = _interopRequireDefault(_MainLoop);

var _c3DEngine = require('../Renderer/c3DEngine');

var _c3DEngine2 = _interopRequireDefault(_c3DEngine);

var _LayerUpdateStrategy = require('./Layer/LayerUpdateStrategy');

var _Layer = require('./Layer/Layer');

var _Scheduler = require('./Scheduler/Scheduler');

var _Scheduler2 = _interopRequireDefault(_Scheduler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Constructs an Itowns View instance
 *
 * @param {string} crs - The default CRS of Three.js coordinates. Should be a cartesian CRS.
 * @param {HTMLElement} viewerDiv - Where to instanciate the Three.js scene in the DOM
 * @param {Object=} options - Optional properties.
 * @param {?MainLoop} options.mainLoop - {@link MainLoop} instance to use, otherwise a default one will be constructed
 * @param {?(WebGLRenderer|object)} options.renderer - {@link WebGLRenderer} instance to use, otherwise
 * a default one will be constructed. In this case, if options.renderer is an object, it will be used to
 * configure the renderer (see {@link c3DEngine}.  If not present, a new <canvas> will be created and
 * added to viewerDiv (mutually exclusive with mainLoop)
 * @param {?Scene} options.scene3D - {@link Scene} instance to use, otherwise a default one will be constructed
 * @constructor
 * @example
 * // How add gpx object
 * itowns.GpxUtils.load(url, viewer.referenceCrs).then((gpx) => {
 *      if (gpx) {
 *         viewer.scene.add(gpx);
 *      }
 * });
 *
 * viewer.notifyChange(true);
 */
// TODO:
// - remove debug boolean, replace by if __DEBUG__ and checkboxes in debug UI
//
function View(crs, viewerDiv) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

    if (!viewerDiv) {
        throw new Error('Invalid viewerDiv parameter (must non be null/undefined)');
    }

    this.referenceCrs = crs;

    var engine = void 0;
    // options.renderer can be 2 separate things:
    //   - an actual renderer (in this case we don't use viewerDiv)
    //   - options for the renderer to be created
    if (options.renderer && options.renderer.domElement) {
        engine = new _c3DEngine2.default(options.renderer);
    } else {
        engine = new _c3DEngine2.default(viewerDiv, options.renderer);
    }

    this.mainLoop = options.mainLoop || new _MainLoop2.default(new _Scheduler2.default(), engine);

    this.scene = options.scene3D || new _three.Scene();
    if (!options.scene3D) {
        this.scene.autoUpdate = false;
    }

    this.camera = new _Camera2.default(this.referenceCrs, this.mainLoop.gfxEngine.getWindowSize().x, this.mainLoop.gfxEngine.getWindowSize().y, options);

    this._frameRequesters = {};
    this._layers = [];

    window.addEventListener('resize', function () {
        // If the user gave us a container (<div>) then itowns' size is
        // the container's size. Otherwise we use window' size.
        var newSize = new _three.Vector2(viewerDiv.clientWidth, viewerDiv.clientHeight);
        _this.mainLoop.gfxEngine.onWindowResize(newSize.x, newSize.y);
        _this.notifyChange(true);
    }, false);

    this._changeSources = new _set2.default();
} /* global window, requestAnimationFrame */


View.prototype = (0, _create2.default)(_three.EventDispatcher.prototype);
View.prototype.constructor = View;

var _syncGeometryLayerVisibility = function (layer, view) {
    if (layer.object3d) {
        layer.object3d.visible = layer.visible;
    }

    if (layer.threejsLayer) {
        if (layer.visible) {
            view.camera.camera3D.layers.enable(layer.threejsLayer);
        } else {
            view.camera.camera3D.layers.disable(layer.threejsLayer);
        }
    }
};

function _preprocessLayer(view, layer, provider) {
    if (!(layer instanceof _Layer.Layer) && !(layer instanceof _Layer.GeometryLayer)) {
        var nlayer = new _Layer.Layer(layer.id);
        // nlayer.id is read-only so delete it from layer before Object.assign
        var tmp = layer;
        delete tmp.id;
        layer = (0, _assign2.default)(nlayer, layer);
        // restore layer.id in user provider layer object
        tmp.id = layer.id;
    }

    if (!layer.updateStrategy) {
        layer.updateStrategy = {
            type: _LayerUpdateStrategy.STRATEGY_MIN_NETWORK_TRAFFIC
        };
    }

    if (provider) {
        if (provider.tileInsideLimit) {
            layer.tileInsideLimit = provider.tileInsideLimit.bind(provider);
        }

        if (provider.tileTextureCount) {
            layer.tileTextureCount = provider.tileTextureCount.bind(provider);
        }
    }

    if (!layer.whenReady) {
        if (layer.type == 'geometry' || layer.type == 'debug') {
            if (!layer.object3d) {
                // layer.threejsLayer *must* be assigned before preprocessing,
                // because TileProvider.preprocessDataLayer function uses it.
                layer.threejsLayer = view.mainLoop.gfxEngine.getUniqueThreejsLayer();
            }
        }
        var providerPreprocessing = _promise2.default.resolve();
        if (provider && provider.preprocessDataLayer) {
            providerPreprocessing = provider.preprocessDataLayer(layer, view, view.mainLoop.scheduler);
            if (!(providerPreprocessing && providerPreprocessing.then)) {
                providerPreprocessing = _promise2.default.resolve();
            }
        }

        // the last promise in the chain must return the layer
        layer.whenReady = providerPreprocessing.then(function () {
            layer.ready = true;
            return layer;
        });
    }

    // probably not the best place to do this
    if (layer.type == 'color') {
        (0, _Layer.defineLayerProperty)(layer, 'frozen', false);
        (0, _Layer.defineLayerProperty)(layer, 'visible', true);
        (0, _Layer.defineLayerProperty)(layer, 'opacity', 1.0);
        (0, _Layer.defineLayerProperty)(layer, 'sequence', 0);
    } else if (layer.type == 'elevation') {
        (0, _Layer.defineLayerProperty)(layer, 'frozen', false);
    } else if (layer.type == 'geometry' || layer.type == 'debug') {
        (0, _Layer.defineLayerProperty)(layer, 'visible', true, function () {
            return _syncGeometryLayerVisibility(layer, view);
        });
        _syncGeometryLayerVisibility(layer, view);

        var changeOpacity = function (o) {
            if (o.material) {
                // != undefined: we want the test to pass if opacity is 0
                if (o.material.opacity != undefined) {
                    o.material.transparent = layer.opacity < 1.0;
                    o.material.opacity = layer.opacity;
                }
                if (o.material.uniforms && o.material.uniforms.opacity != undefined) {
                    o.material.transparent = layer.opacity < 1.0;
                    o.material.uniforms.opacity.value = layer.opacity;
                }
            }
        };
        (0, _Layer.defineLayerProperty)(layer, 'opacity', 1.0, function () {
            if (layer.object3d) {
                layer.object3d.traverse(function (o) {
                    if (o.layer !== layer.id) {
                        return;
                    }
                    changeOpacity(o);
                    // 3dtiles layers store scenes in children's content property
                    if (o.content) {
                        o.content.traverse(changeOpacity);
                    }
                });
            }
        });
    }
    return layer;
}

/**
 * Options to wms protocol
 * @typedef {Object} OptionsWms
 * @property {Attribution} attribution The intellectual property rights for the layer
 * @property {Object} extent Geographic extent of the service
 * @property {string} name
 * @property {string} mimetype
 */

/**
 * Options to wtms protocol
 * @typedef {Object} OptionsWmts
 * @property {Attribution} attribution The intellectual property rights for the layer
 * @property {string} attribution.name The name of the owner of the data
 * @property {string} attribution.url The website of the owner of the data
 * @property {string} name
 * @property {string} mimetype
 * @property {string} tileMatrixSet
 * @property {Array.<Object>} tileMatrixSetLimits The limits for the tile matrix set
 * @property {number} tileMatrixSetLimits.minTileRow Minimum row for tiles at the level
 * @property {number} tileMatrixSetLimits.maxTileRow Maximum row for tiles at the level
 * @property {number} tileMatrixSetLimits.minTileCol Minimum col for tiles at the level
 * @property {number} tileMatrixSetLimits.maxTileCol Maximum col for tiles at the level
 * @property {Object} [zoom]
 * @property {Object} [zoom.min] layer's zoom minimum
 * @property {Object} [zoom.max] layer's zoom maximum
 */

/**
 * @typedef {Object} NetworkOptions - Options for fetching resources over the
 * network. For json or xml fetching, this object is passed as it is to fetch
 * as the init object, see [fetch documentation]{@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters}.
 * @property {string} crossOrigin For textures, only this property is used. Its
 * value is directly assigned to the crossorigin property of html tags.
 * @property * Same properties as the init parameter of fetch
 */

/**
 * @typedef {Object} LayerOptions
 * @property {string} id Unique layer's id
 * @property {string} type the layer's type : 'color', 'elevation', 'geometry'
 * @property {string} protocol wmts and wms (wmtsc for custom deprecated)
 * @property {string} url Base URL of the repository or of the file(s) to load
 * @property {NetworkOptions} networkOptions Options for fetching resources over network
 * @property {Object} updateStrategy strategy to load imagery files
 * @property {OptionsWmts|OptionsWms} options WMTS or WMS options
 */

/**
 * Add layer in viewer.
 * The layer id must be unique.
 *
 * This function calls `preprocessDataLayer` of the relevant provider with this
 * layer and set `layer.whenReady` to a promise that resolves when
 * the preprocessing operation is done. This promise is also returned by
 * `addLayer` allowing to chain call.
 *
 * @example
 * // Add Color Layer
 * view.addLayer({
 *      type: 'elevation',
 *      id: 'iElevation',
 * });
 *
 * // Example to add an OPENSM Layer
 * view.addLayer({
 *   type: 'color',
 *   protocol:   'wmtsc',
 *   id:         'OPENSM',
 *   fx: 2.5,
 *   customUrl:  'http://b.tile.openstreetmap.fr/osmfr/%TILEMATRIX/%COL/%ROW.png',
 *   options: {
 *       attribution : {
 *           name: 'OpenStreetMap',
 *           url: 'http://www.openstreetmap.org/',
 *       },
 *       tileMatrixSet: 'PM',
 *       mimetype: 'image/png',
 *    },
 * });
 *
 * // Add Elevation Layer and do something once it's ready
 * var layer = view.addLayer({
 *      type: 'elevation',
 *      id: 'iElevation',
 * }).then(() => { .... });
 *
 * // One can also attach a callback to the same promise with a layer instance.
 * layer.whenReady.then(() => { ... });
 *
 * @param {LayerOptions|Layer|GeometryLayer} layer
 * @param {Layer=} parentLayer
 * @return {Promise} a promise resolved with the new layer object when it is fully initialized
 */
View.prototype.addLayer = function (layer, parentLayer) {
    var duplicate = this.getLayers(function (l) {
        return l.id == layer.id;
    });
    if (duplicate.length > 0) {
        throw new Error('Invalid id \'' + layer.id + '\': id already used');
    }

    if (parentLayer && !layer.extent) {
        layer.extent = parentLayer.extent;
    }

    var provider = this.mainLoop.scheduler.getProtocolProvider(layer.protocol);
    if (layer.protocol && !provider) {
        throw new Error(layer.protocol + ' is not a recognized protocol name.');
    }
    layer = _preprocessLayer(this, layer, provider);
    if (parentLayer) {
        parentLayer.attach(layer);
    } else {
        if (typeof layer.update !== 'function') {
            throw new Error('Cant add GeometryLayer: missing a update function');
        }
        if (typeof layer.preUpdate !== 'function') {
            throw new Error('Cant add GeometryLayer: missing a preUpdate function');
        }

        this._layers.push(layer);
    }

    if (layer.object3d && !layer.object3d.parent && layer.object3d !== this.scene) {
        this.scene.add(layer.object3d);
    }

    this.notifyChange(true);
    return layer.whenReady;
};

/**
 * Notifies the scene it needs to be updated due to changes exterior to the
 * scene itself (e.g. camera movement).
 * non-interactive events (e.g: texture loaded)
 * @param {boolean} needsRedraw - indicates if notified change requires a full scene redraw.
 * @param {*} changeSource
 */
View.prototype.notifyChange = function (needsRedraw, changeSource) {
    this._changeSources.add(changeSource);
    this.mainLoop.scheduleViewUpdate(this, needsRedraw);
};

/**
 * Get all layers, with an optionnal filter applied.
 * The filter method will be called with 2 args:
 *   - 1st: current layer
 *   - 2nd: (optional) the geometry layer to which the current layer is attached
 * @example
 * // get all layers
 * view.getLayers();
 * // get all color layers
 * view.getLayers(layer => layer.type === 'color');
 * // get all elevation layers
 * view.getLayers(layer => layer.type === 'elevation');
 * // get all geometry layers
 * view.getLayers(layer => layer.type === 'geometry');
 * // get one layer with id
 * view.getLayers(layer => layer.id === 'itt');
 * @param {function(Layer):boolean} filter
 * @returns {Array<Layer>}
 */
View.prototype.getLayers = function (filter) {
    var result = [];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(this._layers), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var geometryLayer = _step.value;

            if (!filter || filter(geometryLayer)) {
                result.push(geometryLayer);
            }
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = (0, _getIterator3.default)(geometryLayer._attachedLayers), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var attached = _step2.value;

                    if (!filter || filter(attached, geometryLayer)) {
                        result.push(attached);
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

    return result;
};

/**
 * @name FrameRequester
 * @function
 *
 * @description
 * Method that will be called each time the <code>MainLoop</code> updates. This
 * function will be given as parameter the delta (in ms) between this update and
 * the previous one, and whether or not we just started to render again. This
 * update is considered as the "next" update if <code>view.notifyChange</code>
 * was called during a precedent update. If <code>view.notifyChange</code> has
 * been called by something else (other micro/macrotask, UI events etc...), then
 * this update is considered as being the "first". It can also receive optional
 * arguments, depending on the attach point of this function.  Currently only
 * <code>BEFORE_LAYER_UPDATE / AFTER_LAYER_UPDATE</code> attach points provide
 * an additional argument: the layer being updated.
 * <br><br>
 *
 * This means that if a <code>frameRequester</code> function wants to animate something, it
 * should keep on calling <code>view.notifyChange</code> until its task is done.
 * <br><br>
 *
 * Implementors of <code>frameRequester</code> should keep in mind that this
 * function will be potentially called at each frame, thus care should be given
 * about performance.
 * <br><br>
 *
 * Typical frameRequesters are controls, module wanting to animate moves or UI
 * elements etc... Basically anything that would want to call
 * requestAnimationFrame.
 *
 * @param {number} dt
 * @param {boolean} updateLoopRestarted
 * @param {...*} args
 */
/**
 * Add a frame requester to this view.
 *
 * FrameRequesters can activate the MainLoop update by calling view.notifyChange.
 *
 * @param {String} when - decide when the frameRequester should be called during
 * the update cycle. Can be any of {@link MAIN_LOOP_EVENTS}.
 * @param {FrameRequester} frameRequester - this function will be called at each
 * MainLoop update with the time delta between last update, or 0 if the MainLoop
 * has just been relaunched.
 */
View.prototype.addFrameRequester = function (when, frameRequester) {
    if (typeof frameRequester !== 'function') {
        throw new Error('frameRequester must be a function');
    }

    if (!this._frameRequesters[when]) {
        this._frameRequesters[when] = [frameRequester];
    } else {
        this._frameRequesters[when].push(frameRequester);
    }
};

/**
 * Remove a frameRequester.
 *
 * @param {String} when - attach point of this requester. Can be any of
 * {@link MAIN_LOOP_EVENTS}.
 * @param {FrameRequester} frameRequester
 */
View.prototype.removeFrameRequester = function (when, frameRequester) {
    this._frameRequesters[when].splice(this._frameRequesters[when].indexOf(frameRequester), 1);
};

/**
 * Execute a frameRequester.
 *
 * @param {String} when - attach point of this (these) requester(s). Can be any
 * of {@link MAIN_LOOP_EVENTS}.
 * @param {Number} dt - delta between this update and the previous one
 * @param {boolean} updateLoopRestarted
 * @param {...*} args - optional arguments
 */
View.prototype.execFrameRequesters = function (when, dt, updateLoopRestarted) {
    if (!this._frameRequesters[when]) {
        return;
    }

    for (var _len = arguments.length, args = Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++) {
        args[_key - 3] = arguments[_key];
    }

    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = (0, _getIterator3.default)(this._frameRequesters[when]), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var frameRequester = _step3.value;

            if (frameRequester.update) {
                frameRequester.update(dt, updateLoopRestarted, args);
            } else {
                frameRequester(dt, updateLoopRestarted, args);
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
};

exports.default = View;