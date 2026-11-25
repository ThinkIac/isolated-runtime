var __assign, __read, __spreadArray, createBridge, provideIsolation, requireCapabilityDependency;

provideIsolation = function(host) {
  /**
   * @register module isolation
   * @context capability
   */
  var bridge, container;
  bridge = createBridge(host.authority.runAsPackage);
  container = void 0;
  return {
    name: 'isolation',
    phase: 'boot',
    swappable: false,
    api: bridge,
    install: function(c) {
      container = c;
    },
    close: async function() {
      var errors, results;
      if (false) {
        await void 0;
      }
      if (!container) {
        return;
      }
      results = (await (Promise.allSettled(__spreadArray([], __read(container.state('isolated').keys()), false).map(function(folder) {
        return bridge.stopIsolatedRunner(container, folder, 'isolation_closed');
      }))));
      errors = results.filter(function(result) {
        return result.status == 'rejected';
      }).map(function(result) {
        return result.reason;
      });
      if (errors.length) {
        throw new AggregateError(errors, 'Isolation shutdown failed');
      }
    }
  };
};

requireCapabilityDependency = function(name, local) {
  var entry, error;
  entry = void 0;
  try {
    entry = require.resolve(name);
  } catch (error1) {
    error = error1;
    if (error.code != 'MODULE_NOT_FOUND') {
      throw error;
    }
    entry = require.resolve(local);
  }
  return require(entry);
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

createBridge = require('./bridge.cjs').createBridge;

module.exports = __assign({
  provideIsolation: provideIsolation
}, require('./runner.cjs'));

// Compatibility factories resolve their SDK from their own dependency graph.
module.exports.createHost = function() {
  var _a, _i, args;
  _a = void 0;
  args = [];
  _i = 0;
  while (_i < arguments.length) {
    args[_i] = arguments[_i];
    _i++;
  }
  return (_a = requireCapabilityDependency('@thinkiac/module-runtime-compat', '../runtime-compat')).createHost.apply(_a, __spreadArray([], __read(args), false));
};

// Library alias for existing direct consumers; not used for runtime discovery.
module.exports.createRuntimeModule = provideIsolation;
