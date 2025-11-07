# Arquitetura - SalaAgenda

Este documento descreve a arquitetura técnica e decisões de design da aplicação SalaAgenda.

## 🏗��� Visão Geral

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
┌──────────���──────────────────────────────────────────────┐
│                 SERVIDOR (Node.js/Express)              │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │               Route Layer                           ││
│  │  GET /api/rooms      POST /api/bookings             ││
│  │  PUT /api/rooms/:id  DELETE /api/bookings/:id       ││
│  │  POST /api/chat      GET /api/ai/rooms              ││
│  └─────────────────────────────────────────────────────┘│
│                        ↓                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │              Service Layer                          ││
│  │  • Email Service     • Validation                    ││
│  │  • Data Access Objs  • OpenRouter Integration       ││
│  └─────────────────────────────────────────────────────┘│
│                        ↓                                │
│  ┌────────────��────────────────────────────────────────┐│
│  │           Data Access Layer (MySQL)                 ││
│  │  getRooms()          createBooking()                ││
│  │  getBookings()       updateBooking()                ││
│  │  bookingExists()     deleteBooking()                ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                        ↓↑
┌─────────────────────────────────────────────────────────┐
│              BANCO DE DADOS (MySQL 8.0+)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────────────────────────┐│
│  │ rooms        │  │ bookings                         ││
│  ���──────────────┤  ├──────────────────────────────────┤│
│  │ id           │  │ id                               ││
│  │ name         │  │ room_id (FK)                     ││
│  │ capacity     │  │ room_name                        ││
│  │ created_at   │  │ client_name                      ││
│  └──────────────┘  │ client_email                     ││
│                    │ date                             ││
│                    │ start_time                       ││
│                    │ end_time                         ││
│                    │ created_at                       ││
│                    └──────────────────────────────────┘│
└────────────────────────��────────────────────────────────┘
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
│   ├── chat.ts      # Integração OpenRouter
│   └── demo.ts      # Teste
├── services/         # Lógica de negócio
│   └── email.ts     # Envio de confirmações
├── data.ts          # Data Access Layer (14 funções)
├── db.ts            # Conexão MySQL
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

### Banco de Dados

#### Schema MySQL

```sql
-- Salas
CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  capacity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agendamentos
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  room_name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  INDEX idx_room_date (room_id, date),
  INDEX idx_email (client_email)
);
```

#### Índices

Para otimizar queries:
- `idx_room_date`: Rápido verificar disponibilidade
- `idx_email`: Rápido encontrar agendamentos de um cliente

## 🔄 Fluxos Principais

### Fluxo 1: Usuário Agenda uma Sala

```
1. User → Chatbot: "Quero agendar"
   └→ Bot asks for name

2. User → Chatbot: "João Silva"
   └→ Extract: name="João Silva"
   └→ Ask for email

3. User → Chatbot: "joao@uni.edu.br"
   └→ Extract: email="joao@uni.edu.br"
   └→ Validate: ✓ .edu.br
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
   └→ Query DB for conflicts
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
    └→ Insert into DB
    └→ Send confirmation email
    └→ Return booking with ID

12. User receives:
    └→ Success message with ID #12345
    └→ Email confirmation
```

### Fluxo 2: Administrador Gerencia Salas

```
1. Admin → Login page: "admin" / "admin123"
   └→ AuthContext.login()
   └→ localStorage.setItem("adminAuth", "true")
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

2. Chatbot → OpenRouter API: POST /api/chat
   {
    "messages": [
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."},
      {"role": "user", "content": "Preciso de uma sala..."}
    ]
  }
  └→ Server calls OpenRouter LLM
  └→ Model responds with next question

3. OpenRouter → Chatbot: "Qual é a hora desejada?"
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
Database Constraint Validation
  ↓
Response Validation
```

### Proteção contra Ataques

1. **SQL Injection**: Prepared statements
```typescript
connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
```

2. **XSS**: React escapa automaticamente
```typescript
// Safe: ${maliciousInput} será escapado
<div>{userInput}</div>
```

3. **CSRF**: Verificação de origin
```typescript
app.use(cors({ origin: process.env.APP_URL }));
```

4. **Brute Force**: Rate limiting (recomendado)

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

1. **Database Indexing**:
```sql
CREATE INDEX idx_booking_date ON bookings(date);
```

2. **Connection Pooling**: MySQL pool
3. **Caching**: Redis (não implementado, sugestão)
4. **Query Optimization**: Usar índices

### Network

1. **CDN**: Netlify/Vercel provide CDN
2. **Compression**: gzip automático
3. **HTTP Caching**: Cache headers

## 🔌 Extensibilidade

### Adicionar Nova Feature

1. **Atualizar Tipos** (shared/api.ts)
2. **Atualizar BD** (server/db.ts schema)
3. **Atualizar DAL** (server/data.ts)
4. **Atualizar Rotas** (server/routes/)
5. **Atualizar Frontend** (client/components/)

### Exemplo: Adicionar Campo "Observações"

```typescript
// 1. shared/api.ts
interface Booking {
  notes?: string;  // NOVO
}

// 2. server/db.ts
ALTER TABLE bookings ADD COLUMN notes TEXT;

// 3. server/data.ts
export async function createBooking(booking) {
  // Incluir notes na INSERT
}

// 4. server/routes/bookings.ts
const { notes } = req.body;
booking = await createBooking({ ...data, notes });

// 5. client/components/Chatbot.tsx
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

Para múltiplos servidores:
1. Load balancer (nginx, AWS ELB)
2. Sessões em Redis (não JWT)
3. Database replication

### Vertical Scaling

Para um único servidor:
1. Aumentar RAM e CPU
2. Otimizar queries
3. Implementar cache

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
FAIL            Deploy to Netlify
               (dist/spa + functions)
                     ↓
                CDN Cache
                     ↓
              Browser Access
                     ↓
                User sees app
```

## 📨 Sistema de Emails

### Confirmação de Agendamento

Quando um agendamento é criado:
1. A API chama `sendBookingConfirmationEmail(booking)`
2. Template HTML responsivo é gerado com detalhes
3. Email é enviado via Gmail/Nodemailer

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
Delete from database
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
- **Schemas**: `server/db.ts` - Estrutura de dados
- **Routes**: `server/index.ts` - Mapeamento de endpoints
- **Componentes**: `client/components/` - UI React
- **Email Service**: `server/services/email.ts` - Confirmação e cancelamento
- **Admin Panel**: `client/pages/Admin.tsx` - Gerenciamento com 3 abas

---

**Versão**: 1.1.0
**Última atualização**: 2024
**Mudanças Recentes**:
- ✅ Adicionado sistema de emails de cancelamento
- ✅ Adicionado ID de reserva visível no admin
- ✅ Separação de agendamentos ativos vs histórico
- ✅ Filtro de histórico por mês

Architecture is destiny! 🏛️
