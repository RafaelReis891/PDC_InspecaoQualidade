# Controle de Qualidade

Webapp desenvolvido em **HTML, CSS e JavaScript puro**, destinado principalmente à utilização em tablets para execução de inspeções e checklists de controle de qualidade.

O sistema permite:

- Cadastro do responsável pela inspeção;
- Identificação do produto/lote;
- Checklist configurável;
- Resposta **OK / NÃO OK**;
- Inclusão de fotografias em cada pergunta;
- Fotos obrigatórias em perguntas específicas;
- Salvamento automático da inspeção;
- Recuperação da inspeção após reload ou fechamento do navegador;
- Exportação manual da inspeção para arquivo `.json`;
- Importação de uma inspeção previamente salva;
- Geração de relatório em PDF;
- Inclusão de fotos no PDF;
- Geração de planilha Excel;
- Criação de uma nova inspeção;
- Funcionamento responsivo para tablets e dispositivos móveis.

---

# Tecnologias

O projeto utiliza somente tecnologias web padrão:

- HTML5
- CSS3
- JavaScript
- IndexedDB
- File API
- Canvas API

Bibliotecas externas utilizadas:

- [SheetJS / XLSX](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js)
- [jsPDF](https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js)

Não existe backend obrigatório para o funcionamento atual.

---

# Estrutura do projeto

```text
/
├── index.html
├── style.css
├── app.js
├── storage.js
│
├── config/
│   └── checklist.json
│
└── src/
    └── logo.png