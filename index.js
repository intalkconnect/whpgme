require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const PQueue = require('p-queue');

const app = express();
const queue = new PQueue({
  concurrency: 1,       // Só 1 requisição por vez
  interval: 1000,       // Intervalo de tempo (1s)
  intervalCap: 5        // Até 5 requisições por segundo
});

const PORT = process.env.PORT || 3000;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  // Enfileira a execução do webhook
  queue.add(() => handleWebhook(req.body))
    .then(() => {
      res.status(200).send('Webhook enfileirado e processado.');
    })
    .catch((err) => {
      console.error('Erro ao processar webhook enfileirado:', err.message);
      res.status(200).send('Erro interno, mas webhook recebido.');
    });
});

async function handleWebhook(data) {
  const paymentUrl = data.data.checkouts?.[0]?.payment_url;
  const statusPagamento = data.data.status;

  if (!paymentUrl || !statusPagamento) {
    console.warn('payment_url ou status não encontrado no payload.');
    return;
  }

  if (statusPagamento === 'pending') {
    console.log(`Pagamento pendente para ${paymentUrl}. Nenhuma ação realizada.`);
    return;
  }

  if (statusPagamento !== 'paid') {
    console.log(`Status "${statusPagamento}" ignorado para ${paymentUrl}.`);
    return;
  }

  console.log(`🔍 Buscando registro com payment_url: ${paymentUrl}`);

  const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula={Checkout}="${paymentUrl}"`;

  const searchResponse = await axios.get(searchUrl, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`
    }
  });

  const records = searchResponse.data.records;

  if (records.length === 0) {
    console.log(`⚠️ Nenhum registro encontrado para ${paymentUrl}`);
    return;
  }

  const recordId = records[0].id;

  console.log(`✅ Atualizando registro ${recordId} com Pagamento: Confirmado`);

  await axios.patch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`,
    {
      fields: {
        Pagamento: 'Confirmado'
      },
      typecast: true
    },
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
