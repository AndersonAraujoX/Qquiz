# Quiz Analytics — Top 10 & Estatísticas (Site Estático / GitHub Pages)

Site estático pronto para **GitHub Pages** que lê as planilhas `.xlsx` da pasta `dados/` e gera:

- **Top 10 Melhores Alunos** (com Pódio Ouro/Prata/Bronze e tabela completa).
- **Alternância de critério de ranking**: por **Pontuação (Score)** ou **Acertos + Menor Tempo (Rank da Planilha)**.
- **Filtro de tentativas zeradas**: opção para incluir ou excluir reconexões com 0 questões respondidas.
- **Estatísticas completas da turma**:
  - KPIs (alunos ativos, acurácia da turma, média/mediana de pontos, tempo médio, notas ≥ 70% e 100%).
  - Estatística descritiva (Média, Mediana, Desvio Padrão, Q1, Q3, Mínimo e Máximo).
  - Gráficos SVG interativos (Distribuição de Acurácia, Distribuição de Pontuação e Dispersão Tempo × Pontuação com Correlação de Pearson).
  - Desempenho por Questão (com modal detalhado ao clicar) e distribuição de dispositivos/navegadores.
  - Tabela completa pesquisável e exportação em CSV protegida contra CSV Injection.

## Como atualizar com novas planilhas em `dados/`

1. Coloque um ou mais arquivos `.xlsx` dentro de `dados/`.
2. Execute o gerador estático:

```bash
python3 scripts/build_static_data.py
```

Isso atualiza `docs/data/manifest.json` e os arquivos JSON correspondentes em `docs/data/`.

## Como visualizar localmente

Como site estático puro (igual ao GitHub Pages):

```bash
python3 -m http.server 8080 -b 127.0.0.1 -d docs
```

Ou usando o servidor local completo:

```bash
python3 server.py --port 8080
```

Acesse `http://127.0.0.1:8080`.

## Como publicar no GitHub Pages

Você tem duas opções (ambas já configuradas):

1. **GitHub Actions automático (recomendado)**:
   - Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
   - O workflow `.github/workflows/pages.yml` roda os testes unitários, regenera `docs/data/` a partir de `dados/*.xlsx` e publica `docs/` automaticamente a cada `push` na branch `main`.
2. **Direto da branch (`main /docs`)**:
   - Em **Settings → Pages → Build and deployment**, selecione **Deploy from a branch**, branch `main`, pasta `/docs`.

## Testes Unitários

```bash
python3 -m unittest discover -s tests/python -p "test_*.py" -v
node --test tests/js/*.test.mjs
```
