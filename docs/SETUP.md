# Guia de Instalação e Configuração

Este documento descreve como instalar, configurar e executar o SalaAgenda em diferentes ambientes.

## 📋 Pré-requisitos

### Obrigatórios
- **Node.js**: v22.0.0 ou superior
- **npm**: v10.0.0 ou superior

> Não é necessário nenhum servidor de banco de dados (nem solicitar instalação ao setor de TI): os dados ficam em um arquivo JSON criado automaticamente pela aplicação.

### Opcionais
- **Git**: Para clonar o repositório
- **VS Code**: Editor recomendado

## 🔧 Instalação

### Passo 1: Clonar o Repositório

```bash
git clone <repository-url>
cd salaagenda
```

### Passo 2: Instalar Dependências

```bash
npm install
```

> **Nota**: O projeto usa **npm** como gerenciador de pacotes (o `package-lock.json` é o lockfile oficial). Não use pnpm ou yarn para evitar lockfiles divergentes.

### Passo 3: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas informações:

```env
# ========================================
# ARMAZENAMENTO DE DADOS - Opcional
# ========================================
# Diretório onde o arquivo db.json é criado (padrão: ./data)
DATA_DIR=./data

# ========================================
# CONFIGURAÇÃO DA IA (Groq)
# ========================================
# Obrigatória para o chatbot funcionar — chave gratuita em https://console.groq.com/keys
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
# Modelo (opcional, padrão: llama-3.3-70b-versatile)
GROQ_MODEL=llama-3.3-70b-versatile

# ========================================
# CONFIGURAÇÃO DA APLICAÇÃO
# ========================================
APP_URL=http://localhost:8080
PORT=3000
NODE_ENV=development

# ========================================
# AUTENTICAÇÃO ADMIN
# ========================================
# Em desenvolvimento, o padrão é admin/admin123.
# Em produção, ADMIN_PASSWORD é OBRIGATÓRIA.
ADMIN_USERNAME=admin
ADMIN_PASSWORD=defina-uma-senha-forte

# ========================================
# VALIDAÇÃO DE EMAIL
# ========================================
# Domínios aceitos (subdomínios inclusos). Padrão: fiocruz.br,edu.br
ALLOWED_EMAIL_DOMAINS=fiocruz.br,edu.br

# ========================================
# CORS
# ========================================
# Origens permitidas, separadas por vírgula. Aberto se não definida.
# CORS_ORIGIN=https://seudominio.com

# ========================================
# EMAIL DE CONFIRMAÇÃO (SMTP)
# ========================================
# Servidor SMTP usado para enviar confirmações/cancelamentos.
SMTP_HOST=smtp.seuservidor.br
SMTP_PORT=587
SMTP_USER=usuario@dominio.br
SMTP_PASS=sua-senha-smtp
# true = exigir TLS (porta 465 usa TLS implícito automaticamente)
SMTP_TLS=true
# Remetente exibido nos emails (opcional)
EMAIL_FROM=SalaAgenda <nao-responda@dominio.br>
# Alternativa legada (usada apenas se SMTP_* não estiver definido):
# EMAIL_USER=conta@gmail.com + EMAIL_PASSWORD=senha-de-aplicativo-gmail

# ========================================
# PROCESSADOR DE EMAILS (IMAP) - Opcional
# ========================================
IOC_EMAIL_HOST=imap.gmail.com
IOC_EMAIL_PORT=993
IOC_EMAIL_USER=caixa-monitorada@dominio
IOC_EMAIL_PASSWORD=senha-de-aplicativo
IOC_EMAIL_FOLDER=INBOX
IOC_EMAIL_CHECK_INTERVAL=5
IOC_EMAIL_PROCESSING_ENABLED=false
```

### Passo 4: Armazenamento de Dados (automático)

Não há banco de dados para criar ou configurar. Na primeira execução, o servidor cria automaticamente o arquivo `data/db.json`, que guarda **todas** as salas, agendamentos e logs de email — inclusive salas iniciais de exemplo.

- **Localização**: por padrão, o diretório `./data` na raiz do projeto. Pode ser alterado pela variável de ambiente `DATA_DIR`.
- **Versionamento**: o diretório `data/` está no `.gitignore` — os dados não vão para o repositório.
- **Escrita segura**: as gravações são atômicas (arquivo temporário + rename), seguras para um único processo Node.
- **Backup**: basta copiar o arquivo `data/db.json`.

> Nada precisa "existir previamente": se o diretório ou o arquivo não existirem, eles são criados na primeira execução.

## 🚀 Executando a Aplicação

### Desenvolvimento

```bash
# Inicia servidor com reload automático
npm run dev

# Acesso (tudo em uma única porta — o Vite serve o SPA
# e monta o Express como middleware)
# - Aplicação: http://localhost:8080
# - Admin: http://localhost:8080/admin
# - API: http://localhost:8080/api
```

### Produção

```bash
# Build do projeto
npm run build

# Iniciar servidor
npm run start

# A aplicação estará em http://localhost:3000 (configurável via PORT)
```

## 📦 Scripts Disponíveis

```bash
npm run dev              # Iniciar desenvolvimento
npm run build           # Build para produção
npm run build:client    # Build apenas frontend
npm run build:server    # Build apenas backend
npm run start           # Iniciar aplicação em produção
npm run test            # Executar testes
npm run format.fix      # Formatar código (Prettier)
npm run typecheck       # Verificar tipos TypeScript
```

## 🔑 Credenciais do Painel Admin

As credenciais do painel administrativo são configuradas via variáveis de ambiente:

- **`ADMIN_USERNAME`**: usuário do admin (padrão: `admin`)
- **`ADMIN_PASSWORD`**: senha do admin — **obrigatória em produção**; em desenvolvimento, se não definida, usa o padrão `admin123` (apenas dev)

⚠️ **Importante**: Nunca use o padrão de desenvolvimento em produção. Defina uma senha forte em `ADMIN_PASSWORD`.

## 🗄️ Estrutura de Pastas

```
salaagenda/
├── client/                 # Frontend React
│   ├── components/        # Componentes React
│   │   ├── Chatbot.tsx   # Chatbot principal
│   │   ├── Header.tsx    # Cabeçalho
│   │   └── ui/           # Componentes UI (shadcn)
│   ├── pages/            # Páginas (rotas)
│   │   ├── Index.tsx     # Página inicial
│   │   ├── Admin.tsx     # Painel admin
│   │   ├── Login.tsx     # Página de login
│   │   └── NotFound.tsx  # 404
│   ├── context/          # Context API
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilidades
│   └── App.tsx           # Componente raiz
├── server/                 # Backend Express
│   ├── routes/           # Rotas da API
│   │   ├── ai.ts        # Endpoints IA
│   │   ├── bookings.ts  # Agendamentos
│   │   ├── rooms.ts     # Salas
│   │   └── chat.ts      # Chat (Groq)
│   ├── services/         # Serviços (email, etc)
│   ├── data.ts           # Lógica de dados (camada de dados)
│   ├── store.ts          # Armazenamento JSON (data/db.json)
│   └── index.ts          # Servidor Express
├── shared/                 # Código compartilhado
│   └── api.ts            # Tipos TypeScript
├── docs/                   # Documentação
├── package.json           # Dependências npm
├── tsconfig.json          # Configuração TypeScript
└── .env                   # Variáveis de ambiente
```

## 🔗 Dependências Principais

### Frontend
```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "@tanstack/react-query": "^5.84.2",
  "tailwindcss": "^3.4.17",
  "sonner": "^1.7.4",
  "lucide-react": "^0.539.0"
}
```

### Backend
```json
{
  "express": "^5.1.0",
  "nodemailer": "^7.0.10",
  "cors": "^2.8.5",
  "dotenv": "^17.2.1"
}
```

## 🧪 Testes

```bash
# Executar testes (vitest, arquivos *.spec.ts)
npm run test

# Watch mode
npm run test -- --watch
```

## 🔍 Verificação de Tipos

```bash
# Verificar tipos TypeScript
npm run typecheck

# Formatar código
npm run format.fix
```

## ⚠️ Solução de Problemas

### Erro ao criar/gravar o arquivo de dados
- Verifique se o processo tem permissão de escrita no diretório configurado em `DATA_DIR` (padrão: `./data`)
- Verifique se o disco não está cheio
- Se o diretório não existir, o servidor tenta criá-lo automaticamente na primeira execução

### Erro: "Serviço de IA não configurado no servidor"
- Obtenha uma chave gratuita em https://console.groq.com/keys
- Adicione como `GROQ_API_KEY` em seu arquivo `.env`

### Erro: "Port already in use"
```bash
# Em produção, mudar a porta em .env
PORT=3100

# Ou matar o processo que ocupa a porta (ex.: 8080 em dev)
lsof -ti:8080 | xargs kill -9
```

### Resetar os dados (começar do zero)
```bash
# 1. Parar o servidor

# 2. Remover o arquivo de dados
rm data/db.json   # (Windows: del data\db.json)

# 3. Reiniciar — o arquivo é recriado com as salas iniciais de exemplo
npm run dev
```

⚠️ Isso apaga **todas** as salas, agendamentos e logs. Faça uma cópia de `data/db.json` antes, se quiser preservar os dados.

## 📚 Próximas Etapas

1. Leia [USER_GUIDE.md](USER_GUIDE.md) para entender como usar
2. Leia [ADMIN_GUIDE.md](ADMIN_GUIDE.md) para gerenciar salas
3. Leia [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) para desenvolvimento
4. Leia [API.md](API.md) para integração

## 🆘 Suporte

Se encontrar problemas:
1. Verifique o console (Ctrl+Shift+J)
2. Consulte a seção "Solução de Problemas" acima
3. Verifique variáveis de ambiente (.env)
4. Verifique logs do servidor (terminal)

---

**Versão**: 1.0.0
**Última atualização**: 2026
