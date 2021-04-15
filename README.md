# RBAC
Role based access control helper for node apps

Features:
* Easy to use
* Define roles, permissions, and claims in a declarative way
* Inherit permissions across roles
* Map permission sets to user claims
* Verify permissions or roles against claims
* Includes helper middlewares for express apps

## About
I wanted a better way to handle [authorization](https://www.okta.com/identity-101/authentication-vs-authorization/) in node apps. There are plenty of tools to help with authencation (passport) via different identity providers (oauth, saml, etc), but after you authenticate how do you handle authorization of specific resources and routes based on those [identity claims](https://developer.okta.com/blog/2017/07/25/oidc-primer-part-1#whats-a-claim)? I've seen a lot of applications do some sort of manual checking of session state and user claims on a per-route basis and in non-uniform ways. That pattern is not very scalable or maintainable and it becomes very difficult to audit and verify as the complexity of the app grows.

This package lets you declaratively define your permission sets with a very simple syntax. It supports heirarchical rules via permission inheritance and allows you to map those permissions to identity claims. It includes helper functions for express apps for authorizing against permissions and/or roles.

## Usage
Add rbac as a dependency for your app and install via npm
```
npm install @danmasta/rbac --save
```
Require the package in your app
```javascript
const RBAC = require('@danmasta/rbac');

let rbac = RBAC(roles);
```

### Options

#### Constructor
name | type | description
-----|------|------------
`claims` | *`string`* | What property on the `req` object to find claims. Default is `'user'`
`authorizeAgainst` | *`string\|array`* | Which claims to use to authorize permissions against. If not set it will attempt to authorize against all claims. Default is `undefined`

#### Method: `isAuthenticated`
name | type | description
-----|------|------------
`redirect` | *`boolean`* | If `true` will attempt to set a redirect on failure. Default is `false`

#### Method: `isAuthorized`
name | type | description
-----|------|------------
`redirect` | *`boolean`* | If `true` will attempt to set a redirect on failure. Default is `false`
`permissions` | *`string\|array`* | Which permissions to test: `'posts.get'` or `['posts.get']`. Default is `undefined`
`claims` | *`string\|array`* | What claim key names to use to authorize against: `'groups'` or `['groups']`. Default is `undefined`

#### Method: `isRole`
name | type | description
-----|------|------------
`redirect` | *`boolean`* | If `true` will attempt to set a redirect on failure. Default is `false`
`roles` | *`string\|array`* | Which roles to test: `'editor'` or `['editor']`. Default is `undefined`

### Methods
Name | Description
-----|------------
`verifyPermissions(claims, permissions, authorizeAgainst)` | Verify permissions against a set of claims. Accepts a set of claims, list of permissions, and optional claim key filter to authorize against. If more than one permission is provided it will succeed only if all permissions are verified. Returns a promise that resolves with the specified claims or rejects with an `AuthorizationError` on failure
`verifyRoles(claims, roles)` | Verify roles against a set of claims. Accepts a set of claims and a list of roles. If more than one role is provided it will succeed if any role is verified. Returns a promise that resolves with the specified claims or rejects with an `AuthorizationError` on failure
`isAuthenticated(opts)` | Helper middleware for checking authentication state. Expects a `req.isAuthenticated` function to be set. Returns a function that accepts `(req, res, next)` objects
`isAuthorized(permissions, opts)` | Helper middleware for verifying permissions. Returns a function that accepts `(req, res, next)` objects
`isRole(roles, opts)` | Helper middleware for verifying roles. Returns a function that accepts `(req, res, next)` objects
`express()` | Helper middleware for setting functions on the `req` object and `locals` for view templates. Returns a function that accepts `(req, res, next)` objects

### Roles
Roles can be configured using the following fields:
name | type | description
-----|------|------------
`id` | *`string`* | Id for the role. Default is `undefined`
`description` | *`string`* | Description for the role. Default is `undefined`
`permissions` | *`array\|object`* | Permissions for the role. Should be an array or strings: `[posts.get, posts.list]`, or an object of key/value pairs specifying `true`/`false` for each key: `{ 'posts.get': true, 'posts.list': false }`. Default is `undefined`
`inherit` | *`string\|array`* | Which role ids to inherit permissions from. Default is `undefined`
`claims` | *`object`* | Key/value pairs of claim names and values: `{ groups: ['posts-editor', 'posts-viewer'] }`. Default is `undefined`

## Examples
Define roles and create an instance
```js
const RBAC = require('@danmasta/rbac');

const roles = [
    {
        id: 'superadmin',
        description: 'Administer all',
        inherit: [
            'post/admin'
        ],
        permissions: [],
        claims: {
            groups: [
                'superadmin'
            ]
        }
    },
    {
        id: 'post/admin',
        description: 'Administer post data',
        inherit: [
            'post/editor',
        ],
        permissions: [
            'post.delete'
        ],
        claims: {
            groups: [
                'post-admin'
            ]
        }
    },
    {
        id: 'post/editor',
        description: 'Edit post data',
        inherit: [
            'post/viewer'
        ],
        permissions: [
            'post.write',
            'post.edit'
        ],
        claims: {
            groups: [
                'post-editor'
            ]
        }
    },
    {
        id: 'post/viewer',
        description: 'View post data',
        inherit: [],
        permissions: [
            'post.view',
        ],
        claims: {
            groups: [
                'everyone',
                'post-viewer'
            ]
        }
    }
];

const rbac = RBAC(roles, { authorizeAgainst: 'groups' });
```

Secure resources and routes with middleware by permission
```js
let app = express();

app.get('/post/:id', rbac.isAuthorized('post.view'), (req, res, next) => {
    res.render('post/index');
});

app.get('/post/:id/edit', rbac.isAuthorized('post.edit'), (req, res, next) => {
    res.render('post/edit');
});
```

Secure all admin routes at specified path by role
```js
let app = express();
let adminRouter = require('./routes/admin');

app.use('/admin', rbac.isRole(['superadmin', 'admin']), adminRouter);
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

app.get('/post/list', (req, res, next) => {

    req.isAuthorized('post.list').then(() => {
        res.render('post/list');
    }).catch(err => {
        next(err);
    });

});
```

## Testing
Testing is currently run using mocha and chai. To execute tests just run `npm run test`. To generate unit test coverage reports just run `npm run coverage`

## Contact
If you have any questions feel free to get in touch
