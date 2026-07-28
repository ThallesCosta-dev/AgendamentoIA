# Deploy - SalaAgenda

O SalaAgenda inclui, além do chatbot web, um sistema de **agendamento por email**: emails enviados para a caixa institucional monitorada (ex.: `reservas@ioc.fiocruz.br`) são lidos via IMAP em intervalos regulares, classificados por palavras-chave/regex (pedido de reserva, pedido de informação ou indefinido) e processados automaticamente — reservas completas são criadas no sistema e confirmadas por email; pedidos incompletos ou de informação recebem uma resposta automática solicitando os dados faltantes.

📚 **O guia canônico de deploy é [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — ele cobre variáveis de ambiente, deploy recomendado em servidor Node.js (PM2/systemd), configuração do processador de emails, segurança e as limitações do deploy serverless (Netlify).

---

**Versão**: 1.0.0
