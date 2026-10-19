import { configured, initialize } from "../lib/sheets.ts";
async function main() {
  if (!configured())
    throw new Error(
      "Configure GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY em .env ou .env.local.",
    );
  await initialize();
  console.log(
    "Inicialização concluída. Abas: Animais, Participantes, Lancamentos, Configuracoes e Movimentacoes. Nenhum dado de demonstração foi enviado.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
