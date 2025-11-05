# Guia de Deployment - SalaAgenda

Este documento descreve como fazer deploy da aplicação SalaAgenda em produção.

## 🚀 Opções de Deploy

### 1. Netlify (Recomendado)
- Fácil configuração
- CI/CD automático
- SSL gratuito
- Bom para full-stack

### 2. Vercel
- Deploy automático
- Preview de PRs
- Analytics integrado
- Suporte a Edge Functions

### 3. AWS/DigitalOcean
- Total controle
- Mais complexo
- Infraestrutura personalizável

### 4. Heroku (Deprecated)
- Não recomendado (encerrado em 2022)

## 📋 Pré-requisitos para Deploy

- [ ] Código no repositório Git (GitHub, GitLab)
- [ ] Variáveis de ambiente configuradas
- [ ] Banco de dados em produção
- [ ] Domínio registrado
- [ ] SSL/TLS configurado

## 🔑 Variáveis de Ambiente em Produção

Create `.env.production`:

```env
# ========================================
# BANCO DE DADOS - Produção
# ========================================
DB_HOST=seu-host-rds.amazonaws.com
DB_USER=admin_user
DB_PASSWORD=senha_super_segura_aqui
DB_NAME=salaagenda_prod
DB_PORT=3306

# ========================================
# IA - OpenRouter
# ========================================
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# ========================================
# APP - Produção
# ========================================
APP_URL=https://seudominio.com
PORT=3000
NODE_ENV=production

# ========================================
# Email - SMTP
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-app

# ========================================
# Segurança
# ========================================
ADMIN_PASSWORD=nova-senha-super-segura
```

## 📊 Deploy no Netlify

### Passo 1: Preparar Repositório

```bash
# Garantir que tudo está commitado
git status

# Push para main/master
git push origin main
```

### Passo 2: Conectar Netlify

1. Acesse [https://netlify.com](https://netlify.com)
2. Clique "New site from Git"
3. Selecione seu repositório
4. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/spa`
   - **Functions**: `netlify/functions`

### Passo 3: Configurar Variáveis

1. Em Netlify, vá para "Site settings" → "Environment"
2. Adicione as variáveis do `.env.production`

### Passo 4: Configurar Banco de Dados

#### Opção A: AWS RDS

```bash
# 1. Criar instância RDS MySQL
aws rds create-db-instance \
  --db-instance-identifier salaagenda-prod \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password your-password

# 2. Obter endpoint
aws rds describe-db-instances \
  --db-instance-identifier salaagenda-prod \
  --query 'DBInstances[0].Endpoint.Address'

# 3. Atualizar .env no Netlify
DB_HOST=salaagenda-prod.xxxxx.us-east-1.rds.amazonaws.com
```

#### Opção B: PlanetScale (MySQL serverless)

```bash
# 1. Criar conta em planetscale.com
# 2. Criar novo banco de dados
# 3. Obter connection string
# 4. Usar em DB_HOST
```

#### Opção C: Supabase PostgreSQL

```bash
# Nota: SalaAgenda usa MySQL
# Seria necessário adaptar o código
```

### Passo 5: Deploy

1. Commit e push para main
2. Netlify faz deploy automaticamente
3. Acompanhe em "Deploys"
4. Acesse seu site em `seu-site.netlify.app`

### Passo 6: Configurar Domínio

1. Em Netlify, vá para "Domain settings"
2. Adicione seu domínio customizado
3. Atualize DNS ou use nameservers Netlify
4. SSL será configurado automaticamente

## 🔐 Configurações de Segurança

### 1. Alterar Credenciais Admin

Em produção, não use `admin/admin123`!

**Opção A: Variável de Ambiente**

```typescript
// server/index.ts
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Usar para validar login
```

**Opção B: Hash de Senha**

```typescript
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

### 2. HTTPS/SSL

```typescript
// Força redirecionamento para HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### 3. Rate Limiting

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100  // 100 requisições por IP
});

app.use('/api/', limiter);
```

### 4. CORS Restritivo

```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.APP_URL,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
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
# Em Netlify
Logs → Functions → Veja os logs

# Ou via Netlify CLI
netlify logs:tail
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
- **Database**: Monitore com CloudWatch (AWS)

## 🔄 CI/CD Pipeline

### GitHub Actions

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
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
      
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🔄 Rollback

### Se Deploy Falhou

```bash
# Em Netlify
1. Vá para "Deploys"
2. Selecione deploy anterior
3. Clique "Publish deploy"
```

### Se Erro em Produção

```bash
# Revert commit
git revert <commit-hash>
git push origin main

# Netlify fará deploy automaticamente
```

## 🗄️ Backup de Banco de Dados

### AWS RDS Automated Backups

```bash
# Configurar período de retenção
aws rds modify-db-instance \
  --db-instance-identifier salaagenda-prod \
  --backup-retention-period 30  # 30 dias
```

### Backup Manual

```bash
# Exportar dados
mysqldump -h rds-endpoint.amazonaws.com \
  -u admin -p salaagenda_prod > backup.sql

# Importar backup
mysql -h rds-endpoint.amazonaws.com \
  -u admin -p salaagenda_prod < backup.sql
```

## 📊 Performance

### Otimizações Recomendadas

1. **Database**
```sql
-- Adicionar índices
CREATE INDEX idx_booking_date ON bookings(date);
CREATE INDEX idx_booking_room ON bookings(room_id);
CREATE INDEX idx_booking_email ON bookings(client_email);
```

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
✅ **Solução**: Configure redirect rules

Em `netlify.toml`:
```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

### Banco de Dados Offline

❌ **Problema**: Conexão recusada
✅ **Solução**:
```bash
# Verificar credenciais
# Verificar security groups
# Verificar whitelist de IPs

# Testar conexão local
mysql -h host -u user -p -e "SELECT 1;"
```

### Email não envia

❌ **Problema**: Confirmações não chegam
✅ **Solução**:
```bash
# Verificar credenciais SMTP
# Verificar app passwords (Gmail)
# Verificar logs de erro
```

## 📋 Checklist de Deploy

- [ ] Código testado localmente
- [ ] TypeScript sem erros (`npm run typecheck`)
- [ ] Testes passando (`npm run test`)
- [ ] `.env.production` configurado
- [ ] Banco de dados em produção
- [ ] SSL/TLS ativado
- [ ] Email configurado
- [ ] Credenciais admin alteradas
- [ ] CORS configurado
- [ ] Rate limiting ativo
- [ ] Logs configurados
- [ ] Backup automatizado
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

- [Netlify Docs](https://docs.netlify.com)
- [Vercel Docs](https://vercel.com/docs)
- [AWS RDS](https://aws.amazon.com/rds)
- [PlanetScale](https://planetscale.com)

---

**Versão**: 1.0.0
**Última atualização**: 2024

Deploy com confiança! 🚀
