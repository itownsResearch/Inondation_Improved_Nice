'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _MathExtended = require('../Math/MathExtended');

var _MathExtended2 = _interopRequireDefault(_MathExtended);

var _Coordinates = require('./Coordinates');

var _Extent = require('./Extent');

var _Extent2 = _interopRequireDefault(_Extent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Projection() {
    // Constructor

} /**
   * Generated On: 2015-10-5
   * Class: Projection
   * Description: Outils de projections cartographiques et de convertion
   */


Projection.prototype.WGS84ToY = function (latitude) {
    return 0.5 - Math.log(Math.tan(_MathExtended2.default.PI_OV_FOUR + latitude * 0.5)) * _MathExtended2.default.INV_TWO_PI;
};

Projection.prototype.YToWGS84 = function (y) {
    return 2 * (Math.atan(Math.exp(-(y - 0.5) / _MathExtended2.default.INV_TWO_PI)) - _MathExtended2.default.PI_OV_FOUR);
};

Projection.prototype.WGS84ToOneSubY = function (latitude) {
    // TODO remove me
    return 0.5 + Math.log(Math.tan(_MathExtended2.default.PI_OV_FOUR + latitude * 0.5)) * _MathExtended2.default.INV_TWO_PI;
};

Projection.prototype.WGS84LatitudeClamp = function (latitude) {
    // var min = -68.1389  / 180 * Math.PI;
    var min = -86 / 180 * Math.PI;
    var max = 84 / 180 * Math.PI;

    latitude = Math.max(min, latitude);
    latitude = Math.min(max, latitude);

    return latitude;
};

Projection.prototype.getCoordWMTS_WGS84 = function (tileCoord, bbox, tileMatrixSet) {
    // TODO: PM, WGS84G are hard-coded reference to IGN's TileMatrixSet
    if (tileMatrixSet === 'PM') {
        return this.WMTS_WGS84ToWMTS_PM(tileCoord, bbox);
    } else if (tileMatrixSet === 'WGS84G') {
        return [tileCoord];
    } else {
        throw new Error('Unsupported TileMatrixSet \'' + tileMatrixSet + '\'');
    }
};

Projection.prototype.getAllCoordsWMTS = function (tileCoord, bbox, tileMatrixSets) {
    var tilesMT = [];

    for (var key in tileMatrixSets) {
        if (Object.prototype.hasOwnProperty.call(tileMatrixSets, key)) {
            tilesMT[key] = this.getCoordsWMTS(tileCoord, bbox, key);
        }
    }

    return tilesMT;
};

Projection.prototype.getCoordsWMTS = function (tileCoord, bbox, tileMatrixSet) {
    var box = this.getCoordWMTS_WGS84(tileCoord, bbox, tileMatrixSet);
    var tilesMT = [];

    for (var row = box[0].row; row < box[1].row + 1; row++) {
        tilesMT.push(new _Extent2.default('WMTS:' + tileMatrixSet, box[0].zoom, row, box[0].col));
    }

    return tilesMT;
};

/**
 *
 * @param {type} cWMTS
 * @param {type} bbox
 * @returns {Array} coord WMTS array in pseudo mercator
 */
Projection.prototype.WMTS_WGS84ToWMTS_PM = function (cWMTS, bbox) {
    var wmtsBox = [];
    var level = cWMTS.zoom + 1;
    var nbRow = Math.pow(2, level);

    // var sY      = this.WGS84ToY(this.WGS84LatitudeClamp(-Math.PI*0.5)) - this.WGS84ToY(this.WGS84LatitudeClamp(Math.PI*0.5));
    var sizeRow = 1.0 / nbRow;

    var yMin = this.WGS84ToY(this.WGS84LatitudeClamp(bbox.north(_Coordinates.UNIT.RADIAN)));
    var yMax = this.WGS84ToY(this.WGS84LatitudeClamp(bbox.south(_Coordinates.UNIT.RADIAN)));

    var maxRow = void 0;

    var minRow = Math.floor(yMin / sizeRow);
    // ]N; N+1] => N
    maxRow = Math.ceil(yMax / sizeRow) - 1;
    // make sure we don't exceed boundaries
    maxRow = Math.min(maxRow, nbRow - 1);

    var minCol = cWMTS.col;


    for (var r = maxRow; r >= minRow; r--) {
        for (var c = minCol; c <= minCol; c++) {
            wmtsBox.push(new _Extent2.default('WMTS:PM', level, r, c));
        }
    }

    return wmtsBox;
};

Projection.prototype.WGS84toWMTS = function (bbox) {
    var dim = bbox.dimensions(_Coordinates.UNIT.RADIAN);

    var zoom = Math.floor(Math.log(_MathExtended2.default.PI / dim.y) / _MathExtended2.default.LOG_TWO + 0.5);

    var nY = Math.pow(2, zoom);


    var uX = _MathExtended2.default.TWO_PI / (2 * nY);
    var uY = _MathExtended2.default.PI / nY;

    var center = bbox.center();
    var col = Math.floor((_MathExtended2.default.PI + center.longitude(_Coordinates.UNIT.RADIAN)) / uX);
    var row = Math.floor(nY - (_MathExtended2.default.PI_OV_TWO + center.latitude(_Coordinates.UNIT.RADIAN)) / uY);

    return new _Extent2.default('WMTS:WGS84G', zoom, row, col);
};

Projection.prototype.UnitaryToLongitudeWGS84 = function (u, bbox) {
    var dim = bbox.dimensions(_Coordinates.UNIT.RADIAN);
    return bbox.west(_Coordinates.UNIT.RADIAN) + u * dim.x;
};

Projection.prototype.UnitaryToLatitudeWGS84 = function (v, bbox) {
    var dim = bbox.dimensions(_Coordinates.UNIT.RADIAN);
    return bbox.south(_Coordinates.UNIT.RADIAN) + v * dim.y;
};

Projection.prototype.wgs84_to_lambert93 = function (latitude, longitude) // , x93, y93)
{
    /*
    rfrences :
    Mthode de calcul pour une projection de type lambert conique conforme scante (
    NTG_71.pdf):
    http://www.ign.fr/affiche_rubrique.asp?rbr_id=1700&lng_id=FR
    */

    // variables:

    // systme WGS84
    var a = 6378137; // demi grand axe de l'ellipsoide (m)
    var e = 0.08181919106; // premire excentricit de l'ellipsoide


    var deg2rad = function () {};

    // paramtres de projections
    // var l0 =deg2rad(3);
    var lc = deg2rad(3); // longitude de rfrence
    var phi0 = deg2rad(46.5); // latitude d'origine en radian
    var phi1 = deg2rad(44); // 1er parallele automcoque
    var phi2 = deg2rad(49); // 2eme parallele automcoque

    // coordonnes l'origine
    // coordonnes l'origine

    // coordonnes du point traduire
    var phi = deg2rad(latitude);
    var l = deg2rad(longitude);

    // calcul des grandes normales
    var gN1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
    var gN2 = a / Math.sqrt(1 - e * e * Math.sin(phi2) * Math.sin(phi2));

    // calculs de slatitudes isomtriques
    var gl1 = Math.log(Math.tan(Math.PI / 4 + phi1 / 2) * Math.pow((1 - e * Math.sin(phi1)) / (1 + e * Math.sin(phi1)), e / 2));

    var gl2 = Math.log(Math.tan(Math.PI / 4 + phi2 / 2) * Math.pow((1 - e * Math.sin(phi2)) / (1 + e * Math.sin(phi2)), e / 2));

    var gl0 = Math.log(Math.tan(Math.PI / 4 + phi0 / 2) * Math.pow((1 - e * Math.sin(phi0)) / (1 + e * Math.sin(phi0)), e / 2));

    var gl = Math.log(Math.tan(Math.PI / 4 + phi / 2) * Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2));

    // calcul de l'exposant de la projection
    var n = Math.log(gN2 * Math.cos(phi2) / (gN1 * Math.cos(phi1))) / (gl1 - gl2); // ok

    // calcul de la constante de projection
    var c = gN1 * Math.cos(phi1) / n * Math.exp(n * gl1); // ok

    // calcul des coordonnes
    var ys = 6600000 + c * Math.exp(-1 * n * gl0);

    // calcul des coordonnes lambert
    var x93 = 700000 + c * Math.exp(-1 * n * gl) * Math.sin(n * (l - lc));
    var y93 = ys - c * Math.exp(-1 * n * gl) * Math.cos(n * (l - lc));

    return {
        x: x93,
        y: y93
    };
};

exports.default = Projection;