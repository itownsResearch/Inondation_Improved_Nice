'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _jsPriorityQueue = require('js-priority-queue');

var _jsPriorityQueue2 = _interopRequireDefault(_jsPriorityQueue);

var _WMTS_Provider = require('./Providers/WMTS_Provider');

var _WMTS_Provider2 = _interopRequireDefault(_WMTS_Provider);

var _WMS_Provider = require('./Providers/WMS_Provider');

var _WMS_Provider2 = _interopRequireDefault(_WMS_Provider);

var _TileProvider = require('./Providers/TileProvider');

var _TileProvider2 = _interopRequireDefault(_TileProvider);

var _dTiles_Provider = require('./Providers/3dTiles_Provider');

var _dTiles_Provider2 = _interopRequireDefault(_dTiles_Provider);

var _TMS_Provider = require('./Providers/TMS_Provider');

var _TMS_Provider2 = _interopRequireDefault(_TMS_Provider);

var _PointCloudProvider = require('./Providers/PointCloudProvider');

var _PointCloudProvider2 = _interopRequireDefault(_PointCloudProvider);

var _WFS_Provider = require('./Providers/WFS_Provider');

var _WFS_Provider2 = _interopRequireDefault(_WFS_Provider);

var _Raster_Provider = require('./Providers/Raster_Provider');

var _Raster_Provider2 = _interopRequireDefault(_Raster_Provider);

var _StaticProvider = require('./Providers/StaticProvider');

var _StaticProvider2 = _interopRequireDefault(_StaticProvider);

var _CancelledCommandException = require('./CancelledCommandException');

var _CancelledCommandException2 = _interopRequireDefault(_CancelledCommandException);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var instanceScheduler = null; /**
                               * Generated On: 2015-10-5
                               * Class: Scheduler
                               * Description: Cette classe singleton gère les requetes/Commandes  de la scène. Ces commandes peuvent etre synchrone ou asynchrone. Elle permet d'executer, de prioriser  et d'annuler les commandes de la pile. Les commandes executées sont placées dans une autre file d'attente.
                               */

function _instanciateQueue() {
    return {
        storage: new _jsPriorityQueue2.default({
            comparator: function comparator(a, b) {
                var cmp = b.priority - a.priority;
                // Prioritize recent commands
                if (cmp === 0) {
                    return b.timestamp - a.timestamp;
                }
                return cmp;
            }
        }),
        counters: {
            // commands in progress
            executing: 0,
            // commands successfully executed
            executed: 0,
            // commands failed
            failed: 0,
            // commands cancelled
            cancelled: 0
        },
        execute: function execute(cmd, provider, executingCounterUpToDate) {
            var _this = this;

            if (!executingCounterUpToDate) {
                this.counters.executing++;
            }

            // If the provider returns a Promise, use it to handle counters
            // Otherwise use a resolved Promise.
            var p = provider.executeCommand(cmd) || _promise2.default.resolve();

            return p.then(function (result) {
                _this.counters.executing--;
                cmd.resolve(result);
                // only count successul commands
                _this.counters.executed++;
            }, function (err) {
                _this.counters.executing--;
                cmd.reject(err);
                _this.counters.failed++;
            });
        }
    };
}

function Scheduler() {

    this.defaultQueue = _instanciateQueue();
    this.hostQueues = new _map2.default();

    this.providers = {};

    this.maxConcurrentCommands = 16;
    this.maxCommandsPerHost = 6;

    // TODO: add an options to not instanciate default providers
    this.initDefaultProviders();
}

Scheduler.prototype.constructor = Scheduler;

Scheduler.prototype.initDefaultProviders = function () {
    // Register all providers
    var wmtsProvider = new _WMTS_Provider2.default();
    this.addProtocolProvider('wmts', wmtsProvider);
    this.addProtocolProvider('wmtsc', wmtsProvider);
    this.addProtocolProvider('tile', new _TileProvider2.default());
    this.addProtocolProvider('wms', new _WMS_Provider2.default());
    this.addProtocolProvider('3d-tiles', new _dTiles_Provider2.default());
    this.addProtocolProvider('tms', new _TMS_Provider2.default());
    this.addProtocolProvider('potreeconverter', _PointCloudProvider2.default);
    this.addProtocolProvider('wfs', new _WFS_Provider2.default());
    this.addProtocolProvider('rasterizer', _Raster_Provider2.default);
    this.addProtocolProvider('static', _StaticProvider2.default);
};

Scheduler.prototype.runCommand = function (command, queue, executingCounterUpToDate) {
    var _this2 = this;

    var provider = this.providers[command.layer.protocol];

    if (!provider) {
        throw new Error('No known provider for layer', command.layer.id);
    }

    queue.execute(command, provider, executingCounterUpToDate).then(function () {
        // notify view that one command ended.
        command.view.notifyChange('redraw' in command ? command.redraw : true, command.requester);

        // try to execute next command
        if (queue.counters.executing < _this2.maxCommandsPerHost) {
            var cmd = _this2.deQueue(queue);
            if (cmd) {
                return _this2.runCommand(cmd, queue);
            }
        }
    });
};

Scheduler.prototype.execute = function (command) {
    // TODO: check for mandatory commands fields


    // parse host
    var layer = command.layer;
    var host = layer.url ? new URL(layer.url, document.location).host : undefined;

    command.promise = new _promise2.default(function (resolve, reject) {
        command.resolve = resolve;
        command.reject = reject;
    });

    // init queue if needed
    if (host && !this.hostQueues.has(host)) {
        this.hostQueues.set(host, _instanciateQueue());
    }

    var q = host ? this.hostQueues.get(host) : this.defaultQueue;

    // execute command now if possible
    if (q.counters.executing < this.maxCommandsPerHost) {
        // increment before
        q.counters.executing++;

        var runNow = function () {
            this.runCommand(command, q, true);
        }.bind(this);

        // We use a setTimeout to defer processing but we avoid the
        // queue mechanism (why setTimeout and not Promise? see tasks vs microtasks priorities)
        window.setTimeout(runNow, 0);
    } else {
        command.timestamp = Date.now();
        q.storage.queue(command);
    }

    return command.promise;
};

Scheduler.prototype.addProtocolProvider = function (protocol, provider) {
    this.providers[protocol] = provider;
};

Scheduler.prototype.getProtocolProvider = function (protocol) {
    return this.providers[protocol];
};

Scheduler.prototype.commandsWaitingExecutionCount = function () {
    var sum = this.defaultQueue.storage.length + this.defaultQueue.counters.executing;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(this.hostQueues), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var q = _step.value;

            sum += q[1].storage.length + q[1].counters.executing;
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

    return sum;
};

Scheduler.prototype.commandsRunningCount = function () {
    var sum = this.defaultQueue.counters.executing;

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = (0, _getIterator3.default)(this.hostQueues), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var q = _step2.value;

            sum += q[1].counters.executing;
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

    return sum;
};

Scheduler.prototype.resetCommandsCount = function (type) {
    var sum = this.defaultQueue.counters[type];
    this.defaultQueue.counters[type] = 0;
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = (0, _getIterator3.default)(this.hostQueues), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var q = _step3.value;

            sum += q[1].counters[type];
            q[1].counters[type] = 0;
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

    return sum;
};

Scheduler.prototype.getProviders = function () {
    return this.providers.slice();
};

Scheduler.prototype.deQueue = function (queue) {
    var st = queue.storage;
    while (st.length > 0) {
        var cmd = st.dequeue();

        if (cmd.earlyDropFunction && cmd.earlyDropFunction(cmd)) {
            queue.counters.cancelled++;
            cmd.reject(new _CancelledCommandException2.default(cmd));
        } else {
            return cmd;
        }
    }

    return undefined;
};

exports.default = Scheduler;