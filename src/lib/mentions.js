// Mencoes do feed: @handle (pessoa ou autor) e #tag.
// O texto e guardado como texto puro no banco — nada de HTML. A resolucao dos
// links acontece na renderizacao, contra as listas que o app ja tem em memoria,
// entao nao ha markup vindo do usuario para injetar em lugar nenhum.

const PADRAO = /(@[A-Za-z0-9_.]{2,32}|#[\p{L}\p{N}_]{2,32})/gu;

function normalizar(valor) {
  return (valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function tokenizarMencoes(texto) {
  if (!texto) return [];
  const partes = String(texto).split(PADRAO);

  return partes.filter(Boolean).map((parte) => {
    if (parte.startsWith("@")) return { tipo: "mencao", valor: parte.slice(1), texto: parte };
    if (parte.startsWith("#")) return { tipo: "tag", valor: parte.slice(1), texto: parte };
    return { tipo: "texto", texto: parte };
  });
}

export function resolverMencao(handle, { profiles = [], authors = [] } = {}) {
  const alvo = normalizar(handle);
  if (!alvo) return null;

  const perfil = profiles.find(
    (item) => normalizar(item.username) === alvo || normalizar(item.name) === alvo
  );
  if (perfil) {
    return { tipo: "perfil", id: perfil.id, rotulo: perfil.name || perfil.username, href: `/app/perfil/${perfil.id}` };
  }

  const autor = authors.find((item) => normalizar(item.name) === alvo);
  if (autor) {
    return { tipo: "autor", id: autor.id, rotulo: autor.name, href: `/app/autor/${autor.id}` };
  }

  return null;
}

export function handleDoPerfil(perfil) {
  return (
    perfil?.username ||
    normalizar(perfil?.name) ||
    "leitor"
  );
}
