'use strict';
var IsolatedRunner, __importDefault, node_child_process_1, node_path_1;

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

node_child_process_1 = require('node:child_process');

node_path_1 = __importDefault(require('node:path'));

IsolatedRunner = class IsolatedRunner {
  constructor(options) {
    this.child = null;
    this.pending = new Map();
    this.sequence = 0;
    this.stopping = false;
    this.manifest = null;
    this.options = options;
    return;
  }

  async start() {
    var __assign, _this, child, childPath, compilerDir, env, error, manifest, nodeMajor;
    __assign = function() {
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
    env = __assign(__assign({}, this.options.env), {
      LOGOS_TYPE_LOADER: node_path_1.default.join(node_path_1.default.dirname(require.resolve('logos')), 'kernel/type-source.js'),
      LOGOS_ISOLATED_PACKAGE: this.options.dir,
      LOGOS_ISOLATED_FOLDER: this.options.folder
    });
    compilerDir = node_path_1.default.dirname(require.resolve('logostype/package.json', {
      paths: [node_path_1.default.dirname(env.LOGOS_TYPE_LOADER)]
    }));
    env.LOGOS_TYPE_COMPILER = require.resolve('logostype', {
      paths: [node_path_1.default.dirname(env.LOGOS_TYPE_LOADER)]
    });
    // Permission mode denies filesystem writes, child processes and workers by
    // default. Reads cover the package, bootstrap and language implementation;
    // Module._load still denies package imports outside its own root.
    this.child = node_child_process_1.fork.call(void 0, childPath, [], {
      cwd: this.options.dir,
      env: env,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: [(nodeMajor >= 24 ? '--permission' : '--experimental-permission'), '--allow-fs-read='.concat(this.options.dir), '--allow-fs-read='.concat(node_path_1.default.dirname(childPath)), '--allow-fs-read='.concat(node_path_1.default.dirname(node_path_1.default.dirname(env.LOGOS_TYPE_LOADER))), '--allow-fs-read='.concat(compilerDir)]
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
      expected = _this.stopping || _this.child != child;
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
      var j, len, results;
      results = [];
      for (index = j = 0, len = args.length; j < len; index = ++j) {
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
    var child, id;
    child = this.child;
    if (!(child != null ? child.connected : void 0)) {
      return Promise.reject(new Error('Isolated package "'.concat(this.options.folder, '" is not connected')));
    }
    if (signal != null ? signal.aborted : void 0) {
      return Promise.reject(signal.reason);
    }
    id = String(++this.sequence);
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
        return abort(new Error('Isolated package "'.concat(this.options.folder, '" ').concat(op, ' timed out')));
      }), (ref = this.options.timeoutMs) != null ? ref : 30000);
      this.pending.set(id, {resolve, reject, cleanup});
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
    var result;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, error, pending, result;
    _a = void 0;
    _b = void 0;
    _c = void 0;
    _d = void 0;
    _e = void 0;
    _f = void 0;
    _g = void 0;
    _h = void 0;
    _j = void 0;
    _k = void 0;
    _l = void 0;
    _m = void 0;
    _o = void 0;
    if (false) {
      await void 0;
    }
    if (!message || typeof message != 'object') {
      return;
    }
    if (message.op == 'event') {
      try {
        result = (await ((_b = (_a = this.options).onEvent) == null || _b == void 0 ? void 0 : _b.call(_a, message.event, message.payload)));
        ((_c = this.child) == null || _c == void 0 ? void 0 : _c.send({
          op: 'event:result',
          id: message.id,
          result: result
        }));
      } catch (error1) {
        error = error1;
        ((_d = this.child) == null || _d == void 0 ? undefined : _d.send({
          op: 'event:error',
          id: message.id,
          error: ((_e = error === null || error === void 0 ? void 0 : error.message) != null && _e != void 0 ? _e : String(error))
        }));
      }
      return;
    }
    if (message.op == 'capability') {
      try {
        result = (await ((_g = (_f = this.options).onCapability) == null || _g == void 0 ? void 0 : _g.call(_f, message.request)));
        ((_h = this.child) == null || _h == void 0 ? void 0 : _h.send({
          op: 'capability:result',
          id: message.id,
          result: result
        }));
      } catch (error1) {
        error = error1;
        ((_j = this.child) == null || _j == void 0 ? undefined : _j.send({
          op: 'capability:error',
          id: message.id,
          error: ((_k = error === null || error === void 0 ? void 0 : error.message) != null && _k != void 0 ? _k : String(error))
        }));
      }
      return;
    }
    if (message.op == 'log') {
      ((_m = (_l = this.options).onLog) == null || _m == void 0 ? void 0 : _m.call(_l, String(message.message)));
      return;
    }
    pending = this.pending.get(String(message.id));
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
