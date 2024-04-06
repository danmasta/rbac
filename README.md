# RBAC
Role based access control helper for node apps

Features:
* Easy to use
* Define roles, permissions, and claims in a declarative way
* Inherit permissions across roles
* Map roles and permission sets to user claims
* Authorize roles and permission sets against user claims
* Includes helper middlewares for express apps
* Supports [RBAC](https://developer.okta.com/books/api-security/authz/role-based/) and [ABAC](https://developer.okta.com/books/api-security/authz/attribute-based/) type flows
* [Wildcard](#wildcards) support for permission definitions

## About
I wanted a better way to handle [authorization](https://www.okta.com/identity-101/authentication-vs-authorization/) in node apps. There are plenty of tools to help with authentication from different identity providers such as passport, oauth, saml, oidc, etc. But after you authenticate how do you handle authorization of specific resources and routes based on those [identity claims](https://developer.okta.com/blog/2017/07/25/oidc-primer-part-1#whats-a-claim)? I've seen a lot of applications do some sort of manual checking of session state and user claims on a per-route basis and in non-uniform ways. That pattern tends to be pretty error-prone and not very scalable or maintainable as the application grows. It can also be difficult to audit, change, or verify over time.

This package lets you declaratively define your permission sets with a very simple syntax. It supports heirarchical rules via permission inheritance and allows you to map those permissions to identity claims. It includes helper functions for express apps for authorizing against permissions and roles. It also supports wildcard matching for permission definitions.

## Usage
Add rbac as a dependency for your app and install via npm
```
npm install @danmasta/rbac --save
```
Require the package in your app
```js
const RBAC = require('@danmasta/rbac');

let rbac = RBAC(roles);
```
Add authorization to a route
```js
app.use('/admin', rbac.isRole('admin'), router);
```

### Options
name | type | description
-----|------|------------
`claims` | *`string`* | What property on the `req` object to find claims. Default is `'user'`
`roles` | *`array`* | Role definitions to use for authorizing against. Default is `undefined`
`authorizeAgainst` | *`string\|array`* | Which claims to use to authorize permissions against. If not set it will attempt to authorize against all claims. Default is `undefined`
`strict` | *`boolean`* | Whether or not to allow multiple role mappings per claim. If `true` it will throw an error if there is more than one role defined for a claim set. Default is `false`

### Methods
Name | Description
-----|------------
`authorizeByPermissions(claims, permissions, authorizeAgainst?)` | Verify permissions against a set of claims. Accepts a set of claims, list of permissions, and optional claim key filter to authorize against. If more than one permission is provided it will succeed only if all permissions are verified. Returns a `promise` that resolves with claims or rejects with an `AuthorizationError`
`authorizeByRoles(claims, roles, authorizeAgainst?)` | Verify roles against a set of claims. Accepts a set of claims, list of roles, and optional claim key filter to authorize against. If more than one role is provided it will succeed if any role is verified. Returns a `promise` that resolves with claims or rejects with an `AuthorizationError`
`isAuthorized(permissions, opts?)` | Helper middleware for verifying permissions on routes. Accepts an optional options object of `{ permissions, authorizeAgainst, redirect }`. Returns a middleware `function`
`isRole(roles, opts?)` | Helper middleware for verifying roles on routes. Accepts an optional options object of `{ roles, authorizeAgainst, redirect }`. Returns a middleware `function`
`isAuthenticated(opts?)` | Helper middleware for checking authentication state. Expects a `req.isAuthenticated()` function to be set. Accepts an optional options object of `{ redirect }`. Returns a middleware `function`
`express()` | Helper middleware for setting functions on the `req` object and `res.locals` object for routes and view templates. Returns a middleware `function`

*Note: The `redirect` option for middleware functions is used to set `req.session.redirect` on failure, if desired*

### Role Objects
Each role object has the following signature:
#### Properties
name | type | description
-----|------|------------
`id` | *`string`* | ID for the role. Required or an error is thrown. Used to look up other roles by ID for permission inheritance. Default is `undefined`
`description` | *`string`* | Description for the role. Default is `undefined`
`permissions` | *`string\|array`* | Permissions for the role. Should be an array of strings: `['posts.edit', 'posts.view']`. Default is `undefined`
`inherit` | *`string\|array`* | Which role ids to inherit permissions from. Default is `undefined`
`claims` | *`object`* | Key/value pairs of claim names and values: `{ groups: ['editor', 'viewer'] }`. Default is `undefined`

#### Methods
Name | Description
-----|------------
`generatePermissionTree()` | Generate the permission tree for the role. Recursively walks and merges inherited permissions. Returns a permissions `object`
`isAuthorized(permission)` | Verifies whethere or not the role has a permission: `role.isAuthorized('posts.edit')`. Returns a `boolean`

### Wildcards
When describing permissions you can use wildcards `*` to authorize patterns of resources. The syntax looks like:
* `*` At the end of a permission matches anything after and including. If you want to set a superadmin type role you can just use `*` as the only permission
* `**` Explicitly matches all from this point, alias for using `*` at the end
* `*.` Match anything one level deep

#### Wildcard Examples
String | Description
-------|------------
`*` | Matches anything at any depth
`api.*` | Matches any permission at any depth that begins with `api`
`api.*.` | Matches any permission at 1 depth that begins with `api`. Matches `api.status`, but not `api.status.db`
`api.*.view` | Matches any permission at 1 depth that begins with `api` and ends with `view`. Matches `api.users.view`, but not `api.users` or `api.users.edit`

## Examples
Define roles, find claims on the `req.user` object, and authorize against the `groups` claim
```js
const RBAC = require('@danmasta/rbac');

const roles = [
    {
        id: 'admin',
        inherit: undefined,
        permissions: [
            '*'
        ],
        claims: {
            groups: [
                'admin'
            ]
        }
    },
    {
        id: 'editor',
        inherit: [
            'viewer',
        ],
        permissions: [
            'api.*.edit',
            'posts.edit'
        ],
        claims: {
            groups: [
                'editor'
            ]
        }
    },
    {
        id: 'viewer',
        inherit: undefined,
        permissions: [
            'api.*.view',
            'api.*.list',
            'posts.view'
        ],
        claims: {
            groups: [
                'viewer'
            ]
        }
    }
];

const rbac = RBAC(roles, { claims: 'user', authorizeAgainst: 'groups' });
```

Secure resources and routes with middleware by permissions
```js
let app = express();

app.get('/post/:id', rbac.isAuthorized('posts.view'), (req, res, next) => {
    res.render('post/index', req.params.id);
});

app.get('/post/:id/edit', rbac.isAuthorized('posts.edit'), (req, res, next) => {
    res.render('post/edit', req.params.id);
});

app.post('/api/post/:id/edit', rbac.isAuthorized('api.post.edit'), (req, res, next) => {
    res.json({ message: 'post udpated', id: req.params.id });
});
```

Secure all admin routes by role
```js
let app = express();

app.use('/admin', rbac.isRole('admin'), require('./routes/admin'));
```

Add express helpers to `req` and `res.locals` objects
```js
let app = express();

app.use(rbac.express());
```

Verify permissions inside a route handler function
```js
let app = express();

app.use(rbac.express());

app.get('/post/:id', (req, res, next) => {

    req.isAuthorized('posts.view').then(() => {
        res.render('post/index', req.params.id);
    }).catch(err => {
        next(err);
    });

});
```

## Testing
Tests are currently run using mocha and chai. To execute tests run `npm run test`. To generate unit test coverage reports run `npm run coverage`

## Contact
If you have any questions feel free to get in touch
