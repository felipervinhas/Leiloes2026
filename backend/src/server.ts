import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPool } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(errorHandler);

async function start() {
  try {
    await getPool();
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao conectar no banco de dados:', err);
    process.exit(1);
  }
}

start();
