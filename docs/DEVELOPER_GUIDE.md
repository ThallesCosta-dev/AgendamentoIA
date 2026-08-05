# Guia para Desenvolvedores - SalaAgenda

Este guia descreve como desenvolver, estender e manter a aplicação SalaAgenda.

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────┐
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
│  Armazenamento em Arquivo (data/db.json)│
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
│   ├── lib/
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
│   │   ├── chat.ts              # Integração com Groq (LLM)
│   │   └── index.ts             # Configuração de rotas
│   ├── services/
│   │   └── email.ts             # Serviço de envio de email
│   ├── data.ts                  # Camada de dados (API estável)
│   ├── store.ts                 # Armazenamento JSON (data/db.json)
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

Isso inicia **tudo em uma única porta** — o Vite serve o SPA e monta o Express como middleware (não há porta separada de backend em desenvolvimento):

- Aplicação + API: http://localhost:8080
- Hot reload automático (frontend e backend)

> **Sem banco de dados**: não há nada para instalar ou provisionar. O arquivo de dados (`data/db.json`) é criado automaticamente na primeira execução, com salas iniciais de exemplo. Para começar do zero, basta apagar o arquivo e reiniciar. O diretório é configurável via `DATA_DIR` (padrão: `./data`) e está no `.gitignore`.

> Em produção (`npm run build` + `npm start`), o servidor Node roda na porta 3000 (configurável via `PORT`).

> **Gerenciador de pacotes**: use **npm** (o lockfile oficial é o `package-lock.json`).

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
- Alterações em `client/pages/` para novas rotas
- Alterações em `client/components/` para novos componentes

#### Backend (Express)
- Arquivos em `server/`
- Novas rotas em `server/routes/`
- Novos serviços em `server/services/`

#### Dados
- Camada de dados (API estável usada pelas rotas): `server/data.ts`
- Armazenamento JSON (leitura/escrita atômica de `data/db.json`): `server/store.ts`

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

#### Passo 2: Armazenamento — nada a fazer

Não há schema nem migração: o campo novo passa a ser gravado em `data/db.json` assim que a camada de dados o incluir no objeto persistido. Registros antigos (sem o campo) continuam válidos.

#### Passo 3: Atualizar Data Layer (server/data.ts)

```typescript
export async function createBooking(
  booking: Omit<Booking, "id" | "createdAt">,
): Promise<Booking> {
  // Incluir booking.equipment no objeto persistido —
  // o store (server/store.ts) grava o data/db.json
  // de forma atômica (arquivo temporário + rename)
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
// ✅ Validar dados do usuário contra a lista de domínios permitidos
// (ALLOWED_EMAIL_DOMAINS, padrão "fiocruz.br,edu.br", subdomínios aceitos)
if (!isAllowedEmailDomain(email)) {
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

4. **Acesso a Dados**
```typescript
// ✅ Sempre passar pela camada de dados (server/data.ts),
// que valida e tipa os objetos antes de persistir
const booking = await createBooking(validatedData);

// ❌ Nunca ler/escrever o data/db.json diretamente
// nas rotas — isso contorna validação e escrita atômica
```

> Nota: injeção de SQL não se aplica a este projeto — não há banco SQL; os dados são serializados como JSON pelo store.

## 🧪 Testando

### Testes Unitários

Os testes usam **vitest** e vivem em arquivos `*.spec.ts` junto ao código testado. Eles rodam **sem nenhuma infraestrutura** — não há banco de dados nem serviços externos para subir antes:

```bash
npm run test
```

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
      "url": "http://localhost:8080",
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
console.log(`Server started on port ${port}`);
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
- [Tailwind CSS](https://tailwindcss.com)

## 📞 Contato e Suporte

Para dúvidas sobre desenvolvimento:
1. Consulte esta documentação
2. Verifique exemplos no código existente
3. Abra uma issue no repositório

---

**Versão**: 1.0.0
**Última atualização**: 2026

Happy coding! 🎉
