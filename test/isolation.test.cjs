const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
// Plain-JS runner tests need only the host bootstrap paths. Full .type loading
// and real authority are exercised by the integration suite in Lógos.
if (!fs.existsSync(path.join(__dirname,'../node_modules/logos'))) {
 const fixture=path.join(__dirname,'support-host');
 fs.mkdirSync(path.join(fixture,'kernel'),{recursive:true});
 fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'logos',main:'index.cjs'}));
 fs.writeFileSync(path.join(fixture,'index.cjs'),'// Test host path only.\n');
 fs.mkdirSync(path.join(__dirname,'../node_modules'),{recursive:true});
 fs.symlinkSync(fixture,path.join(__dirname,'../node_modules/logos'),'dir');
}
const hasLogos=require.resolve('logos');
for(const [label,api] of [['original',require('./reference/runner.cjs')],['type',require('../runner.cjs')]]) {
 function fixture(t,source){const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'isolation-migrate-'));fs.writeFileSync(dir+'/package.json','{"name":"demo"}');fs.writeFileSync(dir+'/index.js',source);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
 const run=(name,fn)=>test(label+': '+name,{skip:!hasLogos || (label==='original' && Number(process.versions.node.split('.')[0])>=24)},fn);
 run('discovers and invokes declarations in child',async t=>{const dir=fixture(t,`exports.double=function(value){/** @register_tool double */return value*2;};`);const r=new api.IsolatedRunner({folder:'demo',dir,timeoutMs:3000});t.after(()=>r.stop());const m=await r.start();a.notEqual(r.pid,process.pid);a.equal(await r.invoke(m.tools[0].id,[21]),42);await a.rejects(r.invoke('unknown',[]),/Unknown/);await r.stop();a.equal(r.running,false);await a.rejects(r.invoke('x',[]),/not running/);});
 run('denies direct native access',async t=>{const dir=fixture(t,`require('node:fs');`);const r=new api.IsolatedRunner({folder:'demo',dir,timeoutMs:3000});t.after(()=>r.stop());await a.rejects(r.start(),/Native module access is denied/);});
 run('mediates events and capabilities',async t=>{const dir=fixture(t,`const l=require('logos');exports.read=async function(){/** @register_tool read */const value=await l.$('hello',3);return l.requestCapability({surface:'echo',value});};`);const r=new api.IsolatedRunner({folder:'demo',dir,timeoutMs:3000,onEvent:(name,payload)=>payload+1,onCapability:req=>req.value*2});t.after(()=>r.stop());const m=await r.start();a.equal(await r.invoke(m.tools[0].id,[]),8);});
 run('does not inherit arbitrary environment',async t=>{const dir=fixture(t,`exports.environment=function(){/** @register_tool environment */return {keys:Object.keys(process.env),fetch:typeof fetch};};`);const r=new api.IsolatedRunner({folder:'demo',dir,timeoutMs:3000,env:{PRIVATE_TEST:'hidden'}});t.after(()=>r.stop());const m=await r.start();a.deepEqual(await r.invoke(m.tools[0].id,[]),{keys:['NODE_ENV'],fetch:'undefined'});});
}
test('bridge memoizes authority and ignores regular packages',async()=>{const {createBridge}=require('../bridge.cjs');const run=()=>{};a.equal(createBridge(run),createBridge(run));a.equal(await createBridge(run).isolatedRunnerFor({},{}),null);});

test('request context and cancellation reach an isolated invocation', { timeout: 5000 }, async t => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'isolation-context-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo"}');
  fs.writeFileSync(path.join(dir, 'index.js'), `
    const { requestCapability } = require('logos');
    exports.observe = async function (value = 'default', ctx) {
      /** @register_tool observe */
      return [value, ctx.event, ctx.flowId, Object.isFrozen(ctx), ctx.signal.aborted];
    };
    exports.wait = async function (ctx) {
      /** @register_tool wait */
      await new Promise(resolve => {
        ctx.signal.addEventListener('abort', resolve, { once: true });
        requestCapability({ surface: 'ready' });
      });
      await requestCapability({ surface: 'cancelled' });
    };
  `);
  const signals = new Map();
  const listen = name => new Promise(resolve => signals.set(name, resolve));
  const runner = new (require('../runner.cjs').IsolatedRunner)({
    folder: 'demo', dir, timeoutMs: 3000,
    onCapability: ({ surface }) => signals.get(surface)?.(),
  });
  t.after(() => runner.stop());
  const manifest = await runner.start();
  const id = name => manifest.tools.find(tool => tool.name === name).id;
  const { signal } = new AbortController();
  const context = { event: 'demo::response:read', flowId: 'trace' };
  a.deepEqual(await runner.invokeWithContext(id('observe'), [undefined], context, signal),
    ['default', context.event, context.flowId, true, false]);

  const ready = listen('ready');
  const cancelled = listen('cancelled');
  const controller = new AbortController();
  const invocation = runner.invokeWithContext(id('wait'), [], context, controller.signal);
  await ready;
  const reason = new Error('request cancelled');
  controller.abort(reason);
  await a.rejects(invocation, error => error === reason);
  await cancelled;
  a.equal(runner.running, true);
});
