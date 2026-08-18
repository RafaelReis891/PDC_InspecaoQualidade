/*
 * ============================================================
 * CONTROLE DE QUALIDADE
 * app.js
 *
 * Versão: 2
 * ============================================================
 */


/* ============================================================
   CONFIGURAÇÃO DOS CHECKLISTS
============================================================ */

const CHECKLISTS = [

    {
        id: "linha-pintura",
        nome: "Linha de Pintura",
        arquivo: "config/checklists/linha-pintura.json"
    },

    {
        id: "linha-inspecao",
        nome: "Linha de Inspeção",
        arquivo: "config/checklists/linha-inspecao.json"
    },

    {
        id: "linha-haste",
        nome: "Linha de Haste",
        arquivo: "config/checklists/linha-haste.json"
    },

    {
        id: "linha-solda",
        nome: "Linha de Solda",
        arquivo: "config/checklists/linha-solda.json"
    },

    {
        id: "linha-tubos",
        nome: "Linha de Tubos",
        arquivo: "config/checklists/linha-tubos.json"
    },

    {
        id: "linha-montagem",
        nome: "Linha de Montagem",
        arquivo: "config/checklists/linha-montagem.json"
    }

];


/* ============================================================
   ESTADO
============================================================ */

let config = null;

let checklist = [];

let saveTimer = null;

let loadingChecklist = false;


/* ============================================================
   INICIALIZAÇÃO
============================================================ */

async function initialize() {

    try {

        await openDatabase();


        /*
         * Eventos dos campos
         */

        document
            .getElementById("checklistSelect")
            .addEventListener(
                "change",
                changeChecklist
            );


        document
            .getElementById("responsavel")
            .addEventListener(
                "input",
                scheduleSave
            );


        document
            .getElementById("turno")
            .addEventListener(
                "input",
                scheduleSave
            );


        document
            .getElementById("lote")
            .addEventListener(
                "input",
                scheduleSave
            );


        document
            .getElementById("qtdProduzidos")
            .addEventListener(
                "input",
                scheduleSave
            );


        document
            .getElementById("qtdNaoConformes")
            .addEventListener(
                "input",
                scheduleSave
            );


        document
            .getElementById("qtdNokAuditoria")
            .addEventListener(
                "input",
                scheduleSave
            );


        /*
         * Inicialmente não existe checklist.
         */

        config = null;

        checklist = [];


        /*
         * Esconde área final até existir checklist.
         */

        setChecklistVisibility(false);


        updateProgress();


        /*
         * Tenta restaurar inspeção salva.
         */

        const saved =
            await loadInspectionState();


        if (saved) {

            await restoreSavedInspection(saved);

        }


        console.log(
            "Aplicação inicializada."
        );

    }

    catch (error) {

        console.error(error);

        showFatalError(
            error
        );

    }

}


/* ============================================================
   VISIBILIDADE DO CHECKLIST
============================================================ */

function setChecklistVisibility(visible) {

    const questions =
        document.getElementById(
            "questions"
        );


    const finalData =
        document.getElementById(
            "finalData"
        );


    if (questions) {

        questions.style.display =
            visible
                ? ""
                : "none";

    }


    if (finalData) {

        finalData.style.display =
            visible
                ? ""
                : "none";

    }

}


/* ============================================================
   ERRO FATAL
============================================================ */

function showFatalError(error) {

    document.body.innerHTML = `

        <div style="
            padding:30px;
            font-family:Arial,sans-serif;
        ">

            <h2>
                Erro ao iniciar aplicação
            </h2>

            <p>
                ${
                    error?.message ||
                    "Erro desconhecido."
                }
            </p>

        </div>

    `;

}


/* ============================================================
   TROCAR CHECKLIST
============================================================ */

async function changeChecklist() {

    if (loadingChecklist) {
        return;
    }


    const select =
        document.getElementById(
            "checklistSelect"
        );


    const checklistId =
        select.value;


    if (!checklistId) {

        return;

    }


    const selected =
        CHECKLISTS.find(
            item =>
                item.id === checklistId
        );


    if (!selected) {

        alert(
            "Checklist não encontrado."
        );

        select.value =
            config?.id || "";

        return;

    }


    /*
     * Verifica se existe inspeção em andamento.
     */

    const hasData =
        hasCurrentInspectionData();


    if (hasData && config) {

        const confirmed =
            confirm(
                "Existe uma inspeção em andamento.\n\n" +
                "Ao trocar o checklist, os dados atuais " +
                "serão descartados.\n\n" +
                "Deseja continuar?"
            );


        if (!confirmed) {

            select.value =
                config.id;

            return;

        }

    }


    try {

        loadingChecklist = true;


        const response =
            await fetch(
                selected.arquivo,
                {
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Não foi possível carregar:\n${selected.arquivo}`
            );

        }


        const newConfig =
            await response.json();


        /*
         * Validação básica
         */

        if (
            !newConfig ||
            !Array.isArray(
                newConfig.perguntas
            )
        ) {

            throw new Error(
                "O JSON do checklist possui formato inválido."
            );

        }


        config =
            newConfig;


        checklist =
            config.perguntas.map(
                () => ({

                    answer: null,

                    photo: null

                })
            );


        /*
         * Limpa dados anteriores.
         */

        clearFormFields();


        /*
         * Atualiza cabeçalho.
         */

        document
            .querySelector(".header-title")
            .textContent =
            config.nome;


        document
            .querySelector(".header-subtitle")
            .textContent =
            config.descricao ||
            "Checklist de inspeção";


        /*
         * Renderiza perguntas.
         */

        renderQuestions();


        setChecklistVisibility(
            true
        );


        updateProgress();


        /*
         * Remove estado anterior.
         */

        await clearInspectionState();


        /*
         * Salva imediatamente o novo estado.
         */

        await saveCurrentState();


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });


        console.log(
            `Checklist carregado: ${config.nome}`
        );

    }

    catch (error) {

        console.error(error);


        alert(
            "Não foi possível carregar o checklist.\n\n" +
            error.message
        );


        /*
         * Retorna para o checklist anterior.
         */

        if (config) {

            select.value =
                config.id;

        }

    }

    finally {

        loadingChecklist = false;

    }

}


/* ============================================================
   VERIFICAR SE EXISTEM DADOS
============================================================ */

function hasCurrentInspectionData() {

    if (!config) {

        return false;

    }


    const responsavel =
        document
            .getElementById("responsavel")
            .value
            .trim();


    const turno =
        document
            .getElementById("turno")
            .value
            .trim();


    const lote =
        document
            .getElementById("lote")
            .value
            .trim();


    const qtdProduzidos =
        document
            .getElementById("qtdProduzidos")
            .value;


    const qtdNaoConformes =
        document
            .getElementById("qtdNaoConformes")
            .value;


    const qtdNokAuditoria =
        document
            .getElementById("qtdNokAuditoria")
            .value;


    const checklistHasData =
        checklist.some(
            item =>
                item.answer !== null ||
                !!item.photo
        );


    return (
        responsavel !== "" ||
        turno !== "" ||
        lote !== "" ||
        qtdProduzidos !== "" ||
        qtdNaoConformes !== "" ||
        qtdNokAuditoria !== "" ||
        checklistHasData
    );

}


/* ============================================================
   LIMPAR CAMPOS
============================================================ */

function clearFormFields() {

    document
        .getElementById("responsavel")
        .value = "";


    document
        .getElementById("turno")
        .value = "";


    document
        .getElementById("lote")
        .value = "";


    document
        .getElementById("qtdProduzidos")
        .value = "";


    document
        .getElementById("qtdNaoConformes")
        .value = "";


    document
        .getElementById("qtdNokAuditoria")
        .value = "";

}


/* ============================================================
   RESTAURAR INSPEÇÃO
============================================================ */

async function restoreSavedInspection(saved) {

    try {

        /*
         * Compatibilidade com versão antiga.
         */

        const checklistId =
            saved.checklistId ||
            findChecklistIdByName(
                saved.checklistName
            );


        if (!checklistId) {

            console.warn(
                "Não foi possível identificar o checklist salvo."
            );

            return;

        }


        const selected =
            CHECKLISTS.find(
                item =>
                    item.id === checklistId
            );


        if (!selected) {

            console.warn(
                "Checklist salvo não está disponível."
            );

            return;

        }


        /*
         * Carrega o JSON.
         */

        const response =
            await fetch(
                selected.arquivo,
                {
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Não foi possível carregar o checklist salvo."
            );

        }


        config =
            await response.json();


        checklist =
            config.perguntas.map(
                () => ({

                    answer: null,

                    photo: null

                })
            );


        /*
         * Renderiza.
         */

        document
            .getElementById(
                "checklistSelect"
            )
            .value =
            config.id;


        document
            .querySelector(".header-title")
            .textContent =
            config.nome;


        document
            .querySelector(".header-subtitle")
            .textContent =
            config.descricao ||
            "Checklist de inspeção";


        renderQuestions();


        setChecklistVisibility(
            true
        );


        /*
         * Campos.
         */

        document
            .getElementById("responsavel")
            .value =
            saved.responsavel ||
            "";


        document
            .getElementById("turno")
            .value =
            saved.turno ||
            "";


        document
            .getElementById("lote")
            .value =
            saved.lote ||
            "";


        document
            .getElementById("qtdProduzidos")
            .value =
            saved.qtdProduzidos ??
            "";


        document
            .getElementById("qtdNaoConformes")
            .value =
            saved.qtdNaoConformes ??
            "";


        document
            .getElementById("qtdNokAuditoria")
            .value =
            saved.qtdNokAuditoria ??
            "";


        /*
         * Respostas e fotos.
         */

        if (
            Array.isArray(
                saved.checklist
            )
        ) {

            saved.checklist.forEach(
                (savedItem, index) => {

                    if (
                        !checklist[index]
                    ) {

                        return;

                    }


                    checklist[index].answer =
                        savedItem.answer ??
                        savedItem.resultado ??
                        null;


                    checklist[index].photo =
                        savedItem.photo ??
                        savedItem.foto ??
                        null;

                }
            );

        }


        /*
         * Atualiza visual.
         */

        restoreChecklistVisual();


        updateProgress();


        console.log(
            "Inspeção restaurada."
        );

    }

    catch (error) {

        console.error(
            "Erro ao restaurar inspeção:",
            error
        );

    }

}


/* ============================================================
   ENCONTRAR ID POR NOME
============================================================ */

function findChecklistIdByName(name) {

    if (!name) {

        return null;

    }


    const found =
        CHECKLISTS.find(
            item =>
                item.nome === name
        );


    return found
        ? found.id
        : null;

}


/* ============================================================
   RENDERIZAR PERGUNTAS
============================================================ */

function renderQuestions() {

    const container =
        document.getElementById(
            "questions"
        );


    container.innerHTML = "";


    if (
        !config ||
        !Array.isArray(
            config.perguntas
        )
    ) {

        return;

    }


    config.perguntas.forEach(
        (question, index) => {

            const element =
                document.createElement(
                    "section"
                );


            element.className =
                "card question";


            const photoLabel =
                question.fotoObrigatoria

                    ? "📷 Adicionar foto *"

                    : "📷 Adicionar foto";


            element.innerHTML = `

                <div class="question-top">

                    <div class="question-number">

                        ${index + 1}

                    </div>


                    <div class="question-text">

                        ${escapeHTML(
                            question.texto
                        )}

                    </div>

                </div>


                <div class="answer-buttons">

                    <button
                        id="ok-${index}"
                        type="button"
                        class="answer-button answer-ok"
                        onclick="setAnswer(${index}, 'OK')"
                    >

                        ✓ OK

                    </button>


                    <button
                        id="notok-${index}"
                        type="button"
                        class="answer-button answer-not-ok"
                        onclick="setAnswer(${index}, 'NÃO OK')"
                    >

                        ✕ NÃO OK

                    </button>

                </div>


                <div class="photo-area">

                    <label class="photo-button">

                        ${photoLabel}

                        <input
                            class="photo-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onchange="handlePhoto(${index}, this)"
                        >

                    </label>


                    <span
                        id="photo-name-${index}"
                        class="photo-name">
                    </span>

                </div>


                <div
                    id="preview-${index}"
                    class="photo-preview"
                    style="display:none;"
                >

                    <img
                        id="image-${index}"
                        alt="Foto da inspeção"
                    >


                    <button
                        type="button"
                        class="remove-photo"
                        onclick="removePhoto(${index})"
                    >

                        ×

                    </button>

                </div>

            `;


            container.appendChild(
                element
            );

        }
    );


    restoreChecklistVisual();

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   RESTAURAR VISUAL
============================================================ */

function restoreChecklistVisual() {

    checklist.forEach(
        (item, index) => {

            const ok =
                document.getElementById(
                    `ok-${index}`
                );


            const notok =
                document.getElementById(
                    `notok-${index}`
                );


            if (ok) {

                ok.classList.toggle(
                    "active",
                    item.answer === "OK"
                );

            }


            if (notok) {

                notok.classList.toggle(
                    "active",
                    item.answer === "NÃO OK"
                );

            }


            if (item.photo) {

                const image =
                    document.getElementById(
                        `image-${index}`
                    );


                const preview =
                    document.getElementById(
                        `preview-${index}`
                    );


                const name =
                    document.getElementById(
                        `photo-name-${index}`
                    );


                if (image) {

                    image.src =
                        item.photo;

                }


                if (preview) {

                    preview.style.display =
                        "block";

                }


                if (name) {

                    name.textContent =
                        "Foto restaurada";

                }

            }

        }
    );

}


/* ============================================================
   RESPOSTA
============================================================ */

function setAnswer(
    index,
    answer
) {

    if (!checklist[index]) {

        return;

    }


    checklist[index].answer =
        answer;


    const ok =
        document.getElementById(
            `ok-${index}`
        );


    const notok =
        document.getElementById(
            `notok-${index}`
        );


    if (ok) {

        ok.classList.toggle(
            "active",
            answer === "OK"
        );

    }


    if (notok) {

        notok.classList.toggle(
            "active",
            answer === "NÃO OK"
        );

    }


    updateProgress();

    scheduleSave();

}


/* ============================================================
   FOTO
============================================================ */

function handlePhoto(
    index,
    input
) {

    const file =
        input.files?.[0];


    if (!file) {

        return;

    }


    /*
     * Verificação básica.
     */

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Selecione uma imagem válida."
        );

        input.value = "";

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function(event) {

            checklist[index].photo =
                event.target.result;


            const image =
                document.getElementById(
                    `image-${index}`
                );


            const preview =
                document.getElementById(
                    `preview-${index}`
                );


            const name =
                document.getElementById(
                    `photo-name-${index}`
                );


            if (image) {

                image.src =
                    event.target.result;

            }


            if (preview) {

                preview.style.display =
                    "block";

            }


            if (name) {

                name.textContent =
                    file.name;

            }


            scheduleSave();

        };


    reader.readAsDataURL(
        file
    );

}


/* ============================================================
   REMOVER FOTO
============================================================ */

function removePhoto(index) {

    if (!checklist[index]) {

        return;

    }


    checklist[index].photo =
        null;


    const preview =
        document.getElementById(
            `preview-${index}`
        );


    const name =
        document.getElementById(
            `photo-name-${index}`
        );


    const image =
        document.getElementById(
            `image-${index}`
        );


    if (preview) {

        preview.style.display =
            "none";

    }


    if (name) {

        name.textContent =
            "";

    }


    if (image) {

        image.removeAttribute(
            "src"
        );

    }


    scheduleSave();

}


/* ============================================================
   PROGRESSO
============================================================ */

function updateProgress() {

    const progressText =
        document.getElementById(
            "progressText"
        );


    const progressFill =
        document.getElementById(
            "progressFill"
        );


    const excelButton =
        document.getElementById(
            "excelButton"
        );


    if (!checklist.length) {

        if (progressText) {

            progressText.textContent =
                "0 / 0";

        }


        if (progressFill) {

            progressFill.style.width =
                "0%";

        }


        if (excelButton) {

            excelButton.disabled =
                true;

        }

        return;

    }


    const completed =
        checklist.filter(
            item =>
                item.answer !== null
        ).length;


    const total =
        checklist.length;


    const percentage =
        (
            completed /
            total
        ) * 100;


    if (progressText) {

        progressText.textContent =
            `${completed} / ${total}`;

    }


    if (progressFill) {

        progressFill.style.width =
            `${percentage}%`;

    }


    if (excelButton) {

        excelButton.disabled =
            completed !== total;

    }

}


/* ============================================================
   VALIDAÇÃO
============================================================ */

function validateChecklist() {

    if (!config) {

        showWarning(
            "Selecione um checklist antes de continuar."
        );

        return false;

    }


    /*
     * Responsável
     */

    const responsavel =
        document
            .getElementById(
                "responsavel"
            )
            .value
            .trim();


    if (!responsavel) {

        showWarning(
            "Informe o responsável pela inspeção."
        );


        document
            .getElementById(
                "responsavel"
            )
            .focus();


        return false;

    }


    /*
     * Turno
     */

    const turno =
        document
            .getElementById(
                "turno"
            )
            .value
            .trim();


    if (!turno) {

        showWarning(
            "Informe o turno trabalhado."
        );


        document
            .getElementById(
                "turno"
            )
            .focus();


        return false;

    }


    /*
     * Perguntas
     */

    const incomplete =
        checklist.findIndex(
            item =>
                item.answer === null
        );


    if (incomplete !== -1) {

        showWarning(
            `A pergunta ${
                incomplete + 1
            } ainda não foi respondida.`
        );


        document
            .getElementById(
                `ok-${incomplete}`
            )
            ?.scrollIntoView({

                behavior: "smooth",

                block: "center"

            });


        return false;

    }


    /*
     * Fotos obrigatórias
     */

    for (
        let i = 0;
        i < config.perguntas.length;
        i++
    ) {

        const question =
            config.perguntas[i];


        if (
            question.fotoObrigatoria &&
            !checklist[i].photo
        ) {

            showWarning(
                `A pergunta ${
                    i + 1
                } exige uma foto.`
            );


            document
                .getElementById(
                    `photo-name-${i}`
                )
                ?.scrollIntoView({

                    behavior: "smooth",

                    block: "center"

                });


            return false;

        }

    }


    hideWarning();

    return true;

}


/* ============================================================
   AVISO
============================================================ */

function showWarning(message) {

    const warning =
        document.getElementById(
            "warning"
        );


    warning.textContent =
        message;


    warning.style.display =
        "block";


    warning.scrollIntoView({

        behavior: "smooth",

        block: "center"

    });

}


function hideWarning() {

    const warning =
        document.getElementById(
            "warning"
        );


    warning.style.display =
        "none";

}


/* ============================================================
   DADOS DA INSPEÇÃO
============================================================ */

function getInspectionData() {

    return {

        version: 2,

        checklistId:
            config?.id ||
            null,

        checklistName:
            config?.nome ||
            null,

        checklistVersion:
            config?.versao ||
            1,

        responsavel:
            document
                .getElementById(
                    "responsavel"
                )
                .value
                .trim(),

        turno:
            document
                .getElementById(
                    "turno"
                )
                .value
                .trim(),

        lote:
            document
                .getElementById(
                    "lote"
                )
                .value
                .trim(),

        date:
            new Date()
                .toLocaleString(
                    "pt-BR"
                ),

        qtdProduzidos:
            document
                .getElementById(
                    "qtdProduzidos"
                )
                .value,

        qtdNaoConformes:
            document
                .getElementById(
                    "qtdNaoConformes"
                )
                .value,

        qtdNokAuditoria:
            document
                .getElementById(
                    "qtdNokAuditoria"
                )
                .value,

        checklist:
            config.perguntas.map(
                (
                    question,
                    index
                ) => ({

                    id:
                        question.id,

                    pergunta:
                        question.texto,

                    resultado:
                        checklist[index]
                            .answer,

                    foto:
                        checklist[index]
                            .photo

                })
            )

    };

}


/* ============================================================
   AUTOSAVE
============================================================ */

async function saveCurrentState() {

    if (!config) {

        return;

    }


    const state = {

        version: 2,

        savedAt:
            new Date().toISOString(),

        checklistId:
            config.id,

        checklistName:
            config.nome,

        checklistVersion:
            config.versao ||
            1,

        responsavel:
            document
                .getElementById(
                    "responsavel"
                )
                .value,

        turno:
            document
                .getElementById(
                    "turno"
                )
                .value,

        lote:
            document
                .getElementById(
                    "lote"
                )
                .value,

        qtdProduzidos:
            document
                .getElementById(
                    "qtdProduzidos"
                )
                .value,

        qtdNaoConformes:
            document
                .getElementById(
                    "qtdNaoConformes"
                )
                .value,

        qtdNokAuditoria:
            document
                .getElementById(
                    "qtdNokAuditoria"
                )
                .value,

        checklist:
            checklist.map(
                item => ({

                    answer:
                        item.answer,

                    photo:
                        item.photo

                })
            )

    };


    try {

        await saveInspectionState(
            state
        );

    }

    catch (error) {

        console.error(
            "Erro ao salvar inspeção:",
            error
        );

    }

}


/* ============================================================
   AGENDAR SAVE
============================================================ */

function scheduleSave() {

    if (!config) {

        return;

    }


    clearTimeout(
        saveTimer
    );


    saveTimer =
        setTimeout(
            () => {

                saveCurrentState();

            },
            400
        );

}


/* ============================================================
   SALVAR ARQUIVO JSON
============================================================ */

async function saveInspectionFile() {

    if (!config) {

        alert(
            "Selecione um checklist antes de salvar."
        );

        return;

    }


    const data =
        getInspectionData();


    const exportData = {

        ...data,

        exportedAt:
            new Date().toISOString()

    };


    const json =
        JSON.stringify(
            exportData,
            null,
            4
        );


    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        `inspecao_${sanitizeFileName(
            config.nome
        )}_${formatFileDate(
            new Date()
        )}.json`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );


    await saveCurrentState();

}


/* ============================================================
   CARREGAR ARQUIVO
============================================================ */

function loadInspectionFile() {

    const input =
        document.getElementById(
            "importFile"
        );


    input.value = "";

    input.click();

}


/* ============================================================
   IMPORTAR JSON
============================================================ */

async function handleImportFile(
    input
) {

    const file =
        input.files?.[0];


    if (!file) {

        return;

    }


    try {

        const text =
            await file.text();


        const data =
            JSON.parse(
                text
            );


        if (
            !data ||
            !Array.isArray(
                data.checklist
            )
        ) {

            throw new Error(
                "Arquivo de inspeção inválido."
            );

        }


        const checklistId =
            data.checklistId ||
            findChecklistIdByName(
                data.checklistName
            );


        if (!checklistId) {

            throw new Error(
                "Não foi possível identificar o checklist desse arquivo."
            );

        }


        const selected =
            CHECKLISTS.find(
                item =>
                    item.id === checklistId
            );


        if (!selected) {

            throw new Error(
                "O checklist desse arquivo não está disponível nesta instalação."
            );

        }


        /*
         * Confirma se já existe outra inspeção.
         */

        if (
            hasCurrentInspectionData()
        ) {

            const confirmed =
                confirm(
                    "Existe uma inspeção em andamento.\n\n" +
                    "Deseja substituí-la pelo arquivo importado?"
                );


            if (!confirmed) {

                return;

            }

        }


        /*
         * Carrega configuração.
         */

        const response =
            await fetch(
                selected.arquivo,
                {
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Não foi possível carregar o checklist."
            );

        }


        config =
            await response.json();


        checklist =
            config.perguntas.map(
                () => ({

                    answer: null,

                    photo: null

                })
            );


        /*
         * Renderiza.
         */

        document
            .getElementById(
                "checklistSelect"
            )
            .value =
            config.id;


        document
            .querySelector(
                ".header-title"
            )
            .textContent =
            config.nome;


        document
            .querySelector(
                ".header-subtitle"
            )
            .textContent =
            config.descricao ||
            "Checklist de inspeção";


        renderQuestions();


        setChecklistVisibility(
            true
        );


        /*
         * Dados.
         */

        document
            .getElementById(
                "responsavel"
            )
            .value =
            data.responsavel ||
            "";


        document
            .getElementById(
                "turno"
            )
            .value =
            data.turno ||
            "";


        document
            .getElementById(
                "lote"
            )
            .value =
            data.lote ||
            "";


        document
            .getElementById(
                "qtdProduzidos"
            )
            .value =
            data.qtdProduzidos ??
            "";


        document
            .getElementById(
                "qtdNaoConformes"
            )
            .value =
            data.qtdNaoConformes ??
            "";


        document
            .getElementById(
                "qtdNokAuditoria"
            )
            .value =
            data.qtdNokAuditoria ??
            "";


        /*
         * Respostas e fotos.
         */

        data.checklist.forEach(
            (
                item,
                index
            ) => {

                if (
                    !checklist[index]
                ) {

                    return;

                }


                checklist[index].answer =
                    item.resultado ??
                    item.answer ??
                    null;


                checklist[index].photo =
                    item.foto ??
                    item.photo ??
                    null;

            }
        );


        restoreChecklistVisual();


        updateProgress();


        await saveCurrentState();


        alert(
            "Inspeção carregada com sucesso."
        );


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }

    catch (error) {

        console.error(error);


        alert(
            "Não foi possível carregar a inspeção.\n\n" +
            error.message
        );

    }

    finally {

        input.value = "";

    }

}


/* ============================================================
   NOVA INSPEÇÃO
============================================================ */

async function newInspection() {

    if (
        hasCurrentInspectionData()
    ) {

        const confirmed =
            confirm(
                "Existe uma inspeção em andamento.\n\n" +
                "Todos os dados não salvos em arquivo serão removidos.\n\n" +
                "Deseja realmente iniciar uma nova inspeção?"
            );


        if (!confirmed) {

            return;

        }

    }


    try {

        await clearInspectionState();

    }

    catch (error) {

        console.error(error);

    }


    config = null;

    checklist = [];


    clearFormFields();


    document
        .getElementById(
            "checklistSelect"
        )
        .value = "";


    document
        .querySelector(
            ".header-title"
        )
        .textContent =
        "Controle de Qualidade";


    document
        .querySelector(
            ".header-subtitle"
        )
        .textContent =
        "Selecione um checklist para iniciar";


    document
        .getElementById(
            "questions"
        )
        .innerHTML = "";


    setChecklistVisibility(
        false
    );


    updateProgress();


    hideWarning();


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


/* ============================================================
   EXCEL
============================================================ */

function generateExcel() {

    if (!validateChecklist()) {

        return;

    }


    if (
        typeof XLSX ===
        "undefined"
    ) {

        alert(
            "A biblioteca Excel não foi carregada.\n\n" +
            "Verifique sua conexão com a internet."
        );

        return;

    }


    const data =
        getInspectionData();


    const rows = [

        [
            "CONTROLE DE QUALIDADE"
        ],

        [],

        [
            "Checklist",
            data.checklistName
        ],

        [
            "Responsável",
            data.responsavel
        ],

        [
            "Turno",
            data.turno
        ],

        [
            "Produto / Lote",
            data.lote
        ],

        [
            "Data",
            data.date
        ],

        [],

        [
            "REGISTRO DO TURNO"
        ],

        [
            "QTD Produzidos",
            data.qtdProduzidos
        ],

        [
            "QTD Peças Não Conformes",
            data.qtdNaoConformes
        ],

        [
            "QTD NOK Auditoria Processo",
            data.qtdNokAuditoria
        ],

        [],

        [
            "CHECKLIST"
        ],

        [
            "Nº",
            "Pergunta",
            "Resultado",
            "Foto"
        ]

    ];


    data.checklist.forEach(
        (
            item,
            index
        ) => {

            rows.push([

                index + 1,

                item.pergunta,

                item.resultado,

                item.foto
                    ? "SIM"
                    : "NÃO"

            ]);

        }
    );


    const workbook =
        XLSX.utils.book_new();


    const worksheet =
        XLSX.utils.aoa_to_sheet(
            rows
        );


    worksheet["!cols"] = [

        {
            wch: 8
        },

        {
            wch: 80
        },

        {
            wch: 18
        },

        {
            wch: 12
        }

    ];


    XLSX.utils.book_append_sheet(

        workbook,

        worksheet,

        "Checklist"

    );


    XLSX.writeFile(

        workbook,

        `controle_qualidade_${sanitizeFileName(
            data.checklistName
        )}_${formatFileDate(
            new Date()
        )}.xlsx`

    );

}


/* ============================================================
   FINALIZAR
============================================================ */

async function finishInspection() {

    if (!validateChecklist()) {

        return;

    }


    generateExcel();


    const newInspectionConfirmed =
        confirm(
            "Inspeção finalizada.\n\n" +
            "O Excel foi gerado.\n\n" +
            "Deseja iniciar uma nova inspeção?"
        );


    if (
        newInspectionConfirmed
    ) {

        await newInspection();

    }

}


/* ============================================================
   PDF
============================================================ */

async function generatePDF() {

    if (!validateChecklist()) {

        return;

    }


    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        alert(
            "A biblioteca PDF não foi carregada.\n\n" +
            "Verifique sua conexão com a internet."
        );

        return;

    }


    try {

        const data =
            getInspectionData();


        const {
            jsPDF
        } = window.jspdf;


        const pdf =
            new jsPDF({

                orientation:
                    "portrait",

                unit:
                    "mm",

                format:
                    "a4"

            });


        const pageWidth =
            pdf.internal.pageSize
                .getWidth();


        const pageHeight =
            pdf.internal.pageSize
                .getHeight();


        let y = 20;


        /*
         * ====================================================
         * CABEÇALHO
         * ====================================================
         */

        drawPDFHeader(
            pdf,
            pageWidth
        );


        /*
         * Logo
         */

        await addLogoToPDF(
            pdf
        );


        /*
         * Título
         */

        pdf.setTextColor(
            40,
            48,
            56
        );


        pdf.setFontSize(
            18
        );


        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.text(
            "RELATÓRIO DE CONTROLE DE QUALIDADE",
            15,
            y
        );


        y += 8;


        pdf.setFontSize(
            11
        );


        pdf.setFont(
            "helvetica",
            "normal"
        );


        pdf.setTextColor(
            90,
            96,
            102
        );


        pdf.text(
            data.checklistName,
            15,
            y
        );


        y += 12;


        /*
         * ====================================================
         * INFORMAÇÕES
         * ====================================================
         */

        drawPDFInfoBox(
            pdf,
            data,
            y,
            pageWidth
        );


        y += 46;


        /*
         * ====================================================
         * RESUMO DO TURNO
         * ====================================================
         */

        drawPDFSectionTitle(
            pdf,
            "REGISTRO DO TURNO",
            15,
            y
        );


        y += 9;


        const produced =
            Number(
                data.qtdProduzidos
            ) || 0;


        const nonConforming =
            Number(
                data.qtdNaoConformes
            ) || 0;


        const auditNok =
            Number(
                data.qtdNokAuditoria
            ) || 0;


        const okCount =
            data.checklist.filter(
                item =>
                    item.resultado ===
                    "OK"
            ).length;


        const nokCount =
            data.checklist.filter(
                item =>
                    item.resultado ===
                    "NÃO OK"
            ).length;


        const photoCount =
            data.checklist.filter(
                item =>
                    !!item.foto
            ).length;


        y =
            drawPDFSummaryCards(
                pdf,
                [
                    [
                        "PRODUZIDOS",
                        String(
                            produced
                        )
                    ],

                    [
                        "NÃO CONFORMES",
                        String(
                            nonConforming
                        )
                    ],

                    [
                        "NOK AUDITORIA",
                        String(
                            auditNok
                        )
                    ],

                    [
                        "CHECKLIST",
                        `${okCount} OK / ${nokCount} NOK`
                    ]
                ],
                y,
                pageWidth
            );


        y += 12;


        /*
         * ====================================================
         * RESULTADO
         * ====================================================
         */

        const status =
            nokCount > 0
                ? "NÃO CONFORME"
                : "CONFORME";


        drawPDFStatus(
            pdf,
            status,
            y,
            pageWidth
        );


        y += 18;


        /*
         * ====================================================
         * CHECKLIST
         * ====================================================
         */

        drawPDFSectionTitle(
            pdf,
            "RESULTADO DA INSPEÇÃO",
            15,
            y
        );


        y += 10;


        for (
            let i = 0;
            i < data.checklist.length;
            i++
        ) {

            const item =
                data.checklist[i];


            const question =
                `${i + 1}. ${item.pergunta}`;


            const lines =
                pdf.splitTextToSize(
                    question,
                    150
                );


            const itemHeight =
                (
                    lines.length *
                    4.5
                ) + 14;


            if (
                y + itemHeight >
                pageHeight - 25
            ) {

                addPDFFooter(
                    pdf,
                    pageWidth,
                    pageHeight
                );


                pdf.addPage();


                y = 20;

            }


            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                9
            );


            pdf.setTextColor(
                45,
                52,
                60
            );


            pdf.text(
                lines,
                15,
                y
            );


            y +=
                lines.length *
                4.5;


            /*
             * Resultado
             */

            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                9
            );


            if (
                item.resultado ===
                "OK"
            ) {

                pdf.setTextColor(
                    30,
                    110,
                    70
                );

            }

            else {

                pdf.setTextColor(
                    180,
                    55,
                    45
                );

            }


            pdf.text(
                `Resultado: ${item.resultado}`,
                20,
                y + 2
            );


            /*
             * Foto
             */

            if (item.foto) {

                y += 7;


                if (
                    y + 55 >
                    pageHeight - 25
                ) {

                    addPDFFooter(
                        pdf,
                        pageWidth,
                        pageHeight
                    );


                    pdf.addPage();


                    y = 20;

                }


                try {

                    const image =
                        await prepareImageForPDF(
                            item.foto
                        );


                    const dimensions =
                        calculateImageDimensions(
                            image.width,
                            image.height,
                            70,
                            50
                        );


                    pdf.addImage(

                        image.data,

                        "JPEG",

                        20,

                        y,

                        dimensions.width,

                        dimensions.height

                    );


                    y +=
                        dimensions.height +
                        5;

                }

                catch (error) {

                    console.error(
                        "Erro ao adicionar foto:",
                        error
                    );

                }

            }


            y += 8;


            /*
             * Linha divisória
             */

            pdf.setDrawColor(
                220,
                223,
                226
            );


            pdf.line(
                15,
                y,
                pageWidth - 15,
                y
            );


            y += 5;

        }


        /*
         * ====================================================
         * RODAPÉ FINAL
         * ====================================================
         */

        addPDFFooter(
            pdf,
            pageWidth,
            pageHeight
        );


        /*
         * ====================================================
         * SALVAR
         * ====================================================
         */

        pdf.save(

            `controle_qualidade_${sanitizeFileName(
                data.checklistName
            )}_${formatFileDate(
                new Date()
            )}.pdf`

        );

    }

    catch (error) {

        console.error(
            "ERRO AO GERAR PDF:",
            error
        );


        alert(
            "Erro ao gerar o PDF.\n\n" +
            error.message
        );

    }

}


/* ============================================================
   CABEÇALHO PDF
============================================================ */

function drawPDFHeader(
    pdf,
    pageWidth
) {

    const height =
        7;


    /*
     * Simula gradiente:
     *
     * rgb(200,188,166)
     * →
     * rgb(253,248,236)
     */

    const start = {
        r: 200,
        g: 188,
        b: 166
    };


    const end = {
        r: 253,
        g: 248,
        b: 236
    };


    const steps = 40;


    for (
        let i = 0;
        i < steps;
        i++
    ) {

        const t =
            i /
            (steps - 1);


        const r =
            Math.round(
                start.r +
                (
                    end.r -
                    start.r
                ) *
                t
            );


        const g =
            Math.round(
                start.g +
                (
                    end.g -
                    start.g
                ) *
                t
            );


        const b =
            Math.round(
                start.b +
                (
                    end.b -
                    start.b
                ) *
                t
            );


        pdf.setFillColor(
            r,
            g,
            b
        );


        pdf.rect(

            i *
                (
                    pageWidth /
                    steps
                ),

            0,

            pageWidth /
                steps +
                0.5,

            height,

            "F"

        );

    }

}


/* ============================================================
   LOGO
============================================================ */

function addLogoToPDF(
    pdf
) {

    return new Promise(
        resolve => {

            const image =
                new Image();


            image.onload =
                function() {

                    try {

                        const maxWidth =
                            30;


                        const maxHeight =
                            15;


                        const dimensions =
                            calculateImageDimensions(

                                image.naturalWidth,

                                image.naturalHeight,

                                maxWidth,

                                maxHeight

                            );


                        pdf.addImage(

                            image,

                            "PNG",

                            155,

                            10,

                            dimensions.width,

                            dimensions.height

                        );

                    }

                    catch (error) {

                        console.warn(
                            "Não foi possível adicionar o logo:",
                            error
                        );

                    }


                    resolve();

                };


            image.onerror =
                function() {

                    console.warn(
                        "Logo não encontrado: src/logo.png"
                    );


                    resolve();

                };


            image.src =
                "src/logo.png";

        }
    );

}


/* ============================================================
   DIMENSÕES PROPORCIONAIS
============================================================ */

function calculateImageDimensions(
    originalWidth,
    originalHeight,
    maxWidth,
    maxHeight
) {

    if (
        !originalWidth ||
        !originalHeight
    ) {

        return {

            width:
                maxWidth,

            height:
                maxHeight

        };

    }


    const ratio =
        Math.min(

            maxWidth /
                originalWidth,

            maxHeight /
                originalHeight

        );


    return {

        width:
            originalWidth *
            ratio,

        height:
            originalHeight *
            ratio

    };

}


/* ============================================================
   INFO BOX PDF
============================================================ */

function drawPDFInfoBox(
    pdf,
    data,
    y,
    pageWidth
) {

    const x = 15;

    const width =
        pageWidth - 30;

    const height = 36;


    pdf.setFillColor(
        248,
        249,
        250
    );


    pdf.setDrawColor(
        225,
        228,
        231
    );


    pdf.roundedRect(

        x,

        y - 5,

        width,

        height,

        2,

        2,

        "FD"

    );


    pdf.setFontSize(
        8
    );


    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.setTextColor(
        100,
        105,
        110
    );


    pdf.text(
        "CHECKLIST",
        20,
        y + 2
    );


    pdf.text(
        "RESPONSÁVEL",
        100,
        y + 2
    );


    pdf.text(
        "TURNO",
        20,
        y + 14
    );


    pdf.text(
        "PRODUTO / LOTE",
        100,
        y + 14
    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.setFontSize(
        9
    );


    pdf.setTextColor(
        35,
        40,
        45
    );


    pdf.text(
        String(
            data.checklistName ||
            "-"
        ),
        20,
        y + 7
    );


    pdf.text(
        String(
            data.responsavel ||
            "-"
        ),
        100,
        y + 7
    );


    pdf.text(
        String(
            data.turno ||
            "-"
        ),
        20,
        y + 19
    );


    pdf.text(
        String(
            data.lote ||
            "-"
        ),
        100,
        y + 19
    );


    pdf.setFontSize(
        7
    );


    pdf.setTextColor(
        120,
        125,
        130
    );


    pdf.text(
        `Data: ${data.date}`,
        20,
        y + 29
    );

}


/* ============================================================
   TÍTULO DE SEÇÃO PDF
============================================================ */

function drawPDFSectionTitle(
    pdf,
    title,
    x,
    y
) {

    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.setFontSize(
        11
    );


    pdf.setTextColor(
        45,
        52,
        60
    );


    pdf.text(
        title,
        x,
        y
    );


    pdf.setDrawColor(
        200,
        188,
        166
    );


    pdf.setLineWidth(
        0.8
    );


    pdf.line(
        x,
        y + 3,
        x + 35,
        y + 3
    );

}


/* ============================================================
   CARDS DO RESUMO
============================================================ */

function drawPDFSummaryCards(
    pdf,
    cards,
    y,
    pageWidth
) {

    const margin = 15;

    const gap = 4;

    const cardWidth =
        (
            pageWidth -
            margin * 2 -
            gap * 3
        ) / 4;


    const height = 22;


    cards.forEach(
        (
            card,
            index
        ) => {

            const x =
                margin +
                index *
                (
                    cardWidth +
                    gap
                );


            pdf.setFillColor(
                250,
                250,
                250
            );


            pdf.setDrawColor(
                225,
                228,
                231
            );


            pdf.roundedRect(

                x,

                y,

                cardWidth,

                height,

                2,

                2,

                "FD"

            );


            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                6.5
            );


            pdf.setTextColor(
                110,
                115,
                120
            );


            pdf.text(
                card[0],
                x + 3,
                y + 6
            );


            pdf.setFontSize(
                9
            );


            pdf.setTextColor(
                40,
                45,
                50
            );


            pdf.text(
                card[1],
                x + 3,
                y + 15
            );

        }
    );


    return y + height;

}


/* ============================================================
   STATUS PDF
============================================================ */

function drawPDFStatus(
    pdf,
    status,
    y,
    pageWidth
) {

    const isOK =
        status === "CONFORME";


    pdf.setFillColor(

        isOK
            ? 232
            : 250,

        isOK
            ? 246
            : 235,

        isOK
            ? 238
            : 232

    );


    pdf.setDrawColor(

        isOK
            ? 150
            : 220,

        isOK
            ? 190
            : 150,

        isOK
            ? 165
            : 140

    );


    pdf.roundedRect(

        15,

        y,

        pageWidth - 30,

        11,

        2,

        2,

        "FD"

    );


    pdf.setFont(
        "helvetica",
        "bold"
    );


    pdf.setFontSize(
        9
    );


    pdf.setTextColor(

        isOK
            ? 35
            : 170,

        isOK
            ? 105
            : 55,

        isOK
            ? 65
            : 45

    );


    pdf.text(
        `STATUS DA INSPEÇÃO: ${status}`,
        20,
        y + 7
    );

}


/* ============================================================
   RODAPÉ
============================================================ */

function addPDFFooter(
    pdf,
    pageWidth,
    pageHeight
) {

    const pageNumber =
        pdf.internal.getNumberOfPages();


    pdf.setDrawColor(
        220,
        223,
        226
    );


    pdf.line(

        15,

        pageHeight - 15,

        pageWidth - 15,

        pageHeight - 15

    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.setFontSize(
        7
    );


    pdf.setTextColor(
        130,
        135,
        140
    );


    pdf.text(

        "Controle de Qualidade",

        15,

        pageHeight - 9

    );


    pdf.text(

        `Página ${pageNumber}`,

        pageWidth - 35,

        pageHeight - 9

    );

}


/* ============================================================
   PREPARAR IMAGEM
============================================================ */

function prepareImageForPDF(
    dataUrl
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const image =
                new Image();


            image.onload =
                function() {

                    /*
                     * Converte para JPEG.
                     * Isso melhora compatibilidade
                     * com jsPDF.
                     */

                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    const maxDimension =
                        1400;


                    let width =
                        image.naturalWidth;


                    let height =
                        image.naturalHeight;


                    if (
                        width >
                        maxDimension ||
                        height >
                        maxDimension
                    ) {

                        const ratio =
                            Math.min(

                                maxDimension /
                                    width,

                                maxDimension /
                                    height

                            );


                        width *=
                            ratio;


                        height *=
                            ratio;

                    }


                    canvas.width =
                        width;


                    canvas.height =
                        height;


                    const context =
                        canvas.getContext(
                            "2d"
                        );


                    context.drawImage(

                        image,

                        0,

                        0,

                        width,

                        height

                    );


                    resolve({

                        data:
                            canvas.toDataURL(
                                "image/jpeg",
                                0.82
                            ),

                        width,

                        height

                    });

                };


            image.onerror =
                function() {

                    reject(
                        new Error(
                            "Imagem inválida."
                        )
                    );

                };


            image.src =
                dataUrl;

        }
    );

}


/* ============================================================
   FORMATAÇÃO DE DATA
============================================================ */

function formatFileDate(
    date
) {

    const pad =
        value =>
            String(
                value
            ).padStart(
                2,
                "0"
            );


    return [

        date.getFullYear(),

        pad(
            date.getMonth() + 1
        ),

        pad(
            date.getDate()
        )

    ].join("-")
    +
    "_"
    +
    [

        pad(
            date.getHours()
        ),

        pad(
            date.getMinutes()
        ),

        pad(
            date.getSeconds()
        )

    ].join("-");

}


/* ============================================================
   NOME SEGURO PARA ARQUIVO
============================================================ */

function sanitizeFileName(
    value
) {

    return String(
        value ||
        "inspecao"
    )

        .normalize(
            "NFD"
        )

        .replace(
            /[\u0300-\u036f]/g,
            ""
        )

        .replace(
            /[^a-zA-Z0-9_-]+/g,
            "_"
        )

        .replace(
            /^_+|_+$/g,
            ""

        )

        || "inspecao";

}


/* ============================================================
   START
============================================================ */

initialize();
