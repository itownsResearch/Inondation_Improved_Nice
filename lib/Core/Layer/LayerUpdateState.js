"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var UPDATE_STATE = {
    IDLE: 0,
    PENDING: 1,
    ERROR: 2,
    DEFINITIVE_ERROR: 3,
    FINISHED: 4
};
var PAUSE_BETWEEN_ERRORS = [1.0, 3.0, 7.0, 60.0];

/**
 * LayerUpdateState is the update state of a layer, for a given object (e.g tile).
 * It stores information to allow smart update decisions, and especially network
 * error handling.
 * @constructor
 */
function LayerUpdateState() {
    this.state = UPDATE_STATE.IDLE;
    this.lastErrorTimestamp = 0;
    this.errorCount = 0;
}

LayerUpdateState.prototype.canTryUpdate = function (timestamp) {
    switch (this.state) {
        case UPDATE_STATE.IDLE:
            {
                return true;
            }
        case UPDATE_STATE.DEFINITIVE_ERROR:
        case UPDATE_STATE.PENDING:
        case UPDATE_STATE.FINISHED:
            {
                return false;
            }
        case UPDATE_STATE.ERROR:
        default:
            {
                var errorDuration = this.secondsUntilNextTry() * 1000;
                return errorDuration <= timestamp - this.lastErrorTimestamp;
            }
    }
};

LayerUpdateState.prototype.secondsUntilNextTry = function () {
    if (this.state !== UPDATE_STATE.ERROR) {
        return 0;
    }
    var idx = Math.max(0, Math.min(this.errorCount, PAUSE_BETWEEN_ERRORS.length) - 1);

    return PAUSE_BETWEEN_ERRORS[idx];
};

LayerUpdateState.prototype.newTry = function () {
    this.state = UPDATE_STATE.PENDING;
};

LayerUpdateState.prototype.success = function () {
    this.lastErrorTimestamp = 0;
    this.state = UPDATE_STATE.IDLE;
};

LayerUpdateState.prototype.noMoreUpdatePossible = function () {
    this.state = UPDATE_STATE.FINISHED;
};

LayerUpdateState.prototype.failure = function (timestamp, definitive) {
    this.lastErrorTimestamp = timestamp;
    this.state = definitive ? UPDATE_STATE.DEFINITIVE_ERROR : UPDATE_STATE.ERROR;
    this.errorCount++;
};

LayerUpdateState.prototype.inError = function () {
    return this.state == UPDATE_STATE.DEFINITIVE_ERROR || this.state == UPDATE_STATE.ERROR;
};

exports.default = LayerUpdateState;