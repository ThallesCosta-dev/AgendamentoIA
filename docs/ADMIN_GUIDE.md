# Guia do Administrador - SalaAgenda

Este guia descreve como usar o painel administrativo para gerenciar salas e agendamentos.

## 🔐 Acessando o Painel Admin

### Login

1. Acesse: **http://localhost:5173/admin** (ou seu domínio de produção)
2. Digite as credenciais:
   - **Usuário**: `admin`
   - **Senha**: `admin123`
3. Clique em "Entrar"

⚠️ **Segurança**: Altere as credenciais padrão imediatamente em produção!

### Interface Principal

```
┌────────────────────────────────────────────┐
│  SalaAgenda  [Chatbot] [Admin] [Sair]      │
├──────────────┬─────��────────────────────────┤
│              │                              │
│  SALAS       │  Aba 1: Salas              │
│  AGENDAMENTOS│  Aba 2: Agendamentos       │
│              │                              │
│              │  [Tabela de dados]          │
│              │                              │
└──────────────┴──────────────────────────────┘
```

## 🏢 Gerenciando Salas

### Visualizar Salas

A aba "Salas" mostra uma tabela com todas as salas cadastradas:

| ID | Nome | Capacidade | Ações |
|----|----|-----------|--------|
| 1 | Sala 101 | 30 | ✏️ Editar, 🗑️ Deletar |
| 2 | Auditório Principal | 100 | ✏️ Editar, 🗑️ Deletar |
| 3 | Sala de Conferência A | 20 | ✏️ Editar, 🗑️ Deletar |

### Criar Nova Sala

1. Clique no botão **"+ Adicionar Sala"**
2. Preencha o formulário:
   - **Nome da Sala**: Identificação clara
     - Exemplo: "Sala 101", "Auditório A", "Sala de Conferência"
   - **Capacidade**: Número máximo de pessoas
     - Exemplo: 30, 50, 100

3. Clique em **"Criar"**
4. Você receberá uma confirmação

### Editar Sala

1. Localize a sala na tabela
2. Clique no ícone **✏️ Editar**
3. Um modal abrirá com os dados atuais
4. Modifique as informações desejadas
5. Clique em **"Salvar"**

### Deletar Sala

⚠️ **Atenção**: Esta ação é irreversível!

1. Localize a sala na tabela
2. Clique no ícone **🗑️ Deletar**
3. Um diálogo de confirmação aparecerá
4. Confirme a exclusão
5. A sala e todos seus agendamentos serão deletados

**Cuidado**: Ao deletar uma sala, todos os agendamentos nela também serão removidos!

## 📅 Gerenciando Agendamentos

### Visualizar Agendamentos

A aba "Agendamentos" mostra uma tabela com todos os agendamentos:

| ID | Cliente | Email | Sala | Data | Hora Início | Hora Fim | Ações |
|----|---------|-------|------|------|------------|----------|--------|
| 1 | João Silva | joao@uni.edu.br | Sala 101 | 2025-02-15 | 14:00 | 15:00 | ✏️ 🗑️ |
| 2 | Maria Costa | maria@uni.edu.br | Auditório | 2025-02-15 | 15:00 | 16:00 | ✏️ 🗑️ |

### Editar Agendamento

1. Clique no ícone **✏️ Editar** do agendamento
2. Um modal abrirá com os dados atuais
3. Você pode modificar:
   - **Nome do Cliente**: Nome completo
   - **Email**: Email institucional (.edu.br)
   - **Data**: Data do agendamento (YYYY-MM-DD)
   - **Hora Início**: Formato HH:mm (ex: 14:30)
   - **Hora Fim**: Formato HH:mm (ex: 15:30)
   - **Sala**: Selecione uma sala disponível

4. Clique em **"Salvar"**

### Cancelar Agendamento

1. Clique no ícone **🗑️ Deletar** do agendamento
2. Confirme a exclusão
3. O agendamento será removido permanentemente

### Filtrar Agendamentos

Você pode visualizar agendamentos por:
- **Data específica**: Use o filtro de data
- **Cliente**: Procure pelo nome ou email
- **Sala**: Filtre por sala específica

## 📊 Dashboard (Resumo)

A página inicial do painel mostra:

- **Total de Salas**: Número total de salas cadastradas
- **Total de Agendamentos**: Agendamentos atuais
- **Próximos Agendamentos**: Próximas defesas agendadas
- **Salas Disponíveis Hoje**: Salas livres hoje

## ⚙️ Configurações e Segurança

### Alterar Senha Admin

⚠️ **Importante**: A senha padrão é `admin123`. Você DEVE alterar isto em produção.

Para alterar (via código):
1. Edite `client/context/AuthContext.tsx`
2. Procure por: `if (username === "admin" && password === "admin123")`
3. Altere a senha
4. Recompile a aplicação

**Melhor prática**: Use um gerenciador de senhas com hash em produção.

### Logout

1. Clique no botão **"Sair"** no canto superior direito
2. Será redirecionado para a página de login
3. Sua sessão será encerrada

## 📋 Validações e Regras

### Para Salas

- **Nome**: Obrigatório, único (não pode haver duas salas com mesmo nome)
- **Capacidade**: Número positivo (ex: 30, 50, 100)

### Para Agendamentos

- **Nome do Cliente**: Obrigatório, deve conter pelo menos 2 caracteres
- **Email**: Obrigatório, deve ser válido e terminar em `.edu.br`
- **Data**: Obrigatória, deve ser hoje ou no futuro
- **Hora Início**: Obrigatória, formato HH:mm (00:00 a 23:59)
- **Hora Fim**: Obrigatória, deve ser DEPOIS da hora início
- **Sala**: Obrigatória, deve estar cadastrada

### Validação de Conflitos

O sistema previne:
- Agendamentos sobrepostos na mesma sala
- Emails inválidos (não .edu.br)
- Datas no passado
- Horas inválidas (fim antes de início)

## 📊 Relatórios

### Ver Estatísticas

Na tabela de agendamentos, você pode:
1. **Ordenar por coluna**: Clique no cabeçalho
2. **Buscar**: Use a barra de pesquisa
3. **Filtrar**: Por data, sala, cliente

### Exportar Dados

Atualmente, você pode:
- Copiar dados manualmente da tabela
- Tirar screenshot para registros
- Anotar IDs de agendamentos

## 🔄 Fluxo Típico de Administrador

### Rotina Diária

1. **Acessar painel**: Verificar novos agendamentos
2. **Revisar próximos agendamentos**: Confirmar disponibilidade
3. **Responder modificações**: Se clientes pedirem mudanças
4. **Preparar salas**: Garantir que estão prontas

### Rotina Semanal

1. **Gerar relatório**: Listar agendamentos da semana
2. **Revisar salas**: Verificar capacidade e equipamento
3. **Comunicar defesas**: Notificar professores e alunos
4. **Manutenção**: Atualizar salas conforme necessário

### Rotina Mensal

1. **Backup de dados**: Salvar banco de dados
2. **Revisar logs**: Verificar atividades
3. **Limpeza**: Remover agendamentos muito antigos
4. **Relatório**: Gerar estatísticas do mês

## 🆘 Troubleshooting

### "Não consigo fazer login"
❌ Problema: Credenciais incorretas
✅ Solução:
- Verifique se CAPS LOCK está desligado
- Confirme username e password
- Limpe cookies (Ctrl+Shift+Del) e tente novamente

### "Não consigo deletar uma sala"
❌ Problema: Sala pode ter agendamentos
✅ Solução:
- Cancele todos os agendamentos da sala primeiro
- Depois delete a sala

### "Email inválido ao salvar agendamento"
❌ Problema: Email não termina em .edu.br
✅ Solução:
- Use apenas emails institucionais
- Formato: usuario@instituicao.edu.br

### "Horário inválido"
❌ Problema: Formato incorreto ou lógica inválida
✅ Solução:
- Use formato HH:mm (ex: 14:30)
- Hora fim deve ser depois de hora início

### "Não consigo editar um agendamento antigo"
❌ Problema: Pode estar em data passada
✅ Solução:
- O sistema não permite modificar datas passadas
- Se necessário, delete e crie novo agendamento

## 📞 Suporte

### Problemas Técnicos

1. **Verificar console**: F12 → Console → Procure por erros (vermelho)
2. **Reiniciar aplicação**: Às vezes resolve problemas temporários
3. **Limpar cache**: Ctrl+Shift+Delete → Limpar cache navegador
4. **Contactar desenvolvedor**: Se problema persistir

### Dúvidas sobre Funcionalidade

Consulte os documentos:
- [USER_GUIDE.md](USER_GUIDE.md) - Como usuários usam
- [API.md](API.md) - Endpoints técnicos
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Detalhes técnicos

## 🔒 Boas Práticas de Segurança

### Senha Segura
- [ ] Mudou a senha padrão
- [ ] Usa combinação de números e letras
- [ ] Mínimo 12 caracteres em produção
- [ ] Não compartilhada com outros

### Dados Confidenciais
- [ ] Não compartilhe URLs diretas do admin
- [ ] Não faça screenshot com emails visíveis
- [ ] Use VPN ou conexão segura

### Logs e Auditoria
- [ ] Mantenha logs de alterações
- [ ] Registre quem modificou o quê
- [ ] Faça backup regularmente

## 📅 Calendário

### Dentro do Sistema

O agendamento segue:
- Formato de data: **YYYY-MM-DD** (2025-02-15)
- Formato de hora: **HH:mm** (14:30)
- Fuso horário: Local do servidor

### Conversão Local

Se precisa converter:
- **DD/MM/YYYY para YYYY-MM-DD**: 
  - 25/12/2025 → 2025-12-25

---

**Versão**: 1.0.0
**Última atualização**: 2024

Administração responsável! 🛡️
