'use strict';
var AsyncLocalStorage, IsolatedRunner, __importDefault, node_child_process_1, node_path_1, randomUUID, realpathSync;

// core/isolated — process boundary for packages declared `isolated: true`.

// The parent never imports package code. It receives only declarative surface
// descriptors and invokes an opaque handler id over Node's IPC channel.
__importDefault = this && this.__importDefault || function(mod) {
  if (mod && mod.__esModule) {
    return mod;
  } else {
    return {
      'default': mod
    };
  }
};

Object.defineProperty(exports, '__esModule', {
  value: true
});

exports.IsolatedRunner = void 0;

({AsyncLocalStorage} = require('node:async_hooks'));

({randomUUID} = require('node:crypto'));

({realpathSync} = require('node:fs'));

node_child_process_1 = require('node:child_process');

node_path_1 = __importDefault(require('node:path'));

IsolatedRunner = class IsolatedRunner {
  constructor(options) {
    this.child = null;
    this.pending = new Map();
    this.timedOutChildren = new WeakSet();
    this.stopping = false;
    this.manifest = null;
    this.options = options;
    return;
  }

  async start() {
    var _this, child, childPath, compilerDir, compilerEntry, env, error, executorDir, launchArgs, launcher, logosDir, manifest, nodeMajor, packageDir, permissionArgs, ref, ref1, ref2, root;
    _this = this;
    if (false) {
      await void 0;
    }
    if (this.running && this.manifest) {
      return this.manifest;
    }
    nodeMajor = Number(process.versions.node.split('.')[0]);
    if (!Number.isInteger(nodeMajor) || nodeMajor < 20) {
      throw new Error('Isolated packages require Node.js 20+ permission mode');
    }
    this.stopping = false;
    childPath = node_path_1.default.join(__dirname, 'child.js');
    env = {
      NODE_ENV: (ref = (ref1 = this.options.env) != null ? ref1.NODE_ENV : void 0) != null ? ref : 'production',
      LOGOS_TYPE_LOADER: node_path_1.default.join(node_path_1.default.dirname(require.resolve('logos')), 'kernel/type-source.js'),
      LOGOS_ISOLATED_PACKAGE: this.options.dir,
      LOGOS_ISOLATED_FOLDER: this.options.folder
    };
    compilerDir = node_path_1.default.dirname(require.resolve('logostype/package.json', {
      paths: [node_path_1.default.dirname(env.LOGOS_TYPE_LOADER)]
    }));
    env.LOGOS_TYPE_COMPILER = require.resolve('logostype', {
      paths: [node_path_1.default.dirname(env.LOGOS_TYPE_LOADER)]
    });
    logosDir = node_path_1.default.dirname(node_path_1.default.dirname(env.LOGOS_TYPE_LOADER));
    executorDir = node_path_1.default.dirname(childPath);
    compilerEntry = env.LOGOS_TYPE_COMPILER;
    packageDir = this.options.dir;
    launcher = process.execPath;
    launchArgs = [];
    if (this.options.sandboxRoot != null) {
      if (process.platform !== 'linux') {
        throw new Error('Linux is required for the OS package sandbox');
      }
      root = realpathSync(this.options.sandboxRoot);
      if (root === '/') {
        throw new Error('The OS package sandbox requires a dedicated runtime root');
      }
      launcher = (ref2 = this.options.sandboxLauncher) != null ? ref2 : '/usr/bin/bwrap';
      if (!node_path_1.default.isAbsolute(launcher)) {
        throw new Error('The OS package sandbox requires an absolute launcher path');
      }
      launchArgs = ['--unshare-user', '--disable-userns', '--unshare-pid', '--as-pid-1', '--unshare-net', '--unshare-ipc', '--unshare-uts', '--die-with-parent', '--new-session', '--cap-drop', 'ALL', '--ro-bind', root, '/', '--dev', '/dev', '--ro-bind', realpathSync(packageDir), '/package', '--ro-bind', realpathSync(executorDir), '/executor', '--ro-bind', realpathSync(logosDir), '/logos', '--ro-bind', realpathSync(compilerDir), '/compiler', '--chdir', '/package', '--', '/node'];
      packageDir = '/package';
      executorDir = '/executor';
      logosDir = '/logos';
      childPath = '/executor/child.js';
      compilerEntry = node_path_1.default.join('/compiler', node_path_1.default.relative(compilerDir, compilerEntry));
      compilerDir = '/compiler';
      env.LOGOS_ISOLATED_PACKAGE = packageDir;
      env.LOGOS_TYPE_LOADER = '/logos/kernel/type-source.js';
      env.LOGOS_TYPE_COMPILER = compilerEntry;
    }
    permissionArgs = [(nodeMajor >= 24 ? '--permission' : '--experimental-permission'), '--allow-fs-read='.concat(packageDir), '--allow-fs-read='.concat(executorDir), '--allow-fs-read='.concat(logosDir), '--allow-fs-read='.concat(compilerDir)];
    this.child = node_child_process_1.fork.call(void 0, childPath, [], {
      cwd: this.options.dir,
      env: env,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execPath: launcher,
      execArgv: launchArgs.concat(permissionArgs)
    });
    child = this.child;
    child.on('message', function(message) {
      if (_this.child == child) {
        _this.onMessage(message);
      }
    });
    child.once('exit', function(code, signal) {
      var _a, _b, expected;
      _a = void 0;
      _b = void 0;
      expected = !_this.timedOutChildren.has(child) && (_this.stopping || _this.child !== child);
      if (_this.child == child) {
        _this.onExit((signal ? 'child terminated ('.concat(signal, ')') : 'child exited'));
      }
      ((_b = (_a = _this.options).onExit) == null || _b == void 0 ? void 0 : _b.call(_a, {
        code: code,
        signal: signal,
        expected: expected,
        pid: child.pid
      }));
    });
    child.once('error', function(error) {
      if (_this.child == child) {
        _this.onExit(error.message);
      }
    });
    try {
      manifest = (await (this.request('start', {})));
      this.manifest = manifest;
      return manifest;
    } catch (error1) {
      error = error1;
      await this.stop('start_failed');
      throw error;
    }
  }

  invokeWithContext(id, args, context, signal) {
    var arg, index, omitted;
    // JSON IPC would turn omitted positional arguments into null.
    omitted = (function() {
      var i, len, results;
      results = [];
      for (index = i = 0, len = args.length; i < len; index = ++i) {
        arg = args[index];
        if (arg === void 0) {
          results.push(index);
        }
      }
      return results;
    })();
    return this.invoke(id, args, context, signal, omitted);
  }

  async invoke(id, args, context, signal, omitted) {
    if (false) {
      await void 0;
    }
    if (!this.running) {
      throw new Error('Isolated package "'.concat(this.options.folder, '" is not running'));
    }
    return this.request('invoke', {
      handler: id,
      args,
      context: context != null ? context : {},
      cancellable: signal != null,
      omitted
    }, signal);
  }

  async stop(reason) {
    var _a, child;
    if (reason == void 0) {
      reason = 'stopped';
    }
    if (false) {
      await void 0;
    }
    child = this.child;
    this.stopping = true;
    this.child = null;
    this.manifest = null;
    this.rejectAll(reason);
    if (!child || child.exitCode != null || child.signalCode != null) {
      return;
    }
    try {
      if (child.connected) {
        child.send({
          op: 'stop',
          reason: reason
        });
      }
    } catch (error1) {
      _a = error1;
    }
    /* already gone */
    await new Promise(function(resolve) {
      var timer;
      timer = setTimeout((function() {
        try {
          child.kill('SIGKILL');
        } catch (error1) {
          _a = error1;
        }
        /* ignored */
        resolve();
      }), 1000);
      child.once('exit', function() {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  request(op, payload, signal) {
    var child, id, runInContext;
    child = this.child;
    if (!(child != null ? child.connected : void 0)) {
      return Promise.reject(new Error('Isolated package "'.concat(this.options.folder, '" is not connected')));
    }
    if (signal != null ? signal.aborted : void 0) {
      return Promise.reject(signal.reason);
    }
    id = randomUUID();
    runInContext = AsyncLocalStorage.snapshot();
    return new Promise((resolve, reject) => {
      var abort, cancel, cleanup, error, ref, timer;
      cleanup = () => {
        clearTimeout(timer);
        if (signal != null) {
          signal.removeEventListener('abort', cancel);
        }
        return this.pending.delete(id);
      };
      abort = (error) => {
        cleanup();
        if ((signal != null) && child.connected) {
          try {
            child.send({
              op: 'cancel',
              id
            }, function() {});
          } catch (error1) {
            null;
          }
        }
        return reject(error);
      };
      cancel = function() {
        return abort(signal.reason);
      };
      timer = setTimeout((() => {
        var reason;
        reason = op + ' timed out';
        // Stop revokes every pending host scope before settling the calls.
        this.timedOutChildren.add(child);
        this.stop(reason);
      }), (ref = this.options.timeoutMs) != null ? ref : 30000);
      this.pending.set(id, {resolve, reject, cleanup, runInContext});
      if (signal != null) {
        signal.addEventListener('abort', cancel, {
          once: true
        });
      }
      try {
        return child.send(Object.assign({op, id}, payload), (error) => {
          if (error && this.pending.has(id)) {
            cleanup();
            return reject(error);
          }
        });
      } catch (error1) {
        error = error1;
        cleanup();
        return reject(error);
      }
    });
  }

  async onMessage(message) {
    var _l, _m, _o, child, error, pending, ref, ref1, ref2, response, scope;
    _l = void 0;
    _m = void 0;
    _o = void 0;
    if (false) {
      await void 0;
    }
    if (!message || typeof message != 'object') {
      return;
    }
    if ((ref = message.op) === 'event' || ref === 'capability') {
      child = this.child;
      scope = this.pending.get(message.invocation);
      response = {
        id: message.id
      };
      try {
        if (!scope) {
          throw new Error('Isolated request has no active host invocation');
        }
        response.result = (await scope.runInContext(() => {
          var base, base1;
          if (message.op === 'event') {
            return typeof (base = this.options).onEvent === "function" ? base.onEvent(message.event, message.payload) : void 0;
          } else {
            return typeof (base1 = this.options).onCapability === "function" ? base1.onCapability(message.request) : void 0;
          }
        }));
        response.op = message.op + ':result';
      } catch (error1) {
        error = error1;
        response.op = message.op + ':error';
        response.error = (ref1 = error != null ? error.message : void 0) != null ? ref1 : String(error);
      }
      if (this.child === child && (child != null ? child.connected : void 0)) {
        try {
          child.send(response, function() {});
        } catch (error1) {
          error = error1;
          child.send({
            op: message.op + ':error',
            id: message.id,
            error: error.message
          }, function() {});
        }
      }
      return;
    }
    if (message.op == 'log') {
      ((_m = (_l = this.options).onLog) == null || _m == void 0 ? void 0 : _m.call(_l, String(message.message)));
      return;
    }
    if ((ref2 = message.op) !== 'result' && ref2 !== 'error') {
      return;
    }
    pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    pending.cleanup();
    if (message.op == 'error') {
      pending.reject(new Error(((_o = message.error) != null && _o != void 0 ? _o : 'isolated package failed')));
    } else {
      pending.resolve(message.result);
    }
  }

  onExit(reason) {
    this.child = null;
    this.manifest = null;
    this.rejectAll(reason);
  }

  rejectAll(reason) {
    var pending;
    for (pending of this.pending.values()) {
      pending.cleanup();
      pending.reject(new Error('Isolated package "'.concat(this.options.folder, '": ').concat(reason)));
    }
  }

};

Object.defineProperty(IsolatedRunner.prototype, 'running', {
  get: function() {
    return Boolean(this.child && this.child.connected && !this.stopping);
  }
});

Object.defineProperty(IsolatedRunner.prototype, 'surfaces', {
  get: function() {
    return this.manifest;
  }
});

Object.defineProperty(IsolatedRunner.prototype, 'pid', {
  get: function() {
    var _a;
    _a = void 0;
    if ((_a = this.child) == null || _a == void 0) {
      return void 0;
    } else {
      return _a.pid;
    }
  }
});

exports.IsolatedRunner = IsolatedRunner;
