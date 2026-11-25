var Module, __assign, __read, __spreadArray, __values, _a, databaseProxy, descriptor, discover, docOf, files, fs, functions, hostProcess, logosFacade, originalLoad, params, path, pending, pkgDir, request, requestEvent, sequence, tag, typeLoader, validateTypePath;

validateTypePath = function(real) {
  if (!real.startsWith(''.concat(pkgDir).concat(path.sep))) {
    throw new Error('Module escapes isolated package root: ' + real);
  }
};

request = function(op, payload) {
  var id;
  id = String(++sequence);
  return new Promise(function(resolve, reject) {
    pending.set(id, {
      resolve: resolve,
      reject: reject
    });
    hostProcess.send(__assign({
      op: op,
      id: id
    }, payload));
  });
};

requestEvent = function(event, payload) {
  return request('event', {
    event: event,
    payload: payload
  });
};

databaseProxy = function(tenant) {
  return new Proxy({}, {
    get: function(_target, entity) {
      if (typeof entity != 'string') {
        return undefined;
      }
      return new Proxy({}, {
        get: function(_model, method) {
          if (typeof method != 'string') {
            return undefined;
          }
          return function() {
            var _i, args;
            args = [];
            _i = 0;
            while (_i < arguments.length) {
              args[_i] = arguments[_i];
              _i++;
            }
            return request('capability', {
              request: {
                surface: 'database',
                tenant: tenant,
                entity: entity,
                method: method,
                args: args
              }
            });
          };
        }
      });
    }
  });
};

files = function(dir, out) {
  var __caught, _a, _b, _c, e_1, e_1_1, entry, file;
  e_1 = void 0;
  _a = void 0;
  if (out == void 0) {
    out = [];
  }
  try {
    _b = __values(fs.readdirSync(dir, {
      withFileTypes: true
    }));
    _c = _b.next();
    while (!_c.done) {
      entry = _c.value;
      if (['node_modules', 'test', 'tests', '__tests__'].includes(entry.name) || entry.name.startsWith('.')) {
        _c = _b.next();
        continue;
      }
      file = path.join(dir, entry.name);
      if (entry.isDirectory() && !fs.existsSync(path.join(file, 'package.json'))) {
        files(file, out);
      } else if (entry.isFile() && /\.(?:[cm]?js|type)$/.test(entry.name) && !/\.(?:test|spec)\.(?:[cm]?js|type)$/.test(entry.name)) {
        out.push(file);
      }
      _c = _b.next();
    }
  } catch (error1) {
    e_1_1 = error1;
    e_1 = {
      error: e_1_1
    };
  } finally {
    try {
      if (_c && !_c.done && (_a = _b.return)) {
        _a.call(_b);
      }
    } catch (error1) {
      __caught = error1;
      throw __caught;
    } finally {
      if (e_1) {
        throw e_1.error;
      }
    }
  }
  return out;
};

docOf = function(fn, source) {
  var above, escaped, inside, name, text;
  text = Function.prototype.toString.call(fn);
  inside = text.match(/\/\*\*([\s\S]*?)\*\//);
  if (inside) {
    return inside[0];
  }
  name = fn.name.replace(/^bound /, '');
  escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  above = source.match(new RegExp('/\\*\\*([\\s\\S]*?)\\*/\\s*(?:async\\s+)?function\\s+'.concat(escaped, '\\b')));
  if (above) {
    return above[0];
  } else {
    return '';
  }
};

tag = function(doc, name) {
  var match;
  match = doc.match(new RegExp('@'.concat(name, '\\s+([^\\s@]+)')));
  if (match) {
    return match[1].trim();
  } else {
    return null;
  }
};

params = function(doc) {
  var __caught, _a, _b, _c, _d, e_2, e_2_1, match, optional, properties, raw, required, type;
  e_2 = void 0;
  _a = void 0;
  _b = void 0;
  properties = {};
  required = [];
  try {
    _c = __values(doc.matchAll(/@param\s+\{([^}]+)\}\s+([\w.]+)\s*(?:-\s*([^\n*]+))?/g));
    _d = _c.next();
    while (!_d.done) {
      match = _d.value;
      optional = match[1].endsWith('?');
      raw = match[1].replace('?', '').replace('[]', '');
      type = {
        Int: 'integer',
        Float: 'number',
        String: 'string',
        Boolean: 'boolean',
        DateTime: 'string',
        Json: 'object'
      }[raw] || raw;
      properties[match[2]] = {
        type: (['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(type) ? type : 'string'),
        description: ((_b = match[3]) == null || _b == void 0 ? void 0 : _b.trim()) || null
      };
      if (!optional) {
        required.push(match[2]);
      }
      _d = _c.next();
    }
  } catch (error1) {
    e_2_1 = error1;
    e_2 = {
      error: e_2_1
    };
  } finally {
    try {
      if (_d && !_d.done && (_a = _c.return)) {
        _a.call(_c);
      }
    } catch (error1) {
      __caught = error1;
      throw __caught;
    } finally {
      if (e_2) {
        throw e_2.error;
      }
    }
  }
  return {
    type: 'object',
    properties: properties,
    required: required
  };
};

descriptor = function(kind, id, fn, doc) {
  var _a, _b, declaration, item, lines, publicMatch, publicValue, type_1, value;
  _a = void 0;
  _b = void 0;
  value = tag(doc, (kind == 'tool' ? 'register_tool' : (kind == 'route' ? 'register_router' : 'register_hook')));
  if (!value) {
    type_1 = (kind == 'route' ? 'router' : (kind == 'tool' ? 'tool' : 'hook'));
    lines = doc.split('\n').map(function(line) {
      return line.trim().replace(/^\/\*\*?\s*/, '').replace(/^\*\s?/, '').replace(/\s*\*\/$/, '');
    });
    declaration = lines.map(function(line) {
      return line.match(new RegExp('^@register[ \\t]+'.concat(type_1, '(?:[ \\t]+([^\\s@]+))?(?:[ \\t]|$)')));
    }).find(Boolean);
    if (declaration) {
      value = declaration[1] || ((_a = lines.map(function (line) {
  return line.match(/^@name[ \t]+([^\s@]+)/);
}).find(Boolean)) == null || _a == void 0 ? void 0 : _a[1]);
      if (!value) {
        throw new Error('[logos] @register '.concat(type_1, ' requires a name'));
      }
      if (kind == 'route') {
        value = value.replace(/^\/+/, '');
      }
    }
  }
  if (!value) {
    return null;
  }
  item = {
    id: id,
    kind: kind
  };
  if (kind == 'tool') {
    item.name = value;
    item.description = tag(doc, 'description');
    item.parameters = params(doc);
  }
  if (kind == 'route') {
    item.path = value;
    item.method = (tag(doc, 'method') || 'get').toLowerCase();
    publicMatch = doc.match(/@public(?:[ \t]+(?!(?:@|\*\/))(\S+))?/i);
    publicValue = ((_b = publicMatch === null || publicMatch === void 0 ? void 0 : publicMatch[1]) == null || _b == void 0 ? void 0 : _b.toLowerCase());
    if (publicMatch && publicValue && !['true', 'false'].includes(publicValue)) {
      throw new Error('[logos] @public "'.concat(publicValue, '" inválido — use true, false, ou omita o valor.'));
    }
    item.public = Boolean(publicMatch) && publicValue != 'false';
  }
  if (kind == 'hook') {
    item.event = value;
    item.priority = Number(tag(doc, 'priority') || 100);
  }
  return item;
};

discover = async function() {
  var key;
  var handlerId;
  var __caught, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, compiled, declaration, doc, e_3, e_3_1, e_4, e_4_1, e_5, e_5_1, e_6, e_6_1, e_7, e_7_1, exportName, exports, file, fn, handlerId, id, item, key, kind, line, match, raw, registration, registrations, registrations_1, registrations_1_1, result, source, tags, value;
  e_3 = void 0;
  _a = void 0;
  e_4 = void 0;
  _b = void 0;
  e_5 = void 0;
  _c = void 0;
  e_6 = void 0;
  _d = void 0;
  e_7 = void 0;
  _e = void 0;
  _f = void 0;
  _g = void 0;
  _h = void 0;
  _j = void 0;
  _k = void 0;
  _l = void 0;
  if (false) {
    await void 0;
  }
  result = {
    tools: [],
    routes: [],
    hooks: [],
    declarations: []
  };
  id = 0;
  try {
    _m = __values(files(pkgDir));
    _o = _m.next();
    while (!_o.done) {
      file = _o.value;
      delete require.cache[require.resolve(file)];
      source = fs.readFileSync(file, 'utf8');
      compiled = (file.endsWith('.type') ? typeLoader.compileType(source, file) : null);
      exports = (compiled ? typeLoader.loadType(file, compiled.js, validateTypePath, (function(_root, entity) {
        return new Proxy({}, {
          get: (function(_target, key) {
            if (typeof key != 'string' || key == 'then') {
              return undefined;
            }
            return request('capability', {
              request: {
                surface: 'database',
                tenant: hostProcess.env.LOGOS_ISOLATED_FOLDER,
                entity: entity,
                operation: 'index',
                key: key
              }
            });
          })
        });
      })) : require(file));
      try {
        _p = (function() {
          e_4 = void 0;
          return __values(Object.entries(exports));
        }).call(this);
        _q = _p.next();
        while (!_q.done) {
          _r = __read(_q.value, 2);
          exportName = _r[0];
          fn = _r[1];
          if (typeof fn != 'function') {
            _q = _p.next();
            continue;
          }
          doc = (compiled ? ((_g = (_f = compiled.docs[fn.name]) !== null && _f !== void 0 ? _f : compiled.docs[exportName]) != null && _g != void 0 ? _g : '') : docOf(fn, source));
          tags = {};
          registrations = [];
          try {
            _s = (function() {
              e_5 = void 0;
              return __values(doc.split('\n').map(function(line) {
                return line.trim().replace(/^\/\*\*?\s*/, '').replace(/^\*\s?/, '').replace(/\s*\*\/$/, '');
              }));
            }).call(this);
            _t = _s.next();
            while (!_t.done) {
              line = _t.value;
              match = line.match(/^@([\w-]+)(?:[ \t]+(.*?))?[ \t]*$/);
              if (!match) {
                _t = _s.next();
                continue;
              }
              _u = __read(match, 3);
              key = _u[1];
              _v = _u[2];
              raw = (_v == void 0 ? '' : _v);
              value = raw.trim();
              (tags[key] || (tags[key] = [])).push(value);
              if (key == 'register') {
                registration = value.match(/^([^\s]+)(?:[ \t]+(.*))?$/);
                if (registration) {
                  registrations.push({
                    type: registration[1],
                    name: ((_h = registration[2]) == null || _h == void 0 ? void 0 : _h.trim()) || null,
                    legacy: false
                  });
                }
              } else if (key.startsWith('register_') && key.length > 9) {
                registrations.push({
                  type: key.slice(9),
                  name: value || null,
                  legacy: true
                });
              }
              _t = _s.next();
            }
          } catch (error1) {
            e_5_1 = error1;
            e_5 = {
              error: e_5_1
            };
          } finally {
            try {
              if (_t && !_t.done && (_c = _s.return)) {
                _c.call(_s);
              }
            } catch (error1) {
              __caught = error1;
              throw __caught;
            } finally {
              if (e_5) {
                throw e_5.error;
              }
            }
          }
          try {
            registrations_1 = (function() {
              e_6 = void 0;
              return __values(registrations);
            }).call(this);
            registrations_1_1 = registrations_1.next();
            while (!registrations_1_1.done) {
              declaration = registrations_1_1.value;
              handlerId = 'declaration:'.concat(++id);
              functions.set(handlerId, fn);
              result.declarations.push({
                id: handlerId,
                file: file,
                declaration: __assign(__assign({}, declaration), {
                  name: ((_l = (_j = declaration.name) !== null && _j !== void 0 ? _j : (_k = tags.name) === null || _k === void 0 ? void 0 : _k[0]) != null && _l != void 0 ? _l : (compiled ? exportName : null)),
                  tags: tags
                })
              });
              registrations_1_1 = registrations_1.next();
            }
          } catch (error1) {
            e_6_1 = error1;
            e_6 = {
              error: e_6_1
            };
          } finally {
            try {
              if (registrations_1_1 && !registrations_1_1.done && (_d = registrations_1.return)) {
                _d.call(registrations_1);
              }
            } catch (error1) {
              __caught = error1;
              throw __caught;
            } finally {
              if (e_6) {
                throw e_6.error;
              }
            }
          }
          try {
            _w = (function() {
              e_7 = void 0;
              return __values([['tool', 'tools'], ['route', 'routes'], ['hook', 'hooks']]);
            }).call(this);
            _x = _w.next();
            while (!_x.done) {
              _y = __read(_x.value, 2);
              kind = _y[0];
              key = _y[1];
              handlerId = ''.concat(kind, ':').concat(++id);
              item = descriptor(kind, handlerId, fn, (compiled ? typeLoader.resolvedParameterDocs(doc, file) : doc));
              if (item) {
                functions.set(handlerId, fn);
                result[key].push(item);
              }
              _x = _w.next();
            }
          } catch (error1) {
            e_7_1 = error1;
            e_7 = {
              error: e_7_1
            };
          } finally {
            try {
              if (_x && !_x.done && (_e = _w.return)) {
                _e.call(_w);
              }
            } catch (error1) {
              __caught = error1;
              throw __caught;
            } finally {
              if (e_7) {
                throw e_7.error;
              }
            }
          }
          _q = _p.next();
        }
      } catch (error1) {
        e_4_1 = error1;
        e_4 = {
          error: e_4_1
        };
      } finally {
        try {
          if (_q && !_q.done && (_b = _p.return)) {
            _b.call(_p);
          }
        } catch (error1) {
          __caught = error1;
          throw __caught;
        } finally {
          if (e_4) {
            throw e_4.error;
          }
        }
      }
      _o = _m.next();
    }
  } catch (error1) {
    e_3_1 = error1;
    e_3 = {
      error: e_3_1
    };
  } finally {
    try {
      if (_o && !_o.done && (_a = _m.return)) {
        _a.call(_m);
      }
    } catch (error1) {
      __caught = error1;
      throw __caught;
    } finally {
      if (e_3) {
        throw e_3.error;
      }
    }
  }
  return result;
};

'use strict';

__assign = this && this.__assign || function() {
  __assign = Object.assign || function(t) {
    var i, n, p, s;
    s = void 0;
    i = 1;
    n = arguments.length;
    while (i < n) {
      s = arguments[i];
      for (p in s) {
        if (Object.prototype.hasOwnProperty.call(s, p)) {
          t[p] = s[p];
        }
      }
      i++;
    }
    return t;
  };
  return __assign.apply(this, arguments);
};

__values = this && this.__values || function(o) {
  var i, m, s;
  s = typeof Symbol == 'function' && Symbol.iterator;
  m = s && o[s];
  i = 0;
  if (m) {
    return m.call(o);
  }
  if (o && typeof o.length == 'number') {
    return {
      next: function() {
        if (o && i >= o.length) {
          o = void 0;
        }
        return {
          value: o && o[i++],
          done: !o
        };
      }
    };
  }
  throw new TypeError((s ? 'Object is not iterable.' : 'Symbol.iterator is not defined.'));
};

__read = this && this.__read || function(o, n) {
  var __caught, ar, e, error, i, m, r;
  m = typeof Symbol == 'function' && o[Symbol.iterator];
  if (!m) {
    return o;
  }
  i = m.call(o);
  r = void 0;
  ar = [];
  e = void 0;
  try {
    while ((n == void 0 || n-- > 0) && !(r = i.next()).done) {
      ar.push(r.value);
    }
  } catch (error1) {
    error = error1;
    e = {
      error: error
    };
  } finally {
    try {
      if (r && !r.done && (m = i['return'])) {
        m.call(i);
      }
    } catch (error1) {
      __caught = error1;
      throw __caught;
    } finally {
      if (e) {
        throw e.error;
      }
    }
  }
  return ar;
};

__spreadArray = this && this.__spreadArray || function(to, from, pack) {
  var ar, i, l;
  if (pack || arguments.length == 2) {
    i = 0;
    l = from.length;
    ar = void 0;
    while (i < l) {
      if (ar || !(i in from)) {
        if (!ar) {
          ar = Array.prototype.slice.call(from, 0, i);
        }
        ar[i] = from[i];
      }
      i++;
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};

_a = void 0;

// Runs from both src in tests and dist in a published runtime.
// LógosType uses the language loader supplied by the parent before lockdown.
// The ambient Lógos API exposed to package code is the mediated facade below.
fs = require('node:fs');

path = require('node:path');

Module = require('node:module');

pkgDir = path.resolve(process.env.LOGOS_ISOLATED_PACKAGE);

hostProcess = process;

// Keep compiler authority inside bootstrap; package code cannot import it.
typeLoader = (files(pkgDir).some((function(file) {
  return file.endsWith('.type');
})) ? require(process.env.LOGOS_TYPE_LOADER) : null);

if (typeLoader) {
  typeLoader.compileType('', path.join(pkgDir, 'bootstrap.type'));
}

functions = new Map();

pending = new Map();

sequence = 0;

hostProcess.on('disconnect', function() {
  return hostProcess.exit(1);
});

logosFacade = Object.freeze({
  requestCapability: function(requestPayload) {
    return request('capability', {
      request: requestPayload
    });
  },
  emit: requestEvent,
  dispatchEvent: requestEvent,
  $: requestEvent,
  getProxy: databaseProxy
});

originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  var real, resolved;
  if (request == 'logos') {
    return logosFacade;
  }
  // An isolated package receives capabilities through `logos`, never direct
  // Node authority. node:net/fetch would bypass origin grants; node:fs would
  // bypass declared file roots.
  if (Module.builtinModules.includes(request) || request.startsWith('node:')) {
    throw new Error('Native module access is denied in isolated packages: '.concat(request));
  }
  resolved = Module._resolveFilename(request, parent, isMain);
  real = fs.realpathSync(resolved);
  if (real != pkgDir && !real.startsWith(''.concat(pkgDir).concat(path.sep))) {
    throw new Error('Module escapes isolated package root: '.concat(request));
  }
  if (path.extname(real) == '.node') {
    throw new Error('Native addons are denied in isolated packages: '.concat(request));
  }
  return originalLoad.call(this, request, parent, isMain);
};

// The bootstrap retains hostProcess for IPC/lifecycle; package modules only
// receive a harmless immutable environment marker and must use IPC facades.
Object.defineProperty(globalThis, 'process', {
  value: Object.freeze({
    env: Object.freeze({
      NODE_ENV: ((_a = hostProcess.env.NODE_ENV) != null && _a != void 0 ? _a : 'production')
    })
  }),
  configurable: false,
  enumerable: false,
  writable: false
});

Object.defineProperty(globalThis, 'fetch', {
  value: undefined,
  configurable: false,
  writable: false
});

hostProcess.on('message', async function(message) {
  var error, fn, pendingCall;
  if (false) {
    await void 0;
  }
  if (!message || typeof message != 'object') {
    return;
  }
  if (message.op == 'event:result' || message.op == 'event:error' || message.op == 'capability:result' || message.op == 'capability:error') {
    pendingCall = pending.get(String(message.id));
    if (!pendingCall) {
      return;
    }
    pending.delete(String(message.id));
    (message.op.endsWith(':error') ? pendingCall.reject(new Error(message.error)) : pendingCall.resolve(message.result));
    return;
  }
  if (message.op == 'stop') {
    hostProcess.disconnect();
    hostProcess.exit(0);
    return;
  }
  try {
    if (message.op == 'start') {
      hostProcess.send({
        op: 'result',
        id: message.id,
        result: (await (discover()))
      });
    } else if (message.op == 'invoke') {
      fn = functions.get(message.handler);
      if (!fn) {
        throw new Error('Unknown isolated handler: '.concat(message.handler));
      }
      hostProcess.send({
        op: 'result',
        id: message.id,
        result: (await (fn.apply(void 0, __spreadArray(__spreadArray([], __read(message.args || []), false), [message.context || {}], false))))
      });
    }
  } catch (error1) {
    error = error1;
    hostProcess.send({
      op: 'error',
      id: message.id,
      error: (error == null || error == void 0 ? undefined : error.stack) || (error == null || error == void 0 ? undefined : error.message) || String(error)
    });
  }
});
