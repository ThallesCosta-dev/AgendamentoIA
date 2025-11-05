# Guia para Desenvolvedores - SalaAgenda

Este guia descreve como desenvolver, estender e manter a aplicação SalaAgenda.

## 🏗️ Arquitetura Geral

```
┌──────────────────���──────────────────────┐
│         Cliente (React/TypeScript)      │
│  ┌──────────────────────────────────┐  │
│  │ Chatbot | Admin Panel | Pages    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                   ↓
          (HTTP REST API)
                   ↓
┌─────────────────────────────────────────┐
│      Servidor (Express/Node.js)         │
│  ┌──────────────────────────────────┐  │
│  │ Routes | Services | Logic        │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│      Banco de Dados (MySQL)             │
│  ┌──────────────────────────────────┐  │
│  │ Rooms | Bookings | Logs          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 📂 Estrutura do Projeto

```
salaagenda/
├── client/
│   ├── components/
│   │   ├── Chatbot.tsx          # Componente principal do chatbot
│   │   ├── Header.tsx           # Cabeçalho com navegação
│   │   ├── ProtectedRoute.tsx   # Wrapper para rotas protegidas
│   │   └── ui/                  # Componentes shadcn/ui
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── card.tsx
│   │       └── ... (outros componentes)
│   ├── context/
│   │   └── AuthContext.tsx      # Context para autenticação
│   ├── hooks/
│   │   ├── use-mobile.tsx       # Hook para responsividade
│   │   └── use-toast.ts         # Hook para notificações
│   ├─��� lib/
│   │   └── utils.ts             # Funções utilitárias
│   ├── pages/
│   │   ├── Index.tsx            # Página inicial (chatbot)
│   │   ├── Admin.tsx            # Painel administrativo
│   │   ├── Login.tsx            # Página de login
│   │   └── NotFound.tsx         # Página 404
│   ├── App.tsx                  # Componente raiz
│   ├── global.css               # Estilos globais
│   └── vite-env.d.ts           # Tipos Vite
│
├── server/
│   ├── routes/
│   │   ├── ai.ts                # Endpoints de IA
│   │   ├── bookings.ts          # Endpoints de agendamentos
│   │   ├── rooms.ts             # Endpoints de salas
│   │   ├── chat.ts              # Integração com OpenRouter
│   │   ├── demo.ts              # Rota demo
│   │   └── index.ts             # Configuração de rotas
│   ├── services/
│   │   └── email.ts             # Serviço de envio de email
│   ├── data.ts                  # Operações de banco de dados
│   ├── db.ts                    # Conexão MySQL
│   ├── index.ts                 # Aplicação Express
│   └── node-build.ts            # Entry point produção
│
├── shared/
│   └── api.ts                   # Tipos TypeScript compartilhados
│
├── docs/                        # Documentação
├── public/                      # Arquivos estáticos
├── package.json                 # Dependências
├── tsconfig.json                # Configuração TypeScript
├── vite.config.ts               # Configuração Vite (frontend)
└── vite.config.server.ts        # Configuração Vite (backend)
```

## 🔧 Setup para Desenvolvimento

### 1. Clonar e Instalar

```bash
git clone <repository>
cd salaagenda
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar exemplo
cp .env.example .env

# Editar com suas configurações
nano .env  # ou seu editor preferido
```

### 3. Iniciar Desenvolvimento

```bash
npm run dev
```

Isso inicia:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Ambos com hot reload automático

## 💡 Fluxo de Desenvolvimento

### 1. Criar Nova Feature

```bash
# 1. Criar branch
git checkout -b feature/sua-feature

# 2. Desenvolver
# Editar arquivos

# 3. Testar
npm run test

# 4. Verificar tipos
npm run typecheck

# 5. Formatar código
npm run format.fix

# 6. Commit
git add .
git commit -m "feat: descrição da feature"

# 7. Push
git push origin feature/sua-feature

# 8. Pull request
# Abrir PR no GitHub/GitLab
```

### 2. Tipos de Mudanças

#### Frontend (React)
- Arquivos em `client/`
- Altera��ões em `client/pages/` para novas rotas
- Alterações em `client/components/` para novos componentes

#### Backend (Express)
- Arquivos em `server/`
- Novas rotas em `server/routes/`
- Novos serviços em `server/services/`

#### Banco de Dados
- Alterações em `server/data.ts`
- Schema em `server/db.ts`

#### Tipos Compartilhados
- Alterações em `shared/api.ts`

## 📝 Convenções de Código

### TypeScript

```typescript
// ✅ Bom: Tipos explícitos
const greet = (name: string): string => {
  return `Hello, ${name}!`;
};

// ❌ Ruim: Types implícitos
const greet = (name) => {
  return `Hello, ${name}!`;
};
```

### Componentes React

```typescript
// ✅ Bom: Componente funcional com tipos
import { FC } from 'react';

interface GreetProps {
  name: string;
  age?: number;
}

const Greet: FC<GreetProps> = ({ name, age }) => {
  return <div>Hello {name}</div>;
};

export default Greet;

// ❌ Ruim: Sem tipos
const Greet = ({ name, age }) => {
  return <div>Hello {name}</div>;
};
```

### Nomes de Arquivos

- **Componentes**: PascalCase (`Header.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useAuth.ts`)
- **Utilitários**: camelCase (`utils.ts`)
- **Tipos**: Use `api.ts` para tipos compartilhados

### Nomes de Variáveis

```typescript
// ✅ Bom
const isLoading = true;
const userData = {...};
const handleClick = () => {};
const getUserById = (id) => {};

// ❌ Ruim
const loading = true;
const data = {...};
const onclick = () => {};
const get_user = (id) => {};
```

## 🔌 Adicionando Nova Feature: Exemplo Passo a Passo

### Objetivo: Adicionar campo "Equipment" ao agendamento

#### Passo 1: Atualizar Tipos (shared/api.ts)

```typescript
export interface Booking {
  // ... outros campos
  equipment?: string;  // NOVO
}

export interface CreateBookingRequest {
  // ... outros campos
  equipment?: string;  // NOVO
}
```

#### Passo 2: Atualizar Banco de Dados (server/db.ts)

```typescript
// No schema de bookings, adicionar coluna
await connection.execute(`
  ALTER TABLE bookings ADD COLUMN equipment VARCHAR(255);
`);
```

#### Passo 3: Atualizar Data Layer (server/data.ts)

```typescript
export async function createBooking(
  booking: Omit<Booking, "id" | "createdAt">,
): Promise<Booking> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO bookings (..., equipment) VALUES (..., ?)`,
      [...values, booking.equipment],
    );
    // ... resto do código
  } finally {
    connection.release();
  }
}
```

#### Passo 4: Atualizar Rotas (server/routes/bookings.ts)

```typescript
export const handleCreateBooking: RequestHandler = async (req, res) => {
  const { equipment } = req.body;
  
  // ... validações existentes
  
  const booking = await createBooking({
    // ... outros campos
    equipment,
  });
  
  // ... resto do código
};
```

#### Passo 5: Atualizar Frontend (client/components/Chatbot.tsx)

```typescript
const [formData, setFormData] = useState({
  // ... outros campos
  equipment: "",  // NOVO
});

// Extrair equipment do texto
const extractDataFromText = (text: string) => {
  // ... código existente
  
  const equipmentMatch = text.match(
    /(?:equipment|equipamento|preciso de|projetor|quadro|microfone)/i
  );
  if (equipmentMatch) {
    data.equipment = equipmentMatch[0];
  }
};
```

#### Passo 6: Testar

```bash
npm run test
npm run typecheck
npm run format.fix
npm run dev
```

## 🔐 Segurança

### Boas Práticas

1. **Validação de Entrada**
```typescript
// ✅ Validar dados do usuário
if (!email.endsWith('.edu.br')) {
  throw new Error('Email must be institutional');
}

// ❌ Não confiar em input do usuário
const email = req.body.email;  // Usar diretamente é inseguro
```

2. **Proteção de Rotas**
```typescript
// ✅ Proteger rotas admin
<ProtectedRoute>
  <Admin />
</ProtectedRoute>

// ❌ Não exigir autenticação
<Route path="/admin" element={<Admin />} />
```

3. **Senhas**
```typescript
// ✅ Usar hash (bcrypt, argon2)
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(password, 10);

// ❌ Armazenar em plaintext
const password = 'admin123';  // NUNCA FAZER!
```

4. **SQL Injection Prevention**
```typescript
// ✅ Usar prepared statements
connection.execute('SELECT * FROM users WHERE id = ?', [userId]);

// ❌ String concatenation
connection.execute(`SELECT * FROM users WHERE id = ${userId}`);
```

## 🧪 Testando

### Testes Unitários

```bash
npm run test
```

Arquivos de teste: `**/*.spec.ts`

```typescript
// Exemplo: lib/utils.spec.ts
import { describe, it, expect } from 'vitest';
import { sum } from './utils';

describe('sum', () => {
  it('should add two numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });
});
```

### Testes Manuais

1. **Frontend**: F12 → Console para erros
2. **Backend**: Terminal mostrará logs
3. **API**: Postman ou cURL

## 🔄 Git Workflow

### Branches

```
main                    # Produção
  ├── develop          # Staging
  │   ├── feature/auth
  │   ├── feature/bookings
  │   └── bugfix/email
  └── hotfix/security
```

### Commits

```
feat: adicionar novo campo equipment
fix: corrigir validação de email
docs: atualizar README
style: formatar código
refactor: reorganizar componente
test: adicionar testes para bookings
chore: atualizar dependências
```

## 📦 Dependências

### Adicionar Nova Dependência

```bash
# Frontend
npm install --save react-something

# Backend
npm install --save express-something

# Dev
npm install --save-dev @types/node
```

### Remover Dependência

```bash
npm uninstall package-name
```

### Atualizar Dependências

```bash
# Verificar atualizações
npm outdated

# Atualizar
npm update

# Major version
npm install package@latest
```

## 🚀 Deploy

### Build

```bash
# Build completo
npm run build

# Apenas frontend
npm run build:client

# Apenas backend
npm run build:server
```

### Verificar Build

```bash
# Tamanho
npm run build
du -sh dist/

# Tipos
npm run typecheck
```

## 🐛 Debugging

### VS Code

1. Instale extensão Debugger for Chrome
2. Configure `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/client"
    }
  ]
}
```

### Console

```javascript
// Frontend (F12)
console.log('debug info', variable);
console.error('error:', error);

// Backend (Terminal)
console.log('Server started on port 3000');
```

## 📚 Documentação de Código

### JSDoc

```typescript
/**
 * Calcula a idade de uma pessoa
 * @param birthYear Ano de nascimento
 * @returns Idade em anos
 */
function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}
```

### Comentários Úteis

```typescript
// ❌ Ruim
const x = 5;  // Variável x

// ✅ Bom
const maxRetries = 5;  // Máximo de tentativas antes de falhar
```

## 🔗 Recursos Úteis

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Express Docs](https://expressjs.com)
- [MySQL Docs](https://dev.mysql.com/doc)
- [Tailwind CSS](https://tailwindcss.com)

## 📞 Contato e Suporte

Para dúvidas sobre desenvolvimento:
1. Consulte esta documentação
2. Verifique exemplos no código existente
3. Abra uma issue no repositório

---

**Versão**: 1.0.0
**Última atualização**: 2024

Happy coding! 🎉
