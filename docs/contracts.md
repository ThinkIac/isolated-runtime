# Contratos e migração

## Comportamento preservado

Exporta IsolatedRunner e provideIsolation(host); bridge.cjs exporta createBridge(runAsPackage). O provedor isolation inicia na fase boot. Mantém start, invoke, stop e os getters running, surfaces e pid.

O pai não importa o código do pacote. O filho descobre declarações e fornece identificadores opacos para invoke. O bootstrap restringe leitura ao pacote e às bibliotecas de inicialização; nega módulos nativos e addons ao código do pacote e oferece uma fachada logos por IPC. O ambiente não herda credenciais arbitrárias e fetch é removido. O bridge executa pedidos sob autoridade do pacote e seleciona provedores em runtime:capabilities. Staging usa AsyncLocalStorage; stop limpa chamadas pendentes e termina o filho. Isso preserva o modelo existente de permissões Node; não é uma garantia de isolamento contra todas as técnicas de código hostil.

## Fronteira da plataforma

A migração mantém APIs Node onde a implementação original as utiliza. O formato .type não elimina dependências de processos, threads, sistema de arquivos ou IPC. Uma implementação embarcada exigirá outro adaptador com os mesmos contratos e uma validação específica.

## Distribuição

src contém a implementação editável. scripts/build.cjs compila recursivamente para dist; arquivos na raiz e em compat são fachadas CommonJS. O bootstrap child.js ou cpu-worker.js, quando presente, continua no pacote. Não editar dist diretamente.

## Validação

Testes em test/*.test.cjs exercitam a implementação original congelada em test/reference e a implementação .type com os mesmos cenários. Não representam prova de equivalência para toda entrada possível. Testes de integração no Lógos verificam autoridade, isolamento, reload e distribuição independente com a composição real.

## Integração

A base usa @thinkiac/module-isolated-runtime fixado por commit. As entradas antigas podem encaminhar a esse pacote. createRuntimeModule permanece apenas como alias de compatibilidade; os comentários @register do provedor continuam sendo descobertos no código compilado.

## Node 24

Node 24 removeu o alias --experimental-permission. A implementação migrada usa --permission nessa versão e preserva o flag antigo em Node 22. Na matriz Node 24, quatro testes do original são ignorados por essa incompatibilidade do original; os quatro testes equivalentes da implementação .type continuam obrigatórios. Em Node 22, ambas as implementações são testadas.
