const _ = require('lodash');

class AuthenticationError extends Error {
    constructor (msg) {
        super(msg);
        Error.captureStackTrace(this, AuthenticationError);
        this.name = 'AuthenticationError';
        this.code = 'AUTHENTICATION_ERROR';
    }
}

class AuthorizationError extends Error {
    constructor (msg) {
        super(msg);
        Error.captureStackTrace(this, AuthorizationError);
        this.name = 'AuthorizationError';
        this.code = 'AUTHORIZATION_ERROR';
    }
}

class RBACError extends Error {
    constructor (msg) {
        super(msg);
        Error.captureStackTrace(this, RBACError);
        this.name = 'RBACError';
        this.code = 'RBAC_ERROR';
    }
}

// Return a list of items to an array
function toArray (arr, ...args) {
    if (Array.isArray(arr) && args.length === 0) {
        return arr;
    } else {
        return Array.prototype.concat.call([], arr, ...args);
    }
}

// Return a flat array
function toArrayFlat (...args) {
    return toArray(...args).flat(Infinity);
}

// Return a flat array with null and undefined removed
function toArrayFlatCompact (...args) {
    return toArrayFlat(...args).filter(val => !_.isNil(val));
}

// Alias for toArrayFlat
function flat (...args) {
    return toArrayFlat(...args);
}

// Alias for toArrayFlatCompact
function flatCompact (...args) {
    return toArrayFlatCompact(...args);
}

// Run an iterator fn on each item in arr
function each (arr, fn) {
    if (Array.isArray(arr) || arr instanceof Map || arr instanceof Set) {
        arr.forEach(fn);
    } else {
        fn(arr, 0);
    }
}

// Run an iterator fn on each item in arr, ignores null and undefined
function eachNotNil (arr, fn) {
    each(arr, (val, key) => {
        if (!_.isNil(val)) {
            fn(val, key);
        }
    });
}

// Return an array of values from an iterator fn
function map (arr, fn) {
    let res = [];
    each(arr, (val, key) => {
        res.push(fn(val, key));
    });
    return res;
}

// Return an array of values from an iterator fn, ignores null and undefined
function mapNotNil (arr, fn) {
    let res = [];
    eachNotNil(arr, (val, key) => {
        let ret = fn(val, key);
        if (!_.isNil(ret)) {
            res.push(ret);
        }
    });
    return res;
}

function mapFlat (arr, fn) {
    return flat(map(arr, fn));
}

function mapFlatCompact (arr, fn) {
    return flatCompact(map(arr, fn));
}

function mapNotNilFlat (arr, fn) {
    return flat(mapNotNil(arr, fn));
}

function mapNotNilFlatCompact (arr, fn) {
    return flatCompact(mapNotNil(arr, fn));
}

// Returns true if any element from iterator is truthy
function some (arr, fn) {
    if (Array.isArray(arr) || arr instanceof Map || arr instanceof Set) {
        for (let [key, val] of arr.entries()) {
            if (fn(val, key)) {
                return true;
            }
        }
        return false;
    } else {
        if (fn(arr, 0)) {
            return true;
        }
        return false;
    }
}

// Returns true if any element from iterator is truthy, ignores null and undefined
function someNotNil (arr, fn) {
    return some(arr, (val, key) => {
        if (!_.isNil(val)) {
            return fn(val, key);
        }
        return false;
    });
}

function defaults (...args) {

    let accumulator = {};

    function iterate (res, obj, def) {
        _.forOwn(obj, (val, key) => {
            if (_.has(def, key)) {
                if (_.isPlainObject(def[key])) {
                    res[key] = iterate(_.toPlainObject(res[key]), val, def[key]);
                } else {
                    if (res[key] === undefined) {
                        res[key] = val;
                    }
                }
            }
        });
        return res;
    }

    args.map(obj => {
        iterate(accumulator, obj, args.at(-1));
    });

    return accumulator;

}

exports.AuthenticationError = AuthenticationError;
exports.AuthorizationError = AuthorizationError;
exports.RBACError = RBACError;
exports.toArray = toArray;
exports.toArrayFlat = toArrayFlat;
exports.toArrayFlatCompact = toArrayFlatCompact;
exports.flat = flat;
exports.flatCompact = flatCompact;
exports.each = each;
exports.eachNotNil = eachNotNil;
exports.map = map;
exports.mapNotNil = mapNotNil;
exports.mapFlat = mapFlat;
exports.mapFlatCompact = mapFlatCompact;
exports.mapNotNilFlat = mapNotNilFlat;
exports.mapNotNilFlatCompact = mapNotNilFlatCompact;
exports.some = some;
exports.someNotNil = someNotNil;
exports.defaults = defaults;
