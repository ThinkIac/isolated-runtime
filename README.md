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
