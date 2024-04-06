const _ = require('lodash');
const util = require('./util');
const Authorizer = require('./authorizer');

const defaults = {
    claims: 'user',
    roles: undefined,
    authorizeAgainst: undefined,
    strict: undefined
};

class RBAC {

    constructor (roles, opts) {

        if (_.isPlainObject(roles)) {
            [roles, opts] = [opts, roles];
        }

        this.opts = opts = util.defaults({ roles }, opts, defaults);
        this.authorizer = new Authorizer(opts);

    }

    authorizeByPermissions (claims, permissions, authorizeAgainst) {
        return new Promise((resolve, reject) => {
            try {
                resolve(this.authorizer.authorizeByPermissions(claims, permissions, authorizeAgainst));
            } catch (err) {
                reject(err);
            }
        });
    }

    authorizeByRoles (claims, roles, authorizeAgainst) {
        return new Promise((resolve, reject) => {
            try {
                resolve(this.authorizer.authorizeByRoles(claims, roles, authorizeAgainst));
            } catch (err) {
                reject(err);
            }
        });
    }

    // Returns middleware function to authorize request by permissions
    isAuthorized (permissions, opts) {

        let rbac = this;

        let defaults = {
            permissions: undefined,
            authorizeAgainst: undefined,
            redirect: false
        };

        if (_.isPlainObject(permissions)) {
            [permissions, opts] = [opts, permissions];
        }

        opts = util.defaults({ permissions }, opts, defaults);

        return function isAuthorized (req, res, next) {

            let claims = _.get(req, rbac.opts.claims);

            rbac.authorizeByPermissions(claims, opts.permissions, opts.authorizeAgainst).then(() => {
                next();
            }).catch(err => {
                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }
                next(err);
            });

        };

    }

    // Returns middleware function to authorize request by roles
    isRole (roles, opts) {

        let rbac = this;

        let defaults = {
            roles: undefined,
            authorizeAgainst: undefined,
            redirect: false
        };

        if (_.isPlainObject(roles)) {
            [roles, opts] = [opts, roles];
        }

        opts = util.defaults({ roles }, opts, defaults);

        return function isRole (req, res, next) {

            let claims = _.get(req, rbac.opts.claims);

            rbac.authorizeByRoles(claims, opts.roles, opts.authorizeAgainst).then(() => {
                next();
            }).catch(err => {
                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }
                next(err);
            });

        };

    }

    // Returns middleware function to check authenticated state
    // Note: req.isAuthenticated fn should be set by your auth lib (passport, etc)
    isAuthenticated (opts) {

        let defaults = {
            redirect: false
        };

        opts = util.defaults(opts, defaults);

        return function isAuthenticated (req, res, next) {
            if (_.isFunction(req.isAuthenticated) && req.isAuthenticated()) {
                next();
            } else {
                if (opts.redirect) {
                    req.session.redirect = req.session.redirect || req.originalUrl;
                }
                next(new util.AuthenticationError('Not Authenticated'));
            }
        };

    }

    // Adds req and view helpers for express apps
    express () {

        let rbac = this;

        return function express (req, res, next) {

            let claims = _.get(req, rbac.opts.claims);

            // Add request helpers
            req.isAuthorized = rbac.authorizeByPermissions.bind(rbac, claims);
            req.isRole = rbac.authorizeByRoles.bind(rbac, claims);

            // Add view helper
            // Returns a boolean vs throwing errors
            res.locals.isAuthorized = function isAuthorized (permissions, authorizeAgainst) {
                try {
                    rbac.authorizer.authorizeByPermissions(claims, permissions, authorizeAgainst);
                    return true;
                } catch (err) {
                    return false;
                }
            };

            // Add view helper
            // Returns a boolean vs throwing errors
            res.locals.isRole = function isRole (roles, authorizeAgainst) {
                try {
                    rbac.authorizer.authorizeByRoles(claims, roles, authorizeAgainst);
                    return true;
                } catch (err) {
                    return false;
                }
            };

            // Add view helper to check authenticated state
            // Note: req.isAuthenticated fn should be set by your auth lib (passport, etc)
            res.locals.isAuthenticated = function isAuthenticated () {
                if (_.isFunction(req.isAuthenticated) && req.isAuthenticated()) {
                    return true;
                } else {
                    return false;
                }
            };

            // Add view helper
            res.locals.authenticated = _.isFunction(req.isAuthenticated) && req.isAuthenticated();

            next();

        };

    }

    static factory () {
        let Fn = this;
        return function factory (...args) {
            return new Fn(...args);
        };
    }

}

module.exports = RBAC;
