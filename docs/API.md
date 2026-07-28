# Documentação da API REST - SalaAgenda

Esta documentação descreve todos os endpoints da API REST do SalaAgenda.

## 📋 Informações Gerais

- **Base URL**: `http://localhost:8080/api` (desenvolvimento — porta única do `npm run dev`)
- **Base URL Produção**: `https://seudominio.com/api` (servidor Node na porta 3000, via `PORT`)
- **Formato**: JSON
- **Autenticação**: Token Bearer para endpoints administrativos (obtido via `POST /api/auth/login`, validade de 8 horas). Endpoints públicos: listagem/consulta de salas, criação de agendamento, verificação de disponibilidade e horários, `/api/ai/bookings/{id}` (GET/PUT/DELETE, com verificação por email), `/api/chat`, `/api/config` e `/api/ping`.
- **Rate Limit**: Limitadores em memória, por IP: `/api/chat` (20 req/min), **todas** as rotas `/api/ai/*` (30 req/min) e `POST /api/auth/login` (10 req/min). Excedido o limite, a resposta é **429** com corpo `{"error": "..."}`.

## 🔐 Autenticação

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Body**:
```json
{
  "username": "admin",
  "password": "sua-senha"
}
```

**Resposta** (200 OK):
```json
{
  "success": true,
  "token": "abc123...",
  "expiresAt": "2026-07-28T22:00:00.000Z"
}
```

As credenciais são configuradas pelas variáveis de ambiente `ADMIN_USERNAME` (padrão `admin`) e `ADMIN_PASSWORD` (obrigatória em produção; fallback `admin123` apenas em desenvolvimento). O token expira em **8 horas**.

Este endpoint tem **rate limit** de 10 requisições por minuto por IP (mitigação de força bruta). Excedido o limite, a resposta é **429** com `{"error": "Muitas tentativas de login em pouco tempo. Aguarde um instante e tente novamente."}`.

**Uso do token** — envie em todas as rotas protegidas:

```http
Authorization: Bearer <token>
```

**Resposta de Erro** (401):
```json
{
  "success": false,
  "error": "Usuário ou senha inválidos"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Resposta** (200 OK):
```json
{
  "success": true
}
```

Invalida o token atual no servidor.

## ⚙️ Configuração Pública

### Obter Configuração

```http
GET /api/config
```

**Descrição**: Retorna configurações públicas usadas pelo frontend, como os domínios de email aceitos (definidos via `ALLOWED_EMAIL_DOMAINS`).

**Resposta** (200 OK):
```json
{
  "allowedEmailDomains": ["fiocruz.br", "edu.br"]
}
```

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
  createdAt: string; // ISO 8601
}
```

## 🏢 Endpoints de Salas

### Listar Salas (público)

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
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### Obter Sala por ID (público)

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
  "createdAt": "2026-01-15T10:30:00Z"
}
```

**Resposta de Erro** (404):
```json
{
  "error": "Sala não encontrada"
}
```

### Criar Sala 🔒 (requer Bearer)

```http
POST /api/rooms
Content-Type: application/json
Authorization: Bearer <token>
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
  "createdAt": "2026-01-20T10:30:00Z"
}
```

**Validações**:
- `name`: Obrigatório, único
- `capacity`: Obrigatório, número positivo

### Atualizar Sala 🔒 (requer Bearer)

```http
PUT /api/rooms/{id}
Content-Type: application/json
Authorization: Bearer <token>
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
  "createdAt": "2026-01-20T10:30:00Z"
}
```

### Deletar Sala 🔒 (requer Bearer)

```http
DELETE /api/rooms/{id}
Authorization: Bearer <token>
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

### Listar Agendamentos 🔒 (requer Bearer)

```http
GET /api/bookings
Authorization: Bearer <token>
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
      "clientEmail": "joao@ioc.fiocruz.br",
      "date": "2026-08-15",
      "startTime": "14:00",
      "endTime": "15:00",
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### Obter Agendamento por ID 🔒 (requer Bearer)

```http
GET /api/bookings/{id}
Authorization: Bearer <token>
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

> Esta rota é administrativa. Para consulta pública de uma reserva (fluxo do chatbot), use `GET /api/ai/bookings/{id}`, que retorna o email do cliente **mascarado**.

**Resposta** (200 OK):
```json
{
  "id": "1",
  "roomId": "1",
  "roomName": "Sala 101",
  "clientName": "João Silva",
  "clientEmail": "joao@ioc.fiocruz.br",
  "date": "2026-08-15",
  "startTime": "14:00",
  "endTime": "15:00",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

### Criar Agendamento (público)

```http
POST /api/bookings
Content-Type: application/json
```

**Body**:
```json
{
  "roomId": "1",
  "clientName": "Maria Costa",
  "clientEmail": "maria@ioc.fiocruz.br",
  "date": "2026-08-16",
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
    "clientEmail": "maria@ioc.fiocruz.br",
    "date": "2026-08-16",
    "startTime": "14:30",
    "endTime": "15:30",
    "createdAt": "2026-01-20T10:30:00Z"
  }
}
```

**Validações**:
- `roomId`: Obrigatório, deve existir
- `clientName`: Obrigatório, mínimo 2 caracteres
- `clientEmail`: Obrigatório, deve pertencer a um domínio permitido (`ALLOWED_EMAIL_DOMAINS`, padrão `fiocruz.br,edu.br`; subdomínios aceitos)
- `date`: Obrigatório, formato YYYY-MM-DD, deve ser hoje ou futuro
- `startTime`: Obrigatório, formato HH:mm
- `endTime`: Obrigatório, formato HH:mm, deve ser > startTime

A criação é protegida contra condição de corrida: dois pedidos simultâneos para a mesma sala/horário não geram reserva duplicada — a verificação de conflito e a gravação são serializadas no processo do servidor.

### Atualizar Agendamento 🔒 (requer Bearer)

```http
PUT /api/bookings/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

**Body** (`clientName`, `clientEmail`, `date`, `startTime` e `endTime` são **obrigatórios**; apenas `roomId` é opcional):
```json
{
  "clientName": "Maria Costa Silva",
  "clientEmail": "maria.costa@ioc.fiocruz.br",
  "date": "2026-08-17",
  "startTime": "15:00",
  "endTime": "16:00",
  "roomId": "2"
}
```

Campos obrigatórios ausentes retornam **400** `{"error": "Campos obrigatórios ausentes"}`. Conflito com outra reserva na mesma sala/horário retorna **409**.

**Resposta** (200 OK): Agendamento atualizado

### Deletar Agendamento 🔒 (requer Bearer)

```http
DELETE /api/bookings/{id}
Authorization: Bearer <token>
```

**Parâmetros**:
- `id` (string, path): ID do agendamento

**Resposta** (200 OK):
```json
{
  "success": true
}
```

### Verificar Disponibilidade (público)

```http
POST /api/bookings/check-availability
Content-Type: application/json
```

**Body**:
```json
{
  "date": "2026-08-15",
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
      "createdAt": "2026-01-15T10:30:00Z"
    },
    {
      "id": "2",
      "name": "Auditório Principal",
      "capacity": 100,
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "bookedRooms": ["3"]
}
```

### Obter Horários Disponíveis (público)

```http
GET /api/bookings/available-times?date=2026-08-15
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
      "createdAt": "2026-01-15T10:30:00Z"
    }
  ],
  "bookedSlots": {
    "1": [
      {"start": 840, "end": 900}
    ]
  }
}
```

Os intervalos ocupados (`bookedSlots`) são retornados em minutos desde 00:00, ordenados corretamente por horário de início.

## 💬 Endpoints de Chat

### Enviar Mensagem para Chatbot (público, com rate limit)

```http
POST /api/chat
Content-Type: application/json
```

O chatbot usa o **Groq** com o modelo `llama-3.3-70b-versatile` (requer `GROQ_API_KEY`; modelo configurável via `GROQ_MODEL`). Este endpoint possui **rate limiting** em memória para prevenir abuso.

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
- 400: Formato de requisição inválido (`messages` ausente ou não é um array)
- 429: Rate limit excedido (20 req/min por IP)
- 500: `GROQ_API_KEY` não configurada no servidor (`"Serviço de IA não configurado no servidor."`)
- 502: Falha na chamada ao provedor de IA — inclui chave inválida, erro ou timeout do Groq (mensagem genérica em PT-BR)

> Este endpoint **nunca** retorna 401 — ele é público. Uma chave Groq inválida aparece para o cliente como **502**.

## 🤖 Endpoints de IA (`/api/ai/*`)

Rotas usadas pelo fluxo do chatbot para consultar, modificar e cancelar reservas **por ID**, sem o painel web. Apenas essas três rotas por ID são públicas — não existem mais rotas de IA para listar salas/agendamentos, criar reserva ou verificar disponibilidade (para isso, use `GET /api/rooms`, `POST /api/bookings` e `POST /api/bookings/check-availability`).

**Rate limit**: todas as rotas `/api/ai/*` compartilham um limitador de **30 req/min por IP** (proteção contra enumeração/abuso). Excedido o limite, a resposta é **429** com `{"error": "..."}`.

**Verificação de titularidade**: como as rotas são públicas, a posse da reserva é verificada pelo **email do cliente** — o GET retorna o email mascarado, e o PUT/DELETE exigem o email exato da reserva (comparação caso-insensível).

### IA - Obter Agendamento por ID (público, usado pelo chatbot)

```http
GET /api/ai/bookings/{id}
```

**Resposta** (200 OK) — o `clientEmail` vem **mascarado** (2 primeiros caracteres + `***@` + domínio):
```json
{
  "success": true,
  "booking": {
    "id": "1",
    "roomId": "1",
    "roomName": "Sala 101",
    "clientName": "Thalles Costa",
    "clientEmail": "th***@ioc.fiocruz.br",
    "date": "2026-08-15",
    "startTime": "14:00",
    "endTime": "15:00",
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

**Erros**:
- 404: `{"success": false, "error": "Agendamento com ID {id} não encontrado"}`

### IA - Atualizar Agendamento (público, com verificação por email)

```http
PUT /api/ai/bookings/{id}
Content-Type: application/json
```

**Body** — `clientEmail` é **obrigatório** e serve apenas como **fator de verificação de titularidade**: deve corresponder (caso-insensível) ao email da reserva. Ele **nunca** altera o email armazenado — o email da reserva não pode ser mudado por esta rota. Os demais campos (`clientName`, `date`, `startTime`, `endTime`, `roomId`) são opcionais; os ausentes mantêm o valor atual:

```json
{
  "clientEmail": "maria@ioc.fiocruz.br",
  "date": "2026-08-17",
  "startTime": "15:00",
  "endTime": "16:00"
}
```

**Resposta** (200 OK):
```json
{
  "success": true,
  "booking": {...},
  "message": "Agendamento {id} atualizado com sucesso"
}
```

**Erros**:
- 400: `clientEmail` ausente — `{"success": false, "error": "O campo clientEmail é obrigatório para verificar a titularidade da reserva"}`
- 400: data/horário inválidos
- 403: email não corresponde — `{"success": false, "error": "O email informado não corresponde ao email da reserva"}`
- 404: agendamento (ou sala, se `roomId` for enviado) não encontrado
- 409: conflito com outra reserva na mesma sala/horário

### IA - Cancelar Agendamento (público, com verificação por email)

```http
DELETE /api/ai/bookings/{id}?email=maria@ioc.fiocruz.br
```

**Parâmetros Query**:
- `email` (**obrigatório**): email da reserva, usado como fator de verificação de titularidade (comparação caso-insensível)

**Resposta** (200 OK):
```json
{
  "success": true,
  "message": "Agendamento {id} cancelado com sucesso",
  "cancelledBooking": {...}
}
```

Um email de confirmação do cancelamento é enviado ao cliente.

**Erros**:
- 400: `email` ausente — `{"success": false, "error": "O parâmetro email é obrigatório para verificar a titularidade da reserva"}`
- 403: email não corresponde — `{"success": false, "error": "O email informado não corresponde ao email da reserva"}`
- 404: agendamento não encontrado

### IA - Classificar Email 🔒 (requer Bearer)

```http
POST /api/ai/email/classify
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**: `emailContent` (obrigatório), `subject` e `senderEmail` (opcionais). Classificação por palavras-chave/regex (não usa LLM).

**Resposta** (200 OK): `{"success": true, "classification": {...}}`

### IA - Gerar Resposta de Email 🔒 (requer Bearer)

```http
POST /api/ai/email/response
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**: `classification` (`INFORMATION_REQUEST`, `BOOKING_REQUEST` ou `UNCLEAR`) e `senderEmail` são obrigatórios; `extractedData`, `missingFields` e `originalSubject` são opcionais.

**Resposta** (200 OK): `{"success": true, "responseData": {...}}`

> Ambas as rotas de email acima são de uso interno/administrativo e exigem token Bearer (401 sem token válido). Por estarem sob `/api/ai/`, também contam para o rate limit de 30 req/min.

## 📨 Endpoints do Processador de Emails 🔒 (todos requerem Bearer)

Gerenciam o processamento automático de emails via IMAP. A classificação dos emails é feita por **palavras-chave/regex** (não usa IA). Todos exigem `Authorization: Bearer <token>`.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/email-processor/start` | Inicia o processamento automático |
| POST | `/api/email-processor/stop` | Para o processamento |
| GET | `/api/email-processor/status` | Status atual do processador |
| GET | `/api/email-processor/logs` | Logs recentes de processamento (query `limit`, padrão 50) |
| GET | `/api/email-processor/logs/by-date` | Logs por intervalo de datas (query `startDate` e `endDate`, obrigatórios, formato ISO `YYYY-MM-DD`) |
| GET | `/api/email-processor/stats` | Estatísticas de processamento |
| POST | `/api/email-processor/test` | Testa a conexão IMAP configurada |
| POST | `/api/email-processor/manual-process` | Dispara um ciclo de processamento manual |

**Exemplo**:

```bash
curl http://localhost:8080/api/email-processor/status \
  -H "Authorization: Bearer $TOKEN"
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

Útil para verificar se o servidor está ativo. A mensagem retornada pode ser customizada pela variável de ambiente `PING_MESSAGE` (padrão: `"ping"`).

## 📊 Formato de Respostas

Não há um "envelope" genérico de resposta: cada endpoint de sucesso (2xx) retorna o JSON específico documentado acima (ex.: `{"rooms": [...]}`, `{"booking": {...}}`, ou o próprio objeto). Algumas rotas (`/api/ai/*`, `/api/email-processor/*`, autenticação) incluem também um campo `success: true`.

### Erro (4xx/5xx)

Erros retornam sempre um corpo JSON com o campo `error` contendo uma mensagem **em português**:

```json
{
  "error": "Descrição do erro em português"
}
```

Não existem campos `code` nem `status` no corpo — o status HTTP vem apenas no cabeçalho da resposta. Nas rotas `/api/ai/*`, `/api/email-processor/*` e de autenticação, o corpo de erro inclui também `"success": false`:

```json
{
  "success": false,
  "error": "O email informado não corresponde ao email da reserva"
}
```

### Não Autenticado (401)

Rotas protegidas sem token válido retornam:

```json
{
  "error": "Não autorizado"
}
```

### Rate Limit Excedido (429)

```json
{
  "error": "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente."
}
```

### Outros erros globais

- JSON malformado no corpo da requisição → **400** `{"error": "JSON inválido no corpo da requisição"}`
- Erro interno não tratado → **500** `{"error": "Erro interno do servidor"}`

## 🔐 CORS

As origens permitidas são configuradas pela variável de ambiente `CORS_ORIGIN` (lista separada por vírgula):

```env
CORS_ORIGIN=https://seudominio.com,https://outro.dominio.com
```

Quando `CORS_ORIGIN` **não** está definida, o CORS fica aberto (qualquer origem) — defina-a em produção.

## 📝 Exemplos com cURL

Exemplos em desenvolvimento (porta 8080). Em produção, troque para a porta 3000 / seu domínio.

### Login (obter token)

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "sua-senha"
  }'
```

### Listar Salas

```bash
curl -X GET http://localhost:8080/api/rooms
```

### Criar Sala (autenticado)

```bash
curl -X POST http://localhost:8080/api/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Sala 103",
    "capacity": 40
  }'
```

### Criar Agendamento

```bash
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "1",
    "clientName": "João Silva",
    "clientEmail": "joao@ioc.fiocruz.br",
    "date": "2026-08-15",
    "startTime": "14:00",
    "endTime": "15:00"
  }'
```

### Chat com IA

```bash
curl -X POST http://localhost:8080/api/chat \
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
**Última atualização**: 2026
