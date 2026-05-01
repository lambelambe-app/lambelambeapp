# Bolsa de Cotações - Marketplace B2B Inteligente

Plataforma colaborativa para comparação de preços de produtos com base na tabela **NCM (Nomenclatura Comum do Mercosul)**.  
Fornecedores cadastram suas ofertas, administradores gerenciam produtos e o usuário final (comprador) encontra o menor preço ou faz upload de um arquivo de texto para cotação em lote.

## 🚀 Funcionalidades

- **Consulta pública** com busca fuzzy por nome ou NCM.
- **Upload de arquivo .txt** com lista de produtos e quantidades (formato `produto;quantidade`) – retorna menor preço e valor total.
- **Painel do fornecedor** (login: fornecedor@bolsa.com / 123) para registrar/atualizar preços.
- **Painel do administrador** (admin@bolsa.com / admin123) para gerenciar produtos, fornecedores e visualizar todas as ofertas.
- **Integração com API oficial da NCM (Siscomex)** – importação automática de produtos a partir da tabela oficial.
- Persistência local (`localStorage`) – fácil migração para backend real (Node.js, PostgreSQL).

## 🛠️ Tecnologias

- HTML5, CSS3 (Flex/Grid, design responsivo)
- JavaScript ES6+
- Font Awesome 6
- API REST do Siscomex (NCM)

## 📁 Estrutura de arquivos
