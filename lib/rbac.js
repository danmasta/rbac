const _ = require('lodash');

const defaults = {
    rbac: {
        claims: 'user',
        authorizeAgainst: undefined
    },
    role: {
        id: undefined,
        description: undefined,
        permissions: undefined,
        inherit: undefined,
        claims: undefined
    },
    isAuthenticated: {
        redirect: false
    },
    isAuthorized: {
        redirect: false,
        permissions: undefined,
        claims: undefined
    },
    isRole: {
        redirect: false,
        roles: undefined
    }
};

class AuthorizationError extends Error {

    constructor (msg) {
        super(msg);
        Error.captureStackTrace(this, AuthorizationError);
        this.name = 'AuthorizationError';
        this.code = 403;
    }

}

class AuthenticationError extends Error {

    constructor (msg) {
        super(msg);
        Error.captureStackTrace(this, AuthenticationError);
        this.name = 'AuthenticationError';
        this.code = 401;
    }

}

class RBAC {

    constructor (roles, opts) {

        this._opts = opts = _.defaults(opts, defaults.rbac);

        this._claims = {};
        this._roles = {};

        this._addRoles(roles);

    }

    // this method can be costly if called too many times
    // because each time a role is added or changed the permissions tree
    // and claim cache need to be regenerated for all roles
    _addRoles (roles) {

        // set up role mapping
        _.each(_.concat(roles), role => {
            this._roles[role.id] = _.defaults({}, role, defaults.role);
        });

        // cache role permissions
        _.each(this._roles, role => {
            role.claims = this._resolveClaims(role);
            role.permissions = this._resolvePermissions(role);
        });

        // cache claim permission sets
        _.each(this._roles, role => {

            if (_.isPlainObject(role.claims)) {

                _.each(role.claims, (claims, key) => {

                    this._claims[key] = this._claims[key] || {};

                    _.each(claims, (claim, id) => {

                        this._claims[key][id] = this._claims[key][id] || {};
                        _.assign(this._claims[key][id], role.permissions);

                    });

                });

            }

        });

    }

    // normalize claims format so we can reverse lookup roles
    _resolveClaims (role) {

        let res = {};

        if (role.claims && _.isPlainObject(role.claims)) {

            _.each(role.claims, (claims, key) => {

                res[key] = res[key] || {};

                if (_.isPlainObject(claims)) {

                    _.each(claims, (claim, index) => {
                        if (claim) {
                            res[key][index] = true;
                        } else {
                            res[key][index] = false;
                        }
                    });

                } else if (_.isArray(claims)) {

                    _.each(claims, claim => {
                        res[key][claim] = true;
                    });

                } else {

                    if (claims) {
                        res[key][claims] = true;
                    } else {
                        res[key][claims] = false;
                    }

                }

            });

        }

        return res;

    }

    // recursively resolve inherited permission sets
    _resolvePermissions (role) {

        let res = {};

        if (role.permissions) {

            _.each(role.permissions, (val, key) => {
                if (_.isString(val)) {
                    res[val] = true;
                } else {
                    res[key] = Boolean(val);
                }
            });

        }

        if (role.inherit) {
            _.each(_.concat(role.inherit), id => {
                if (this._roles[id]) {
                    _.assign(res, this._resolvePermissions(this._roles[id]));
                }
            });
        }

        return res;

    }

    _verifyPermissions (claims, permissions, authorizeAgainst) {

        if (!claims) {
            throw new AuthorizationError('Not Authorized - No Claims Provided');
        }

        if (!permissions) {
            throw new AuthorizationError('Not Authorized - No Permissions Provided');
        }

        let keys = authorizeAgainst || this._opts.authorizeAgainst || _.keys(claims);
        let found = false;

        found = _.every(_.concat(permissions), permission => {
            return _.some(_.concat(keys), key => {
                return _.some(_.concat(claims[key]), val => {
                    return this._claims[key] && this._claims[key][val] && this._claims[key][val][permission];
                });
            });
        });

        if (found) {
            return claims;
        } else {
            throw new AuthorizationError(`Not Authorized - Missing one of Required Permissions: ${permissions}`);
        }

    }

    verifyPermissions (claims, permissions, authorizeAgainst) {

        return new Promise((resolve, reject) => {

            try {
                resolve(this._verifyPermissions(claims, permissions, authorizeAgainst));
            } catch (err) {
                reject(err);
            }

        });

    }

    _verifyRoles (claims, roles) {

        if (!claims) {
            throw new AuthorizationError('Not Authorized - No Claims Provided');
        }

        if (!roles) {
            throw new AuthorizationError('Not Authorized - No Roles Provided');
        }

        let found = false;

        found = _.some(_.concat(roles), role => {
            return _.some(this._roles[role].claims, (claim, key) => {
                return _.some(_.concat(claims[key]), val => {
                    return claim[val];
                });
            });
        });

        if (found) {
            return claims;
        } else {
            throw new AuthorizationError(`Not Authorized - Missing one of Required Roles: ${roles}`);
        }

    }

    verifyRoles (claims, roles) {

        return new Promise((resolve, reject) => {

            try {
                resolve(this._verifyRoles(claims, roles));
            } catch (err) {
                reject(err);
            }

        });

    }

    isAuthorized (permissions, opts) {

        let rbac = this;

        if (_.isPlainObject(permissions)) {
            [permissions, opts] = [opts, permissions];
        }

        opts = _.defaults(opts, { permissions }, defaults.isAuthorized);

        return function isAuthorized (req, res, next) {

            let claims = _.get(req, rbac._opts.claims);

            rbac.verifyPermissions(claims, opts.permissions, opts.claims).then(() => {

                next();

            }).catch(err => {

                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }

                next(err);

            });

        };

    }

    isAuthenticated (opts) {

        opts = _.defaults(opts, defaults.isAuthenticated);

        return function isAuthenticated (req, res, next) {

            if (_.isFunction(req.isAuthenticated) && req.isAuthenticated()) {

                next();

            } else {

                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }

                next(new AuthenticationError('Not Authenticated'));

            }

        };

    }

    isRole (roles, opts) {

        let rbac = this;

        if (_.isPlainObject(roles)) {
            [roles, opts] = [opts, roles];
        }

        opts = _.defaults(opts, { roles }, defaults.isRole);

        return function isRole (req, res, next) {

            let claims = _.get(req, rbac._opts.claims);

            rbac.verifyRoles(claims, opts.roles).then(() => {

                next();

            }).catch(err => {

                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }

                next(err);

            });

        };

    }

    // adds req and view helpers for express apps
    express () {

        let rbac = this;

        return function express (req, res, next) {

            let claims = _.get(req, rbac._opts.claims);

            // add request helpers
            req.isAuthorized = rbac.verifyPermissions.bind(rbac, claims);
            req.isRole = rbac.verifyRoles.bind(rbac, claims);

            // add view helper
            // returns a boolean vs throwing errors
            res.locals.isAuthorized = function isAuthorized (permissions, authorizeAgainst) {
                try {
                    rbac._verifyPermissions(claims, permissions, authorizeAgainst);
                    return true;
                } catch (err) {
                    return false;
                }
            };

            // add view helper
            // check authenticated state
            // note: the req.isAuthenticated function should
            // be included from your auth lib (passport, etc)
            res.locals.isAuthenticated = function isAuthenticated () {
                if (_.isFunction(req.isAuthenticated) && req.isAuthenticated()) {
                    return true;
                } else {
                    return false;
                }
            };

            // add view helper
            // returns a boolean vs throwing errors
            res.locals.isRole = function isRole (roles) {
                try {
                    rbac._verifyRoles(roles);
                    return true;
                } catch (err) {
                    return false;
                }
            };

            next();

        };

    }

    static factory () {
        let Fn = this;
        return function rbacFactory (...args) {
            return new Fn(...args);
        };
    }

}

module.exports = RBAC;
