/*
 * CONTROLE DE QUALIDADE - app.js
 * Versão: 6 (Integração Realtime Database)
 */

// ============================================================
// IMPORTAÇÕES DO FIREBASE (Realtime Database)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDswGi_UmMiCddQ0Fq_xggkDMsPORtiClc",
  authDomain: "pdc-monthly.firebaseapp.com",
  projectId: "pdc-monthly",
  storageBucket: "pdc-monthly.firebasestorage.app",
  messagingSenderId: "405073422956",
  appId: "1:405073422956:web:e77b330bb8a9e02c538649",
  measurementId: "G-JZB6V2BTQP",
  databaseURL: "https://pdc-monthly-default-rtdb.firebaseio.com/" // URL do seu Realtime Database
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app); // Inicializa o Realtime Database
// ============================================================


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
let isRestoring = false;

const SELECTED_CHECKLIST_KEY = "controleQualidade_selectedChecklist";

// ============================================================
// LOCAL STORAGE AUXILIAR
// ============================================================
function saveSelectedChecklist(checklistId) {
    try { if (checklistId) localStorage.setItem(SELECTED_CHECKLIST_KEY, checklistId); else localStorage.removeItem(SELECTED_CHECKLIST_KEY); } 
    catch (error) { console.warn("Erro ao salvar checklist selecionado:", error); }
}
function getSelectedChecklist() {
    try { return localStorage.getItem(SELECTED_CHECKLIST_KEY); } catch (error) { return null; }
}
function clearSelectedChecklist() {
    try { localStorage.removeItem(SELECTED_CHECKLIST_KEY); } catch (error) { console.warn("Erro ao limpar checklist:", error); }
}

// ============================================================
// SALVAR NO REALTIME DATABASE
// ============================================================
async function salvarNoFirebase() {
    if (!config) throw new Error("Nenhum checklist selecionado.");

    const data = getInspectionData();
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];

    const itensParaFirebase = data.checklist.map((item, index) => ({
        id: index + 1,
        pergunta: item.pergunta,
        resultado: item.resultado,
        temFoto: !!item.foto,
        fotoObrigatoria: config.perguntas[index]?.fotoObrigatoria || false
    }));

    const totalOk = itensParaFirebase.filter(i => i.resultado === "OK").length;
    const totalNok = itensParaFirebase.filter(i => i.resultado === "NÃO OK").length;

    const dadosParaSalvar = {
        checklistId: data.checklistId || "",  // Garante que não seja null
        checklistNome: data.checklistName || "",  // Salva o nome também
        data: dataFormatada,
        turno: data.turno,
        responsavel: data.responsavel,
        lote: data.lote,
        qtdProduzidos: parseInt(data.qtdProduzidos) || 0,
        qtdNaoConformes: parseInt(data.qtdNaoConformes) || 0,
        qtdNokAuditoria: parseInt(data.qtdNokAuditoria) || 0,
        itens: itensParaFirebase,
        statusDia: totalNok > 0 ? "NÃO CONFORME" : "CONFORME",
        totalItensOk: totalOk,
        totalItensNok: totalNok,
        totalItens: itensParaFirebase.length,
        createdAt: serverTimestamp(),
        versao: data.version
    };

    const inspecoesRef = ref(db, 'inspecoes');
    await push(inspecoesRef, dadosParaSalvar);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function initialize() {
    try {
        await openDatabase(); // Do seu storage.js

        ["responsavel", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener("input", scheduleSave);
        });

        const turno = document.getElementById("turno");
        if (turno) turno.addEventListener("change", scheduleSave);

        const checklistSelect = document.getElementById("checklistSelect");
        if (checklistSelect) checklistSelect.addEventListener("change", changeChecklist);

        document.getElementById("menuToggle")?.addEventListener("click", toggleMenu);
        document.getElementById("saveButton")?.addEventListener("click", async () => { toggleMenu(); await saveInspectionFile(); });
        document.getElementById("loadButton")?.addEventListener("click", () => { toggleMenu(); loadInspectionFile(); });
        document.getElementById("newButton")?.addEventListener("click", async () => { toggleMenu(); await newInspection(); });
        
        document.getElementById("pdfButton")?.addEventListener("click", generatePDF);
        document.getElementById("excelButton")?.addEventListener("click", finishInspection);

        document.addEventListener("click", event => {
            const menu = document.getElementById("actionMenu");
            const toggle = document.getElementById("menuToggle");
            if (menu && toggle && menu.classList.contains("open") && !menu.contains(event.target) && !toggle.contains(event.target)) {
                menu.classList.remove("open");
            }
        });

        document.getElementById("importFile")?.addEventListener("change", function () { handleImportFile(this); });

        config = null;
        checklist = [];
        setChecklistVisibility(false);
        updateProgress();

        const saved = await loadInspectionState();
        if (saved) {
            isRestoring = true;
            try { await restoreSavedInspection(saved); } finally { isRestoring = false; }
            return;
        }

        const savedChecklistId = getSelectedChecklist();
        if (savedChecklistId) {
            const selected = CHECKLISTS.find(item => item.id === savedChecklistId);
            if (selected) {
                isRestoring = true;
                try { await loadChecklistOnly(selected, false); } 
                catch (error) { clearSelectedChecklist(); if(checklistSelect) checklistSelect.value = ""; } 
                finally { isRestoring = false; }
            }
        }
    } catch (error) {
        console.error("Erro fatal:", error);
        showFatalError(error);
    }
}

// ============================================================
// FUNÇÕES DE CHECKLIST E UI
// ============================================================
async function loadChecklistOnly(selected, saveSelection = true) {
    if (!selected) throw new Error("Checklist inválido.");
    const response = await fetch(selected.arquivo, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Não foi possível carregar:\n${selected.arquivo}`);
    
    const newConfig = await response.json();
    if (!newConfig || !Array.isArray(newConfig.perguntas)) throw new Error("Formato JSON inválido.");

    config = newConfig;
    checklist = config.perguntas.map(() => ({ answer: null, photo: null }));

    const select = document.getElementById("checklistSelect");
    if (select) select.value = selected.id;
    if (saveSelection) saveSelectedChecklist(selected.id);

    const title = document.querySelector(".header-title");
    const subtitle = document.querySelector(".header-subtitle");
    if (title) title.textContent = config.nome;
    if (subtitle) subtitle.textContent = config.descricao || "Checklist de inspeção";

    renderQuestions();
    setChecklistVisibility(true);
    updateProgress();
}

function toggleMenu() {
    const menu = document.getElementById("actionMenu");
    if (menu) menu.classList.toggle("open");
}

function setChecklistVisibility(visible) {
    const questions = document.getElementById("questions");
    const finalData = document.getElementById("finalData");
    if (questions) questions.style.display = visible ? "" : "none";
    if (finalData) finalData.style.display = visible ? "" : "none";
}

function showFatalError(error) {
    document.body.innerHTML = `<div style="padding:30px; font-family:Arial,sans-serif; color:#dc3545;">
        <h2>Erro ao iniciar aplicação</h2>
        <p>${escapeHTML(error?.message || "Erro desconhecido.")}</p>
        <button onclick="location.reload()" style="padding:10px 20px; margin-top:10px; cursor:pointer;">Recarregar</button>
    </div>`;
}

async function changeChecklist() {
    if (loadingChecklist || isRestoring) return;
    const select = document.getElementById("checklistSelect");
    const checklistId = select.value;
    if (!checklistId) { clearSelectedChecklist(); return; }

    const selected = CHECKLISTS.find(item => item.id === checklistId);
    if (!selected) { alert("Checklist não encontrado."); select.value = config?.id || ""; return; }

    if (hasCurrentInspectionData() && config) {
        if (!confirm("Existe uma inspeção em andamento.\n\nAo trocar o checklist, os dados atuais serão descartados.\n\nDeseja continuar?")) {
            select.value = config.id || ""; return;
        }
    }

    try {
        loadingChecklist = true;
        await loadChecklistOnly(selected, true);
        clearFormFields();
        await clearInspectionState();
        await saveCurrentState();
        updateProgress();
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error("Erro ao trocar checklist:", error);
        alert("Não foi possível carregar o checklist.\n\n" + error.message);
        if (config) { select.value = config.id; saveSelectedChecklist(config.id); } 
        else { select.value = ""; clearSelectedChecklist(); }
    } finally { loadingChecklist = false; }
}

function hasCurrentInspectionData() {
    if (!config) return false;
    const fields = ["responsavel", "turno", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"];
    const hasFormData = fields.some(id => {
        const el = document.getElementById(id);
        return el ? String(el.value || "").trim() !== "" : false;
    });
    const hasChecklistData = checklist.some(item => item.answer !== null || !!item.photo);
    return hasFormData || hasChecklistData;
}

function clearFormFields() {
    ["responsavel", "turno", "lote", "qtdProduzidos", "qtdNaoConformes", "qtdNokAuditoria"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
}

async function restoreSavedInspection(saved) {
    try {
        const checklistId = saved.checklistId || findChecklistIdByName(saved.checklistName);
        if (!checklistId) return;
        const selected = CHECKLISTS.find(item => item.id === checklistId);
        if (!selected) return;

        await loadChecklistOnly(selected, true);

        setElementValue("responsavel", saved.responsavel);
        setElementValue("turno", saved.turno);
        setElementValue("lote", saved.lote);
        setElementValue("qtdProduzidos", saved.qtdProduzidos);
        setElementValue("qtdNaoConformes", saved.qtdNaoConformes);
        setElementValue("qtdNokAuditoria", saved.qtdNokAuditoria);

        if (Array.isArray(saved.checklist)) {
            saved.checklist.forEach((savedItem, index) => {
                if (!checklist[index]) return;
                checklist[index].answer = savedItem.answer ?? savedItem.resultado ?? null;
                checklist[index].photo = savedItem.photo ?? savedItem.foto ?? null;
            });
        }
        restoreChecklistVisual();
        updateProgress();
        setChecklistVisibility(true);
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
    if (!container || !config || !Array.isArray(config.perguntas)) return;
    container.innerHTML = "";

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
                <button id="ok-${index}" type="button" class="answer-button answer-ok" onclick="window.setAnswer(${index}, 'OK')">✓ OK</button>
                <button id="notok-${index}" type="button" class="answer-button answer-not-ok" onclick="window.setAnswer(${index}, 'NÃO OK')">✕ NÃO OK</button>
            </div>
            <div class="photo-area">
                <label class="photo-button">
                    ${photoLabel}
                    <input class="photo-input" type="file" accept="image/*" capture="environment" onchange="window.handlePhoto(${index}, this)">
                </label>
                <span id="photo-name-${index}" class="photo-name"></span>
            </div>
            <div id="preview-${index}" class="photo-preview" style="display:none;">
                <img id="image-${index}" alt="Foto da inspeção">
                <button type="button" class="remove-photo" onclick="window.removePhoto(${index})">×</button>
            </div>`;
        container.appendChild(element);
    });
    restoreChecklistVisual();
}

window.setAnswer = function(index, answer) {
    if (!checklist[index]) return;
    checklist[index].answer = answer;
    const ok = document.getElementById(`ok-${index}`);
    const notok = document.getElementById(`notok-${index}`);
    if (ok) ok.classList.toggle("active", answer === "OK");
    if (notok) notok.classList.toggle("active", answer === "NÃO OK");
    updateProgress();
    scheduleSave();
};

window.handlePhoto = function(index, input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Selecione uma imagem válida."); input.value = ""; return; }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        if (!checklist[index]) return;
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
};

window.removePhoto = function(index) {
    if (!checklist[index]) return;
    checklist[index].photo = null;
    const preview = document.getElementById(`preview-${index}`);
    const name = document.getElementById(`photo-name-${index}`);
    const image = document.getElementById(`image-${index}`);
    if (preview) preview.style.display = "none";
    if (name) name.textContent = "";
    if (image) image.removeAttribute("src");
    const inputs = document.querySelectorAll(".photo-input");
    if (inputs[index]) inputs[index].value = "";
    scheduleSave();
};

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
    if (!config) { showWarning("Selecione um checklist antes de continuar."); return false; }
    const responsavel = getElementValue("responsavel");
    if (!responsavel) { showWarning("Informe o responsável pela inspeção."); document.getElementById("responsavel")?.focus(); return false; }
    const turno = getElementValue("turno");
    if (!turno) { showWarning("Informe o turno trabalhado."); document.getElementById("turno")?.focus(); return false; }
    
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
    if (!warning) { alert(message); return; }
    warning.textContent = message;
    warning.style.display = "block";
    warning.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideWarning() {
    const warning = document.getElementById("warning");
    if (warning) warning.style.display = "none";
}

function getInspectionData() {
    return {
        version: 2,
        checklistId: config?.id || null,
        checklistName: config?.nome || null,
        checklistVersion: config?.versao || 1,
        responsavel: getElementValue("responsavel"),
        turno: getElementValue("turno"),
        lote: getElementValue("lote"),
        date: new Date().toLocaleString("pt-BR"),
        qtdProduzidos: getElementValue("qtdProduzidos"),
        qtdNaoConformes: getElementValue("qtdNaoConformes"),
        qtdNokAuditoria: getElementValue("qtdNokAuditoria"),
        checklist: config.perguntas.map((question, index) => ({
            id: question.id,
            pergunta: question.texto,
            resultado: checklist[index]?.answer ?? null,
            foto: checklist[index]?.photo ?? null
        }))
    };
}

async function saveCurrentState() {
    if (!config) return;
    const state = {
        version: 2, savedAt: new Date().toISOString(), checklistId: config.id, checklistName: config.nome,
        responsavel: getElementValue("responsavel"), turno: getElementValue("turno"), lote: getElementValue("lote"),
        qtdProduzidos: getElementValue("qtdProduzidos"), qtdNaoConformes: getElementValue("qtdNaoConformes"), qtdNokAuditoria: getElementValue("qtdNokAuditoria"),
        checklist: checklist.map(item => ({ answer: item.answer, photo: item.photo }))
    };
    try { await saveInspectionState(state); } 
    catch (error) { console.error("Erro ao salvar inspeção local:", error); }
}

function scheduleSave() {
    if (!config || isRestoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCurrentState(); }, 400);
}

async function saveInspectionFile() {
    if (!config) { alert("Selecione um checklist antes de salvar."); return; }
    const data = getInspectionData();
    const exportData = { ...data, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 4)], { type: "application/json" });
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
    if (!input) return;
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
        if (!selected) throw new Error("O checklist desse arquivo não está disponível.");

        if (hasCurrentInspectionData() && !confirm("Existe uma inspeção em andamento.\n\nDeseja substituí-la pelo arquivo importado?")) return;

        await loadChecklistOnly(selected, true);
        setElementValue("responsavel", data.responsavel);
        setElementValue("turno", data.turno);
        setElementValue("lote", data.lote);
        setElementValue("qtdProduzidos", data.qtdProduzidos);
        setElementValue("qtdNaoConformes", data.qtdNaoConformes);
        setElementValue("qtdNokAuditoria", data.qtdNokAuditoria);

        data.checklist.forEach((item, index) => {
            if (!checklist[index]) return;
            checklist[index].answer = item.resultado ?? item.answer ?? null;
            checklist[index].photo = item.foto ?? item.photo ?? null;
        });

        restoreChecklistVisual();
        updateProgress();
        setChecklistVisibility(true);
        await saveCurrentState();
        alert("Inspeção carregada com sucesso.");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error("Erro ao importar:", error);
        alert("Não foi possível carregar a inspeção.\n\n" + error.message);
    } finally { input.value = ""; }
}

async function newInspection() {
    if (hasCurrentInspectionData() && !confirm("Existe uma inspeção em andamento.\n\nTodos os dados não salvos em arquivo serão removidos.\n\nDeseja realmente iniciar uma nova inspeção?")) return;

    try { clearTimeout(saveTimer); await clearInspectionState(); } 
    catch (error) { console.error("Erro ao limpar inspeção:", error); }

    config = null;
    checklist = [];
    clearFormFields();
    clearSelectedChecklist();

    const select = document.getElementById("checklistSelect");
    if (select) select.value = "";
    const title = document.querySelector(".header-title");
    const subtitle = document.querySelector(".header-subtitle");
    if (title) title.textContent = "Controle de Qualidade";
    if (subtitle) subtitle.textContent = "Selecione um checklist para iniciar";
    
    const questions = document.getElementById("questions");
    if (questions) questions.innerHTML = "";

    setChecklistVisibility(false);
    updateProgress();
    hideWarning();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// FINALIZAR / EXCEL / FIREBASE
// ============================================================
async function finishInspection() {
    if (!validateChecklist()) return;

    const excelButton = document.getElementById("excelButton");
    const originalText = excelButton.innerHTML;
    
    excelButton.disabled = true;
    excelButton.innerHTML = "⏳ Salvando na nuvem...";

    try {
        await salvarNoFirebase(); // Salva no Realtime Database
        generateExcel(); // Gera o Excel local com as fotos

        const confirmed = confirm("✅ Inspeção salva no Firebase com sucesso!\n\nO arquivo Excel foi gerado.\n\nDeseja iniciar uma nova inspeção?");
        if (confirmed) {
            await newInspection();
        }
    } catch (error) {
        console.error("Erro ao finalizar:", error);
        alert("❌ Erro ao salvar no Firebase:\n\n" + error.message + "\n\nVerifique as Regras de Segurança do Realtime Database no console do Firebase.");
        generateExcel(); 
    } finally {
        excelButton.disabled = false;
        excelButton.innerHTML = originalText;
    }
}

function generateExcel() {
    if (typeof XLSX === "undefined") { alert("A biblioteca Excel não foi carregada."); return; }
    const data = getInspectionData();
    const rows = [
        ["CONTROLE DE QUALIDADE"], [],
        ["Checklist", data.checklistName], ["Responsável", data.responsavel], ["Turno", data.turno], ["Produto / Lote", data.lote], ["Data", data.date], [],
        ["REGISTRO DO TURNO"],
        ["QTD Produzidos", data.qtdProduzidos], ["QTD Peças Não Conformes", data.qtdNaoConformes], ["QTD NOK Auditoria Processo", data.qtdNokAuditoria], [],
        ["CHECKLIST"], ["Nº", "Pergunta", "Resultado", "Foto"]
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

// ============================================================
// PDF (Funções auxiliares mantidas)
// ============================================================
async function generatePDF() {
    if (!validateChecklist()) return;
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("A biblioteca PDF não foi carregada."); return; }

    try {
        const data = getInspectionData();
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let y = 20;

        drawPDFHeader(pdf, pageWidth);
        await addLogoToPDF(pdf);

        pdf.setTextColor(40, 48, 56); pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
        pdf.text("RELATÓRIO DE CONTROLE DE QUALIDADE", 15, y); y += 8;
        pdf.setFontSize(11); pdf.setFont("helvetica", "normal"); pdf.setTextColor(90, 96, 102);
        pdf.text(data.checklistName, 15, y); y += 12;

        drawPDFInfoBox(pdf, data, y, pageWidth); y += 46;
        drawPDFSectionTitle(pdf, "REGISTRO DO TURNO", 15, y); y += 9;

        const produced = Number(data.qtdProduzidos) || 0;
        const nonConforming = Number(data.qtdNaoConformes) || 0;
        const auditNok = Number(data.qtdNokAuditoria) || 0;
        const okCount = data.checklist.filter(item => item.resultado === "OK").length;
        const nokCount = data.checklist.filter(item => item.resultado === "NÃO OK").length;

        y = drawPDFSummaryCards(pdf, [
            ["PRODUZIDOS", String(produced)], ["NÃO CONFORMES", String(nonConforming)],
            ["NOK AUDITORIA", String(auditNok)], ["CHECKLIST", `${okCount} OK / ${nokCount} NOK`]
        ], y, pageWidth);
        y += 12;

        const status = nokCount > 0 ? "NÃO CONFORME" : "CONFORME";
        drawPDFStatus(pdf, status, y, pageWidth); y += 18;

        drawPDFSectionTitle(pdf, "RESULTADO DA INSPEÇÃO", 15, y); y += 10;

        for (let i = 0; i < data.checklist.length; i++) {
            const item = data.checklist[i];
            const question = `${i + 1}. ${item.pergunta}`;
            const lines = pdf.splitTextToSize(question, 150);
            const itemHeight = (lines.length * 4.5) + 14;

            if (y + itemHeight > pageHeight - 25) { addPDFFooter(pdf, pageWidth, pageHeight); pdf.addPage(); y = 20; }

            pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(45, 52, 60);
            pdf.text(lines, 15, y); y += lines.length * 4.5;

            pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
            pdf.setTextColor(item.resultado === "OK" ? 30 : 180, item.resultado === "OK" ? 110 : 55, item.resultado === "OK" ? 70 : 45);
            pdf.text(`Resultado: ${item.resultado}`, 20, y + 2);

            if (item.foto) {
                y += 7;
                if (y + 55 > pageHeight - 25) { addPDFFooter(pdf, pageWidth, pageHeight); pdf.addPage(); y = 20; }
                try {
                    const image = await prepareImageForPDF(item.foto);
                    const dimensions = calculateImageDimensions(image.width, image.height, 70, 50);
                    pdf.addImage(image.data, "JPEG", 20, y, dimensions.width, dimensions.height);
                    y += dimensions.height + 5;
                } catch (error) { console.error("Erro ao adicionar foto:", error); }
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

function drawPDFHeader(pdf, pageWidth) {
    const height = 7, start = { r: 200, g: 188, b: 166 }, end = { r: 253, g: 248, b: 236 }, steps = 40;
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
        image.onerror = function() { resolve(); };
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
    pdf.setFillColor(248, 249, 250); pdf.setDrawColor(225, 228, 231);
    pdf.roundedRect(x, y - 5, width, height, 2, 2, "FD");
    pdf.setFontSize(8); pdf.setFont("helvetica", "bold"); pdf.setTextColor(100, 105, 110);
    pdf.text("CHECKLIST", 20, y + 2); pdf.text("RESPONSÁVEL", 100, y + 2);
    pdf.text("TURNO", 20, y + 14); pdf.text("PRODUTO / LOTE", 100, y + 14);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(35, 40, 45);
    pdf.text(String(data.checklistName || "-"), 20, y + 7); pdf.text(String(data.responsavel || "-"), 100, y + 7);
    pdf.text(String(data.turno || "-"), 20, y + 19); pdf.text(String(data.lote || "-"), 100, y + 19);
    pdf.setFontSize(7); pdf.setTextColor(120, 125, 130); pdf.text(`Data: ${data.date}`, 20, y + 29);
}
function drawPDFSectionTitle(pdf, title, x, y) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(45, 52, 60);
    pdf.text(title, x, y); pdf.setDrawColor(200, 188, 166); pdf.setLineWidth(0.8); pdf.line(x, y + 3, x + 35, y + 3);
}
function drawPDFSummaryCards(pdf, cards, y, pageWidth) {
    const margin = 15, gap = 4, cardWidth = (pageWidth - margin * 2 - gap * 3) / 4, height = 22;
    cards.forEach((card, index) => {
        const x = margin + index * (cardWidth + gap);
        pdf.setFillColor(250, 250, 250); pdf.setDrawColor(225, 228, 231);
        pdf.roundedRect(x, y, cardWidth, height, 2, 2, "FD");
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.5); pdf.setTextColor(110, 115, 120);
        pdf.text(card[0], x + 3, y + 6); pdf.setFontSize(9); pdf.setTextColor(40, 45, 50); pdf.text(card[1], x + 3, y + 15);
    });
    return y + height;
}
function drawPDFStatus(pdf, status, y, pageWidth) {
    const isOK = status === "CONFORME";
    pdf.setFillColor(isOK ? 232 : 250, isOK ? 246 : 235, isOK ? 238 : 232);
    pdf.setDrawColor(isOK ? 150 : 220, isOK ? 190 : 150, isOK ? 165 : 140);
    pdf.roundedRect(15, y, pageWidth - 30, 11, 2, 2, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    pdf.setTextColor(isOK ? 35 : 170, isOK ? 105 : 55, isOK ? 65 : 45);
    pdf.text(`STATUS DA INSPEÇÃO: ${status}`, 20, y + 7);
}
function addPDFFooter(pdf, pageWidth, pageHeight) {
    const pageNumber = pdf.internal.getNumberOfPages();
    pdf.setDrawColor(220, 223, 226); pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(130, 135, 140);
    pdf.text("Controle de Qualidade", 15, pageHeight - 9); pdf.text(`Página ${pageNumber}`, pageWidth - 35, pageHeight - 9);
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
            canvas.getContext("2d").drawImage(image, 0, 0, width, height);
            resolve({ data: canvas.toDataURL("image/jpeg", 0.82), width, height });
        };
        image.onerror = function() { reject(new Error("Imagem inválida.")); };
        image.src = dataUrl;
    });
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatFileDate(date) {
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function sanitizeFileName(value) {
    return String(value || "inspecao").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "inspecao";
}

function getElementValue(id) {
    const element = document.getElementById(id);
    return element ? String(element.value ?? "").trim() : "";
}

function setElementValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
}

// INICIALIZAÇÃO
initialize();