let config = null;
let checklist = [];

let saveTimer = null;


/*
 * ============================================================
 * INICIALIZAÇÃO
 * ============================================================
 */

async function initialize() {

    try {

        await openDatabase();


        const response =
            await fetch(
                "config/checklist.json"
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


        document.querySelector(
            ".header-title"
        ).textContent =
            config.nome;


        document.querySelector(
            ".header-subtitle"
        ).textContent =
            config.descricao;


        renderQuestions();


        /*
         * ====================================================
         * RESTAURAR ESTADO
         * ====================================================
         */

        const saved =
            await loadInspectionState();


        if (
            saved &&
            saved.checklistName === config.nome
        ) {

            document
                .getElementById("responsavel")
                .value =
                saved.responsavel || "";


            document
                .getElementById("lote")
                .value =
                saved.lote || "";


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
                            savedItem.answer;


                        checklist[index].photo =
                            savedItem.photo;

                    }
                );

            }


            checklist.forEach(
                (item, index) => {

                    if (
                        item.answer
                    ) {

                        document
                            .getElementById(
                                `ok-${index}`
                            )
                            .classList
                            .toggle(
                                "active",
                                item.answer === "OK"
                            );


                        document
                            .getElementById(
                                `notok-${index}`
                            )
                            .classList
                            .toggle(
                                "active",
                                item.answer === "NÃO OK"
                            );

                    }


                    if (
                        item.photo
                    ) {

                        document
                            .getElementById(
                                `image-${index}`
                            )
                            .src =
                            item.photo;


                        document
                            .getElementById(
                                `preview-${index}`
                            )
                            .style.display =
                            "block";


                        document
                            .getElementById(
                                `photo-name-${index}`
                            )
                            .textContent =
                            "Foto restaurada";

                    }

                });

        }


        updateProgress();

    }

    catch (error) {

        console.error(error);


        document.body.innerHTML = `

            <div style="
                padding:30px;
                font-family:Arial;
            ">

                <h2>
                    Erro ao iniciar aplicação
                </h2>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

    }

}


/*
 * ============================================================
 * MONTAR PERGUNTAS
 * ============================================================
 */

function renderQuestions() {

    const container =
        document.getElementById("questions");


    container.innerHTML = "";


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
                        ${question.texto}
                    </div>

                </div>


                <div class="answer-buttons">

                    <button
                        id="ok-${index}"
                        class="answer-button answer-ok"
                        onclick="setAnswer(${index}, 'OK')">

                        ✓ OK

                    </button>


                    <button
                        id="notok-${index}"
                        class="answer-button answer-not-ok"
                        onclick="setAnswer(${index}, 'NÃO OK')">

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
                    class="photo-preview">

                    <img
                        id="image-${index}"
                        alt="Foto da inspeção"
                    >


                    <button
                        class="remove-photo"
                        onclick="removePhoto(${index})">

                        ×

                    </button>

                </div>

            `;


            container.appendChild(
                element
            );

        }
    );

}


/*
 * ============================================================
 * RESPOSTA
 * ============================================================
 */

function setAnswer(
    index,
    answer
) {

    checklist[index].answer =
        answer;


    document
        .getElementById(
            `ok-${index}`
        )
        .classList
        .toggle(
            "active",
            answer === "OK"
        );


    document
        .getElementById(
            `notok-${index}`
        )
        .classList
        .toggle(
            "active",
            answer === "NÃO OK"
        );


    updateProgress();

    scheduleSave();

}


/*
 * ============================================================
 * FOTO
 * ============================================================
 */

function handlePhoto(
    index,
    input
) {

    const file =
        input.files[0];


    if (!file) {
        return;
    }


    const reader =
        new FileReader();


    reader.onload =
        function(event) {

            checklist[index].photo =
                event.target.result;


            document
                .getElementById(
                    `image-${index}`
                )
                .src =
                event.target.result;


            document
                .getElementById(
                    `preview-${index}`
                )
                .style.display =
                "block";


            document
                .getElementById(
                    `photo-name-${index}`
                )
                .textContent =
                file.name;


            scheduleSave();

        };


    reader.readAsDataURL(
        file
    );

}


/*
 * ============================================================
 * REMOVER FOTO
 * ============================================================
 */

function removePhoto(
    index
) {

    checklist[index].photo =
        null;


    document
        .getElementById(
            `preview-${index}`
        )
        .style.display =
        "none";


    document
        .getElementById(
            `photo-name-${index}`
        )
        .textContent =
        "";


    scheduleSave();

}


/*
 * ============================================================
 * PROGRESSO
 * ============================================================
 */

function updateProgress() {

    if (!checklist.length) {
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


    document
        .getElementById(
            "progressText"
        )
        .textContent =
        `${completed} / ${total}`;


    document
        .getElementById(
            "progressFill"
        )
        .style.width =
        `${percentage}%`;


    document
        .getElementById(
            "excelButton"
        )
        .disabled =
        completed !== total;

}


/*
 * ============================================================
 * VALIDAÇÃO
 * ============================================================
 */

function validateChecklist() {

    const incomplete =
        checklist.findIndex(
            item =>
                item.answer === null
        );


    if (
        incomplete !== -1
    ) {

        showWarning(
            `A pergunta ${
                incomplete + 1
            } ainda não foi respondida.`
        );


        document
            .getElementById(
                `ok-${incomplete}`
            )
            .scrollIntoView({
                behavior: "smooth",
                block: "center"
            });


        return false;

    }


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
                .scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });


            return false;

        }

    }


    hideWarning();


    return true;

}


/*
 * ============================================================
 * AVISO
 * ============================================================
 */

function showWarning(
    message
) {

    const warning =
        document.getElementById(
            "warning"
        );


    warning.textContent =
        message;


    warning.style.display =
        "block";

}


function hideWarning() {

    const warning =
        document.getElementById(
            "warning"
        );


    if (warning) {

        warning.style.display =
            "none";

    }

}


/*
 * ============================================================
 * DADOS
 * ============================================================
 */

function getInspectionData() {

    return {

        responsavel:
            document
                .getElementById(
                    "responsavel"
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


/*
 * ============================================================
 * EXCEL
 * ============================================================
 */

function generateExcel() {

    if (
        !validateChecklist()
    ) {
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
            config.nome
        ],

        [
            "Responsável",
            data.responsavel
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
            wch: 6
        },

        {
            wch: 70
        },

        {
            wch: 15
        },

        {
            wch: 10
        }

    ];


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Checklist"
    );


    XLSX.writeFile(
        workbook,
        "controle_qualidade.xlsx"
    );

}


/*
 * ============================================================
 * DATA DO ARQUIVO
 * ============================================================
 */

function formatFileDate() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    const hour =
        String(
            now.getHours()
        ).padStart(
            2,
            "0"
        );


    const minute =
        String(
            now.getMinutes()
        ).padStart(
            2,
            "0"
        );


    const second =
        String(
            now.getSeconds()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}_${hour}-${minute}-${second}`;

}


/*
 * ============================================================
 * CARREGAR LOGO
 * ============================================================
 */

function loadImageAsDataURL(
    src
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

                    try {

                        const canvas =
                            document.createElement(
                                "canvas"
                            );


                        canvas.width =
                            image.naturalWidth;


                        canvas.height =
                            image.naturalHeight;


                        const context =
                            canvas.getContext(
                                "2d"
                            );


                        if (!context) {

                            reject(
                                new Error(
                                    "Canvas não disponível."
                                )
                            );

                            return;

                        }


                        context.drawImage(
                            image,
                            0,
                            0
                        );


                        resolve({

                            data:
                                canvas.toDataURL(
                                    "image/png"
                                ),

                            width:
                                image.naturalWidth,

                            height:
                                image.naturalHeight

                        });

                    }

                    catch (error) {

                        reject(
                            error
                        );

                    }

                };


            image.onerror =
                function() {

                    reject(
                        new Error(
                            `Não foi possível carregar ${src}`
                        )
                    );

                };


            image.src =
                src;

        }
    );

}


/*
 * ============================================================
 * PDF
 * ============================================================
 */

async function generatePDF() {

    if (
        !validateChecklist()
    ) {
        return;
    }


    if (
        typeof window.jspdf ===
            "undefined" ||
        typeof window.jspdf.jsPDF ===
            "undefined"
    ) {

        showWarning(
            "A biblioteca de PDF não foi carregada."
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


        const margin =
            15;


        const contentWidth =
            pageWidth -
            margin * 2;


        const colors = {

            dark:
                [28, 35, 42],

            gray:
                [105, 112, 120],

            light:
                [247, 248, 249],

            border:
                [215, 219, 223],

            white:
                [255, 255, 255],

            green:
                [31, 132, 88],

            red:
                [190, 55, 55],

            orange:
                [211, 132, 32]

        };


        let y =
            15;


        /*
         * ====================================================
         * LOGO
         * ====================================================
         */

        let logoData =
            null;


        let logoWidth =
            25;


        let logoHeight =
            20;


        try {

            const logo =
                await loadImageAsDataURL(
                    "src/logo.png"
                );


            logoData =
                logo.data;


            logoWidth =
                25;


            logoHeight =
                (
                    logo.height /
                    logo.width
                ) *
                logoWidth;

        }

        catch (error) {

            console.warn(
                "Logo não encontrado. Continuando sem logo."
            );

        }


        /*
         * ====================================================
         * FUNÇÕES AUXILIARES
         * ====================================================
         */

        function fill(color) {

            pdf.setFillColor(
                ...color
            );

        }


        function textColor(color) {

            pdf.setTextColor(
                ...color
            );

        }


        function drawColor(color) {

            pdf.setDrawColor(
                ...color
            );

        }


        function roundedBox(
            x,
            top,
            width,
            height,
            color,
            radius = 1.5
        ) {

            fill(color);

            drawColor(color);

            pdf.roundedRect(
                x,
                top,
                width,
                height,
                radius,
                radius,
                "F"
            );

        }


        function footer(
            pageNumber
        ) {

            const footerY =
                pageHeight - 8;


            drawColor(
                colors.border
            );


            pdf.setLineWidth(
                0.25
            );


            pdf.line(
                margin,
                footerY - 3,
                pageWidth - margin,
                footerY - 3
            );


            pdf.setFont(
                "helvetica",
                "normal"
            );


            pdf.setFontSize(
                7.5
            );


            textColor(
                colors.gray
            );


            pdf.text(
                "Relatório de Controle de Qualidade",
                margin,
                footerY
            );


            pdf.text(
                `Página ${pageNumber}`,
                pageWidth - margin,
                footerY,
                {
                    align:
                        "right"
                }
            );

        }


        function ensureSpace(
            height
        ) {

            if (
                y + height >
                pageHeight - 17
            ) {

                footer(
                    pdf.getNumberOfPages()
                );


                pdf.addPage();


                y =
                    16;

            }

        }


        /*
         * ====================================================
         * CABEÇALHO COM GRADIENTE
         * ====================================================
         */

        const headerHeight =
            30;


        const gradientSteps =
            30;


        const startColor =
            [200, 188, 166];


        const endColor =
            [253, 248, 236];


        for (
            let i = 0;
            i < gradientSteps;
            i++
        ) {

            const t =
                i /
                (
                    gradientSteps - 1
                );


            const r =
                Math.round(
                    startColor[0] +
                    (
                        endColor[0] -
                        startColor[0]
                    ) * t
                );


            const g =
                Math.round(
                    startColor[1] +
                    (
                        endColor[1] -
                        startColor[1]
                    ) * t
                );


            const b =
                Math.round(
                    startColor[2] +
                    (
                        endColor[2] -
                        startColor[2]
                    ) * t
                );


            pdf.setFillColor(
                r,
                g,
                b
            );


            pdf.rect(
                margin,
                y +
                (
                    headerHeight /
                    gradientSteps
                ) * i,
                contentWidth,
                headerHeight /
                    gradientSteps +
                    0.2,
                "F"
            );

        }


        /*
         * ====================================================
         * LOGO
         * ====================================================
         */

        if (logoData) {

            try {

                pdf.addImage(

                    logoData,

                    "PNG",

                    margin + 5,

                    y + 5,

                    logoWidth,

                    logoHeight,

                    undefined,

                    "FAST"

                );

            }

            catch (error) {

                console.warn(
                    "Erro ao inserir logo:",
                    error
                );

            }

        }


        /*
         * ====================================================
         * TÍTULO
         * ====================================================
         */

        const titleX =
            logoData
                ? margin + 36
                : margin + 7;


        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.setFontSize(
            16
        );


        textColor(
            [55, 48, 40]
        );


        pdf.text(
            "RELATÓRIO DE CONTROLE DE QUALIDADE",
            titleX,
            y + 11
        );


        pdf.setFont(
            "helvetica",
            "normal"
        );


        pdf.setFontSize(
            8.5
        );


        textColor(
            [105, 96, 84]
        );


        pdf.text(
            config.nome,
            titleX,
            y + 18
        );


        pdf.text(
            "Documento de inspeção",
            titleX,
            y + 24
        );


        y +=
            37;


        /*
         * ====================================================
         * IDENTIFICAÇÃO
         * ====================================================
         */

        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.setFontSize(
            10
        );


        textColor(
            colors.dark
        );


        pdf.text(
            "IDENTIFICAÇÃO DA INSPEÇÃO",
            margin,
            y
        );


        y +=
            5;


        const gap =
            4;


        const boxWidth =
            (
                contentWidth -
                gap
            ) / 2;


        const boxHeight =
            18;


        const info = [

            [
                margin,
                "RESPONSÁVEL",
                data.responsavel ||
                "Não informado"
            ],

            [
                margin +
                    boxWidth +
                    gap,
                "PRODUTO / LOTE",
                data.lote ||
                "Não informado"
            ]

        ];


        info.forEach(
            (
                [x, label, value]
            ) => {

                roundedBox(
                    x,
                    y,
                    boxWidth,
                    boxHeight,
                    colors.light
                );


                pdf.setFont(
                    "helvetica",
                    "bold"
                );


                pdf.setFontSize(
                    6.5
                );


                textColor(
                    colors.gray
                );


                pdf.text(
                    label,
                    x + 4,
                    y + 6
                );


                pdf.setFont(
                    "helvetica",
                    "normal"
                );


                pdf.setFontSize(
                    9
                );


                textColor(
                    colors.dark
                );


                const valueLines =
                    pdf.splitTextToSize(
                        value,
                        boxWidth - 8
                    );


                pdf.text(
                    valueLines.slice(
                        0,
                        1
                    ),
                    x + 4,
                    y + 12
                );

            }
        );


        y +=
            boxHeight +
            4;


        roundedBox(
            margin,
            y,
            contentWidth,
            15,
            colors.light
        );


        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.setFontSize(
            6.5
        );


        textColor(
            colors.gray
        );


        pdf.text(
            "DATA DA INSPEÇÃO",
            margin + 4,
            y + 6
        );


        pdf.setFont(
            "helvetica",
            "normal"
        );


        pdf.setFontSize(
            9
        );


        textColor(
            colors.dark
        );


        pdf.text(
            data.date,
            margin + 4,
            y + 11.5
        );


        const hasNotOk =
            data.checklist.some(
                item =>
                    item.resultado ===
                    "NÃO OK"
            );


        const statusText =
            hasNotOk
                ? "NÃO CONFORME"
                : "CONFORME";


        const statusColor =
            hasNotOk
                ? colors.red
                : colors.green;


        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.setFontSize(
            6.5
        );


        textColor(
            colors.gray
        );


        pdf.text(
            "STATUS",
            margin +
                contentWidth -
                38,
            y + 6
        );


        pdf.setFontSize(
            8.5
        );


        textColor(
            statusColor
        );


        pdf.text(
            statusText,
            margin +
                contentWidth -
                38,
            y + 11.5
        );


        y +=
            23;


        /*
         * ====================================================
         * RESUMO
         * ====================================================
         */

        const total =
            data.checklist.length;


        const okCount =
            data.checklist.filter(
                item =>
                    item.resultado ===
                    "OK"
            ).length;


        const notOkCount =
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


        const summaryGap =
            3;


        const summaryWidth =
            (
                contentWidth -
                summaryGap * 3
            ) / 4;


        const summary = [

            [
                "ITENS",
                total,
                colors.dark
            ],

            [
                "OK",
                okCount,
                colors.green
            ],

            [
                "NÃO OK",
                notOkCount,
                colors.red
            ],

            [
                "FOTOS",
                photoCount,
                colors.orange
            ]

        ];


        summary.forEach(
            (
                [
                    label,
                    value,
                    color
                ],
                index
            ) => {

                const x =
                    margin +
                    index *
                    (
                        summaryWidth +
                        summaryGap
                    );


                roundedBox(
                    x,
                    y,
                    summaryWidth,
                    19,
                    colors.light
                );


                pdf.setFont(
                    "helvetica",
                    "bold"
                );


                pdf.setFontSize(
                    6.5
                );


                textColor(
                    colors.gray
                );


                pdf.text(
                    label,
                    x + 4,
                    y + 6
                );


                pdf.setFontSize(
                    13
                );


                textColor(
                    color
                );


                pdf.text(
                    String(value),
                    x + 4,
                    y + 15
                );

            }
        );


        y +=
            28;


        /*
         * ====================================================
         * RESULTADOS
         * ====================================================
         */

        pdf.setFont(
            "helvetica",
            "bold"
        );


        pdf.setFontSize(
            10
        );


        textColor(
            colors.dark
        );


        pdf.text(
            "RESULTADO DA INSPEÇÃO",
            margin,
            y
        );


        y +=
            5;


        data.checklist.forEach(
            (
                item,
                index
            ) => {

                const questionLines =
                    pdf.splitTextToSize(
                        item.pergunta,
                        contentWidth -
                            48
                    );


                const rowHeight =
                    Math.max(
                        16,
                        questionLines.length *
                            4.2 +
                            8
                    );


                ensureSpace(
                    rowHeight + 2
                );


                if (
                    index % 2 === 0
                ) {

                    roundedBox(
                        margin,
                        y,
                        contentWidth,
                        rowHeight,
                        [248, 249, 250],
                        1
                    );

                }


                pdf.setFont(
                    "helvetica",
                    "bold"
                );


                pdf.setFontSize(
                    8
                );


                textColor(
                    colors.gray
                );


                pdf.text(
                    String(
                        index + 1
                    ).padStart(
                        2,
                        "0"
                    ),
                    margin + 4,
                    y + 7
                );


                pdf.setFont(
                    "helvetica",
                    "normal"
                );


                pdf.setFontSize(
                    8.5
                );


                textColor(
                    colors.dark
                );


                pdf.text(
                    questionLines,
                    margin + 13,
                    y + 6
                );


                const resultColor =
                    item.resultado ===
                    "OK"

                        ? colors.green

                        : colors.red;


                pdf.setFont(
                    "helvetica",
                    "bold"
                );


                pdf.setFontSize(
                    7.5
                );


                textColor(
                    resultColor
                );


                pdf.text(
                    item.resultado,
                    margin +
                        contentWidth -
                        29,
                    y + 7
                );


                y +=
                    rowHeight +
                    2;

            }
        );


        /*
         * ====================================================
         * FOTOS
         * ====================================================
         */

        const photos =
            data.checklist.filter(
                item =>
                    !!item.foto
            );


        if (
            photos.length > 0
        ) {

            ensureSpace(
                20
            );


            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                10
            );


            textColor(
                colors.dark
            );


            pdf.text(
                "EVIDÊNCIAS FOTOGRÁFICAS",
                margin,
                y
            );


            y +=
                6;


            const photoWidth =
                82;


            const photoHeight =
                58;


            const photoGap =
                6;


            photos.forEach(
                (
                    item,
                    photoIndex
                ) => {

                    const column =
                        photoIndex % 2;


                    if (
                        column === 0
                    ) {

                        ensureSpace(
                            photoHeight +
                                15
                        );

                    }


                    const x =
                        column === 0

                            ? margin

                            : margin +
                              photoWidth +
                              photoGap;


                    const topY =
                        y;


                    roundedBox(
                        x,
                        topY,
                        photoWidth,
                        photoHeight + 10,
                        [248, 249, 250],
                        1.5
                    );


                    try {

                        pdf.addImage(
                            item.foto,
                            "JPEG",
                            x + 3,
                            topY + 3,
                            photoWidth - 6,
                            photoHeight - 6,
                            undefined,
                            "FAST"
                        );

                    }

                    catch (error) {

                        console.error(
                            "Erro ao inserir foto:",
                            error
                        );

                    }


                    const originalIndex =
                        data.checklist.indexOf(
                            item
                        );


                    pdf.setFont(
                        "helvetica",
                        "bold"
                    );


                    pdf.setFontSize(
                        7
                    );


                    textColor(
                        colors.gray
                    );


                    pdf.text(
                        `Item ${
                            originalIndex + 1
                        }`,
                        x + 4,
                        topY +
                            photoHeight +
                            6
                    );


                    if (
                        column === 1
                    ) {

                        y +=
                            photoHeight +
                            14;

                    }

                }
            );


            if (
                photos.length % 2 !== 0
            ) {

                y +=
                    photoHeight +
                    14;

            }

        }


        /*
         * ====================================================
         * FINAL
         * ====================================================
         */

        ensureSpace(
            22
        );


        drawColor(
            colors.border
        );


        pdf.setLineWidth(
            0.3
        );


        pdf.line(
            margin,
            y,
            pageWidth - margin,
            y
        );


        y +=
            7;


        pdf.setFont(
            "helvetica",
            "normal"
        );


        pdf.setFontSize(
            7.5
        );


        textColor(
            colors.gray
        );


        pdf.text(
            "Documento gerado automaticamente pelo sistema de Controle de Qualidade.",
            margin,
            y
        );


        pdf.text(
            `Checklist: ${
                config.id || "-"
            } | Versão: ${
                config.versao || 1
            }`,
            margin,
            y + 5
        );


        /*
         * ====================================================
         * RODAPÉ
         * ====================================================
         */

        const totalPages =
            pdf.getNumberOfPages();


        for (
            let page = 1;
            page <= totalPages;
            page++
        ) {

            pdf.setPage(
                page
            );


            footer(
                page
            );

        }


        /*
         * ====================================================
         * SALVAR
         * ====================================================
         */

        pdf.save(
            `controle_qualidade_${
                formatFileDate()
            }.pdf`
        );


        hideWarning();

    }

    catch (error) {

        console.error(
            "ERRO AO GERAR PDF:",
            error
        );


        showWarning(
            "Não foi possível gerar o PDF. Veja o console do navegador para mais detalhes."
        );

    }

}


/*
 * ============================================================
 * SALVAR ESTADO
 * ============================================================
 */

async function saveCurrentState() {

    if (!config) {
        return;
    }


    const state = {

        version:
            1,

        savedAt:
            new Date()
                .toISOString(),

        checklistName:
            config.nome,

        responsavel:
            document
                .getElementById(
                    "responsavel"
                )
                .value,

        lote:
            document
                .getElementById(
                    "lote"
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


/*
 * ============================================================
 * AGENDAMENTO DO SAVE
 * ============================================================
 */

function scheduleSave() {

    clearTimeout(
        saveTimer
    );


    saveTimer =
        setTimeout(
            () => {

                saveCurrentState();

            },
            300
        );

}


/*
 * ============================================================
 * FINALIZAR
 * ============================================================
 */

async function finishInspection() {

    if (
        !validateChecklist()
    ) {
        return;
    }


    generateExcel();


    const newInspection =
        confirm(
            "Inspeção finalizada.\n\n" +
            "Deseja iniciar uma nova inspeção?"
        );


    if (
        newInspection
    ) {

        await clearInspectionState();


        location.reload();

    }

}

/*
 * ============================================================
 * EXPORTAR INSPEÇÃO
 * ============================================================
 */

async function exportInspection() {

    if (!config) {

        alert(
            "O sistema ainda não terminou de carregar."
        );

        return;

    }


    /*
     * Garante que o estado mais recente
     * esteja salvo antes de exportar.
     */

    await saveCurrentState();


    const state = {

        version: 1,

        exportedAt:
            new Date().toISOString(),

        checklistName:
            config.nome,

        checklistId:
            config.id || null,

        checklistVersion:
            config.versao || 1,

        responsavel:
            document
                .getElementById("responsavel")
                .value
                .trim(),

        lote:
            document
                .getElementById("lote")
                .value
                .trim(),

        checklist:
            checklist.map(
                (item, index) => ({

                    id:
                        config.perguntas[index]
                            ?.id || null,

                    answer:
                        item.answer,

                    photo:
                        item.photo

                })
            )

    };


    try {

        const json =
            JSON.stringify(
                state
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
            `inspecao_${
                formatFileDate()
            }.json`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        console.log(
            "Inspeção exportada."
        );

    }

    catch (error) {

        console.error(
            "Erro ao exportar inspeção:",
            error
        );


        alert(
            "Não foi possível salvar a inspeção."
        );

    }

}


/*
 * ============================================================
 * IMPORTAR INSPEÇÃO
 * ============================================================
 */

async function importInspection(
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


        const imported =
            JSON.parse(
                text
            );


        /*
         * ====================================================
         * VALIDAÇÃO BÁSICA
         * ====================================================
         */

        if (
            !imported ||
            typeof imported !== "object"
        ) {

            throw new Error(
                "Arquivo inválido."
            );

        }


        if (
            !Array.isArray(
                imported.checklist
            )
        ) {

            throw new Error(
                "O arquivo não contém uma inspeção válida."
            );

        }


        /*
         * Verifica se pertence ao checklist atual
         */

        if (
            imported.checklistName &&
            imported.checklistName !==
                config.nome
        ) {

            const proceed =
                confirm(
                    "Esta inspeção pertence a outro checklist:\n\n" +
                    imported.checklistName +
                    "\n\n" +
                    "O checklist atual é:\n\n" +
                    config.nome +
                    "\n\n" +
                    "Deseja carregar mesmo assim?"
                );


            if (!proceed) {

                input.value =
                    "";

                return;

            }

        }


        /*
         * ====================================================
         * CONFIRMAÇÃO
         * ====================================================
         */

        const proceed =
            confirm(
                "Carregar esta inspeção?\n\n" +
                "As respostas e fotos atuais serão substituídas."
            );


        if (!proceed) {

            input.value =
                "";

            return;

        }


        /*
         * ====================================================
         * RESTAURAR CAMPOS
         * ====================================================
         */

        document
            .getElementById(
                "responsavel"
            )
            .value =
            imported.responsavel || "";


        document
            .getElementById(
                "lote"
            )
            .value =
            imported.lote || "";


        /*
         * ====================================================
         * RESTAURAR CHECKLIST
         * ====================================================
         */

        checklist =
            config.perguntas.map(
                (
                    question,
                    index
                ) => {

                    const importedItem =
                        imported.checklist[
                            index
                        ];


                    return {

                        answer:
                            importedItem?.answer ||
                            null,

                        photo:
                            importedItem?.photo ||
                            null

                    };

                }
            );


        /*
         * ====================================================
         * ATUALIZAR INTERFACE
         * ====================================================
         */

        checklist.forEach(
            (
                item,
                index
            ) => {

                const okButton =
                    document.getElementById(
                        `ok-${index}`
                    );


                const notOkButton =
                    document.getElementById(
                        `notok-${index}`
                    );


                const preview =
                    document.getElementById(
                        `preview-${index}`
                    );


                const image =
                    document.getElementById(
                        `image-${index}`
                    );


                const photoName =
                    document.getElementById(
                        `photo-name-${index}`
                    );


                /*
                 * Resposta
                 */

                if (okButton) {

                    okButton.classList.toggle(
                        "active",
                        item.answer === "OK"
                    );

                }


                if (notOkButton) {

                    notOkButton.classList.toggle(
                        "active",
                        item.answer === "NÃO OK"
                    );

                }


                /*
                 * Foto
                 */

                if (
                    item.photo
                ) {

                    if (image) {

                        image.src =
                            item.photo;

                    }


                    if (preview) {

                        preview.style.display =
                            "block";

                    }


                    if (photoName) {

                        photoName.textContent =
                            "Foto carregada";

                    }

                }

                else {

                    if (image) {

                        image.removeAttribute(
                            "src"
                        );

                    }


                    if (preview) {

                        preview.style.display =
                            "none";

                    }


                    if (photoName) {

                        photoName.textContent =
                            "";

                    }

                }

            }
        );


        /*
         * Atualiza progresso
         */

        updateProgress();


        /*
         * Salva imediatamente no IndexedDB.
         * Assim, mesmo se o usuário recarregar
         * a página depois do carregamento,
         * a inspeção continuará lá.
         */

        await saveCurrentState();


        /*
         * Limpa mensagem de erro
         */

        hideWarning();


        alert(
            "Inspeção carregada com sucesso."
        );


        console.log(
            "Inspeção importada:",
            file.name
        );

    }

    catch (error) {

        console.error(
            "Erro ao importar inspeção:",
            error
        );


        alert(
            "Não foi possível carregar o arquivo.\n\n" +
            "Verifique se ele é um arquivo de inspeção válido."
        );

    }


    /*
     * Permite selecionar novamente
     * o mesmo arquivo.
     */

    input.value =
        "";

}


/*
 * ============================================================
 * NOVA INSPEÇÃO
 * ============================================================
 */

async function newInspection() {

    const hasData =
        checklist.some(
            item =>
                item.answer !== null ||
                !!item.photo
        );


    const responsavel =
        document
            .getElementById(
                "responsavel"
            )
            .value
            .trim();


    const lote =
        document
            .getElementById(
                "lote"
            )
            .value
            .trim();


    const hasHeaderData =
        responsavel !== "" ||
        lote !== "";


    if (
        hasData ||
        hasHeaderData
    ) {

        const proceed =
            confirm(
                "Existe uma inspeção em andamento.\n\n" +
                "Ao iniciar uma nova inspeção, " +
                "as respostas e fotos atuais serão apagadas.\n\n" +
                "Deseja continuar?"
            );


        if (!proceed) {
            return;
        }

    }


    try {

        await clearInspectionState();


        /*
         * Limpa os dados atuais
         */

        document
            .getElementById(
                "responsavel"
            )
            .value =
            "";


        document
            .getElementById(
                "lote"
            )
            .value =
            "";


        checklist =
            config.perguntas.map(
                () => ({

                    answer:
                        null,

                    photo:
                        null

                })
            );


        /*
         * Limpa visual das perguntas
         */

        checklist.forEach(
            (
                item,
                index
            ) => {

                const okButton =
                    document.getElementById(
                        `ok-${index}`
                    );


                const notOkButton =
                    document.getElementById(
                        `notok-${index}`
                    );


                const preview =
                    document.getElementById(
                        `preview-${index}`
                    );


                const image =
                    document.getElementById(
                        `image-${index}`
                    );


                const photoName =
                    document.getElementById(
                        `photo-name-${index}`
                    );


                if (okButton) {

                    okButton.classList.remove(
                        "active"
                    );

                }


                if (notOkButton) {

                    notOkButton.classList.remove(
                        "active"
                    );

                }


                if (preview) {

                    preview.style.display =
                        "none";

                }


                if (image) {

                    image.removeAttribute(
                        "src"
                    );

                }


                if (photoName) {

                    photoName.textContent =
                        "";

                }

            }
        );


        updateProgress();


        hideWarning();


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });


        console.log(
            "Nova inspeção iniciada."
        );

    }

    catch (error) {

        console.error(
            "Erro ao iniciar nova inspeção:",
            error
        );


        alert(
            "Não foi possível iniciar uma nova inspeção."
        );

    }

}


/*
 * ============================================================
 * START
 * ============================================================
 */

initialize();