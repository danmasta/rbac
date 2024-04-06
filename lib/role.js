const _ = require('lodash');
const util = require('./util');

const defaults = {
    id: undefined,
    description: undefined,
    permissions: undefined,
    inherit: undefined,
    claims: undefined,
    cache: undefined
};

class Role {

    constructor (opts, cache) {

        Object.assign(this, util.defaults({ cache }, opts, defaults));

        if (!this.id) {
            throw new util.RBACError('Role requires id');
        }

        if (this.cache) {
            this.cache.set(this.id, this);
        }

        this.claims = Role.normalizeClaims(this.claims);
        this.permissions = Role.normalizePermissions(this.permissions);

    }

    // Support claims as an object, array, or string:
    // groups: [
    //     'admin'
    // ]
    // groups: {
    //     admin: true
    // }
    // groups: 'admin'
    static normalizeClaims (claims) {

        let res = {};

        _.forOwn(claims, (val, key) => {
            let obj = res[key] = _.toPlainObject(res[key]);
            if (_.isPlainObject(val)) {
                _.forOwn(val, (_val, _key) => {
                    obj[_key] = _val ? true : false;
                });
            } else if (_.isArray(val)) {
                _.each(val, _val => {
                    obj[_val] = true;
                });
            } else {
                obj[val] = val ? true : false;
            }
        });

        return res;

    }

    // Support permissions with wildcards:
    // '*'
    // 'servers.*' - multi-level
    // 'images.*.view'
    // 'posts.*.' - single-level
    static normalizePermissions (permissions) {

        let res = {};

        util.eachNotNil(permissions, val => {
            let parts = _.split(val, '.');
            let obj = res;
            _.each(parts, (str, index) => {
                if (index === parts.length - 1) {
                    if (str === '*') {
                        obj['**'] = true;
                    } else {
                        obj[str] = true;
                    }
                } else {
                    if (obj['*']) {
                        obj = obj['*'] = _.toPlainObject(obj['*']);
                    } else {

                        if (str === '*') {
                            // Inherit existing props
                            obj = obj['*'] = _.assign(null, ..._.values(obj));
                        } else {
                            obj = obj[str] = _.toPlainObject(obj[str]);
                        }
                    }
                }
            });
        });

        return res;

    }

    // Merge all inherited permissions
    // Currently each role will duplicate permissions it inherits
    // We could reference role instances instead, but then we would have to
    // iterate each role during isAuthorized which may be slower
    generatePermissionTree () {

        let res = {};

        if (this.inherit && this.cache) {
            util.eachNotNil(this.inherit, id => {
                let role = this.cache.get(id);
                if (role) {
                    _.merge(res, role.generatePermissionTree());
                }
            });
        }

        return this.permissions = _.merge(res, this.permissions);

    }

    isAuthorized (permission) {

        let p = _.isArray(permission) ? permission : _.split(permission, '.');
        let obj = this.permissions;

        return util.some(p, (val, index) => {
            if (!obj) {
                return false;
            }
            if (obj['**'] === true) {
                return true;
            }
            if (index === p.length - 1) {
                // Support '.' as last char for single level wildcard
                return obj[val] === true || obj['*'] && obj['*'][''];
            } else {
                if (obj['*']) {
                    obj = obj['*'];
                } else {
                    obj = obj[val];
                }
            }
        });

    }

}

module.exports = Role;
