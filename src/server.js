const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`Servidor iniciado en http://localhost:${env.port}`);
});
