import "dotenv/config";
import { createApp } from "./app";
import { loadPermissionCache } from "./lib/permissions";

const app = createApp();
const PORT = Number(process.env.PORT) || 3333;

loadPermissionCache()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao carregar permissões RBAC:", error);
    process.exit(1);
  });
