import "dotenv/config";
import { createApp } from "./app";

const app = createApp();
const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
