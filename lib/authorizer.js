const _ = require('lodash');
const util = require('./util');
const Role = require('./role');

const defaults = {
    roles: undefined,
    authorizeAgainst: undefined,
    strict: false
};

class Authorizer {

    constructor (roles, opts) {

        if (_.isPlainObject(roles)) {
            [roles, opts] = [opts, roles];
        }

        this.opts = opts = util.defaults({ roles }, opts, defaults);
        this.claims = new Map();
        this.roles = new Map();

        // Create roles and add to cache
        util.each(opts.roles, role => {
            new Role(role, this.roles);
        });

        // Generate permission trees
        // Generate claim to roles mapping
        util.each(this.roles, role => {
            role.generatePermissionTree();
            if (_.isPlainObject(role.claims)) {
                _.forOwn(role.claims, (val, key) => {
                    let claim = _.toPlainObject(this.claims.get(key));
                    _.forOwn(val, (_val, _key) => {
                        if (claim[_key] && this.opts.strict) {
                            throw new util.RBACError(`Claim already has role`);
                        } else {
                            if (_.isArray(claim[_key])) {
                                claim[_key].push(role);
                            } else {
                                claim[_key] = [role];
                            }
                        }
                    });
                    this.claims.set(key, claim);
                });
            }
        });

    }

    getRolesByClaim (id, val) {

        let claim = this.claims.get(id);

        if (claim) {
            return util.mapNotNilFlat(val, str => {
                return claim[str];
            });
        } else {
            return [];
        }

    }

    getRolesByClaims (claims, ids) {

        ids = ids || this.opts.authorizeAgainst || _.keys(claims);

        if (claims) {
            return util.mapNotNilFlat(ids, id => {
                return this.getRolesByClaim(id, claims[id]);
            });
        } else {
            return [];
        }

    }

    getRolesById (ids) {
        return util.mapNotNil(ids, id => {
            return this.roles.get(id);
        });
    }

    authorizeByRoles (claims, ids, authorizeAgainst) {

        let roles = this.getRolesByClaims(claims, authorizeAgainst);
        let found = false;

        if (roles.length && ids) {
            found = util.someNotNil(ids, id => {
                return util.some(roles, role => {
                    return role.id === id;
                });
            });
        }

        if (found) {
            return claims;
        } else {
            throw new util.AuthorizationError(`Not Authorized, Missing one of Required Roles: ${ids}`);
        }

    }

    authorizeByPermissions (claims, permissions, authorizeAgainst) {

        let roles = this.getRolesByClaims(claims, authorizeAgainst);
        let found = false;

        if (roles.length && permissions) {
            found = util.someNotNil(permissions, permission => {
                let p = _.split(permission, '.');
                return util.some(roles, role => {
                    return role.isAuthorized(p);
                });
            });
        }

        if (found) {
            return claims;
        } else {
            throw new util.AuthorizationError(`Not Authorized, Missing one of Required Permissions: ${permissions}`);
        }

    }

}

module.exports = Authorizer;
