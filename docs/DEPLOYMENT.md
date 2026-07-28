# Guia de Deployment - SalaAgenda

Este documento descreve como fazer deploy da aplicação SalaAgenda em produção.

## 🚀 Opções de Deploy

### 1. Servidor Node.js com PM2/systemd (Recomendado)
- Suporta **todos** os recursos da aplicação, incluindo o processador de emails (IMAP/cron)
- Controle total do ambiente
- O arquivo de dados (`data/db.json`) persiste normalmente em disco, criado automaticamente na primeira execução

### 2. Netlify (Não recomendado)
- Serve apenas o SPA + API básica via função serverless
- ⚠️ **Limitações importantes** (veja seção dedicada abaixo):
  - O **armazenamento em arquivo não persiste** em ambiente serverless — o sistema de arquivos é efêmero e os dados (salas, agendamentos, logs) são **perdidos** entre invocações/cold starts
  - O processador de emails (IMAP/cron) **não funciona** em ambiente serverless
- O deploy de produção deve ser um servidor Node persistente (PM2/systemd) com `DATA_DIR` gravável e persistente

### 3. AWS/DigitalOcean (VPS)
- Mesmo modelo do deploy Node.js recomendado
- Infraestrutura personalizável

## 📋 Pré-requisitos para Deploy

- [ ] Código no repositório Git (GitHub, GitLab)
- [ ] Variáveis de ambiente configuradas
- [ ] Diretório de dados (`DATA_DIR`, padrão `./data`) em disco **persistente** e com **permissão de escrita** — o arquivo `db.json` é criado automaticamente na primeira execução
- [ ] Domínio registrado
- [ ] SSL/TLS configurado

## 🔑 Variáveis de Ambiente em Produção

Configure no ambiente do servidor (ou arquivo `.env`):

```env
# ========================================
# ARMAZENAMENTO DE DADOS - Opcional
# ========================================
# Diretório do arquivo db.json (padrão: ./data)
# Use um caminho em disco persistente e gravável
DATA_DIR=/opt/salaagenda/data

# ========================================
# IA - Groq (obrigatória para o chatbot)
# ========================================
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# ========================================
# APP - Produção
# ========================================
APP_URL=https://seudominio.com
PORT=3000
NODE_ENV=production

# ========================================
# AUTENTICAÇÃO ADMIN (OBRIGATÓRIA em produção)
# ========================================
ADMIN_USERNAME=admin
ADMIN_PASSWORD=senha-forte-e-unica

# ========================================
# VALIDAÇÃO DE EMAIL
# ========================================
# Domínios aceitos, separados por vírgula (subdomínios inclusos)
ALLOWED_EMAIL_DOMAINS=fiocruz.br,edu.br

# ========================================
# CORS
# ========================================
# Origens permitidas, separadas por vírgula. Aberto se não definida.
CORS_ORIGIN=https://seudominio.com

# ========================================
# EMAIL DE CONFIRMAÇÃO (SMTP)
# ========================================
SMTP_HOST=smtp.seuservidor.br
SMTP_PORT=587
SMTP_USER=usuario@dominio.br
SMTP_PASS=sua-senha-smtp
SMTP_TLS=true
EMAIL_FROM=SalaAgenda <nao-responda@dominio.br>

# ========================================
# PROCESSADOR DE EMAILS (IMAP) - Opcional
# ========================================
IOC_EMAIL_HOST=imap.gmail.com
IOC_EMAIL_PORT=993
IOC_EMAIL_USER=caixa-monitorada@dominio
IOC_EMAIL_PASSWORD=senha-de-aplicativo
IOC_EMAIL_FOLDER=INBOX
IOC_EMAIL_CHECK_INTERVAL=5
IOC_EMAIL_PROCESSING_ENABLED=true
```

⚠️ **`ADMIN_PASSWORD` é obrigatória em produção** — o servidor valida o login do painel admin com essas credenciais (`ADMIN_USERNAME`/`ADMIN_PASSWORD`). O fallback `admin123` existe apenas em desenvolvimento.

⚠️ **Envio de emails**: configure `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` (SMTP genérico — ex.: servidor institucional). Como alternativa legada, `EMAIL_USER`/`EMAIL_PASSWORD` usam Gmail com senha de aplicativo. `IOC_EMAIL_PASSWORD` (IMAP) segue exigindo senha de aplicativo se a caixa monitorada for Gmail. Não há valores padrão no código — sem essas variáveis, o envio/processamento de emails fica desabilitado.

## 🖥️ Deploy Recomendado: Servidor Node.js

### Passo 1: Build

```bash
# Instalar dependências
npm install

# Build para produção
npm run build
```

### Passo 2: Iniciar

#### Opção A: Direto

```bash
npm start
# Servidor em http://localhost:3000 (configurável via PORT)
```

#### Opção B: PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar com PM2
pm2 start dist/server/node-build.mjs --name "salaagenda"

# Auto-restart no boot do sistema
pm2 startup
pm2 save

# Logs
pm2 logs salaagenda
```

#### Opção C: systemd

```ini
# /etc/systemd/system/salaagenda.service
[Unit]
Description=SalaAgenda
After=network.target

[Service]
WorkingDirectory=/opt/salaagenda
ExecStart=/usr/bin/node dist/server/node-build.mjs
Restart=always
EnvironmentFile=/opt/salaagenda/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now salaagenda
```

#### Diretório de dados (obrigatório verificar)

Todos os dados (salas, agendamentos, logs de email) vivem no arquivo `db.json` dentro de `DATA_DIR` (padrão: `./data`, relativo ao diretório de trabalho do processo). Em produção:

- Use um **caminho absoluto** em disco persistente (ex.: `DATA_DIR=/opt/salaagenda/data`)
- Garanta que o usuário do serviço tem **permissão de escrita** nesse diretório
- O diretório e o arquivo são criados automaticamente na primeira execução, se não existirem
- Rode **uma única instância** do processo (as gravações são atômicas e seguras para um processo Node; não use `pm2 start -i` / modo cluster)

#### Backup

Backup = copiar o arquivo `db.json`. Recomenda-se uma cópia periódica via cron:

```bash
# Backup diário às 2h, mantendo a data no nome
0 2 * * * cp /opt/salaagenda/data/db.json /opt/backups/salaagenda/db-$(date +\%F).json
```

### Passo 3: Testar

```bash
# Health check
curl http://localhost:3000/api/ping

# Status do processador de emails (requer token de admin)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SUA_SENHA"}' | jq -r .token)

curl http://localhost:3000/api/email-processor/status \
  -H "Authorization: Bearer $TOKEN"
```

### Processador de Emails em Produção

Com `IOC_EMAIL_*` configuradas e `IOC_EMAIL_PROCESSING_ENABLED=true`, o sistema:

1. Verifica a caixa de entrada configurada periodicamente (intervalo em `IOC_EMAIL_CHECK_INTERVAL`, minutos)
2. Classifica os emails por **palavras-chave/regex** (pedido de reserva, pedido de informação, indefinido)
3. Cria a reserva automaticamente quando os dados estão completos, ou responde solicitando informações
4. Registra tudo nos logs de email armazenados em `data/db.json`

Os endpoints de gerenciamento (`/api/email-processor/*` — start, stop, status, logs, stats, test, manual-process) exigem autenticação Bearer. Veja [API.md](API.md).

## 📊 Deploy no Netlify (Não recomendado)

> ⚠️ **Leia antes**: o armazenamento em arquivo **não persiste** em ambiente serverless — o sistema de arquivos das funções é efêmero, então salas, agendamentos e logs seriam **perdidos** a cada invocação/cold start. Além disso, o processador de emails (IMAP/cron) **não funciona** em serverless (não há processos de longa duração). Por isso, o deploy Netlify **não é adequado para produção**: use um servidor Node.js persistente (PM2/systemd) com `DATA_DIR` em disco gravável e persistente, como descrito acima.

### Passo 1: Conectar Netlify

1. Acesse [https://netlify.com](https://netlify.com)
2. Clique "New site from Git"
3. Selecione seu repositório
4. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/spa`
   - **Functions**: `netlify/functions`

### Passo 2: Configurar Variáveis

1. Em Netlify, vá para "Site settings" → "Environment"
2. Adicione as variáveis de ambiente de produção (exceto as `IOC_EMAIL_*`, que não terão efeito)

### Passo 3: Lembre-se da limitação de persistência

Não há como apontar `DATA_DIR` para um disco persistente em funções serverless — os dados gravados serão descartados. Este caminho serve apenas para demonstrar o SPA, **não** para uso real em produção.

## 🔐 Configurações de Segurança

### 1. Credenciais Admin

A autenticação do painel admin é feita **no servidor**: `POST /api/auth/login` valida `ADMIN_USERNAME`/`ADMIN_PASSWORD` (variáveis de ambiente) e retorna um token com validade de 8 horas, enviado como `Authorization: Bearer <token>` nas rotas protegidas.

- Defina `ADMIN_PASSWORD` com uma senha forte e única (obrigatória em produção)
- Nunca reutilize a senha padrão de desenvolvimento

### 2. HTTPS/SSL

Use um proxy reverso (nginx/Caddy) com certificado TLS (Let's Encrypt) na frente do Node.js, ou force o redirecionamento:

```typescript
// Força redirecionamento para HTTPS (atrás de proxy)
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### 3. Rate Limiting

O endpoint `/api/chat` já possui um limitador de requisições em memória. Para proteger outras rotas de forma mais robusta, considere `express-rate-limit`:

```bash
npm install express-rate-limit
```

### 4. CORS

O CORS é configurável via variável de ambiente `CORS_ORIGIN` (lista de origens separadas por vírgula). Quando não definida, o CORS fica aberto — **defina em produção**:

```env
CORS_ORIGIN=https://seudominio.com
```

### 5. Headers de Segurança

```bash
npm install helmet
```

```typescript
import helmet from 'helmet';

app.use(helmet());
```

## 📈 Monitoramento em Produção

### Logs

```bash
# PM2
pm2 logs salaagenda

# systemd
journalctl -u salaagenda -f
```

### Erros

Use Sentry para monitorar:

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Métricas

- **Uptime**: Monitore com UptimeRobot
- **Performance**: Use Lighthouse
- **Dados**: Monitore o tamanho de `data/db.json` e o espaço em disco do servidor

## 🔄 CI/CD Pipeline

### GitHub Actions

Crie `.github/workflows/deploy.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm run test

      - name: Check types
        run: npm run typecheck

      - name: Build
        run: npm run build
```

Após o build, publique os artefatos no servidor (rsync/scp) e reinicie o serviço (`pm2 reload salaagenda`).

## 🔄 Rollback

### Se Erro em Produção

```bash
# Revert commit
git revert <commit-hash>
git push origin main

# Refazer build e reiniciar
npm run build
pm2 reload salaagenda
```

## 🗄️ Backup dos Dados

Todos os dados vivem em um único arquivo — fazer backup é simplesmente copiá-lo.

### Backup Manual

```bash
# Exportar dados
cp /opt/salaagenda/data/db.json backup-db.json

# Restaurar backup (com o servidor parado)
cp backup-db.json /opt/salaagenda/data/db.json
```

### Backup Automatizado

Agende uma cópia periódica via cron (diária/semanal):

```bash
0 2 * * * cp /opt/salaagenda/data/db.json /opt/backups/salaagenda/db-$(date +\%F).json
```

## 📊 Performance

### Otimizações Recomendadas

1. **Armazenamento de dados**

O armazenamento em arquivo JSON mantém os dados em memória e é adequado para o volume esperado (baixo volume, processo único) — não há índices nem tuning a fazer. Se o sistema crescer muito, a evolução natural é migrar para SQLite ou um banco gerenciado; a camada de dados (`server/data.ts`) é isolada, então a troca fica contida.

2. **Frontend**
```typescript
// Lazy loading
const Admin = lazy(() => import('./pages/Admin'));

// Code splitting
import { Suspense } from 'react';
```

3. **Caching**
```typescript
app.use(express.static('dist/spa', {
  maxAge: '1d'
}));
```

### Nota sobre o modelo de IA

O chatbot usa o **Groq** (tier gratuito) com o modelo `llama-3.3-70b-versatile`, configurável via `GROQ_MODEL`. O tier gratuito do Groq tem limites de requisições por minuto/dia — adequados para o volume esperado deste sistema. A classificação de emails do processador IMAP **não usa IA** — é baseada em palavras-chave/regex, sem custo por requisição.

## 🆘 Troubleshooting

### Deploy Falha

❌ **Problema**: Build falha
✅ **Solução**:
```bash
# Testar localmente
npm run build

# Verificar erros de tipo
npm run typecheck

# Limpar node_modules e reinstalar
rm -rf node_modules
npm install
npm run build
```

### Erro 404 em Produção

❌ **Problema**: Rotas não funcionam
✅ **Solução**: no deploy Node.js, o servidor já faz fallback do SPA. No Netlify, configure redirect rules em `netlify.toml`:
```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

### Erro ao gravar dados

❌ **Problema**: Falha ao criar/gravar `db.json`
✅ **Solução**:
```bash
# Verificar permissão de escrita no diretório de dados
ls -ld /opt/salaagenda/data

# Verificar espaço em disco
df -h

# Verificar o valor de DATA_DIR no .env (use caminho absoluto em produção)
```

### Email não envia

❌ **Problema**: Confirmações não chegam
✅ **Solução**:
```bash
# Verificar SMTP_HOST/SMTP_USER/SMTP_PASS (ou EMAIL_USER/EMAIL_PASSWORD no modo Gmail)
# Verificar porta e TLS (587 com SMTP_TLS=true, ou 465 com TLS implícito)
# Verificar logs de erro
```

### Processador de emails não roda

❌ **Problema**: Emails da caixa monitorada não são processados
✅ **Solução**:
- Verifique `IOC_EMAIL_*` (host, porta, usuário, senha de aplicativo)
- Verifique `IOC_EMAIL_PROCESSING_ENABLED=true`
- Confira o status via `GET /api/email-processor/status` (com token admin)
- Lembre-se: não funciona em deploy serverless (Netlify)

## 📋 Checklist de Deploy

- [ ] Código testado localmente
- [ ] TypeScript sem erros (`npm run typecheck`)
- [ ] Testes passando (`npm run test`)
- [ ] Variáveis de ambiente configuradas
- [ ] `ADMIN_PASSWORD` forte definida
- [ ] `CORS_ORIGIN` definido
- [ ] `ALLOWED_EMAIL_DOMAINS` conferido
- [ ] `DATA_DIR` em disco persistente e com permissão de escrita
- [ ] SSL/TLS ativado
- [ ] Email configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)
- [ ] Logs configurados
- [ ] Backup automatizado (cópia periódica de `db.json`)
- [ ] Domínio apontando corretamente
- [ ] Teste de acesso da aplicação
- [ ] Teste de agendamento completo

## 📚 Próximas Etapas

1. Monitore aplicação em produção
2. Configure alertas para erros
3. Revise logs regularmente
4. Faça backups semanais
5. Planeje atualizações de segurança

## 🔗 Recursos

- [PM2 Docs](https://pm2.keymetrics.io/docs)
- [Netlify Docs](https://docs.netlify.com)
- [systemd Docs](https://www.freedesktop.org/wiki/Software/systemd/)

---

**Versão**: 1.0.0
**Última atualização**: 2026

Deploy com confiança! 🚀
