// `new Date().toISOString().slice(0, 10)` dá sempre a data em UTC.
// Portugal está em UTC+1 no horário de verão (WEST) — entre a meia-noite
// e a 1h locais, isso devolve o dia ANTERIOR, o que pode abrir/fechar a
// caixa errada ou atribuir uma venda ao dia errado perto da meia-noite.
// Esta função devolve sempre a data correta no fuso de Portugal.
export function hojePT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

export function diasAtrasPT(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(d);
}
