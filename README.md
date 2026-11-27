# @thinkiac/module-isolated-runtime

Executa pacotes em processos separados com acesso mediado às capacidades.

Fontes em LógosType (`src/*.type`); JavaScript gerado em `dist/`. Entradas CommonJS preservam imports e descoberta declarativa. Migração de linguagem e distribuição, sem novos recursos.

## Instalação

```sh
npm install ThinkIac/isolated-runtime#main
```

Para reproduzir uma instalação, substitua main pelo hash do commit. Requer Node 22 ou superior. Não foi validado em QuickJS ou ESP32.

## API e funcionamento

Exporta IsolatedRunner e provideIsolation(host); bridge.cjs exporta createBridge(runAsPackage). O provedor isolation inicia na fase boot. Mantém start, invoke, stop e os getters running, surfaces e pid.

```text
pacote isolated → fork com permissões → manifesto de handlers → IPC → evento/capacidade autorizada no processo pai.
```

O pai não importa o código do pacote. O filho descobre declarações e fornece identificadores opacos para invoke. O bootstrap restringe leitura ao pacote e às bibliotecas de inicialização; nega módulos nativos e addons ao código do pacote e oferece uma fachada logos por IPC. O ambiente não herda credenciais arbitrárias e fetch é removido. O bridge executa pedidos sob autoridade do pacote e seleciona provedores em runtime:capabilities. Staging usa AsyncLocalStorage; stop limpa chamadas pendentes e termina o filho. Isso preserva o modelo existente de permissões Node; não é uma garantia de isolamento contra todas as técnicas de código hostil.

## Exemplo

```js
const { IsolatedRunner } = require('@thinkiac/module-isolated-runtime');
const runner = new IsolatedRunner({
  folder: 'sample', dir: '/app/packages/sample',
  onCapability: request => authorizedProvider(request)
});
try {
  const manifest = await runner.start();
  const result = await runner.invoke(manifest.tools[0].id, [21]);
  console.log(result);
} finally { await runner.stop(); }
```

## Desenvolvimento

```sh
npm ci
npm test
npm run build
```

O build usa [LogosType](https://github.com/ThinkIac/LogosType) fixado por commit. A distribuição inclui JS compilado para uso sem compilador em produção. prepare recompila ao instalar pelo Git. Dependências entre módulos usam repositórios fixados, sem caminhos vizinhos.

[Contratos e migração](docs/contracts.md). MIT.

### Linux isolation for untrusted packages

Set `LOGOS_ISOLATED_SANDBOX_ROOT` in the host service environment to an
administrator-managed minimal root filesystem. It must contain `/node`
(the same Node release as the host), its dynamic loader and shared libraries,
and empty directories `/dev`, `/package`, `/executor`, `/logos`, and
`/compiler`. Each directory must be a real directory. Install Bubblewrap at
`/usr/bin/bwrap` and enable user namespaces on that host.

The existing isolated runner mounts this root and the package, runner,
Lógos bootstrap, and compiler read-only. Deploy only code and assets intended
for the sandbox in these directories. The child receives a private PID, network,
IPC and UTS namespace, minimal devices and a filtered environment. Direct
filesystem writes, subprocesses, native modules and further user namespaces
are denied. Use host-authorized IPC capabilities for access to files, network,
processes and credentials. A capability provider should perform the operation
on behalf of the package and return only the intended result.

A configured sandbox that cannot launch fails package startup. The runner keeps
the existing host-owned IPC scopes and retires the process on timeout. The PID
namespace and parent-death handling contain the service lifecycle. Without
this setting, the permission-limited process is intended for trusted packages.
Same-process packages have the privileges of the host process.

Adopt the Linux mode first on a staging host and verify each application's
mediated capabilities before enabling it in production. The sandbox shares
the host kernel and does not impose CPU or memory quotas. Use service-level
resource limits and keep the kernel and Node patched.
