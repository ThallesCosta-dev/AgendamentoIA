# Guia de Instalação e Configuração

Este documento descreve como instalar, configurar e executar o SalaAgenda em diferentes ambientes.

## 📋 Pré-requisitos

### Obrigatórios
- **Node.js**: v22.0.0 ou superior
- **npm**: v10.0.0 ou superior (ou pnpm v10.14.0+)
- **MySQL**: v8.0 ou superior

### Opcionais
- **Git**: Para clonar o repositório
- **VS Code**: Editor recomendado
- **MySQL Workbench**: Para gerenciar banco de dados

## 🔧 Instalação

### Passo 1: Clonar o Repositório

```bash
git clone <repository-url>
cd salaagenda
```

### Passo 2: Instalar Dependências

```bash
# Com npm
npm install

# Ou com pnpm (recomendado)
pnpm install

# Ou com yarn
yarn install
```

### Passo 3: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas informações:

```env
# ========================================
# CONFIGURAÇÃO DO BANCO DE DADOS
# ========================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=salaagenda
DB_PORT=3306

# ========================================
# CONFIGURAÇÃO DA IA (OpenRouter)
# ========================================
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# ========================================
# CONFIGURAÇÃO DA APLICAÇÃO
# ========================================
APP_URL=http://localhost:5173
PORT=3000
NODE_ENV=development

# ========================================
# EMAIL (Opcional - para confirmações)
# ========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-app-google
```

### Passo 4: Configurar Banco de Dados

#### Opção A: MySQL Local

```bash
# 1. Abrir MySQL CLI
mysql -u root -p

# 2. Criar banco de dados
CREATE DATABASE salaagenda;
CREATE USER 'salaagenda_user'@'localhost' IDENTIFIED BY 'senha_segura';
GRANT ALL PRIVILEGES ON salaagenda.* TO 'salaagenda_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Opção B: Usando MySQL Docker

```bash
docker run --name mysql-salaagenda \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=salaagenda \
  -p 3306:3306 \
  -d mysql:8.0
```

### Passo 5: Inicializar Banco de Dados

O banco será criado automaticamente ao iniciar o servidor. As tabelas são geradas no primeiro acesso.

## 🚀 Executando a Aplicação

### Desenvolvimento

```bash
# Inicia servidor com reload automático
npm run dev

# Acesso
# - Frontend: http://localhost:5173
# - Backend: http://localhost:3000
# - API: http://localhost:3000/api
```

### Produção

```bash
# Build do projeto
npm run build

# Iniciar servidor
npm run start

# A aplicação estará em http://localhost:3000
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

## 🔑 Primeiras Credenciais

Ao iniciar a aplicação, use as seguintes credenciais para acessar o painel admin:

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **Importante**: Altere essas credenciais em produção! Veja o guia de segurança.

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
│   │   └── chat.ts      # Chat (OpenRouter)
│   ├── services/         # Serviços (email, etc)
│   ├── data.ts           # Lógica de dados
│   ├── db.ts             # Conexão MySQL
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
  "mysql2": "^3.15.3",
  "nodemailer": "^7.0.10",
  "cors": "^2.8.5",
  "dotenv": "^17.2.1"
}
```

## 🧪 Testes

```bash
# Executar testes
npm run test

# Com coverage
npm run test -- --coverage

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

### Erro: "Can't connect to MySQL server"
```bash
# Verificar se MySQL está rodando
# Linux/Mac
sudo systemctl status mysql

# Windows
sc query MySQL80

# Ou usar Docker
docker start mysql-salaagenda
```

### Erro: "OPENROUTER_API_KEY not configured"
- Obtenha uma chave em https://openrouter.ai/
- Adicione em seu arquivo `.env`

### Erro: "Port 3000 already in use"
```bash
# Mudar a porta em .env
PORT=3001

# Ou matar o processo
lsof -ti:3000 | xargs kill -9
```

### Banco de dados não sincroniza
```bash
# Deletar e recrie o banco
DROP DATABASE salaagenda;
CREATE DATABASE salaagenda;

# Reiniciar servidor (será criado automaticamente)
npm run dev
```

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
**Última atualização**: 2024
