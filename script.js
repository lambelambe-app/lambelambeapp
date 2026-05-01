// ======================== INICIALIZAÇÃO DO BANCO DE DADOS (localStorage) ========================
function initDatabase() {
  if (!localStorage.getItem('produtos')) {
    const produtos = [
      { id: 1, nome: "Seringa descartável 5ml", ncm: "90183111" },
      { id: 2, nome: "Máscara N95", ncm: "63079090" },
      { id: 3, nome: "Luva cirúrgica estéril", ncm: "40151100" },
      { id: 4, nome: "Álcool gel 70%", ncm: "22072010" }
    ];
    localStorage.setItem('produtos', JSON.stringify(produtos));
  }
  if (!localStorage.getItem('fornecedores')) {
    const fornecedores = [
      { id: 1, razao_social: "MedValue Distribuidora", cnpj: "12.345.678/0001-90", email: "fornecedor@bolsa.com", senha: "123" },
      { id: 2, razao_social: "Saúde Direct Brasil", cnpj: "98.765.432/0001-12", email: "saudedirect@example.com", senha: "123" }
    ];
    localStorage.setItem('fornecedores', JSON.stringify(fornecedores));
  }
  if (!localStorage.getItem('ofertas')) {
    const ofertas = [
      { id: 1, produto_id: 1, fornecedor_id: 1, preco: 0.39, data_oferta: "2025-04-01" },
      { id: 2, produto_id: 2, fornecedor_id: 1, preco: 0.85, data_oferta: "2025-04-10" },
      { id: 3, produto_id: 2, fornecedor_id: 2, preco: 0.79, data_oferta: "2025-04-12" },
      { id: 4, produto_id: 3, fornecedor_id: 2, preco: 1.15, data_oferta: "2025-04-05" }
    ];
    localStorage.setItem('ofertas', JSON.stringify(ofertas));
  }
  if (!localStorage.getItem('nextIds')) {
    localStorage.setItem('nextIds', JSON.stringify({ produto: 5, fornecedor: 3, oferta: 5 }));
  }
}
initDatabase();

// Helpers
function getProdutos() { return JSON.parse(localStorage.getItem('produtos')); }
function getFornecedores() { return JSON.parse(localStorage.getItem('fornecedores')); }
function getOfertas() { return JSON.parse(localStorage.getItem('ofertas')); }
function saveProdutos(prod) { localStorage.setItem('produtos', JSON.stringify(prod)); }
function saveFornecedores(forn) { localStorage.setItem('fornecedores', JSON.stringify(forn)); }
function saveOfertas(ofertas) { localStorage.setItem('ofertas', JSON.stringify(ofertas)); }
function getNextId(entidade) {
  let ids = JSON.parse(localStorage.getItem('nextIds'));
  let id = ids[entidade];
  ids[entidade] += 1;
  localStorage.setItem('nextIds', JSON.stringify(ids));
  return id;
}

// ======================== INTEGRAÇÃO COM API NCM (Siscomex) ========================
async function fetchNCMTable() {
  const url = 'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Erro ao buscar NCM');
    const data = await response.json();
    localStorage.setItem('ncm_table', JSON.stringify(data));
    localStorage.setItem('ncm_last_update', Date.now());
    return data;
  } catch (error) {
    console.error('Falha ao carregar NCM:', error);
    return null;
  }
}

async function getNCMTable() {
  const cached = localStorage.getItem('ncm_table');
  const lastUpdate = localStorage.getItem('ncm_last_update');
  if (cached && lastUpdate && (Date.now() - lastUpdate < 24 * 60 * 60 * 1000)) {
    return JSON.parse(cached);
  }
  return await fetchNCMTable();
}

// ======================== LÓGICA DE BUSCA E MELHOR OFERTA ========================
function normalizeText(str) { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

function searchProducts(term) {
  if (!term.trim()) return [];
  term = normalizeText(term);
  const produtos = getProdutos();
  return produtos.map(p => {
    const nomeNorm = normalizeText(p.nome);
    const ncmNorm = normalizeText(p.ncm);
    let score = 0;
    if (nomeNorm.includes(term)) score = 100;
    else if (ncmNorm.includes(term)) score = 95;
    else {
      let palavras = term.split(/\s+/);
      for (let pal of palavras) if (nomeNorm.includes(pal)) score += 30;
    }
    return { ...p, score };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score).slice(0,6);
}

function getBestOffer(produtoId) {
  const ofertas = getOfertas().filter(o => o.produto_id === produtoId);
  if (!ofertas.length) return null;
  const melhor = ofertas.reduce((best, curr) => {
    if (curr.preco < best.preco) return curr;
    if (curr.preco === best.preco && new Date(curr.data_oferta) > new Date(best.data_oferta)) return curr;
    return best;
  });
  const fornecedor = getFornecedores().find(f => f.id === melhor.fornecedor_id);
  return { ...melhor, fornecedor_razao: fornecedor?.razao_social };
}

// ======================== RENDER CONSULTA PÚBLICA ========================
document.getElementById('searchBtn').addEventListener('click', async () => {
  const term = document.getElementById('searchInput').value;
  const matches = searchProducts(term);
  const resultDiv = document.getElementById('publicResult');
  if (!matches.length) {
    resultDiv.innerHTML = '<div class="message error">Nenhum produto encontrado. Tente outro nome ou NCM.</div>';
    return;
  }
  let html = '';
  for (let prod of matches) {
    const best = getBestOffer(prod.id);
    if (best) {
      html += `<div class="result-item">
        <div><strong>${prod.nome}</strong> <span style="font-size:0.7rem;">NCM: ${prod.ncm}</span></div>
        <div class="price-highlight">R$ ${best.preco.toFixed(2)}</div>
        <div><i class="far fa-calendar-alt"></i> Última atualização: ${new Date(best.data_oferta).toLocaleDateString('pt-BR')}</div>
        <div><i class="fas fa-building"></i> Fornecedor: ${best.fornecedor_razao}</div>
      </div>`;
    } else {
      html += `<div class="result-item"><strong>${prod.nome}</strong> (NCM: ${prod.ncm})<br><span class="message error">Nenhuma oferta cadastrada ainda.</span></div>`;
    }
  }
  resultDiv.innerHTML = html;
});

// ======================== UPLOAD DE ARQUIVO DE TEXTO PARA COMPARAÇÃO ========================
function findBestOfferForProductName(productName) {
  const matches = searchProducts(productName);
  if (!matches.length) return null;
  const bestOffer = getBestOffer(matches[0].id);
  if (!bestOffer) return null;
  return { produto: matches[0], oferta: bestOffer };
}

document.getElementById('uploadFileBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('priceFileInput');
  if (!fileInput.files.length) {
    alert('Selecione um arquivo .txt ou .csv');
    return;
  }
  const file = fileInput.files[0];
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    let [produtoNome, quantidadeStr] = line.split(/[;,]/).map(s => s.trim());
    if (!produtoNome || !quantidadeStr) continue;
    const quantidade = parseInt(quantidadeStr);
    if (isNaN(quantidade)) continue;
    items.push({ nome: produtoNome, quantidade });
  }
  if (!items.length) {
    document.getElementById('fileResultArea').innerHTML = '<div class="message error">Nenhum item válido encontrado. Use formato: produto;quantidade</div>';
    return;
  }
  let resultados = [];
  let totalGeral = 0;
  for (let item of items) {
    const melhor = findBestOfferForProductName(item.nome);
    if (melhor) {
      const totalItem = melhor.oferta.preco * item.quantidade;
      totalGeral += totalItem;
      resultados.push(`
        <tr>
          <td>${melhor.produto.nome}</td>
          <td>${item.quantidade}</td>
          <td>R$ ${melhor.oferta.preco.toFixed(2)}</td>
          <td>R$ ${totalItem.toFixed(2)}</td>
          <td>${melhor.oferta.fornecedor_razao}</td>
        </tr>
      `);
    } else {
      resultados.push(`<tr><td>${item.nome}</td><td colspan="4" class="message error">Produto não encontrado ou sem oferta</td></tr>`);
    }
  }
  const htmlTable = `
    <h4>Resultado da cotação por lote</h4>
    <div class="table-responsive">
       <table>
         <thead><tr><th>Produto</th><th>Quantidade</th><th>Melhor preço unit.</th><th>Total</th><th>Fornecedor</th></tr></thead>
         <tbody>${resultados.join('')}</tbody>
       </table>
    </div>
    <div class="price-highlight" style="margin-top:1rem;">Valor total da compra: R$ ${totalGeral.toFixed(2)}</div>
  `;
  document.getElementById('fileResultArea').innerHTML = htmlTable;
});

// ======================== PAINEL DO FORNECEDOR ========================
let currentSupplier = null;
function loadSupplierProducts() {
  const produtos = getProdutos();
  const select = document.getElementById('supplierProductSelect');
  select.innerHTML = produtos.map(p => `<option value="${p.id}">${p.nome} (${p.ncm})</option>`).join('');
}
function loadSupplierOffers() {
  if (!currentSupplier) return;
  const ofertas = getOfertas().filter(o => o.fornecedor_id === currentSupplier.id);
  const produtos = getProdutos();
  const tableHtml = `<table><thead><tr><th>Produto</th><th>Preço</th><th>Data</th></tr></thead><tbody>${
    ofertas.map(o => {
      const prod = produtos.find(p=>p.id === o.produto_id);
      return `<tr><td>${prod?.nome || '-'}</td><td>R$ ${o.preco.toFixed(2)}</td><td>${new Date(o.data_oferta).toLocaleDateString()}</td></tr>`;
    }).join('')
  }</tbody></table>`;
  document.getElementById('supplierOffersTable').innerHTML = ofertas.length ? tableHtml : '<p>Nenhuma oferta registrada.</p>';
}
document.getElementById('supplierLoginBtn').addEventListener('click', () => {
  const email = document.getElementById('supplierEmail').value;
  const senha = document.getElementById('supplierPassword').value;
  const fornecedor = getFornecedores().find(f => f.email === email && f.senha === senha);
  if (fornecedor) {
    currentSupplier = fornecedor;
    document.getElementById('supplierLoginArea').style.display = 'none';
    document.getElementById('supplierDashboard').style.display = 'block';
    document.getElementById('supplierName').innerText = fornecedor.razao_social;
    loadSupplierProducts();
    loadSupplierOffers();
  } else {
    document.getElementById('supplierMessage').innerHTML = '<div class="message error">Credenciais inválidas</div>';
  }
});
document.getElementById('supplierLogoutBtn').addEventListener('click', () => {
  currentSupplier = null;
  document.getElementById('supplierLoginArea').style.display = 'block';
  document.getElementById('supplierDashboard').style.display = 'none';
});
document.getElementById('updatePriceBtn').addEventListener('click', () => {
  if (!currentSupplier) return;
  const produto_id = parseInt(document.getElementById('supplierProductSelect').value);
  const preco = parseFloat(document.getElementById('supplierPrice').value);
  const data_oferta = document.getElementById('supplierDate').value;
  if (isNaN(preco) || preco <= 0 || !data_oferta) {
    document.getElementById('supplierMessage').innerHTML = '<div class="message error">Preço e data válidos obrigatórios</div>';
    return;
  }
  const ofertas = getOfertas();
  const newId = getNextId('oferta');
  ofertas.push({ id: newId, produto_id, fornecedor_id: currentSupplier.id, preco, data_oferta });
  saveOfertas(ofertas);
  document.getElementById('supplierMessage').innerHTML = '<div class="message success">Oferta registrada com sucesso!</div>';
  loadSupplierOffers();
  document.getElementById('supplierPrice').value = '';
  document.getElementById('supplierDate').value = '';
});

// ======================== PAINEL ADMIN ========================
let currentAdmin = false;
function renderAdminProducts() {
  const produtos = getProdutos();
  const html = `<table><thead><tr><th>ID</th><th>Nome</th><th>NCM</th><th>Ações</th></tr></thead><tbody>${
    produtos.map(p => `<tr><td>${p.id}</td><td>${p.nome}</td><td>${p.ncm}</td><td><button onclick="deleteProd(${p.id})" class="btn-outline">Excluir</button></td></tr>`).join('')
  }</tbody></table>`;
  document.getElementById('prodList').innerHTML = html;
}
window.deleteProd = function(id) {
  if (confirm('Remover produto? Todas as ofertas vinculadas serão excluídas.')) {
    let produtos = getProdutos().filter(p => p.id !== id);
    saveProdutos(produtos);
    let ofertas = getOfertas().filter(o => o.produto_id !== id);
    saveOfertas(ofertas);
    renderAdminProducts();
    renderAllOffers();
  }
};
function renderAdminFornecedores() {
  const fornecedores = getFornecedores();
  const html = `<table><thead><tr><th>ID</th><th>Razão Social</th><th>CNPJ</th><th>E-mail</th><th>Ações</th></tr></thead><tbody>${
    fornecedores.map(f => `<tr><td>${f.id}</td><td>${f.razao_social}</td><td>${f.cnpj}</td><td>${f.email}</td><td><button onclick="deleteForn(${f.id})" class="btn-outline">Excluir</button></td></tr>`).join('')
  }</tbody></table>`;
  document.getElementById('fornList').innerHTML = html;
}
window.deleteForn = function(id) {
  if (confirm('Excluir fornecedor? Todas as ofertas associadas serão removidas.')) {
    let fornecedores = getFornecedores().filter(f => f.id !== id);
    saveFornecedores(fornecedores);
    let ofertas = getOfertas().filter(o => o.fornecedor_id !== id);
    saveOfertas(ofertas);
    renderAdminFornecedores();
    renderAllOffers();
  }
};
function renderAllOffers() {
  const ofertas = getOfertas();
  const produtos = getProdutos();
  const fornecedores = getFornecedores();
  const html = `<table><thead><tr><th>Produto</th><th>Fornecedor</th><th>Preço (R$)</th><th>Data</th></tr></thead><tbody>${
    ofertas.map(o => {
      const prod = produtos.find(p=>p.id === o.produto_id);
      const forn = fornecedores.find(f=>f.id === o.fornecedor_id);
      return `<tr><td>${prod?.nome || '-'}</td><td>${forn?.razao_social || '-'}</td><td>${o.preco.toFixed(2)}</td><td>${o.data_oferta}</td></tr>`;
    }).join('')
  }</tbody></table>`;
  document.getElementById('allOffersTable').innerHTML = ofertas.length ? html : '<p>Nenhuma oferta registrada.</p>';
}
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  const email = document.getElementById('adminEmail').value;
  const senha = document.getElementById('adminPassword').value;
  if (email === 'admin@bolsa.com' && senha === 'admin123') {
    currentAdmin = true;
    document.getElementById('adminLoginArea').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    renderAdminProducts();
    renderAdminFornecedores();
    renderAllOffers();
  } else { alert('Acesso negado'); }
});
document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  currentAdmin = false;
  document.getElementById('adminLoginArea').style.display = 'block';
  document.getElementById('adminDashboard').style.display = 'none';
});
document.getElementById('addProdBtn').addEventListener('click', () => {
  const nome = document.getElementById('newProdNome').value.trim();
  const ncm = document.getElementById('newProdNcm').value.trim().replace(/[^0-9]/g, '');
  if (!nome || !ncm) return alert('Preencha nome e NCM válido (apenas números)');
  const produtos = getProdutos();
  produtos.push({ id: getNextId('produto'), nome, ncm });
  saveProdutos(produtos);
  renderAdminProducts();
  document.getElementById('newProdNome').value = '';
  document.getElementById('newProdNcm').value = '';
});
document.getElementById('addFornBtn').addEventListener('click', () => {
  const razao = document.getElementById('newFornRazao').value.trim();
  const cnpj = document.getElementById('newFornCnpj').value.trim();
  const email = document.getElementById('newFornEmail').value.trim();
  if (!razao || !cnpj || !email) return alert('Preencha todos os campos');
  const fornecedores = getFornecedores();
  fornecedores.push({ id: getNextId('fornecedor'), razao_social: razao, cnpj, email, senha: "123" });
  saveFornecedores(fornecedores);
  renderAdminFornecedores();
  document.getElementById('newFornRazao').value = '';
  document.getElementById('newFornCnpj').value = '';
  document.getElementById('newFornEmail').value = '';
});
document.getElementById('importNcmBtn').addEventListener('click', async () => {
  const ncmTable = await getNCMTable();
  if (!ncmTable) return alert('Erro ao carregar tabela NCM oficial');
  const produtosExistentes = getProdutos();
  let novos = 0;
  for (let item of ncmTable) {
    if (item.nivel === 4 && !produtosExistentes.some(p => p.ncm === item.codigo)) {
      produtosExistentes.push({ id: getNextId('produto'), nome: item.descricao, ncm: item.codigo });
      novos++;
    }
  }
  if (novos) {
    saveProdutos(produtosExistentes);
    alert(`${novos} produtos importados da NCM oficial.`);
    renderAdminProducts();
  } else {
    alert('Todos os produtos já estão cadastrados ou nenhum novo nível 4 encontrado.');
  }
});

// ======================== NAVEGAÇÃO POR TABS ========================
const tabs = document.querySelectorAll('.tab-btn');
const contents = {
  public: document.getElementById('publicTab'),
  supplier: document.getElementById('supplierTab'),
  admin: document.getElementById('adminTab')
};
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    Object.keys(contents).forEach(k => contents[k].classList.remove('active-tab'));
    contents[tabId].classList.add('active-tab');
    if (tabId === 'admin' && currentAdmin) renderAllOffers();
    if (tabId === 'supplier' && currentSupplier) loadSupplierOffers();
  });
});
document.getElementById('supplierDate').valueAsDate = new Date();