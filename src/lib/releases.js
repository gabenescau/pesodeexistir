// Espelha public.is_book_released() do banco (migration 00011).
// A regra vive nos dois lados de proposito: o banco e quem realmente barra a
// URL assinada do PDF; aqui e so para a tela nao oferecer o que vai falhar.

const DIA_EM_MS = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  // `release_date` e um DATE do Postgres ("2026-07-24"). Sem o horario
  // explicito o JS interpreta como UTC e o Brasil vira o dia anterior.
  const data = new Date(`${valor}T00:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function hoje() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  return data;
}

export function releaseStatus(bookId, weeklyReleases = []) {
  const agendamentos = weeklyReleases
    .filter((item) => (item.book_id || item.books?.id) === bookId)
    .map((item) => ({ ...item, data: paraData(item.release_date) }))
    .filter((item) => item.data)
    .sort((a, b) => a.data - b.data);

  if (agendamentos.length === 0) {
    return { agendado: false, liberado: true, data: null, diasRestantes: 0 };
  }

  const hoje0 = hoje();
  const jaLiberado = agendamentos.find((item) => item.data <= hoje0);

  if (jaLiberado) {
    return { agendado: true, liberado: true, data: jaLiberado.data, diasRestantes: 0 };
  }

  const proximo = agendamentos[0];
  return {
    agendado: true,
    liberado: false,
    data: proximo.data,
    diasRestantes: Math.max(0, Math.ceil((proximo.data - hoje0) / DIA_EM_MS)),
  };
}

export function isReleased(bookId, weeklyReleases = []) {
  return releaseStatus(bookId, weeklyReleases).liberado;
}

export function formatarData(data) {
  if (!data) return "";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function contagemRegressiva(diasRestantes) {
  if (diasRestantes <= 0) return "Liberando hoje";
  if (diasRestantes === 1) return "Falta 1 dia";
  return `Faltam ${diasRestantes} dias`;
}
