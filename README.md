# SalaAgenda - Assistente de Agendamento de Salas

![Status](https://img.shields.io/badge/status-ativo-brightgreen)
![Versão](https://img.shields.io/badge/versão-1.0.0-blue)
![Licença](https://img.shields.io/badge/licença-MIT-green)

**SalaAgenda** é uma aplicação web moderna para agendamento de salas. Oferece uma interface conversacional intuitiva através de um chatbot alimentado por IA, além de um painel administrativo robusto para gerenciar salas e reservas.

## 🎯 Características Principais

### Para Usuários
- **Chatbot Inteligente**: Interface conversacional em português para agendamento de salas
- **Agendamento em Tempo Real**: Verificação instantânea de disponibilidade
- **Extração Automática de Dados**: O chatbot identifica nome, email, data e horário na conversa
- **Modificação e Cancelamento**: Gerencia suas reservas de forma simples
- **Confirmação por Email**: Receba confirmação e detalhes da reserva por email
- **Agendamento por Email**: Emails enviados para a caixa institucional são processados automaticamente (classificação por palavras-chave/regex)

### Para Administradores
- **Painel de Controle**: Interface clara e intuitiva para gerenciar a plataforma
- **Gerenciamento de Salas**: Criar, editar e deletar salas de agendamento
- **Gerenciamento de Agendamentos**: Visualizar, modificar ou cancelar reservas
- **Autenticação Segura**: Login no servidor com token (validade de 8 horas)

### Para Desenvolvedores
- **API REST Completa**: Endpoints bem documentados para integração
- **Stack Moderno**: React, TypeScript, Express, armazenamento em arquivo JSON
- **Código Limpo**: Estrutura bem organizada e fácil de manter
- **Deploy Simplificado**: Servidor Node.js único (PM2/systemd)

## 🚀 Quick Start

### Instalação Rápida

```bash
# 1. Clonar o repositório
git clone <repository-url>
cd salaagenda

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env

# 4. Iniciar servidor de desenvolvimento
npm run dev
```

> Não há banco de dados para instalar ou configurar: o arquivo de dados (`data/db.json`) é criado automaticamente na primeira execução.

### Acesso Inicial

Em desenvolvimento, tudo roda em uma única porta (o Vite serve o SPA e monta o Express como middleware — não há porta separada de backend):

- **Aplicação**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin
- **Credenciais Admin**: configuradas pelas variáveis de ambiente `ADMIN_USERNAME` e `ADMIN_PASSWORD`. Em desenvolvimento, o padrão é `admin` / `admin123`; em produção, `ADMIN_PASSWORD` é **obrigatória** e deve ser alterada.

Em produção (`npm run build` + `npm start`), a aplicação roda na porta **3000** (configurável via `PORT`).

## 📚 Documentação

A documentação está organizada em múltiplos arquivos para facilitar a navegação:

| Documento | Público | Conteúdo |
|-----------|---------|----------|
| [SETUP.md](docs/SETUP.md) | Todos | Instalação, configuração e dependências |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Usuários | Como usar o chatbot e agendar salas |
| [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | Administradores | Gerenciamento do painel administrativo |
| [API.md](docs/API.md) | Desenvolvedores | Referência completa de endpoints |
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Desenvolvedores | Arquitetura, setup dev e contribuição |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | DevOps | Deploy em produção |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetos | Arquitetura e decisões técnicas |

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **React Router** - Roteamento
- **React Query** - Gerenciamento de dados
- **Sonner** - Notificações toast

### Backend
- **Node.js** - Runtime
- **Express 5** - Framework web
- **Armazenamento em arquivo JSON (sem banco de dados)** - dados em `data/db.json`, criado automaticamente
- **Groq** - LLM do chatbot (modelo `llama-3.3-70b-versatile`, tier gratuito)
- **IMAP + Nodemailer** - Processamento e envio de emails

### DevOps
- **Vite** - Build tool (dev server na porta 8080 com Express integrado)
- **TypeScript** - Compilação
- **PM2/systemd** - Deploy recomendado (servidor Node.js)

## 📋 Requisitos de Sistema

- **Node.js**: v22.0.0 ou superior
- **npm**: v10.0.0 ou superior
- **Navegador**: Chrome, Firefox, Safari ou Edge (versões recentes)

> Não é necessário nenhum servidor de banco de dados: os dados ficam em um arquivo JSON (`data/db.json`) criado automaticamente na primeira execução.

## 🔑 Variáveis de Ambiente

```env
# Armazenamento de dados — opcional
DATA_DIR=./data   # diretório do arquivo db.json (padrão: ./data)

# IA / Chatbot (obrigatória para o chatbot funcionar)
GROQ_API_KEY=sua-chave-groq
GROQ_MODEL=llama-3.3-70b-versatile   # opcional (padrão)

# Email de confirmação (SMTP)
SMTP_HOST=smtp.seuservidor.br
SMTP_PORT=587
SMTP_USER=usuario@dominio.br
SMTP_PASS=sua-senha-smtp
SMTP_TLS=true
EMAIL_FROM=SalaAgenda <nao-responda@dominio.br>   # opcional
# Alternativa legada: EMAIL_USER + EMAIL_PASSWORD (Gmail com senha de aplicativo)

# Processador de emails (IMAP) — opcional
IOC_EMAIL_HOST=imap.gmail.com
IOC_EMAIL_PORT=993
IOC_EMAIL_USER=caixa-monitorada@dominio
IOC_EMAIL_PASSWORD=senha-de-aplicativo
IOC_EMAIL_FOLDER=INBOX
IOC_EMAIL_CHECK_INTERVAL=5
IOC_EMAIL_PROCESSING_ENABLED=false

# Aplicação
APP_URL=http://localhost:8080
PORT=3000
NODE_ENV=development

# Autenticação do painel admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=defina-uma-senha-forte   # obrigatória em produção

# Segurança
ALLOWED_EMAIL_DOMAINS=fiocruz.br,edu.br  # domínios de email aceitos (subdomínios inclusos)
CORS_ORIGIN=https://seudominio.com       # origens permitidas (separadas por vírgula); aberto se não definida
```

Veja [SETUP.md](docs/SETUP.md) para mais detalhes.

## 👥 Uso Típico

### Usuário Agendando uma Sala
1. Acessar o chatbot em http://localhost:8080
2. Conversar naturalmente com o assistente
3. Informar: nome, email, data e horários desejados
4. Selecionar sala disponível
5. Confirmar agendamento
6. Receber confirmação por email

### Administrador Gerenciando Salas
1. Acessar painel em http://localhost:8080/admin
2. Login com credenciais admin (definidas via `ADMIN_USERNAME`/`ADMIN_PASSWORD`)
3. Criar/editar/deletar salas
4. Visualizar e gerenciar agendamentos
5. Modificar ou cancelar reservas conforme necessário

## 🔐 Segurança

- **Autenticação Admin no Servidor**: Login via `POST /api/auth/login` retorna um token (validade de 8 horas) enviado como `Authorization: Bearer <token>`. Endpoints administrativos (gestão de salas, agendamentos e processador de emails) exigem esse token.
- **Validação de Email**: Lista de domínios permitidos configurável via `ALLOWED_EMAIL_DOMAINS` (padrão: `fiocruz.br,edu.br`, subdomínios aceitos — ex.: `@ioc.fiocruz.br`)
- **Validação de Dados**: Todos os inputs são validados no backend
- **CORS Configurável**: Origens permitidas definidas via `CORS_ORIGIN` (aberto quando não definida)
- **Rate Limiting**: Limitador em memória no endpoint `/api/chat`
- **Reservas sem Conflito**: Prevenção de agendamentos duplicados na mesma sala/horário — a verificação e a gravação são serializadas no processo único do servidor

## 📞 Suporte

### Para Usuários
- Consulte [USER_GUIDE.md](docs/USER_GUIDE.md)
- Converse com o chatbot para dúvidas sobre agendamento

### Para Administradores
- Consulte [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)
- Verifique [DEPLOYMENT.md](docs/DEPLOYMENT.md) para questões de servidor

### Para Desenvolvedores
- Consulte [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- Veja [API.md](docs/API.md) para referência técnica

## 🤝 Contribuindo

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autores

Desenvolvido com ❤️ como assistente inteligente de agendamento.

---

**Última atualização**: 2026
**Versão**: 1.0.0
