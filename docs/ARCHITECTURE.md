# Arquitetura - SalaAgenda

Este documento descreve a arquitetura técnica e decisões de design da aplicação SalaAgenda.

## 🏗️ Visão Geral

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (React 18)                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Chatbot    │  │ Admin Panel  │  │   Auth       │  │
│  │  Component   │  │              │  │  Context     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  State: React Query | Context API | Local Storage      │
│  Estilo: Tailwind CSS | shadcn/ui                      │
└─────────────────────────────────────────────────────────┘
                        ↓↑
                  HTTP REST API
                  (JSON over HTTP)
                        ↓↑
┌─────────────────────────────────────────────────────────┐
│                 SERVIDOR (Node.js/Express)              │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │               Route Layer                           ││
│  │  GET /api/rooms      POST /api/bookings             ││
│  │  PUT /api/rooms/:id  DELETE /api/bookings/:id       ││
│  │  POST /api/chat      GET /api/ai/bookings/:id       ││
│  └─────────────────────────────────────────────────────┘│
│                        ↓                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Service Layer                          ││
│  │  • Email Service     • Validation                    ││
│  │  • Data Access Objs  • Groq Integration             ││
│  └─────────────────────────────────────────────────────┘│
│                        ↓                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │        Data Access Layer (server/data.ts)           ││
│  │  getRooms()          createBooking()                ││
│  │  getBookings()       updateBooking()                ││
│  │  bookingExists()     deleteBooking()                ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                        ↓↑
┌─────────────────────────────────────────────────────────┐
│        ARMAZENAMENTO EM ARQUIVO (data/db.json)          │
│                                                          │
│  Coleções (arrays JSON) com IDs inteiros sequenciais:   │
│   • rooms     — salas (id, name, capacity, createdAt)   │
│   • bookings  — agendamentos (id, roomId, roomName,     │
│                 clientName, clientEmail, date,          │
│                 startTime, endTime, createdAt)          │
│   • logs de email do processador IMAP                   │
│                                                          │
│  Leituras servidas da memória                           │
│  Escritas atômicas (arquivo temporário + rename)        │
└─────────────────────────────────────────────────────────┘
```

## 📁 Componentes Principais

### Frontend (client/)

#### Estrutura de Pastas

```
client/
├── components/        # Componentes React
│   ├── Chatbot.tsx   # Componente principal (1200+ linhas)
│   ├── Header.tsx    # Navegação
│   ├── ProtectedRoute.tsx
│   └── ui/           # Componentes UI reutilizáveis
├── pages/            # Páginas/Rotas
│   ├── Index.tsx     # Página inicial
│   ├── Admin.tsx     # Painel administrativo
│   ├── Login.tsx     # Autenticação
│   └── NotFound.tsx  # 404
├── context/          # Estado global (Context API)
│   └── AuthContext.tsx
├── hooks/            # Custom Hooks
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/              # Utilidades
│   └── utils.ts
└── App.tsx           # Componente raiz
```

#### Fluxo de Dados

```
User Input (Chatbot)
        ↓
Extract Data (extractDataFromText)
        ↓
Validate (validateEmail, validateDate, etc)
        ↓
State Update (setFormData)
        ↓
Check Availability (checkAvailability API)
        ↓
Display Rooms
        ↓
User Selection
        ↓
Create Booking (fetch /api/bookings POST)
        ↓
Success Notification (Toast)
        ↓
Email Confirmation
```

#### Página Admin (Admin.tsx)

Painel de gerenciamento com três abas principais:

**1. Salas** - Gerenciar salas
- Criar nova sala
- Editar sala existente
- Deletar sala

**2. Agendamentos Ativos** - Agendamentos futuros apenas
- Exibe apenas agendamentos com data >= hoje
- Mostra ID da reserva para cada agendamento
- Permite editar agendamentos ativos
- Permite deletar agendamentos ativos
- Envia email de cancelamento ao deletar

**3. Histórico** - Agendamentos passados
- Exibe apenas agendamentos com data < hoje
- Filtro por mês/ano selecionável
- Mostra ID da reserva para cada agendamento
- Permite deletar apenas (sem editar)
- Ordenado por data (mais recentes primeiro)

#### Componente Chatbot

Componente principal com estado complexo:

```typescript
interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
  role: "user" | "assistant";
}

interface ExtractedData {
  name?: string;
  email?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  equipment?: string;
}

type ConversationFlow = "booking" | "modify" | "cancel" | "none";
```

Estados do Chatbot:
- **booking**: Novo agendamento
- **modify**: Modificar agendamento existente
- **cancel**: Cancelar agendamento
- **none**: Estado inicial

### Backend (server/)

#### Estrutura de Pastas

```
server/
├── routes/           # Endpoints da API
│   ├── ai.ts        # Operações diretas (7 endpoints)
│   ├── bookings.ts  # Agendamentos (6 endpoints)
│   ├── rooms.ts     # Salas (5 endpoints)
│   ├── chat.ts      # Integração Groq
│   └── demo.ts      # Teste
├── services/         # Lógica de negócio
│   └── email.ts     # Envio de confirmações
├── data.ts          # Data Access Layer (14 funções)
├── store.ts         # Armazenamento JSON (data/db.json)
└── index.ts         # Configuração Express
```

#### Padrão de Rotas

```typescript
// Exemplo: GET /api/rooms/:id
export const handleGetRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await getRoomById(id);  // Data layer
    
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    
    res.json(room);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal error" });
  }
};
```

#### Data Access Layer (data.ts)

Funções organizadas por entidade:

**Rooms:**
- `createRoom()`
- `getRooms()`
- `getRoomById()`
- `updateRoomById()`
- `deleteRoom()`

**Bookings:**
- `createBooking()`
- `getBookings()`
- `getBookingById()`
- `getBookingsByRoom()`
- `updateBookingById()`
- `deleteBookingById()`
- `bookingExists()`

**Validação:**
- `validateInstitutionalEmail()`

### Armazenamento de Dados (arquivo JSON)

O sistema **não usa banco de dados**. Toda a persistência é feita em um único arquivo JSON — `db.json` — dentro do diretório configurado por `DATA_DIR` (padrão: `./data`).

#### Estrutura do db.json (alto nível)

O arquivo guarda as coleções do sistema como arrays de objetos, com **IDs inteiros sequenciais** (mesmo modelo de IDs e mesmos formatos JSON expostos pela API):

- **Salas**: id, nome, capacidade, data de criação
- **Agendamentos**: id, sala (id e nome), cliente (nome e email), data, horários de início/fim, data de criação
- **Logs de email**: registros do processador de emails IMAP (emails recebidos e respostas automáticas)

#### Ciclo de vida e concorrência

- **Criação automática**: na primeira execução, o servidor cria o diretório e o arquivo (com salas iniciais de exemplo) se não existirem. Nada precisa ser provisionado antes.
- **Leituras em memória**: os dados são mantidos em memória; as leituras não tocam o disco.
- **Escritas atômicas**: cada gravação escreve um arquivo temporário e faz `rename` — o `db.json` nunca fica em estado parcial, mesmo se o processo cair no meio de uma escrita.
- **Concorrência**: o modelo assume **um único processo Node**. A prevenção de reserva duplicada (double-booking), que antes seria papel de uma transação SQL, é garantida pela serialização das operações dentro do processo: a verificação de conflito e a gravação acontecem de forma sequencial, sem intercalação.
- **Sem migrações**: não há schema rígido — campos novos são simplesmente gravados no JSON; registros antigos permanecem válidos.
- **Versionamento e backup**: o diretório `data/` está no `.gitignore`; backup = copiar `db.json`.

#### Limitações (e caminho de evolução)

Esse modelo é adequado para o cenário do sistema: baixo volume de dados e um único processo. Se o uso crescer (muitos registros, necessidade de múltiplas instâncias), a evolução natural é migrar para **SQLite** ou um banco gerenciado. A camada de dados (`server/data.ts`) isola o armazenamento (`server/store.ts`) do resto da aplicação, então essa troca fica contida em poucos arquivos.

## 🔄 Fluxos Principais

### Fluxo 1: Usuário Agenda uma Sala

```
1. User → Chatbot: "Quero agendar"
   └→ Bot asks for name

2. User → Chatbot: "João Silva"
   └→ Extract: name="João Silva"
   └→ Ask for email

3. User → Chatbot: "joao@ioc.fiocruz.br"
   └→ Extract: email="joao@ioc.fiocruz.br"
   └→ Validate: ✓ domínio permitido (ALLOWED_EMAIL_DOMAINS)
   └→ Ask for date

4. User → Chatbot: "25/12/2025"
   └→ Extract: date="2025-12-25"
   └→ Validate: ✓ future date
   └→ Ask for start time

5. User → Chatbot: "14:30"
   └→ Extract: startTime="14:30"
   └→ Ask for end time

6. User → Chatbot: "15:30"
   └→ Extract: endTime="15:30"
   └→ Validate: ✓ end > start
   └→ Call checkAvailability API

7. Chatbot → Server: POST /api/bookings/check-availability
   └→ Verifica conflitos no armazenamento
   └→ Return available rooms

8. Chatbot displays rooms
   └→ User selects room

9. User → Chatbot: "Sala 101"
   └→ Extract: selectedRoom="1"
   └→ Display summary
   └→ Ask for confirmation

10. User → Chatbot: "Sim"
    └→ Call createBooking API

11. Chatbot → Server: POST /api/bookings
    └→ Validate all fields
    └→ Grava no armazenamento (data/db.json)
    └→ Send confirmation email
    └→ Return booking with ID

12. User receives:
    └→ Success message with ID #12345
    └→ Email confirmation
```

### Fluxo 2: Administrador Gerencia Salas

```
1. Admin → Login page: credenciais (ADMIN_USERNAME/ADMIN_PASSWORD via env)
   └→ POST /api/auth/login
   └→ Servidor valida e retorna token (validade 8h)
   └→ Token enviado como Authorization: Bearer <token>
   └→ Redirect to /admin

2. Admin → Admin panel
   └→ Fetch /api/rooms
   └→ Display table

3. Admin → Create room
   └→ POST /api/rooms
   └→ {name, capacity}
   └→ Update table

4. Admin → Edit room
   └→ PUT /api/rooms/:id
   └→ Update fields
   └→ Refresh table

5. Admin → Delete room
   └→ DELETE /api/rooms/:id
   └→ ⚠️ Cascades to bookings
   └→ Refresh table
```

### Fluxo 3: Chatbot com IA

```
1. User → Chatbot: "Preciso de uma sala em 15 de dezembro"
   └→ Extract: date="15/12", maybe other info

2. Chatbot → Groq API: POST /api/chat
   {
    "messages": [
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."},
      {"role": "user", "content": "Preciso de uma sala..."}
    ]
  }
  └→ Server calls Groq LLM
  └→ Model responds with next question

3. Groq → Chatbot: "Qual é a hora desejada?"
   └→ Display to user
   └→ Continue conversation loop
```

## 🔐 Segurança

### Validação em Camadas

```
Frontend Validation
  ↓
User Input
  ↓
Backend Validation (Server)
  ↓
Data Layer Validation
  ↓
Response Validation
```

### Proteção contra Ataques

1. **Injeção de SQL**: Não se aplica — não há banco SQL. Os dados passam pela camada de dados tipada (`server/data.ts`) e são serializados como JSON, nunca interpolados em comandos.

2. **XSS**: React escapa automaticamente
```typescript
// Safe: ${maliciousInput} será escapado
<div>{userInput}</div>
```

3. **CSRF**: Verificação de origin via CORS configurável
```typescript
// Origens permitidas definidas em CORS_ORIGIN (separadas por vírgula);
// aberto quando a variável não está definida
app.use(cors({ origin: allowedOrigins }));
```

4. **Autenticação Admin**: Token no servidor (POST /api/auth/login, validade 8h) protege gestão de salas, agendamentos e processador de emails

5. **Rate Limiting**: Limitador em memória no /api/chat

## 📊 Performance

### Frontend Optimization

1. **Code Splitting**: Lazy load pages
```typescript
const Admin = lazy(() => import('./pages/Admin'));
```

2. **Virtual Scrolling**: Para grandes listas
3. **Memoization**: Evitar re-renders
4. **Asset Bundling**: Vite minifica e comprime

### Backend Optimization

1. **Leituras em memória**: os dados vivem em memória — listagens e verificações de disponibilidade não tocam o disco
2. **Escritas enxutas**: apenas as gravações persistem no arquivo (atômicas, temp + rename)
3. **Dimensionamento**: adequado para baixo volume; se o volume crescer muito, migre a camada de dados para SQLite/banco gerenciado (troca contida em `server/data.ts`/`server/store.ts`)

### Network

1. **CDN/Proxy**: nginx ou CDN opcional na frente do servidor Node.js
2. **Compression**: gzip automático
3. **HTTP Caching**: Cache headers

## 🔌 Extensibilidade

### Adicionar Nova Feature

1. **Atualizar Tipos** (shared/api.ts)
2. **Atualizar DAL** (server/data.ts) — não há migração de schema: campos novos são simplesmente gravados no JSON
3. **Atualizar Rotas** (server/routes/)
4. **Atualizar Frontend** (client/components/)

### Exemplo: Adicionar Campo "Observações"

```typescript
// 1. shared/api.ts
interface Booking {
  notes?: string;  // NOVO
}

// 2. server/data.ts
export async function createBooking(booking) {
  // Incluir notes no objeto gravado — registros antigos
  // (sem o campo) continuam válidos, sem migração
}

// 3. server/routes/bookings.ts
const { notes } = req.body;
booking = await createBooking({ ...data, notes });

// 4. client/components/Chatbot.tsx
const [formData, setFormData] = useState({
  notes: "",  // NOVO
});
```

## 🧪 Testabilidade

### Unit Tests (vitest)

```typescript
import { describe, it, expect } from 'vitest';

describe('validateEmail', () => {
  it('should accept .edu.br emails', () => {
    expect(validateEmail('test@uni.edu.br')).toBe(true);
  });

  it('should reject other domains', () => {
    expect(validateEmail('test@gmail.com')).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Booking API', () => {
  it('should create booking', async () => {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({...})
    });
    expect(res.status).toBe(201);
  });
});
```

## 📈 Escalabilidade

### Horizontal Scaling

⚠️ O armazenamento em arquivo pressupõe **um único processo** — não rode múltiplas instâncias/cluster sobre o mesmo `db.json`. Para escalar horizontalmente seria necessário, antes:
1. Migrar a camada de dados para SQLite ou banco gerenciado (troca contida em `server/data.ts`/`server/store.ts`)
2. Load balancer (nginx, AWS ELB)
3. Sessões compartilhadas (ex.: Redis)

### Vertical Scaling

Para um único servidor (o caminho natural deste sistema):
1. Aumentar RAM e CPU
2. Implementar cache HTTP para conteúdo estático

## 🔄 Deployment Architecture

```
Git Repository (GitHub/GitLab)
         ↓
  CI/CD Pipeline (GitHub Actions)
         ↓
   npm run build
         ↓
   Build successful?
  ↙              ↘
 NO                YES
  ↓                 ↓
FAIL            Deploy em servidor Node.js
               (dist/spa + dist/server, PM2/systemd)
                     ↓
              Proxy reverso (nginx) + TLS
                     ↓
              Browser Access
                     ↓
                User sees app
```

> Nota: deploy serverless (Netlify) **não é adequado para produção** — o armazenamento em arquivo não persiste (sistema de arquivos efêmero) e o processador de emails (IMAP/cron) não funciona nesse ambiente. Produção deve ser um servidor Node persistente (PM2/systemd) com `DATA_DIR` gravável e persistente. Veja [DEPLOYMENT.md](DEPLOYMENT.md).

## 📨 Sistema de Emails

### Confirmação de Agendamento

Quando um agendamento é criado:
1. A API chama `sendBookingConfirmationEmail(booking)`
2. Template HTML responsivo é gerado com detalhes
3. Email é enviado via SMTP/Nodemailer

**Dados inclusos no email:**
- ID da reserva (#12345)
- Nome da sala
- Data e horário
- Email do cliente
- Links para modificar ou cancelar

### Cancelamento de Agendamento

Quando um agendamento é deletado:
1. A API chama `sendBookingCancellationEmail(booking)`
2. Template HTML diferenciado (vermelho) confirma cancelamento
3. Email é enviado ao cliente

**Fluxo de cancelamento:**
```
User deletes booking
        ↓
API validates booking exists
        ↓
Remove do armazenamento (data/db.json)
        ↓
Send cancellation email
        ↓
Return success response
```

## 🔄 Separação de Agendamentos Ativos vs Histórico

### Implementação no Admin Panel

**client/pages/Admin.tsx** gerencia a separação:

```typescript
const isBookingPast = (booking: Booking): boolean => {
  // Compara data do agendamento com hoje
  return bookingDate < today;
};

const activeBookings = bookings.filter((b) => !isBookingPast(b));
const pastBookings = bookings.filter((b) => isBookingPast(b));
```

### Três Abas do Admin

| Aba | Dados Mostrados | Ações | Ordenação |
|-----|-----------------|-------|-----------|
| Salas | Todas salas | Criar/Editar/Deletar | Por ID |
| Agendamentos | data >= hoje | Editar/Deletar | Por data de criação |
| Histórico | data < hoje | Deletar apenas | Por data (desc) |

### Filtro de Histórico

O histórico possui filtro de mês:

```typescript
const getMonthsList = () => {
  // Extrai todos os meses com agendamentos passados
  return Array.from(months).sort().reverse();
};

const getFilteredHistoryBookings = () => {
  // Filtra por mês selecionado ou mostra tudo
  if (!selectedHistoryMonth) return [...pastBookings];
  return pastBookings.filter(b => b.date.startsWith(selectedHistoryMonth));
};
```

## 📚 Recursos Importantes

- **Tipos**: `shared/api.ts` - Fonte única de verdade
- **Armazenamento**: `server/store.ts` - Store JSON (`data/db.json`, escrita atômica)
- **Camada de Dados**: `server/data.ts` - API estável sobre o armazenamento
- **Routes**: `server/index.ts` - Mapeamento de endpoints
- **Componentes**: `client/components/` - UI React
- **Email Service**: `server/services/email.ts` - Confirmação e cancelamento
- **Admin Panel**: `client/pages/Admin.tsx` - Gerenciamento com 3 abas

---

**Versão**: 1.0.0
**Última atualização**: 2026
**Mudanças Recentes**:
- ✅ Adicionado sistema de emails de cancelamento
- ✅ Adicionado ID de reserva visível no admin
- ✅ Separação de agendamentos ativos vs histórico
- ✅ Filtro de histórico por mês

Architecture is destiny! 🏛️
