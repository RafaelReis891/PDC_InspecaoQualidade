/*
 * CONTROLE DE QUALIDADE - app.js
 * Versão: 3 (Corrigida)
 */

const CHECKLISTS = [
    { id: "linha-pintura", nome: "Linha de Pintura", arquivo: "config/checklists/linha-pintura.json" },
    { id: "linha-inspecao", nome: "Linha de Inspeção", arquivo: "config/checklists/linha-inspecao.json" },
    { id: "linha-haste", nome: "Linha de Haste", arquivo: "config/checklists/linha-haste.json" },
    { id: "linha-solda", nome: "Linha de Solda", arquivo: "config/checklists/linha-solda.json" },
    { id: "linha-tubos", nome: "Linha de Tubos", arquivo: "config/checklists/linha-tubos.json" },
    { id: "linha-montagem", nome: "Linha de Montagem", arquivo: "config/checklists/linha-montagem.json" }
];

let config = null;
let checklist = [];
let saveTimer = null;
let loadingChecklist = false;

async function initialize() {
    try {
        await openDatabase();

        // Eventos dos campos de texto
        ["responsavel", "turno", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"].forEach(id => {
            document.getElementById(id).addEventListener("input", scheduleSave);
        });

        // Evento do Select
        document.getElementById("checklistSelect").addEventListener("change", changeChecklist);

        // === CORREÇÃO: Eventos dos botões do Menu e Barra Inferior ===
        document.getElementById("menuToggle").addEventListener("click", toggleMenu);
        document.getElementById("saveButton").addEventListener("click", () => { toggleMenu(); saveInspectionFile(); });
        document.getElementById("loadButton").addEventListener("click", () => { toggleMenu(); loadInspectionFile(); });
        document.getElementById("newButton").addEventListener("click", () => { toggleMenu(); newInspection(); });
        
        document.getElementById("pdfButton").addEventListener("click", generatePDF);
        document.getElementById("excelButton").addEventListener("click", finishInspection);

        // Fechar menu ao clicar fora
        document.addEventListener("click", (e) => {
            const menu = document.getElementById("actionMenu");
            const toggle = document.getElementById("menuToggle");
            if (menu.classList.contains("open") && !menu.contains(e.target) && !toggle.contains(e.target)) {
                menu.classList.remove("open");
            }
        });

        // Evento do input de arquivo oculto
        document.getElementById("importFile").addEventListener("change", handleImportFile);

        config = null;
        checklist = [];
        setChecklistVisibility(false);
        updateProgress();

        const saved = await loadInspectionState();
        if (saved) {
            await restoreSavedInspection(saved);
        }

        console.log("Aplicação inicializada com sucesso.");
    } catch (error) {
        console.error(error);
        showFatalError(error);
    }
}

// === CORREÇÃO: Função para abrir/fechar o menu ===
function toggleMenu() {
    const menu = document.getElementById("actionMenu");
    menu.classList.toggle("open");
}

function setChecklistVisibility(visible) {
    const questions = document.getElementById("questions");
    const finalData = document.getElementById("finalData");
    if (questions) questions.style.display = visible ? "" : "none";
    if (finalData) finalData.style.display = visible ? "" : "none";
}

function showFatalError(error) {
    document.body.innerHTML = `
        <div style="padding:30px; font-family:Arial,sans-serif; color: #dc3545;">
            <h2>Erro ao iniciar aplicação</h2>
            <p>${error?.message || "Erro desconhecido."}</p>
            <button onclick="location.reload()" style="padding:10px 20px; margin-top:10px; cursor:pointer;">Recarregar</button>
        </div>`;
}

async function changeChecklist() {
    if (loadingChecklist) return;

    const select = document.getElementById("checklistSelect");
    const checklistId = select.value;

    if (!checklistId) return;

    const selected = CHECKLISTS.find(item => item.id === checklistId);
    if (!selected) {
        alert("Checklist não encontrado.");
        select.value = config?.id || "";
        return;
    }

    if (hasCurrentInspectionData() && config) {
        if (!confirm("Existe uma inspeção em andamento.\n\nAo trocar o checklist, os dados atuais serão descartados.\n\nDeseja continuar?")) {
            select.value = config.id;
            return;
        }
    }

    try {
        loadingChecklist = true;
        const response = await fetch(selected.arquivo, { cache: "no-cache" });
        if (!response.ok) throw new Error(`Não foi possível carregar:\n${selected.arquivo}`);

        const newConfig = await response.json();
        if (!newConfig || !Array.isArray(newConfig.perguntas)) {
            throw new Error("O JSON do checklist possui formato inválido.");
        }

        config = newConfig;
        checklist = config.perguntas.map(() => ({ answer: null, photo: null }));

        clearFormFields();
        document.querySelector(".header-title").textContent = config.nome;
        document.querySelector(".header-subtitle").textContent = config.descricao || "Checklist de inspeção";

        renderQuestions();
        setChecklistVisibility(true);
        updateProgress();
        await clearInspectionState();
        await saveCurrentState();
        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
        console.error(error);
        alert("Não foi possível carregar o checklist.\n\n" + error.message);
        if (config) select.value = config.id;
    } finally {
        loadingChecklist = false;
    }
}

function hasCurrentInspectionData() {
    if (!config) return false;
    const fields = ["responsavel", "turno", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"];
    const hasFormData = fields.some(id => document.getElementById(id).value.trim() !== "");
    const hasChecklistData = checklist.some(item => item.answer !== null || !!item.photo);
    return hasFormData || hasChecklistData;
}

function clearFormFields() {
    ["responsavel", "turno", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"].forEach(id => {
        document.getElementById(id).value = "";
    });
}

async function restoreSavedInspection(saved) {
    try {
        const checklistId = saved.checklistId || findChecklistIdByName(saved.checklistName);
        if (!checklistId) return;

        const selected = CHECKLISTS.find(item => item.id === checklistId);
        if (!selected) return;

        const response = await fetch(selected.arquivo, { cache: "no-cache" });
        if (!response.ok) throw new Error("Não foi possível carregar o checklist salvo.");

        config = await response.json();
        checklist = config.perguntas.map(() => ({ answer: null, photo: null }));

        document.getElementById("checklistSelect").value = config.id;
        document.querySelector(".header-title").textContent = config.nome;
        document.querySelector(".header-subtitle").textContent = config.descricao || "Checklist de inspeção";

        renderQuestions();
        setChecklistVisibility(true);

        document.getElementById("responsavel").value = saved.responsavel || "";
        document.getElementById("turno").value = saved.turno || "";
        document.getElementById("lote").value = saved.lote || "";
        document.getElementById("qtdProduzidos").value = saved.qtdProduzidos ?? "";
        document.getElementById("qtdNaoConformes").value = saved.qtdNaoConformes ?? "";
        document.getElementById("qtdNokAuditoria").value = saved.qtdNokAuditoria ?? "";

        if (Array.isArray(saved.checklist)) {
            saved.checklist.forEach((savedItem, index) => {
                if (checklist[index]) {
                    checklist[index].answer = savedItem.answer ?? savedItem.resultado ?? null;
                    checklist[index].photo = savedItem.photo ?? savedItem.foto ?? null;
                }
            });
        }

        restoreChecklistVisual();
        updateProgress();
    } catch (error) {
        console.error("Erro ao restaurar inspeção:", error);
    }
}

function findChecklistIdByName(name) {
    if (!name) return null;
    const found = CHECKLISTS.find(item => item.nome === name);
    return found ? found.id : null;
}

function renderQuestions() {
    const container = document.getElementById("questions");
    container.innerHTML = "";
    if (!config || !Array.isArray(config.perguntas)) return;

    config.perguntas.forEach((question, index) => {
        const element = document.createElement("section");
        element.className = "card question";
        const photoLabel = question.fotoObrigatoria ? "📷 Adicionar foto *" : "📷 Adicionar foto";

        element.innerHTML = `
            <div class="question-top">
                <div class="question-number">${index + 1}</div>
                <div class="question-text">${escapeHTML(question.texto)}</div>
            </div>
            <div class="answer-buttons">
                <button id="ok-${index}" type="button" class="answer-button answer-ok" onclick="setAnswer(${index}, 'OK')">✓ OK</button>
                <button id="notok-${index}" type="button" class="answer-button answer-not-ok" onclick="setAnswer(${index}, 'NÃO OK')">✕ NÃO OK</button>
            </div>
            <div class="photo-area">
                <label class="photo-button">
                    ${photoLabel}
                    <input class="photo-input" type="file" accept="image/*" capture="environment" onchange="handlePhoto(${index}, this)">
                </label>
                <span id="photo-name-${index}" class="photo-name"></span>
            </div>
            <div id="preview-${index}" class="photo-preview" style="display:none;">
                <img id="image-${index}" alt="Foto da inspeção">
                <button type="button" class="remove-photo" onclick="removePhoto(${index})">×</button>
            </div>
        `;
        container.appendChild(element);
    });
    restoreChecklistVisual();
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function restoreChecklistVisual() {
    checklist.forEach((item, index) => {
        const ok = document.getElementById(`ok-${index}`);
        const notok = document.getElementById(`notok-${index}`);
        if (ok) ok.classList.toggle("active", item.answer === "OK");
        if (notok) notok.classList.toggle("active", item.answer === "NÃO OK");

        if (item.photo) {
            const image = document.getElementById(`image-${index}`);
            const preview = document.getElementById(`preview-${index}`);
            const name = document.getElementById(`photo-name-${index}`);
            if (image) image.src = item.photo;
            if (preview) preview.style.display = "block";
            if (name) name.textContent = "Foto restaurada";
        }
    });
}

function setAnswer(index, answer) {
    if (!checklist[index]) return;
    checklist[index].answer = answer;
    const ok = document.getElementById(`ok-${index}`);
    const notok = document.getElementById(`notok-${index}`);
    if (ok) ok.classList.toggle("active", answer === "OK");
    if (notok) notok.classList.toggle("active", answer === "NÃO OK");
    updateProgress();
    scheduleSave();
}

function handlePhoto(index, input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        alert("Selecione uma imagem válida.");
        input.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        checklist[index].photo = event.target.result;
        const image = document.getElementById(`image-${index}`);
        const preview = document.getElementById(`preview-${index}`);
        const name = document.getElementById(`photo-name-${index}`);
        if (image) image.src = event.target.result;
        if (preview) preview.style.display = "block";
        if (name) name.textContent = file.name;
        scheduleSave();
    };
    reader.readAsDataURL(file);
}

function removePhoto(index) {
    if (!checklist[index]) return;
    checklist[index].photo = null;
    const preview = document.getElementById(`preview-${index}`);
    const name = document.getElementById(`photo-name-${index}`);
    const image = document.getElementById(`image-${index}`);
    if (preview) preview.style.display = "none";
    if (name) name.textContent = "";
    if (image) image.removeAttribute("src");
    
    // Limpar o input file também
    const inputs = document.querySelectorAll('.photo-input');
    if(inputs[index]) inputs[index].value = "";
    
    scheduleSave();
}

function updateProgress() {
    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");
    const excelButton = document.getElementById("excelButton");

    if (!checklist.length) {
        if (progressText) progressText.textContent = "0 / 0";
        if (progressFill) progressFill.style.width = "0%";
        if (excelButton) excelButton.disabled = true;
        return;
    }

    const completed = checklist.filter(item => item.answer !== null).length;
    const total = checklist.length;
    const percentage = (completed / total) * 100;

    if (progressText) progressText.textContent = `${completed} / ${total}`;
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (excelButton) excelButton.disabled = completed !== total;
}

function validateChecklist() {
    if (!config) {
        showWarning("Selecione um checklist antes de continuar.");
        return false;
    }
    const responsavel = document.getElementById("responsavel").value.trim();
    if (!responsavel) {
        showWarning("Informe o responsável pela inspeção.");
        document.getElementById("responsavel").focus();
        return false;
    }
    const turno = document.getElementById("turno").value.trim();
    if (!turno) {
        showWarning("Informe o turno trabalhado.");
        document.getElementById("turno").focus();
        return false;
    }
    const incomplete = checklist.findIndex(item => item.answer === null);
    if (incomplete !== -1) {
        showWarning(`A pergunta ${incomplete + 1} ainda não foi respondida.`);
        document.getElementById(`ok-${incomplete}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
    }
    for (let i = 0; i < config.perguntas.length; i++) {
        if (config.perguntas[i].fotoObrigatoria && !checklist[i].photo) {
            showWarning(`A pergunta ${i + 1} exige uma foto.`);
            document.getElementById(`photo-name-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            return false;
        }
    }
    hideWarning();
    return true;
}

function showWarning(message) {
    const warning = document.getElementById("warning");
    warning.textContent = message;
    warning.style.display = "block";
    warning.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideWarning() {
    document.getElementById("warning").style.display = "none";
}

function getInspectionData() {
    return {
        version: 2,
        checklistId: config?.id || null,
        checklistName: config?.nome || null,
        checklistVersion: config?.versao || 1,
        responsavel: document.getElementById("responsavel").value.trim(),
        turno: document.getElementById("turno").value.trim(),
        lote: document.getElementById("lote").value.trim(),
        date: new Date().toLocaleString("pt-BR"),
        qtdProduzidos: document.getElementById("qtdProduzidos").value,
        qtdNaoConformes: document.getElementById("qtdNaoConformes").value,
        qtdNokAuditoria: document.getElementById("qtdNokAuditoria").value,
        checklist: config.perguntas.map((question, index) => ({
            id: question.id,
            pergunta: question.texto,
            resultado: checklist[index].answer,
            foto: checklist[index].photo
        }))
    };
}

async function saveCurrentState() {
    if (!config) return;
    const state = {
        version: 2,
        savedAt: new Date().toISOString(),
        checklistId: config.id,
        checklistName: config.nome,
        responsavel: document.getElementById("responsavel").value,
        turno: document.getElementById("turno").value,
        lote: document.getElementById("lote").value,
        qtdProduzidos: document.getElementById("qtdProduzidos").value,
        qtdNaoConformes: document.getElementById("qtdNaoConformes").value,
        qtdNokAuditoria: document.getElementById("qtdNokAuditoria").value,
        checklist: checklist.map(item => ({ answer: item.answer, photo: item.photo }))
    };
    try { await saveInspectionState(state); } 
    catch (error) { console.error("Erro ao salvar inspeção:", error); }
}

function scheduleSave() {
    if (!config) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCurrentState(); }, 400);
}

async function saveInspectionFile() {
    if (!config) { alert("Selecione um checklist antes de salvar."); return; }
    const data = getInspectionData();
    const exportData = { ...data, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(exportData, null, 4);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inspecao_${sanitizeFileName(config.nome)}_${formatFileDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    await saveCurrentState();
}

function loadInspectionFile() {
    const input = document.getElementById("importFile");
    input.value = "";
    input.click();
}

async function handleImportFile(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.checklist)) throw new Error("Arquivo de inspeção inválido.");

        const checklistId = data.checklistId || findChecklistIdByName(data.checklistName);
        if (!checklistId) throw new Error("Não foi possível identificar o checklist desse arquivo.");

        const selected = CHECKLISTS.find(item => item.id === checklistId);
        if (!selected) throw new Error("O checklist desse arquivo não está disponível nesta instalação.");

        if (hasCurrentInspectionData()) {
            if (!confirm("Existe uma inspeção em andamento.\n\nDeseja substituí-la pelo arquivo importado?")) return;
        }

        const response = await fetch(selected.arquivo, { cache: "no-cache" });
        if (!response.ok) throw new Error("Não foi possível carregar o checklist.");

        config = await response.json();
        checklist = config.perguntas.map(() => ({ answer: null, photo: null }));

        document.getElementById("checklistSelect").value = config.id;
        document.querySelector(".header-title").textContent = config.nome;
        document.querySelector(".header-subtitle").textContent = config.descricao || "Checklist de inspeção";

        renderQuestions();
        setChecklistVisibility(true);

        document.getElementById("responsavel").value = data.responsavel || "";
        document.getElementById("turno").value = data.turno || "";
        document.getElementById("lote").value = data.lote || "";
        document.getElementById("qtdProduzidos").value = data.qtdProduzidos ?? "";
        document.getElementById("qtdNaoConformes").value = data.qtdNaoConformes ?? "";
        document.getElementById("qtdNokAuditoria").value = data.qtdNokAuditoria ?? "";

        data.checklist.forEach((item, index) => {
            if (checklist[index]) {
                checklist[index].answer = item.resultado ?? item.answer ?? null;
                checklist[index].photo = item.foto ?? item.photo ?? null;
            }
        });

        restoreChecklistVisual();
        updateProgress();
        await saveCurrentState();
        alert("Inspeção carregada com sucesso.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error(error);
        alert("Não foi possível carregar a inspeção.\n\n" + error.message);
    } finally {
        input.value = "";
    }
}

async function newInspection() {
    if (hasCurrentInspectionData()) {
        if (!confirm("Existe uma inspeção em andamento.\n\nTodos os dados não salvos em arquivo serão removidos.\n\nDeseja realmente iniciar uma nova inspeção?")) return;
    }
    try { await clearInspectionState(); } catch (error) { console.error(error); }
    
    config = null;
    checklist = [];
    clearFormFields();
    document.getElementById("checklistSelect").value = "";
    document.querySelector(".header-title").textContent = "Controle de Qualidade";
    document.querySelector(".header-subtitle").textContent = "Selecione um checklist para iniciar";
    document.getElementById("questions").innerHTML = "";
    setChecklistVisibility(false);
    updateProgress();
    hideWarning();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function generateExcel() {
    if (!validateChecklist()) return;
    if (typeof XLSX === "undefined") {
        alert("A biblioteca Excel não foi carregada.\n\nVerifique sua conexão com a internet.");
        return;
    }

    const data = getInspectionData();
    const rows = [
        ["CONTROLE DE QUALIDADE"], [],
        ["Checklist", data.checklistName],
        ["Responsável", data.responsavel],
        ["Turno", data.turno],
        ["Produto / Lote", data.lote],
        ["Data", data.date], [],
        ["REGISTRO DO TURNO"],
        ["QTD Produzidos", data.qtdProduzidos],
        ["QTD Peças Não Conformes", data.qtdNaoConformes],
        ["QTD NOK Auditoria Processo", data.qtdNokAuditoria], [],
        ["CHECKLIST"],
        ["Nº", "Pergunta", "Resultado", "Foto"]
    ];

    data.checklist.forEach((item, index) => {
        rows.push([index + 1, item.pergunta, item.resultado, item.foto ? "SIM" : "NÃO"]);
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 8 }, { wch: 80 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Checklist");
    XLSX.writeFile(workbook, `controle_qualidade_${sanitizeFileName(data.checklistName)}_${formatFileDate(new Date())}.xlsx`);
}

async function finishInspection() {
    if (!validateChecklist()) return;
    generateExcel();
    if (confirm("Inspeção finalizada.\n\nO Excel foi gerado.\n\nDeseja iniciar uma nova inspeção?")) {
        await newInspection();
    }
}

async function generatePDF() {
    if (!validateChecklist()) return;
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("A biblioteca PDF não foi carregada.\n\nVerifique sua conexão com a internet.");
        return;
    }

    try {
        const data = getInspectionData();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let y = 20;

        drawPDFHeader(pdf, pageWidth);
        // Nota: addLogoToPDF foi mantido, mas com try/catch interno para não quebrar se a imagem não existir
        await addLogoToPDF(pdf);

        pdf.setTextColor(40, 48, 56);
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text("RELATÓRIO DE CONTROLE DE QUALIDADE", 15, y);
        y += 8;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(90, 96, 102);
        pdf.text(data.checklistName, 15, y);
        y += 12;

        drawPDFInfoBox(pdf, data, y, pageWidth);
        y += 46;

        drawPDFSectionTitle(pdf, "REGISTRO DO TURNO", 15, y);
        y += 9;

        const produced = Number(data.qtdProduzidos) || 0;
        const nonConforming = Number(data.qtdNaoConformes) || 0;
        const auditNok = Number(data.qtdNokAuditoria) || 0;
        const okCount = data.checklist.filter(item => item.resultado === "OK").length;
        const nokCount = data.checklist.filter(item => item.resultado === "NÃO OK").length;

        y = drawPDFSummaryCards(pdf, [
            ["PRODUZIDOS", String(produced)],
            ["NÃO CONFORMES", String(nonConforming)],
            ["NOK AUDITORIA", String(auditNok)],
            ["CHECKLIST", `${okCount} OK / ${nokCount} NOK`]
        ], y, pageWidth);
        y += 12;

        const status = nokCount > 0 ? "NÃO CONFORME" : "CONFORME";
        drawPDFStatus(pdf, status, y, pageWidth);
        y += 18;

        drawPDFSectionTitle(pdf, "RESULTADO DA INSPEÇÃO", 15, y);
        y += 10;

        for (let i = 0; i < data.checklist.length; i++) {
            const item = data.checklist[i];
            const question = `${i + 1}. ${item.pergunta}`;
            const lines = pdf.splitTextToSize(question, 150);
            const itemHeight = (lines.length * 4.5) + 14;

            if (y + itemHeight > pageHeight - 25) {
                addPDFFooter(pdf, pageWidth, pageHeight);
                pdf.addPage();
                y = 20;
            }

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(45, 52, 60);
            pdf.text(lines, 15, y);
            y += lines.length * 4.5;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9);
            pdf.setTextColor(item.resultado === "OK" ? 30 : 180, item.resultado === "OK" ? 110 : 55, item.resultado === "OK" ? 70 : 45);
            pdf.text(`Resultado: ${item.resultado}`, 20, y + 2);

            if (item.foto) {
                y += 7;
                if (y + 55 > pageHeight - 25) {
                    addPDFFooter(pdf, pageWidth, pageHeight);
                    pdf.addPage();
                    y = 20;
                }
                try {
                    const image = await prepareImageForPDF(item.foto);
                    const dimensions = calculateImageDimensions(image.width, image.height, 70, 50);
                    pdf.addImage(image.data, "JPEG", 20, y, dimensions.width, dimensions.height);
                    y += dimensions.height + 5;
                } catch (error) {
                    console.error("Erro ao adicionar foto:", error);
                }
            }
            y += 8;
            pdf.setDrawColor(220, 223, 226);
            pdf.line(15, y, pageWidth - 15, y);
            y += 5;
        }

        addPDFFooter(pdf, pageWidth, pageHeight);
        pdf.save(`controle_qualidade_${sanitizeFileName(data.checklistName)}_${formatFileDate(new Date())}.pdf`);
    } catch (error) {
        console.error("ERRO AO GERAR PDF:", error);
        alert("Erro ao gerar o PDF.\n\n" + error.message);
    }
}

// --- FUNÇÕES AUXILIARES DE PDF (Mantidas do seu código original, estão corretas) ---
function drawPDFHeader(pdf, pageWidth) {
    const height = 7;
    const start = { r: 200, g: 188, b: 166 };
    const end = { r: 253, g: 248, b: 236 };
    const steps = 40;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        pdf.setFillColor(Math.round(start.r + (end.r - start.r) * t), Math.round(start.g + (end.g - start.g) * t), Math.round(start.b + (end.b - start.b) * t));
        pdf.rect(i * (pageWidth / steps), 0, pageWidth / steps + 0.5, height, "F");
    }
}

function addLogoToPDF(pdf) {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = function() {
            try {
                const dimensions = calculateImageDimensions(image.naturalWidth, image.naturalHeight, 30, 15);
                pdf.addImage(image, "PNG", 155, 10, dimensions.width, dimensions.height);
            } catch (error) { console.warn("Não foi possível adicionar o logo:", error); }
            resolve();
        };
        image.onerror = function() { resolve(); }; // Falha silenciosa se não houver logo
        image.src = "src/logo.png";
    });
}

function calculateImageDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    if (!originalWidth || !originalHeight) return { width: maxWidth, height: maxHeight };
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    return { width: originalWidth * ratio, height: originalHeight * ratio };
}

function drawPDFInfoBox(pdf, data, y, pageWidth) {
    const x = 15, width = pageWidth - 30, height = 36;
    pdf.setFillColor(248, 249, 250);
    pdf.setDrawColor(225, 228, 231);
    pdf.roundedRect(x, y - 5, width, height, 2, 2, "FD");
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(100, 105, 110);
    pdf.text("CHECKLIST", 20, y + 2);
    pdf.text("RESPONSÁVEL", 100, y + 2);
    pdf.text("TURNO", 20, y + 14);
    pdf.text("PRODUTO / LOTE", 100, y + 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(35, 40, 45);
    pdf.text(String(data.checklistName || "-"), 20, y + 7);
    pdf.text(String(data.responsavel || "-"), 100, y + 7);
    pdf.text(String(data.turno || "-"), 20, y + 19);
    pdf.text(String(data.lote || "-"), 100, y + 19);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 125, 130);
    pdf.text(`Data: ${data.date}`, 20, y + 29);
}

function drawPDFSectionTitle(pdf, title, x, y) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(45, 52, 60);
    pdf.text(title, x, y);
    pdf.setDrawColor(200, 188, 166);
    pdf.setLineWidth(0.8);
    pdf.line(x, y + 3, x + 35, y + 3);
}

function drawPDFSummaryCards(pdf, cards, y, pageWidth) {
    const margin = 15, gap = 4, cardWidth = (pageWidth - margin * 2 - gap * 3) / 4, height = 22;
    cards.forEach((card, index) => {
        const x = margin + index * (cardWidth + gap);
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(225, 228, 231);
        pdf.roundedRect(x, y, cardWidth, height, 2, 2, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.setTextColor(110, 115, 120);
        pdf.text(card[0], x + 3, y + 6);
        pdf.setFontSize(9);
        pdf.setTextColor(40, 45, 50);
        pdf.text(card[1], x + 3, y + 15);
    });
    return y + height;
}

function drawPDFStatus(pdf, status, y, pageWidth) {
    const isOK = status === "CONFORME";
    pdf.setFillColor(isOK ? 232 : 250, isOK ? 246 : 235, isOK ? 238 : 232);
    pdf.setDrawColor(isOK ? 150 : 220, isOK ? 190 : 150, isOK ? 165 : 140);
    pdf.roundedRect(15, y, pageWidth - 30, 11, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(isOK ? 35 : 170, isOK ? 105 : 55, isOK ? 65 : 45);
    pdf.text(`STATUS DA INSPEÇÃO: ${status}`, 20, y + 7);
}

function addPDFFooter(pdf, pageWidth, pageHeight) {
    const pageNumber = pdf.internal.getNumberOfPages();
    pdf.setDrawColor(220, 223, 226);
    pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(130, 135, 140);
    pdf.text("Controle de Qualidade", 15, pageHeight - 9);
    pdf.text(`Página ${pageNumber}`, pageWidth - 35, pageHeight - 9);
}

function prepareImageForPDF(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = function() {
            const canvas = document.createElement("canvas");
            const maxDimension = 1400;
            let width = image.naturalWidth, height = image.naturalHeight;
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width *= ratio; height *= ratio;
            }
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0, width, height);
            resolve({ data: canvas.toDataURL("image/jpeg", 0.82), width, height });
        };
        image.onerror = function() { reject(new Error("Imagem inválida.")); };
        image.src = dataUrl;
    });
}

function formatFileDate(date) {
    const pad = value => String(value).padStart(2, "0");
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") + "_" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("-");
}

function sanitizeFileName(value) {
    return String(value || "inspecao").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "inspecao";
}

// INICIALIZAÇÃO
initialize();