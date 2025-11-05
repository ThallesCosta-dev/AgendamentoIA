# Documentação da API REST - SalaAgenda

Esta documentação descreve todos os endpoints da API REST do SalaAgenda.

## 📋 Informações Gerais

- **Base URL**: `http://localhost:3000/api` (desenvolvimento)
- **Base URL Produção**: `https://seudominio.com/api`
- **Formato**: JSON
- **Autenticação**: Nenhuma (protegida por CORS)
- **Rate Limit**: Recomendado implementar em produção

## 🔑 Tipos de Dados

### Room (Sala)

```typescript
{
  id: string;
  name: string;
  capacity: number;
  createdAt: string; // ISO 8601
}
```

### Booking (Agendamento)

```typescript
{
  id: string;
  roomId: string;
  roomName: string;
  clientName: string;
  clientEmail: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  duration?: string; // Opcional
  equipment?: string; // Opcional
  createdAt: string; // ISO 8601
}
```

## 🏢 Endpoints de Salas

### Listar Salas

```http
GET /api/rooms
```

**Descrição**: Retorna todas as salas cadastradas.

**Resposta** (200 OK):
```json
{
  "rooms": [
    {
      "id": "1",
      "name": "Sala 101",
      "capacity": 30,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Obter Sala por ID

```http
GET /api/rooms/{id}
```

**Parâmetros**:
- `id` (string, path): ID da sala

**Resposta** (200 OK):
```json
{
  "id": "1",
  "name": "Sala 101",
  "capacity": 30,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Resposta de Erro** (404):
```json
{
  "error": "Room not found"
}
```

### Criar Sala

```http
POST /api/rooms
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Sala 102",
  "capacity": 25
}
```

**Resposta** (201 Created):
```json
{
  "id": "2",
  "name": "Sala 102",
  "capacity": 25,
  "createdAt": "2024-01-20T10:30:00Z"
}
```

**Validações**:
- `name`: Obrigatório, único
- `capacity`: Obrigatório, número positivo

### Atualizar Sala

```http
PUT /api/rooms/{id}
Content-Type: application/json
```

**Parâmetros**:
- `id` (string, path): ID da sala

**Body**:
```json
{
  "name": "Sala 102 Renovada",
  "capacity": 35
}
```

**Resposta** (200 OK):
```json
{
  "id": "2",
  "name": "Sala 102 Renovada",
  "capacity": 35,
  "createdAt": "2024-01-20T10:30:00Z"
}
```

### Deletar Sala

```http
DELETE /api/rooms/{id}
```

**Parâmetros**:
- `id` (string, path): ID da sala

**Resposta** (200 OK):
```json
{
  "success": true
}
```

⚠️ **Aviso**: Ao deletar uma sala, todos seus agendamentos também serão removidos!

## 📅 Endpoints de Agendamentos

### Listar Agendamentos

```http
GET /api/bookings
```

**Resposta** (200 OK):
```json
{
  "bookings": [
    {
      "id": "1",
      "roomId": "1",
      "roomName": "Sala 101",
      "clientName": "João Silva",
      "clientEmail": "joao@universidade.edu.br",
      "date": "2025-02-15",
      "startTime": "14:00",
      "endTime": "15:00",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Obter Agendamento por ID

```http
GET /api/bookings/{id}
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

**Resposta** (200 OK):
```json
{
  "id": "1",
  "roomId": "1",
  "roomName": "Sala 101",
  "clientName": "João Silva",
  "clientEmail": "joao@universidade.edu.br",
  "date": "2025-02-15",
  "startTime": "14:00",
  "endTime": "15:00",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Criar Agendamento

```http
POST /api/bookings
Content-Type: application/json
```

**Body**:
```json
{
  "roomId": "1",
  "clientName": "Maria Costa",
  "clientEmail": "maria@universidade.edu.br",
  "date": "2025-02-16",
  "startTime": "14:30",
  "endTime": "15:30"
}
```

**Resposta** (201 Created):
```json
{
  "booking": {
    "id": "2",
    "roomId": "1",
    "roomName": "Sala 101",
    "clientName": "Maria Costa",
    "clientEmail": "maria@universidade.edu.br",
    "date": "2025-02-16",
    "startTime": "14:30",
    "endTime": "15:30",
    "createdAt": "2024-01-20T10:30:00Z"
  }
}
```

**Validações**:
- `roomId`: Obrigatório, deve existir
- `clientName`: Obrigatório, mínimo 2 caracteres
- `clientEmail`: Obrigatório, deve ser .edu.br
- `date`: Obrigatório, formato YYYY-MM-DD, deve ser hoje ou futuro
- `startTime`: Obrigatório, formato HH:mm
- `endTime`: Obrigatório, formato HH:mm, deve ser > startTime

### Atualizar Agendamento

```http
PUT /api/bookings/{id}
Content-Type: application/json
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

**Body** (todos opcionais):
```json
{
  "clientName": "Maria Costa Silva",
  "clientEmail": "maria.costa@universidade.edu.br",
  "date": "2025-02-17",
  "startTime": "15:00",
  "endTime": "16:00",
  "roomId": "2"
}
```

**Resposta** (200 OK): Agendamento atualizado

### Deletar Agendamento

```http
DELETE /api/bookings/{id}
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

**Resposta** (200 OK):
```json
{
  "success": true
}
```

### Verificar Disponibilidade

```http
POST /api/bookings/check-availability
Content-Type: application/json
```

**Body**:
```json
{
  "date": "2025-02-15",
  "startTime": "14:00",
  "endTime": "15:00"
}
```

**Resposta** (200 OK):
```json
{
  "availableRooms": [
    {
      "id": "1",
      "name": "Sala 101",
      "capacity": 30,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "2",
      "name": "Auditório Principal",
      "capacity": 100,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "bookedRooms": ["3"]
}
```

### Obter Horários Disponíveis

```http
GET /api/bookings/available-times?date=2025-02-15
```

**Parâmetros Query**:
- `date` (string): Data em formato YYYY-MM-DD

**Resposta** (200 OK):
```json
{
  "availableRooms": [
    {
      "id": "1",
      "name": "Sala 101",
      "capacity": 30,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "bookedSlots": {
    "1": [
      {"start": 840, "end": 900}
    ]
  }
}
```

## 💬 Endpoints de Chat

### Enviar Mensagem para Chatbot

```http
POST /api/chat
Content-Type: application/json
```

**Body**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Quero agendar uma sala"
    },
    {
      "role": "assistant",
      "content": "Claro! Qual é seu nome completo?"
    },
    {
      "role": "user",
      "content": "João Silva"
    }
  ]
}
```

**Resposta** (200 OK):
```json
{
  "message": "Qual é seu email institucional?",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

**Erros Comuns**:
- 500: Chave API não configurada
- 401: Chave API inválida
- 429: Rate limit excedido

## 🤖 Endpoints de IA (Operações de Banco de Dados)

Esses endpoints são para operações diretas via IA, sem interface web.

### IA - Listar Salas

```http
GET /api/ai/rooms
```

**Resposta**:
```json
{
  "success": true,
  "rooms": [...],
  "count": 3
}
```

### IA - Listar Agendamentos

```http
GET /api/ai/bookings?email=joao@universidade.edu.br
```

**Parâmetros Query** (opcionais):
- `email`: Filtrar por email
- `date`: Filtrar por data
- `roomId`: Filtrar por sala

### IA - Criar Agendamento

```http
POST /api/ai/bookings
Content-Type: application/json
```

**Body**: Mesmo que POST /api/bookings

**Resposta**:
```json
{
  "success": true,
  "booking": {...},
  "message": "Booking created successfully with ID: 123"
}
```

### IA - Atualizar Agendamento

```http
PUT /api/ai/bookings/{id}
Content-Type: application/json
```

### IA - Cancelar Agendamento

```http
DELETE /api/ai/bookings/{id}
```

### IA - Verificar Disponibilidade

```http
POST /api/ai/bookings/check-availability
Content-Type: application/json
```

**Body**:
```json
{
  "date": "2025-02-15",
  "startTime": "14:00",
  "endTime": "15:00"
}
```

## 🛠️ Utilitários

### Health Check

```http
GET /api/ping
```

**Resposta** (200 OK):
```json
{
  "message": "ping"
}
```

Útil para verificar se o servidor está ativo.

### Demo

```http
GET /api/demo
```

**Resposta** (200 OK):
```json
{
  "message": "Hello from Express server"
}
```

## 📊 Formato de Respostas

### Sucesso (2xx)

```json
{
  "data": {...},
  "message": "Operação realizada com sucesso"
}
```

### Erro (4xx/5xx)

```json
{
  "error": "Descrição do erro",
  "code": "ERROR_CODE",
  "status": 400
}
```

## 🔐 CORS

O servidor permite requisições de:
- `http://localhost:5173` (desenvolvimento)
- `http://localhost:3000` (desenvolvimento)
- Domínios configurados em produção

## 📝 Exemplos com cURL

### Listar Salas

```bash
curl -X GET http://localhost:3000/api/rooms
```

### Criar Sala

```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala 103",
    "capacity": 40
  }'
```

### Criar Agendamento

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "1",
    "clientName": "João Silva",
    "clientEmail": "joao@universidade.edu.br",
    "date": "2025-02-15",
    "startTime": "14:00",
    "endTime": "15:00"
  }'
```

### Chat com IA

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Quero agendar uma sala"
      }
    ]
  }'
```

## 🧪 Testando a API

### Usando Postman

1. Baixe [Postman](https://www.postman.com/downloads/)
2. Importe a coleção (em desenvolvimento)
3. Configure a base URL
4. Teste cada endpoint

### Usando Thunder Client (VS Code)

1. Instale a extensão
2. Configure requests
3. Salve coleção

### Usando cURL

Veja exemplos acima na seção "Exemplos com cURL"

## 📚 Documentação Adicional

- [USER_GUIDE.md](USER_GUIDE.md) - Como usuários usam
- [ADMIN_GUIDE.md](ADMIN_GUIDE.md) - Painel administrativo
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Desenvolvimento

---

**Versão**: 1.0.0
**Última atualização**: 2024
