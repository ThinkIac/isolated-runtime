var __assign, createBridge, libraries;

createBridge = function(runAsPackage) {
  /** Starts an isolated package before any public surface is wired. */
  var IsolatedRunner, exports, getIsolatedRunner, isolatedRunnerFor, node_async_hooks_1, stagingRunner, stopIsolatedRunner, withStagedIsolated;
  withStagedIsolated = function(container, folder, runner, work) {
    return stagingRunner.run({
      container: container,
      folder: folder,
      runner: runner
    }, work);
  };
  isolatedRunnerFor = async function(container, pkg, publish) {
    var _a, _b, runner, runners;
    _a = void 0;
    _b = void 0;
    if (publish == void 0) {
      publish = true;
    }
    if (false) {
      await void 0;
    }
    if ((pkg === null || pkg === void 0 ? void 0 : pkg.isolated) != true && ((_a = pkg === null || pkg === void 0 ? void 0 : pkg.runtime) === null || _a === void 0 ? void 0 : _a.mode) != 'isolated') {
      return null;
    }
    runners = container.state('isolated');
    runner = runners.get(pkg.folder);
    if (publish && (runner == null || runner == void 0 ? void 0 : runner.running)) {
      return runner;
    }
    runner = new IsolatedRunner({
      folder: pkg.folder,
      dir: pkg.dir,
      sandboxRoot: process.env.LOGOS_ISOLATED_SANDBOX_ROOT,
      env: {
        NODE_ENV: ((_b = process.env.NODE_ENV) != null && _b != void 0 ? _b : 'production')
      },
      onExit: function(event) {
        if (!event.expected && runners.get(pkg.folder) == runner) {
          container.bus.emit('isolated:exit', __assign({
            pkg: pkg.folder
          }, event)).catch(function(error) {
            return container.log(error.message);
          });
        }
      },
      onLog: function(message) {
        return container.log('[isolated:'.concat(pkg.folder, '] ').concat(message));
      },
      onEvent: async function(event, payload) {
        if (false) {
          await void 0;
        }
        return runAsPackage(container.authority, pkg.folder, async function() {
          if (false) {
            await void 0;
          }
          container.authority.enforce({
            principal: {
              kind: 'package',
              id: pkg.folder
            },
            surface: 'events',
            operation: 'publish',
            resource: event
          });
          await container.bus.emit(event, payload, {
            pkg: pkg
          });
          return undefined;
        });
      },
      onCapability: async function(request) {
        var provider;
        if (false) {
          await void 0;
        }
        provider = container.state('runtime:capabilities').get(request.surface);
        if (typeof provider != 'function') {
          throw new Error('Unsupported isolated capability: '.concat(request.surface));
        }
        return runAsPackage(container.authority, pkg.folder, function() {
          return provider(request, Object.freeze({
            package: pkg.folder
          }));
        });
      }
    });
    await runner.start();
    if (publish) {
      runners.set(pkg.folder, runner);
    }
    return runner;
  };
  getIsolatedRunner = function(container, folder) {
    var _a, staged;
    _a = void 0;
    staged = stagingRunner.getStore();
    if ((staged === null || staged === void 0 ? void 0 : staged.container) == container && staged.folder == folder) {
      return staged.runner;
    }
    if ((_a = container.state('isolated').get(folder)) != null && _a != void 0) {
      return _a;
    } else {
      return null;
    }
  };
  stopIsolatedRunner = async function(container, folder, reason) {
    var runner;
    if (false) {
      await void 0;
    }
    runner = getIsolatedRunner(container, folder);
    container.state('isolated').delete(folder);
    await (runner == null || runner == void 0 ? void 0 : runner.stop(reason));
  };
  if (libraries.has(runAsPackage)) {
    return libraries.get(runAsPackage);
  }
  exports = {};
  'use strict';
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  exports.withStagedIsolated = withStagedIsolated;
  exports.isolatedRunnerFor = isolatedRunnerFor;
  exports.getIsolatedRunner = getIsolatedRunner;
  exports.stopIsolatedRunner = stopIsolatedRunner;
  node_async_hooks_1 = require('node:async_hooks');
  IsolatedRunner = require('./runner.cjs').IsolatedRunner;
  stagingRunner = new (node_async_hooks_1.AsyncLocalStorage)();
  libraries.set(runAsPackage, exports);
  return exports;
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

libraries = new WeakMap();

module.exports = {
  createBridge: createBridge
};
