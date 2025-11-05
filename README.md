# SalaAgenda - Assistente de Agendamento de Salas

![Status](https://img.shields.io/badge/status-ativo-brightgreen)
![Versão](https://img.shields.io/badge/versão-1.0.0-blue)
![Licença](https://img.shields.io/badge/licença-MIT-green)

**SalaAgenda** é uma aplicação web moderna para agendamento de salas de defesa de tese em instituições educacionais. Oferece uma interface conversacional intuitiva através de um chatbot alimentado por IA, além de um painel administrativo robusto para gerenciar salas e reservas.

## 🎯 Características Principais

### Para Usuários
- **Chatbot Inteligente**: Interface conversacional em português para agendamento de salas
- **Agendamento em Tempo Real**: Verificação instantânea de disponibilidade
- **Validação Inteligente**: Extração automática de informações (nome, email, data, horário)
- **Modificação e Cancelamento**: Gerencia suas reservas de forma simples
- **Confirmação por Email**: Receba confirmação e detalhes da reserva por email

### Para Administradores
- **Painel de Controle**: Interface clara e intuitiva para gerenciar a plataforma
- **Gerenciamento de Salas**: Criar, editar e deletar salas de agendamento
- **Gerenciamento de Agendamentos**: Visualizar, modificar ou cancelar reservas
- **Autenticação Segura**: Login protegido para acesso ao painel admin

### Para Desenvolvedores
- **API REST Completa**: Endpoints bem documentados para integração
- **Stack Moderno**: React, TypeScript, Express, MySQL
- **Código Limpo**: Estrutura bem organizada e fácil de manter
- **Deploy Simplificado**: Suporte para Netlify, Vercel e Node.js

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

### Acesso Inicial

- **Aplicação**: http://localhost:5173
- **Admin Panel**: http://localhost:5173/admin
- **Credenciais Padrão**: 
  - Usuário: `admin`
  - Senha: `admin123`

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
- **MySQL 2** - Banco de dados
- **OpenRouter AI** - LLM para chatbot

### DevOps
- **Vite** - Build tool
- **TypeScript** - Compilação
- **Netlify/Vercel** - Deployment

## 📋 Requisitos de Sistema

- **Node.js**: v22.0.0 ou superior
- **npm/pnpm**: v10.14.0 ou superior
- **MySQL**: v8.0 ou superior
- **Navegador**: Chrome, Firefox, Safari ou Edge (versões recentes)

## 🔑 Variáveis de Ambiente

```env
# Banco de Dados
DB_HOST=seu-host-mysql
DB_USER=seu-usuario
DB_PASSWORD=sua-senha
DB_NAME=seu-banco
DB_PORT=3306

# AI / Chatbot
OPENROUTER_API_KEY=sua-chave-openrouter

# Aplicação
APP_URL=http://localhost:5173
PORT=3000
```

Veja [SETUP.md](docs/SETUP.md) para mais detalhes.

## 👥 Uso Típico

### Usuário Agendando uma Sala
1. Acessar o chatbot em http://localhost:5173
2. Conversar naturalmente com o assistente
3. Informar: nome, email, data e horários desejados
4. Selecionar sala disponível
5. Confirmar agendamento
6. Receber confirmação por email

### Administrador Gerenciando Salas
1. Acessar painel em http://localhost:5173/admin
2. Login com credenciais admin
3. Criar/editar/deletar salas
4. Visualizar e gerenciar agendamentos
5. Modificar ou cancelar reservas conforme necessário

## 🔐 Segurança

- **Validação de Email**: Aceita apenas emails .edu.br (institucionais)
- **Autenticação Admin**: Login protegido com armazenamento local seguro
- **Validação de Dados**: Todos os inputs são validados no backend
- **CORS Ativado**: Controle de origem configurável
- **Rate Limiting**: Proteção contra abuso (recomendado em produção)

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

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 👨‍💻 Autores

Desenvolvido com ❤️ como assistente inteligente de agendamento.

---

**Última atualização**: 2024
**Versão**: 1.0.0
