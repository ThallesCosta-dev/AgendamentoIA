# Guia do Usuário - SalaAgenda

Bem-vindo ao SalaAgenda! Este guia ajudará você a agendar salas para sua defesa de tese de forma rápida e fácil.

## 🎯 O que é SalaAgenda?

SalaAgenda é um assistente inteligente que ajuda você a:
- **Agendar salas** para defesa de tese
- **Verificar disponibilidade** em tempo real
- **Gerenciar reservas** (modificar ou cancelar)
- **Receber confirmações** por email

Tudo isso através de uma conversa natural com um chatbot!

## 🚀 Começando

### Acessar a Aplicação

1. Abra seu navegador
2. Acesse: **http://localhost:5173** (desenvolvimento) ou o endereço da produção
3. Você verá a página inicial com o Assistente de Agendamento

### Interface do Chatbot

```
┌─────────────────────────────────────────┐
│  Assistente de Agendamento         [⊕]  │
│  Reserve sua sala de defesa de tese     │
├─────────────────────────────────────────┤
│                                         │
│  Bot: Olá! 👋 Bem-vindo ao            │
│  assistente de agendamento de salas     │
│  para defesa de tese...                 │
│                                         │
│  Digite sua resposta...           [→]   │
└─────────────────────────────────────────┘
```

## 📝 Processo de Agendamento

### Passo 1: Informar Seu Nome

**Bot**: "Qual é seu nome completo?"

**Você**: Digite seu nome como ele aparece no documento
- Exemplo: "João Silva da Costa"

### Passo 2: Confirmar Email Institucional

**Bot**: "Qual é seu email?"

**Você**: Digite seu email da instituição
- ✅ Válido: aluno@universidade.edu.br
- ✅ Válido: professor@faculdade.edu.br
- ❌ Inválido: joao@gmail.com

⚠️ **Importante**: Apenas emails .edu.br são aceitos!

### Passo 3: Escolher Data

**Bot**: "Qual data você deseja agendar?"

**Você**: Digite a data em um dos formatos:
- `25-12-2025` (formato DD-MM-YYYY)
- `25/12/2025` (formato DD/MM/YYYY)
- `15 de dezembro` (formato em português)

📌 **Restrições**:
- Apenas datas hoje ou no futuro
- Não é possível agendar no passado

### Passo 4: Informar Horário de Início

**Bot**: "Qual é o horário de INÍCIO que você deseja?"

**Você**: Digite a hora em um dos formatos:
- `14:30` (formato HH:mm)
- `14h30`
- `14` (apenas a hora)

⏰ **Válido**: Qualquer hora entre 00:00 e 23:59

### Passo 5: Informar Horário de Término

**Bot**: "Qual é o horário de TÉRMINO?"

**Você**: Digite a hora final
- Deve ser **depois** da hora de início
- Exemplo: Se começar às 14:30, termine às 15:30 ou depois

### Passo 6: Selecionar Sala

**Bot**: "Salas disponíveis para [data] de [hora início] a [hora término]:"
- [ ] Sala 101 (capacidade: 30 pessoas)
- [ ] Sala 102 (capacidade: 20 pessoas)
- [ ] Auditório Principal (capacidade: 100 pessoas)

**Você**: Digite o nome da sala ou número
- "Sala 101"
- "101"
- "Auditório Principal"

### Passo 7: Confirmar Agendamento

**Bot**: Mostra um resumo com:
- ✓ Nome completo
- ✓ Email
- ✓ Data
- ✓ Horário
- ✓ Sala selecionada

**Bot**: "Deseja confirmar este agendamento?"

**Você**: Digite `sim` ou `yes` para confirmar

### ✅ Sucesso!

Você receberá:
1. **Mensagem de sucesso** no chat com ID da reserva
2. **Email de confirmação** com detalhes
3. **ID da Reserva** (salve para futuras modificações)

## 🔄 Gerenciando Sua Reserva

### Modificar Agendamento

**Você**: "Quero modificar meu agendamento"

**Bot**: Pedirá o ID da reserva (ex: #12345)

**Você**: Digite o ID recebido na confirmação

**Bot**: Mostrará dados atuais e perguntará o que mudar:
- Nome
- Email
- Data
- Hora inicial
- Hora final
- Sala

**Você**: Escolha o campo a modificar

**Você**: Digite o novo valor

✅ **Pronto**: Seu agendamento foi atualizado!

### Cancelar Agendamento

**Você**: "Quero cancelar meu agendamento"

**Bot**: Pedirá o ID da reserva

**Você**: Digite o ID

**Bot**: Mostrará dados atuais

**Bot**: "Tem certeza que deseja CANCELAR?"

**Você**: Digite `sim` para confirmar ou `não` para cancelar

✅ **Cancelado**: Seu agendamento foi deletado

## 💡 Dicas Úteis

### Linguagem Natural
O chatbot entende linguagem natural! Você pode:
- ❌ "Quero agendar uma sala"
- ✅ "Gostaria de agendar a Sala 101 para amanhã às 14h"
- ✅ "Preciso de uma sala no dia 25 de dezembro de 2025 de 15 a 16 horas"

### Correção de Dados
Se erra uma informação:
- Digite a informação correta no próximo mensagem
- O sistema aceitará a última informação válida

### Múltiplos Agendamentos
Você pode agendar várias salas:
- Termine um agendamento
- Converse com o bot novamente para novo agendamento
- Cada um terá seu próprio ID

### Salvar ID da Reserva
Após agendar, você recebe um ID:
```
📌 **ID da Reserva: #12345**
```

💾 **Salve este ID** para:
- Modificar o agendamento
- Cancelar a reserva
- Ter prova da reserva

## 🆘 Troubleshooting

### "Email inválido. Use um email .edu.br"
❌ Problema: Você digitou um email pessoal
✅ Solução: Use seu email da instituição (termina em .edu.br)

### "Data inválida. A data deve ser hoje ou no futuro"
❌ Problema: Tentou agendar para uma data passada
✅ Solução: Escolha uma data a partir de hoje

### "Horário inválido"
❌ Problema: Formatação incorreta
✅ Solução: Use formatos válidos:
- `14:30`
- `14h30`
- `14`

### "Nenhuma sala disponível para este horário"
❌ Problema: Todas as salas estão ocupadas
✅ Solução: 
- Tente outro horário
- Tente outra data
- Aumente o intervalo de tempo

### Não recebo email de confirmação
❌ Problema: Email pode estar no spam
✅ Solução:
- Verifique a pasta de spam
- Verifique se o email está correto
- Contate o administrador

## ✍️ Exemplo Completo

```
Você: Olá, quero agendar uma sala

Bot: Bem-vindo! Qual é seu nome completo?

Você: Maria Silva Santos

Bot: Qual é seu email institucional?

Você: maria.silva@universidade.edu.br

Bot: Qual data você deseja? (formato: DD/MM/YYYY)

Você: 25/12/2025

Bot: Qual é a hora de INÍCIO? (formato: HH:mm)

Você: 14:30

Bot: Qual é a hora de TÉRMINO?

Você: 15:30

Bot: ✅ Salas disponíveis para 25/12/2025 de 14:30 a 15:30:
- Sala 101 (capacidade: 30)
- Auditório Principal (capacidade: 100)

Qual sala você prefere?

Você: Sala 101

Bot: ✅ Resumo:
- Nome: Maria Silva Santos
- Email: maria.silva@universidade.edu.br
- Data: 25/12/2025
- Horário: 14:30 - 15:30
- Sala: Sala 101

Deseja confirmar?

Você: Sim

Bot: ✅ Perfeito! Sua defesa foi agendada com sucesso!
📌 **ID da Reserva: #12345**

Confirmação enviada para: maria.silva@universidade.edu.br
```

## 📞 Suporte

Encontrou um problema?

1. **Revise as seções acima** - Pode ser um erro simples
2. **Fale com o chatbot** - Ele pode ajudar com dúvidas sobre formato
3. **Contate o administrador** - Para problemas técnicos
   - Email: atendimentoia.naoresponda@gmail.com
   - Acesse: /admin (painel administrativo)

## 📋 Checklist Antes de Agendar

- [ ] Tenho meu nome completo?
- [ ] Tenho um email .edu.br válido?
- [ ] Sei que dia e horário preciso?
- [ ] Horário final é depois do horário inicial?
- [ ] Data é hoje ou no futuro?

## 🎓 Próximas Etapas

Após agendar:
1. Procure pela confirmação de email
2. Salve o ID da reserva
3. Prepare-se para sua defesa
4. Se precisar mudar, converse com o bot
5. Compareça 15 minutos antes do horário

---

**Versão**: 1.0.0
**Última atualização**: 2024

Boa defesa! 🎓
