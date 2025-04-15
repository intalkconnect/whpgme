require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    const paymentUrl = data.data.checkouts?.[0]?.payment_url;
    const statusPagamento = data.data.status;
    
    if (!paymentUrl || !statusPagamento) {
      console.warn('payment_url ou status não encontrado no payload.');
      return res.status(200).send('Dados incompletos, mas webhook recebido.');
    }
    
    console.log(`Procurando por payment_url: ${paymentUrl}`);
    
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?filterByFormula={Checkout}="${paymentUrl}"`;


    const searchResponse = await axios.get(searchUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`
      }
    });

    const records = searchResponse.data.records;

    if (records.length === 0) {
      console.log(`Nenhum registro encontrado com checkout ${paymentUrl}`);
      return res.status(200).send('Registro não encontrado, mas webhook recebido.');
    }

    const recordId = records[0].id;

    // Atualiza o campo "pagamento"
    await axios.patch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}/${recordId}`,
      {
        fields: {
          Pagamento: statusPagamento
        }
      },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Registro ${recordId} atualizado com status: ${statusPagamento}`);
    res.status(200).send('Atualização realizada com sucesso.');
  } catch (err) {
    console.error('Erro no webhook:', err.message);
    res.status(200).send('Erro interno, mas webhook recebido.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
