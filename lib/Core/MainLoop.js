'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MAIN_LOOP_EVENTS = exports.RENDERING_SCHEDULED = exports.RENDERING_PAUSED = undefined;

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _three = require('three');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RENDERING_PAUSED = exports.RENDERING_PAUSED = 0;
var RENDERING_SCHEDULED = exports.RENDERING_SCHEDULED = 1;

/**
 * MainLoop's update events list that are fired using
 * {@link View#execFrameRequesters}.
 *
 * @property UPDATE_START {string} fired at the start of the update
 * @property BEFORE_CAMERA_UPDATE {string} fired before the camera update
 * @property AFTER_CAMERA_UPDATE {string} fired after the camera update
 * @property BEFORE_LAYER_UPDATE {string} fired before the layer update
 * @property AFTER_LAYER_UPDATE {string} fired after the layer update
 * @property BEFORE_RENDER {string} fired before the render
 * @property AFTER_RENDER {string} fired after the render
 * @property UPDATE_END {string} fired at the end of the update
 */

var MAIN_LOOP_EVENTS = exports.MAIN_LOOP_EVENTS = {
    UPDATE_START: 'update_start',
    BEFORE_CAMERA_UPDATE: 'before_camera_update',
    AFTER_CAMERA_UPDATE: 'after_camera_update',
    BEFORE_LAYER_UPDATE: 'before_camera_update',
    AFTER_LAYER_UPDATE: 'after_layer_update',
    BEFORE_RENDER: 'before_render',
    AFTER_RENDER: 'after_render',
    UPDATE_END: 'update_end'
};

function MainLoop(scheduler, engine) {
    this.renderingState = RENDERING_PAUSED;
    this.needsRedraw = false;
    this.scheduler = scheduler;
    this.gfxEngine = engine; // TODO: remove me
    this._updateLoopRestarted = true;
}

MainLoop.prototype = (0, _create2.default)(_three.EventDispatcher.prototype);
MainLoop.prototype.constructor = MainLoop;

MainLoop.prototype.scheduleViewUpdate = function (view, forceRedraw) {
    var _this = this;

    this.needsRedraw |= forceRedraw;

    if (this.renderingState !== RENDERING_SCHEDULED) {
        this.renderingState = RENDERING_SCHEDULED;

        requestAnimationFrame(function (timestamp) {
            _this._step(view, timestamp);
        });
    }
};

function updateElements(context, geometryLayer, elements) {
    if (!elements) {
        return;
    }
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(elements), _step2; !(_iteratorNormalCompletion = (_step2 = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var element = _step2.value;

            // update element
            // TODO find a way to notify attachedLayers when geometryLayer deletes some elements
            // and then update Debug.js:addGeometryLayerDebugFeatures
            var newElementsToUpdate = geometryLayer.update(context, geometryLayer, element);

            // update attached layers
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = (0, _getIterator3.default)(geometryLayer._attachedLayers), _step3; !(_iteratorNormalCompletion2 = (_step3 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var attachedLayer = _step3.value;

                    if (attachedLayer.ready) {
                        attachedLayer.update(context, attachedLayer, element);
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

            updateElements(context, geometryLayer, newElementsToUpdate);
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

MainLoop.prototype._update = function (view, updateSources, dt) {
    var context = {
        camera: view.camera,
        engine: this.gfxEngine,
        scheduler: this.scheduler,
        view: view
    };

    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = (0, _getIterator3.default)(view.getLayers(function (x, y) {
            return !y;
        })), _step4; !(_iteratorNormalCompletion3 = (_step4 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var geometryLayer = _step4.value;

            context.geometryLayer = geometryLayer;
            if (geometryLayer.ready && geometryLayer.visible) {
                view.execFrameRequesters(MAIN_LOOP_EVENTS.BEFORE_LAYER_UPDATE, dt, this._updateLoopRestarted, geometryLayer);

                // `preUpdate` returns an array of elements to update
                var elementsToUpdate = geometryLayer.preUpdate(context, geometryLayer, updateSources);
                // `update` is called in `updateElements`.
                updateElements(context, geometryLayer, elementsToUpdate);
                // `postUpdate` is called when this geom layer update process is finished
                geometryLayer.postUpdate(context, geometryLayer, updateSources);

                view.execFrameRequesters(MAIN_LOOP_EVENTS.AFTER_LAYER_UPDATE, dt, this._updateLoopRestarted, geometryLayer);
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

MainLoop.prototype._step = function (view, timestamp) {
    view.execFrameRequesters(MAIN_LOOP_EVENTS.UPDATE_START, dt, this._updateLoopRestarted);

    var willRedraw = this.needsRedraw;
    var dt = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // Reset internal state before calling _update (so future calls to View.notifyChange()
    // can properly change it)
    this.needsRedraw = false;
    this.renderingState = RENDERING_PAUSED;
    var updateSources = new _set2.default(view._changeSources);
    view._changeSources.clear();

    // update camera
    var dim = this.gfxEngine.getWindowSize();

    view.execFrameRequesters(MAIN_LOOP_EVENTS.BEFORE_CAMERA_UPDATE, dt, this._updateLoopRestarted);
    view.camera.update(dim.x, dim.y);
    view.execFrameRequesters(MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, dt, this._updateLoopRestarted);

    // Disable camera's matrix auto update to make sure the camera's
    // world matrix is never updated mid-update.
    // Otherwise inconsistencies can appear because object visibility
    // testing and object drawing could be performed using different
    // camera matrixWorld.
    // Note: this is required at least because WEBGLRenderer calls
    // camera.updateMatrixWorld()
    var oldAutoUpdate = view.camera.camera3D.matrixAutoUpdate;
    view.camera.camera3D.matrixAutoUpdate = false;

    // update data-structure
    this._update(view, updateSources, dt);

    if (this.scheduler.commandsWaitingExecutionCount() == 0) {
        this.dispatchEvent({ type: 'command-queue-empty' });
    }

    // Redraw *only* if needed.
    // (redraws only happen when this.needsRedraw is true, which in turn only happens when
    // view.notifyChange() is called with redraw=true)
    // As such there's no continuous update-loop, instead we use a ad-hoc update/render
    // mechanism.
    if (willRedraw) {
        this._renderView(view, dt);
    }

    // next time, we'll consider that we've just started the loop if we are still PAUSED now
    this._updateLoopRestarted = this.renderingState === RENDERING_PAUSED;

    view.camera.camera3D.matrixAutoUpdate = oldAutoUpdate;

    view.execFrameRequesters(MAIN_LOOP_EVENTS.UPDATE_END, dt, this._updateLoopRestarted);
};

MainLoop.prototype._renderView = function (view, dt) {
    view.execFrameRequesters(MAIN_LOOP_EVENTS.BEFORE_RENDER, dt, this._updateLoopRestarted);

    if (view.render) {
        view.render();
    } else {
        // use default rendering method
        this.gfxEngine.renderView(view);
    }

    view.execFrameRequesters(MAIN_LOOP_EVENTS.AFTER_RENDER, dt, this._updateLoopRestarted);
};

exports.default = MainLoop;