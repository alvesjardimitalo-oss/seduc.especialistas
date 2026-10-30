// Utilitários de interface: escape, modais, avisos e campos.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export function aviso(msg, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + tipo; el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.textContent = msg; document.body.append(el);
  setTimeout(() => el.classList.add('saindo'), 3800); setTimeout(() => el.remove(), 4300);
}
export function erro(e) {
  console.error(e);
  const m = String(e?.code || '').includes('permission-denied')
    ? 'Operação não autorizada para sua conta (ou os dados não passaram na validação).'
    : (e?.message || String(e));
  aviso(m, 'erro');
}

/**
 * Abre um modal com formulário. `aoSalvar(dados, form)` pode lançar erro (fica aberto).
 * Retorna o elemento do formulário para ajustes extras.
 */
export function modal({ titulo, corpo, botao = 'Salvar', aoSalvar, largo = false, somenteLeitura = false }) {
  fecharModal();
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo'; fundo.id = 'modal';
  fundo.innerHTML = '<div class="modal' + (largo ? ' modal-largo' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">'
    + '<header><h2 id="modal-titulo">' + esc(titulo) + '</h2><button type="button" class="icone-btn" data-fechar aria-label="Fechar">✕</button></header>'
    + '<form novalidate><div class="modal-corpo">' + corpo + '</div><p class="form-erro" role="alert" hidden></p>'
    + '<footer><button type="button" class="btn sec" data-fechar>' + (somenteLeitura ? 'Fechar' : 'Cancelar') + '</button>'
    + (somenteLeitura ? '' : '<button type="submit" class="btn">' + esc(botao) + '</button>') + '</footer></form></div>';
  document.body.append(fundo);
  const form = $('form', fundo), msg = $('.form-erro', fundo);
  $$('[data-fechar]', fundo).forEach(b => b.onclick = fecharModal);
  fundo.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
  form.onsubmit = async e => {
    e.preventDefault(); msg.hidden = true;
    const enviar = $('[type=submit]', form);
    if (!form.checkValidity()) { const inv = form.querySelector(':invalid'); msg.textContent = 'Preencha: ' + (inv?.closest('label')?.firstChild?.textContent?.trim() || 'campos obrigatórios'); msg.hidden = false; inv?.focus(); return; }
    enviar.disabled = true; enviar.dataset.texto = enviar.textContent; enviar.textContent = 'Salvando…';
    try { await aoSalvar?.(dadosDoForm(form), form); fecharModal(); }
    catch (err) {
      console.error(err);
      msg.textContent = String(err?.code || '').includes('permission-denied') ? 'O servidor recusou a gravação: verifique sua permissão ou os dados informados.' : err.message;
      msg.hidden = false; enviar.disabled = false; enviar.textContent = enviar.dataset.texto;
    }
  };
  ativarContadores(form);
  setTimeout(() => form.querySelector('input:not([type=hidden]),select,textarea')?.focus(), 30);
  return form;
}
export function fecharModal() { document.getElementById('modal')?.remove(); }

export function dadosDoForm(form) {
  const d = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') { if (el.dataset.lista !== undefined) { (d[el.name] ||= []); if (el.checked) d[el.name].push(el.value); } else d[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
    else d[el.name] = el.value;
  }
  return d;
}

export function campo(nome, rotulo, { tipo = 'text', valor = '', obrig = false, extra = '', dica = '', largo = false } = {}) {
  return '<label class="campo' + (largo ? ' largo' : '') + '"><span>' + esc(rotulo) + (obrig ? ' <b class="obrig">*</b>' : '') + '</span>'
    + '<input type="' + tipo + '" name="' + nome + '" value="' + esc(valor) + '"' + (obrig ? ' required' : '') + ' ' + extra + '>'
    + (dica ? '<small>' + esc(dica) + '</small>' : '') + '</label>';
}
export function area(nome, rotulo, { valor = '', obrig = false, max = 3000, dica = '', linhas = 4 } = {}) {
  return '<label class="campo largo"><span>' + esc(rotulo) + (obrig ? ' <b class="obrig">*</b>' : '') + '</span>'
    + '<textarea name="' + nome + '" rows="' + linhas + '" maxlength="' + max + '"' + (obrig ? ' required' : '') + ' data-contador>' + esc(valor) + '</textarea>'
    + '<small class="contador-linha">' + (dica ? esc(dica) + ' · ' : '') + '<span data-conta>' + String(valor).length + '</span>/' + max + '</small></label>';
}
export function opcoes(nome, rotulo, itens, { valor = '', obrig = false, vazio = '', largo = false, extra = '' } = {}) {
  const lista = Array.isArray(itens) ? itens : Object.entries(itens);
  return '<label class="campo' + (largo ? ' largo' : '') + '"><span>' + esc(rotulo) + (obrig ? ' <b class="obrig">*</b>' : '') + '</span><select name="' + nome + '"' + (obrig ? ' required' : '') + ' ' + extra + '>'
    + (vazio !== '' ? '<option value="">' + esc(vazio) + '</option>' : '')
    + lista.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(v) === String(valor) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
}
export function ativarContadores(raiz = document) {
  $$('[data-contador]', raiz).forEach(t => { const c = t.parentElement.querySelector('[data-conta]'); t.oninput = () => { c.textContent = t.value.length; }; });
}

export const iniciais = nome => String(nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export function vazio(titulo, texto = '') {
  return '<div class="vazio"><strong>' + esc(titulo) + '</strong>' + (texto ? '<p>' + esc(texto) + '</p>' : '') + '</div>';
}

/** Abre uma janela de impressão com um documento HTML completo. */
export function imprimir(titulo, html) {
  const w = window.open('', '_blank');
  if (!w) { aviso('Permita pop-ups para imprimir ou salvar em PDF.', 'erro'); return; }
  w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><link rel="stylesheet" href="' + new URL('css/impressao.css', location.href) + '"></head><body>' + html + '<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>');
  w.document.close();
}
