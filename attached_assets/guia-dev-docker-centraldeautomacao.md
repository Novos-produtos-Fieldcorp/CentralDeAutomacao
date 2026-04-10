# Guia de desenvolvimento rápido com Docker para CentralDeAutomacao

Este documento explica como configurar um ambiente de **desenvolvimento** mais rápido para o projeto CentralDeAutomacao usando Docker, sem precisar rodar `docker compose up --build` a cada alteração de código.

---

## Visão geral

Hoje o seu `Dockerfile` e `docker-compose.yml` estão configurados para **produção**:
- O `Dockerfile` roda `npm run build` e copia apenas a pasta `dist` para a imagem final.
- O container sobe o app já compilado, sem modo watch.
- Toda vez que você muda código, precisa rebuildar a imagem para ver a alteração.

Para desenvolvimento, vamos criar um fluxo separado, com:
- Container rodando em modo **dev**.
- Código fonte montado via **bind mount** (`volumes`).
- Servidores rodando em **watch/hot reload** (Vite dev server no frontend e watcher no backend).

O Dockerfile atual continua sendo usado para produção.

---

## Arquivos envolvidos

Você terá:

- `Dockerfile` (já existente) → **produção**.
- `docker-compose.yml` (já existente) → **produção**.
- `docker-compose.dev.yml` (novo) → **desenvolvimento**.
- `package.json` → onde configuramos os scripts de desenvolvimento.

---

## Passo 1 – Criar o docker-compose.dev.yml

Crie um arquivo `docker-compose.dev.yml` na raiz do projeto com o conteúdo base abaixo (ajustaremos se necessário, mas isso é um ponto de partida sólido):

```yaml
dervices:
  app:
    image: node:20-bookworm-slim
    container_name: central-automacao-dev
    working_dir: /app
    ports:
      - "5000:5000"   # Backend (Express)
      - "5173:5173"   # Frontend (Vite dev server)
      - "8000:8000"   # Serviço de IA em Python, se você quiser subir também
    env_file:
      - .env
    volumes:
      - .:/app          # Monta o código do host dentro do container
      - /app/node_modules  # Garante node_modules dentro do container
    command: sh -c "npm ci && npm run dev"
```

O que este arquivo faz:
- Usa a imagem oficial `node:20-bookworm-slim` para desenvolvimento.
- Monta o seu projeto local em `/app` dentro do container.
- Mantém um `node_modules` próprio dentro do container para evitar conflitos com o host.
- Executa `npm ci` (instala dependências) e depois `npm run dev`.

> Importante: este compose **não usa o Dockerfile de produção**. Ele é voltado apenas para desenvolvimento rápido.

---

## Passo 2 – Ajustar scripts de desenvolvimento no package.json

No seu `package.json`, você precisa ter scripts que:
- Rodem o backend em modo watch (por exemplo, com `tsx --watch` ou `nodemon`).
- Rodem o frontend com Vite em modo dev, expondo na porta 5173 para fora do container.

Um exemplo típico de scripts (você vai adaptar os nomes de arquivos/pastas ao seu projeto real):

```json
{
  "scripts": {
    "dev": "concurrently "npm:dev:server" "npm:dev:client"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite --host 0.0.0.0 --port 5173"
  }
}
```

Observações:
- `concurrently` permite rodar backend e frontend ao mesmo tempo com um único comando.
- `vite --host 0.0.0.0` é necessário para que o Vite dev server aceite conexões vindas de fora do container (se você não colocar isso, normalmente só responde para `localhost` dentro do container).
- Se você não usa `tsx` e sim `nodemon` ou outro, troque o comando de `dev:server` de acordo com sua stack.

Se ainda não tiver `concurrently` instalado:

```bash
npm i -D concurrently
```

### Sobre problemas de watch em Docker

Em alguns ambientes, o watcher não detecta alterações em volumes montados. Se isso acontecer:
- Use `nodemon` com flag `-L` (modo legacy/polling).
- Ou configure o watcher para usar polling (depende da ferramenta que você usa).

Um exemplo alternativo usando `nodemon`:

```json
{
  "scripts": {
    "dev": "concurrently "npm:dev:server" "npm:dev:client"",
    "dev:server": "nodemon -L server/index.ts",
    "dev:client": "vite --host 0.0.0.0 --port 5173"
  }
}
```

---

## Passo 3 – Subir o ambiente de desenvolvimento

Com o `docker-compose.dev.yml` criado e os scripts de dev configurados no `package.json`, o fluxo fica:

### Subir o ambiente dev

Na raiz do projeto, rode:

```bash
docker compose -f docker-compose.dev.yml up
```

Se quiser rodar em background (detached):

```bash
docker compose -f docker-compose.dev.yml up -d
```

No primeiro run, ele vai:
- baixar a imagem `node:20-bookworm-slim` (se ainda não estiver cacheada);
- instalar dependências com `npm ci` dentro do container;
- rodar `npm run dev`, que sobe backend + frontend em modo desenvolvimento.

### Acessar no navegador

- Frontend (Vite dev server): `http://localhost:5173`
- Backend (Express / API): `http://localhost:5000`
- Serviço de IA (se exposto em 8000): `http://localhost:8000`

Você desenvolve sempre apontando para essas URLs.

---

## Passo 4 – Ciclo de desenvolvimento (sem rebuild de imagem)

Depois que o ambiente dev está rodando (`docker compose -f docker-compose.dev.yml up`):

1. Abra o projeto no VS Code.
2. Faça uma alteração em qualquer arquivo de frontend (React/Vite) ou backend (Express/Node).
3. Salve o arquivo.
4. O código atualizado é automaticamente visto dentro do container via bind mount.
5. O Vite dev server faz hot reload da página ou o watcher do backend reinicia o servidor (dependendo da mudança).
6. Você vê a mudança no navegador **sem** precisar rodar `docker compose up --build`.

Ou seja, o rebuild de imagem fica reservado para situações específicas:
- mudar `package.json` / `package-lock.json` **em produção**;
- mudar o `Dockerfile` de produção;
- mudar dependências de sistema; etc.

No dia a dia de desenvolvimento de tela, rotas, handlers, componentes, CSS, etc., você só mexe no código e salva.

---

## Quando usar o Dockerfile + docker-compose.yml originais

O seu `Dockerfile` multi-stage e o `docker-compose.yml` original continuam sendo usados para:

- Testes de build de produção.
- Preparar imagens que vão para deploy.

Fluxo típico de produção:

```bash
docker compose up --build -d    # usando o docker-compose.yml normal
```

Fluxo típico de desenvolvimento rápido:

```bash
docker compose -f docker-compose.dev.yml up
```

Use sempre o compose **dev** enquanto estiver iterando no código; use o compose **prod** apenas quando quiser validar o build final ou preparar a imagem para deploy.

---

## Checklist rápido

1. Criar `docker-compose.dev.yml` com:
   - imagem `node:20-bookworm-slim`;
   - `volumes: - .:/app` e `- /app/node_modules`;
   - `command: sh -c "npm ci && npm run dev"`;
   - `ports` mapeando 5000, 5173 e 8000 se necessário.

2. Ajustar `package.json` para ter:
   - `"dev"` rodando backend + frontend em paralelo (com `concurrently` ou similar);
   - `"dev:client"` com `vite --host 0.0.0.0 --port 5173`;
   - `"dev:server"` com `tsx watch` ou `nodemon -L` apontando para seu entrypoint.

3. Subir o ambiente dev com:
   - `docker compose -f docker-compose.dev.yml up`.

4. Durante o desenvolvimento:
   - editar arquivos no VS Code;
   - salvar;
   - ver resultado em `localhost:5173` (frontend) e `localhost:5000` (API), sem rebuild de imagem.

Com isso, você passa a ter um ciclo de feedback rápido, estilo `npm run dev` local, mas dentro de Docker, e deixa o Dockerfile original focado em build de produção.
