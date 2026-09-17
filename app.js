/* =========================================================
   APP.JS
   Gestion complète :
   - Supabase
   - Authentification administrateur
   - Dossiers
   - Mémos
   - Exercices
   - Médias
   - Recherche/navigation
   - Realtime
   - Import / export
========================================================= */


/* =========================================================
   1. CONFIGURATION SUPABASE
=========================================================

   REMPLACE uniquement ces deux valeurs.

   Ne mets JAMAIS :
   - service_role
   - secret key
   - mot de passe

========================================================= */

const SUPABASE_URL = "TON_URL_SUPABASE";
const SUPABASE_KEY = "TA_CLE_PUBLIQUE_SUPABASE";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   2. CONFIGURATION
========================================================= */

const ITEMS_TABLE = "items";
const ADMIN_TABLE = "admin_users";
const STORAGE_BUCKET = "media";


/* =========================================================
   3. ETAT DE L'APPLICATION
========================================================= */

let items = [];

let currentFolder = null;

let currentView = "home";

let currentSession = null;

let realtimeChannel = null;

let editingId = null;


/* =========================================================
   4. INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    setupLoginInterface();

    setupEditor();

    setupKeyboardShortcuts();

    setupAuthListener();

    await checkSession();

    await loadItems();

    subscribeRealtime();

    showHome();

});


/* =========================================================
   5. INTERFACE DE CONNEXION
========================================================= */

function setupLoginInterface() {

    const loginSection = document.getElementById("login");

    if (!loginSection) return;

    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");

    if (firstName) {

        firstName.type = "email";

        firstName.id = "loginEmail";

        firstName.name = "email";

        firstName.placeholder = "adresse@email.com";

        firstName.autocomplete = "email";

    }

    if (lastName) {

        lastName.type = "password";

        lastName.id = "loginPassword";

        lastName.name = "password";

        lastName.placeholder = "Mot de passe";

        lastName.autocomplete = "current-password";

    }

    const labels = loginSection.querySelectorAll("label");

    if (labels.length >= 2) {

        labels[0].textContent = "Adresse e-mail";
        labels[0].htmlFor = "loginEmail";

        labels[1].textContent = "Mot de passe";
        labels[1].htmlFor = "loginPassword";

    }

}


/* =========================================================
   6. AUTHENTIFICATION
========================================================= */

function setupAuthListener() {

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            currentSession = session;

            if (event === "SIGNED_IN" && session) {

                await verifyAdmin(session.user);

                return;
            }

            if (event === "SIGNED_OUT") {

                currentSession = null;

                hideAdmin();

                showHome();

                showMessage(
                    "Déconnexion réussie.",
                    "success"
                );

            }

        }
    );

}


async function checkSession() {

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();

        if (error) throw error;

        currentSession = data.session;

        if (currentSession) {

            await verifyAdmin(
                currentSession.user
            );

        } else {

            hideAdmin();

        }

    } catch (error) {

        console.error(error);

        hideAdmin();

    }

}


/* =========================================================
   CONNEXION
========================================================= */

async function login() {

    const emailInput =
        document.getElementById("loginEmail") ||
        document.getElementById("firstName");

    const passwordInput =
        document.getElementById("loginPassword") ||
        document.getElementById("lastName");

    const message =
        document.getElementById("loginMessage");

    const email =
        emailInput?.value.trim();

    const password =
        passwordInput?.value;

    if (!email || !password) {

        setLoginMessage(
            "Entre ton adresse e-mail et ton mot de passe.",
            "error"
        );

        return;
    }

    setLoginMessage(
        "Connexion en cours...",
        "loading"
    );

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentSession = data.session;

        if (!currentSession) {

            throw new Error(
                "Session introuvable après connexion."
            );

        }

        const isAdmin =
            await verifyAdmin(
                currentSession.user,
                false
            );

        if (!isAdmin) {

            await supabaseClient.auth.signOut();

            setLoginMessage(
                "Ce compte n'a pas les droits administrateur.",
                "error"
            );

            return;
        }

        setLoginMessage(
            "Connexion réussie.",
            "success"
        );

        showAdmin();

        showAdminPage();

    } catch (error) {

        console.error(error);

        setLoginMessage(
            translateAuthError(error),
            "error"
        );

    }

}


/* =========================================================
   VERIFICATION ADMIN
========================================================= */

async function verifyAdmin(
    user,
    redirect = true
) {

    if (!user?.id) {

        hideAdmin();

        return false;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from(ADMIN_TABLE)
            .select("id,user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {

            /*
             * Si ta table admin_users n'existe pas encore,
             * Supabase renverra une erreur.
             *
             * Dans ce cas on refuse l'accès admin.
             */

            console.error(
                "Vérification admin :",
                error
            );

            hideAdmin();

            return false;
        }

        if (!data) {

            hideAdmin();

            return false;
        }

        showAdmin();

        if (redirect) {

            showAdminPage();

        }

        return true;

    } catch (error) {

        console.error(error);

        hideAdmin();

        return false;
    }

}


/* =========================================================
   DECONNEXION
========================================================= */

async function logout() {

    try {

        const {
            error
        } = await supabaseClient.auth.signOut();

        if (error) throw error;

    } catch (error) {

        console.error(error);

        showMessage(
            "Impossible de se déconnecter.",
            "error"
        );

    }

}


/* =========================================================
   7. CHARGEMENT DES DONNEES
========================================================= */

async function loadItems() {

    const containers = [
        "homeExplorer",
        "learnExplorer",
        "adminExplorer"
    ];

    containers.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.innerHTML = `
                <div class="notice">
                    Chargement...
                </div>
            `;

        }

    });


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from(ITEMS_TABLE)
            .select("*")
            .order("position", {
                ascending: true,
                nullsFirst: false
            })
            .order("created_at", {
                ascending: true
            });

        if (error) throw error;

        items = Array.isArray(data)
            ? data
            : [];

        renderCurrentView();

    } catch (error) {

        console.error(
            "Erreur chargement :",
            error
        );

        showExplorerError(
            error.message
        );

    }

}


/* =========================================================
   8. REALTIME
========================================================= */

function subscribeRealtime() {

    if (realtimeChannel) {

        supabaseClient
            .removeChannel(realtimeChannel);

    }

    realtimeChannel =
        supabaseClient
            .channel("items-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: ITEMS_TABLE
                },
                payload => {

                    console.log(
                        "Modification reçue :",
                        payload
                    );

                    handleRealtimeChange(
                        payload
                    );

                }
            )
            .subscribe(status => {

                console.log(
                    "Realtime :",
                    status
                );

            });

}


function handleRealtimeChange(payload) {

    if (payload.eventType === "INSERT") {

        const existing =
            items.some(
                item => item.id === payload.new.id
            );

        if (!existing) {

            items.push(payload.new);

        }

    }


    if (payload.eventType === "UPDATE") {

        const index =
            items.findIndex(
                item => item.id === payload.new.id
            );

        if (index !== -1) {

            items[index] = payload.new;

        } else {

            items.push(payload.new);

        }

    }


    if (payload.eventType === "DELETE") {

        items =
            items.filter(
                item => item.id !== payload.old.id
            );

        if (editingId === payload.old.id) {

            closeEditor();

        }

    }

    renderCurrentView();

}


/* =========================================================
   9. NAVIGATION
========================================================= */

function showHome() {

    currentView = "home";

    hideAllSections();

    const section =
        document.getElementById("home");

    if (section) {

        section.classList.remove("hidden");

    }

    currentFolder = null;

    renderHome();

}


function showLearn() {

    currentView = "learn";

    hideAllSections();

    const section =
        document.getElementById("learn");

    if (section) {

        section.classList.remove("hidden");

    }

    currentFolder = null;

    renderLearn();

}


function showLogin() {

    currentView = "login";

    hideAllSections();

    const section =
        document.getElementById("login");

    if (section) {

        section.classList.remove("hidden");

    }

}


function showAdminPage() {

    currentView = "admin";

    hideAllSections();

    const section =
        document.getElementById("admin");

    if (section) {

        section.classList.remove("hidden");

    }

    renderAdmin();

}


function hideAllSections() {

    [
        "home",
        "learn",
        "login",
        "admin"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.classList.add("hidden");

        }

    });

}


function renderCurrentView() {

    if (currentView === "home") {

        renderHome();

    }

    if (currentView === "learn") {

        renderLearn();

    }

    if (currentView === "admin") {

        renderAdmin();

    }

}


/* =========================================================
   10. ACCUEIL
========================================================= */

function renderHome() {

    const container =
        document.getElementById("homeExplorer");

    if (!container) return;

    container.innerHTML =
        renderExplorer(null, false);

}


/* =========================================================
   11. APPRENDRE
========================================================= */

function renderLearn() {

    const container =
        document.getElementById("learnExplorer");

    if (!container) return;

    container.innerHTML =
        renderExplorer(null, false);

}


/* =========================================================
   12. ADMIN
========================================================= */

function renderAdmin() {

    const container =
        document.getElementById("adminExplorer");

    if (!container) return;

    container.innerHTML =
        renderExplorer(
            currentFolder,
            true
        );

}


/* =========================================================
   13. EXPLORATEUR
========================================================= */

function renderExplorer(
    parentId = null,
    admin = false
) {

    const children =
        items.filter(
            item =>
                normalizeParentId(
                    item.parent_id
                ) === normalizeParentId(parentId)
        );

    if (!children.length) {

        return `
            <div class="notice">
                <strong>Aucun contenu</strong>
                <br>
                <span>
                    ${
                        admin
                            ? "Crée ton premier dossier, mémo ou exercice."
                            : "Aucune ressource n'est disponible ici pour le moment."
                    }
                </span>
            </div>
        `;

    }


    const folders =
        children.filter(
            item => item.type === "folder"
        );

    const memos =
        children.filter(
            item => item.type === "memo"
        );

    const exercises =
        children.filter(
            item => item.type === "exercise"
        );


    return `

        <div class="explorer">

            ${
                parentId !== null
                    ? renderBackButton(
                        parentId,
                        admin
                    )
                    : ""
            }


            ${
                renderResourceGrid(
                    folders,
                    "folder",
                    admin
                )
            }


            ${
                renderResourceGrid(
                    memos,
                    "memo",
                    admin
                )
            }


            ${
                renderResourceGrid(
                    exercises,
                    "exercise",
                    admin
                )
            }

        </div>

    `;

}


/* =========================================================
   14. CARTES
========================================================= */

function renderResourceGrid(
    list,
    type,
    admin
) {

    if (!list.length) return "";

    return `

        <div class="resource-grid">

            ${
                list.map(
                    item =>
                        renderResourceCard(
                            item,
                            type,
                            admin
                        )
                ).join("")
            }

        </div>

    `;

}


function renderResourceCard(
    item,
    type,
    admin
) {

    const icon =
        type === "folder"
            ? "📁"
            : type === "memo"
                ? "📄"
                : "📝";

    const label =
        type === "folder"
            ? "Dossier"
            : type === "memo"
                ? "Mémo"
                : "Exercice";


    const color =
        escapeAttribute(
            item.color || "#315bd6"
        );


    return `

        <article
            class="
                resource-card
                ${type === "folder" ? "folder-card" : ""}
            "
            style="--resource-color:${color}"
            onclick="
                openItem(
                    '${escapeJs(item.id)}'
                )
            "
        >

            <div
                class="resource-icon"
                style="
                    color:${color};
                    background:${hexToRgba(
                        color,
                        0.10
                    )};
                "
            >
                ${icon}
            </div>


            <h3>
                ${escapeHtml(item.title || "Sans titre")}
            </h3>


            <p>
                ${label}
            </p>


            ${
                admin
                    ? `
                        <div
                            class="resource-admin-actions"
                            onclick="event.stopPropagation()"
                        >

                            <button
                                class="secondary"
                                onclick="
                                    editItem(
                                        '${escapeJs(item.id)}'
                                    )
                                "
                            >
                                Modifier
                            </button>

                            <button
                                class="secondary"
                                onclick="
                                    deleteItem(
                                        '${escapeJs(item.id)}'
                                    )
                                "
                            >
                                Supprimer
                            </button>

                        </div>
                    `
                    : ""
            }

        </article>

    `;

}


/* =========================================================
   15. OUVRIR UN CONTENU
========================================================= */

function openItem(id) {

    const item =
        items.find(
            element => element.id === id
        );

    if (!item) return;


    if (item.type === "folder") {

        currentFolder = item.id;

        openFolder(
            item.id
        );

        return;
    }


    if (item.type === "memo") {

        openMemo(
            item
        );

        return;
    }


    if (item.type === "exercise") {

        openExercise(
            item
        );

    }

}


/* =========================================================
   16. DOSSIER
========================================================= */

function openFolder(id) {

    currentFolder = id;

    currentView = "learn";

    hideAllSections();

    const section =
        document.getElementById("learn");

    if (section) {

        section.classList.remove("hidden");

    }

    const container =
        document.getElementById("learnExplorer");

    if (container) {

        container.innerHTML =
            renderExplorer(
                id,
                false
            );

    }

}


/* =========================================================
   17. RETOUR
========================================================= */

function goBackFromFolder() {

    if (!currentFolder) {

        showLearn();

        return;

    }

    const folder =
        items.find(
            item =>
                item.id === currentFolder
        );

    if (!folder) {

        showLearn();

        return;

    }

    const parent =
        normalizeParentId(
            folder.parent_id
        );

    if (parent === null) {

        currentFolder = null;

        showLearn();

    } else {

        openFolder(parent);

    }

}


function renderBackButton(
    parentId,
    admin
) {

    return `

        <div class="toolbar" style="margin-bottom:20px">

            <button
                class="secondary"
                onclick="goBackFromFolder()"
            >
                ← Retour
            </button>

        </div>

    `;

}


/* =========================================================
   18. CREER UN ELEMENT
========================================================= */

function newItem(parentId = null) {

    editingId = null;

    const editor =
        document.getElementById("editor");

    if (!editor) return;


    document.getElementById(
        "editorTitle"
    ).textContent =
        "Nouveau contenu";


    document.getElementById(
        "editId"
    ).value = "";


    document.getElementById(
        "editParent"
    ).value =
        parentId || "";


    document.getElementById(
        "itemName"
    ).value = "";


    document.getElementById(
        "itemType"
    ).value = "folder";


    document.getElementById(
        "itemColor"
    ).value = "#315bd6";


    clearMemoFields();

    clearExerciseFields();

    changeType();

    updateColor();


    editor.classList.remove("hidden");

    editor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================================
   19. MODIFIER
========================================================= */

function editItem(id) {

    const item =
        items.find(
            element => element.id === id
        );

    if (!item) return;


    editingId = id;


    document.getElementById(
        "editorTitle"
    ).textContent =
        "Modifier le contenu";


    document.getElementById(
        "editId"
    ).value =
        item.id;


    document.getElementById(
        "editParent"
    ).value =
        item.parent_id || "";


    document.getElementById(
        "itemName"
    ).value =
        item.title || "";


    document.getElementById(
        "itemType"
    ).value =
        item.type || "folder";


    document.getElementById(
        "itemColor"
    ).value =
        item.color || "#315bd6";


    clearMemoFields();

    clearExerciseFields();


    const content =
        item.content || {};


    if (item.type === "memo") {

        const editor =
            document.getElementById(
                "memoEditor"
            );

        if (editor) {

            editor.innerHTML =
                content.html ||
                content.text ||
                "";

        }

        setValue(
            "itemImageUrl",
            content.imageUrl || ""
        );

        setValue(
            "itemAudioUrl",
            content.audioUrl || ""
        );

        setValue(
            "itemYoutubeUrl",
            content.youtubeUrl || ""
        );

    }


    if (item.type === "exercise") {

        setValue(
            "exerciseType",
            content.exerciseType ||
            "short_answer"
        );

        setValue(
            "question",
            content.question || ""
        );

        setValue(
            "answer",
            content.answer || ""
        );

        setValue(
            "caseSensitive",
            content.caseSensitive === true
        );

        setValue(
            "trueFalseAnswer",
            String(
                content.trueFalseAnswer ?? true
            )
        );

        setValue(
            "fillBlankText",
            content.fillBlankText || ""
        );

        setValue(
            "exerciseExplanation",
            content.explanation || ""
        );


        renderChoices(
            content.choices || []
        );

    }


    changeType();

    changeExerciseType();

    updateColor();


    const editor =
        document.getElementById("editor");

    editor.classList.remove("hidden");

    editor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


/* =========================================================
   20. TYPE DE CONTENU
========================================================= */

function changeType() {

    const type =
        getValue("itemType");


    const memoFields =
        document.getElementById(
            "memoFields"
        );

    const exerciseFields =
        document.getElementById(
            "exerciseFields"
        );


    if (memoFields) {

        memoFields.classList.toggle(
            "hidden",
            type !== "memo"
        );

    }


    if (exerciseFields) {

        exerciseFields.classList.toggle(
            "hidden",
            type !== "exercise"
        );

    }


    if (type === "folder") {

        clearMemoFields();

        clearExerciseFields();

    }

}


/* =========================================================
   21. TYPE D'EXERCICE
========================================================= */

function changeExerciseType() {

    const type =
        getValue("exerciseType");


    const shortAnswer =
        document.getElementById(
            "shortAnswerFields"
        );

    const qcm =
        document.getElementById(
            "qcmFields"
        );

    const trueFalse =
        document.getElementById(
            "trueFalseFields"
        );

    const fillBlank =
        document.getElementById(
            "fillBlankFields"
        );


    [
        shortAnswer,
        qcm,
        trueFalse,
        fillBlank
    ].forEach(element => {

        if (element) {

            element.classList.add(
                "hidden"
            );

        }

    });


    if (type === "short_answer") {

        shortAnswer?.classList.remove(
            "hidden"
        );

    }


    if (
        type === "qcm" ||
        type === "multiple_answer"
    ) {

        qcm?.classList.remove(
            "hidden"
        );

        ensureDefaultChoices(
            type === "multiple_answer"
        );

    }


    if (type === "true_false") {

        trueFalse?.classList.remove(
            "hidden"
        );

    }


    if (type === "fill_blank") {

        fillBlank?.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   22. PROPOSITIONS QCM
========================================================= */

function ensureDefaultChoices(
    multiple = false
) {

    const container =
        document.getElementById(
            "choicesContainer"
        );

    if (!container) return;

    if (
        container.children.length === 0
    ) {

        addChoice(false, multiple);
        addChoice(false, multiple);
        addChoice(false, multiple);
        addChoice(false, multiple);

    }

}


function addChoice(
    checked = false,
    multiple = null
) {

    const container =
        document.getElementById(
            "choicesContainer"
        );

    if (!container) return;


    const type =
        multiple === null
            ? (
                getValue("exerciseType") ===
                "multiple_answer"
                    ? "checkbox"
                    : "radio"
            )
            : multiple
                ? "checkbox"
                : "radio";


    const row =
        document.createElement("div");

    row.className =
        "choice-row";


    row.innerHTML = `

        <input
            type="${type}"
            name="exerciseChoiceCorrect"
            ${checked ? "checked" : ""}
            title="Bonne réponse"
        >

        <input
            type="text"
            class="choice-text"
            placeholder="Proposition"
        >

        <button
            type="button"
            onclick="
                this.parentElement.remove()
            "
        >
            ×
        </button>

    `;


    container.appendChild(row);

}


function renderChoices(choices) {

    const container =
        document.getElementById(
            "choicesContainer"
        );

    if (!container) return;

    container.innerHTML = "";


    const multiple =
        getValue("exerciseType") ===
        "multiple_answer";


    if (!choices.length) {

        ensureDefaultChoices(
            multiple
        );

        return;

    }


    choices.forEach(choice => {

        addChoice(
            choice.correct === true,
            multiple
        );

        const rows =
            container.querySelectorAll(
                ".choice-row"
            );

        const last =
            rows[rows.length - 1];

        const input =
            last?.querySelector(
                ".choice-text"
            );

        if (input) {

            input.value =
                choice.text || "";

        }

    });

}


/* =========================================================
   23. SAUVEGARDER
========================================================= */

async function saveItem() {

    const name =
        getValue("itemName").trim();

    const type =
        getValue("itemType");

    const parentId =
        getValue("editParent") ||
        currentFolder ||
        null;

    const color =
        getValue("itemColor") ||
        "#315bd6";


    if (!name) {

        showMessage(
            "Donne un nom au contenu.",
            "error"
        );

        return;

    }


    const isAdmin =
        await isCurrentUserAdmin();

    if (!isAdmin) {

        showMessage(
            "Accès administrateur requis.",
            "error"
        );

        return;

    }


    try {

        let content = {};


        /* -------------------------
           MEMO
        ------------------------- */

        if (type === "memo") {

            content = await buildMemoContent();

        }


        /* -------------------------
           EXERCICE
        ------------------------- */

        if (type === "exercise") {

            content =
                buildExerciseContent();

            const validation =
                validateExercise(
                    content
                );

            if (!validation.valid) {

                showMessage(
                    validation.message,
                    "error"
                );

                return;

            }

        }


        /* -------------------------
           DONNEES
        ------------------------- */

        const payload = {

            title: name,

            type,

            parent_id:
                parentId || null,

            color,

            content,

            updated_at:
                new Date().toISOString()

        };


        /* -------------------------
           CREATION
        ------------------------- */

        if (!editingId) {

            const {
                data,
                error
            } = await supabaseClient
                .from(ITEMS_TABLE)
                .insert({
                    ...payload,
                    position:
                        getNextPosition(
                            parentId
                        )
                })
                .select()
                .single();

            if (error) throw error;

            items.push(data);

            showMessage(
                "Contenu créé.",
                "success"
            );

        }


        /* -------------------------
           MODIFICATION
        ------------------------- */

        else {

            const {
                data,
                error
            } = await supabaseClient
                .from(ITEMS_TABLE)
                .update(payload)
                .eq("id", editingId)
                .select()
                .single();

            if (error) throw error;


            const index =
                items.findIndex(
                    item =>
                        item.id === editingId
                );


            if (index !== -1) {

                items[index] =
                    data;

            }


            showMessage(
                "Contenu modifié.",
                "success"
            );

        }


        closeEditor();

        renderCurrentView();


    } catch (error) {

        console.error(
            "Erreur sauvegarde :",
            error
        );

        showMessage(
            "Impossible d'enregistrer : " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   24. CONTENU MEMO
========================================================= */

async function buildMemoContent() {

    const editor =
        document.getElementById(
            "memoEditor"
        );


    let html =
        editor?.innerHTML || "";


    /*
     * Nettoyage basique du HTML.
     * On évite les scripts et événements HTML.
     */

    html =
        sanitizeMemoHtml(
            html
        );


    let imageUrl =
        getValue(
            "itemImageUrl"
        ).trim();


    let audioUrl =
        getValue(
            "itemAudioUrl"
        ).trim();


    const youtubeUrl =
        getValue(
            "itemYoutubeUrl"
        ).trim();


    /* -------------------------
       IMAGE
    ------------------------- */

    const imageFile =
        document.getElementById(
            "itemImageFile"
        )?.files?.[0];


    if (imageFile) {

        imageUrl =
            await uploadMedia(
                imageFile,
                "images"
            );

    }


    /* -------------------------
       AUDIO
    ------------------------- */

    const audioFile =
        document.getElementById(
            "itemAudioFile"
        )?.files?.[0];


    if (audioFile) {

        audioUrl =
            await uploadMedia(
                audioFile,
                "audio"
            );

    }


    return {

        html,

        imageUrl,

        audioUrl,

        youtubeUrl

    };

}


/* =========================================================
   25. EXERCICE
========================================================= */

function buildExerciseContent() {

    const exerciseType =
        getValue(
            "exerciseType"
        );


    const content = {

        exerciseType,

        question:
            getValue(
                "question"
            ).trim(),

        answer:
            getValue(
                "answer"
            ).trim(),

        caseSensitive:
            getChecked(
                "caseSensitive"
            ),

        trueFalseAnswer:
            getValue(
                "trueFalseAnswer"
            ) === "true",

        fillBlankText:
            getValue(
                "fillBlankText"
            ).trim(),

        explanation:
            getValue(
                "exerciseExplanation"
            ).trim(),

        choices: []

    };


    if (
        exerciseType === "qcm" ||
        exerciseType === "multiple_answer"
    ) {

        const rows =
            document.querySelectorAll(
                "#choicesContainer .choice-row"
            );


        content.choices =
            Array.from(rows)
                .map(row => {

                    const input =
                        row.querySelector(
                            ".choice-text"
                        );

                    const correct =
                        row.querySelector(
                            'input[type="radio"], input[type="checkbox"]'
                        );


                    return {

                        text:
                            input?.value.trim() || "",

                        correct:
                            correct?.checked === true

                    };

                })
                .filter(
                    choice =>
                        choice.text.length > 0
                );

    }


    return content;

}


/* =========================================================
   26. VALIDATION EXERCICE
========================================================= */

function validateExercise(
    content
) {

    if (!content.question) {

        return {

            valid: false,

            message:
                "Écris une question."

        };

    }


    if (
        content.exerciseType ===
        "short_answer" &&
        !content.answer
    ) {

        return {

            valid: false,

            message:
                "Indique la réponse attendue."

        };

    }


    if (
        content.exerciseType ===
        "qcm"
    ) {

        if (
            content.choices.length < 2
        ) {

            return {

                valid: false,

                message:
                    "Ajoute au moins deux propositions."

            };

        }


        if (
            !content.choices.some(
                choice =>
                    choice.correct
            )
        ) {

            return {

                valid: false,

                message:
                    "Sélectionne la bonne réponse."

            };

        }

    }


    if (
        content.exerciseType ===
        "multiple_answer"
    ) {

        if (
            content.choices.length < 2
        ) {

            return {

                valid: false,

                message:
                    "Ajoute au moins deux propositions."

            };

        }


        if (
            !content.choices.some(
                choice =>
                    choice.correct
            )
        ) {

            return {

                valid: false,

                message:
                    "Sélectionne au moins une bonne réponse."

            };

        }

    }


    if (
        content.exerciseType ===
        "fill_blank" &&
        !content.fillBlankText
    ) {

        return {

            valid: false,

            message:
                "Écris le texte à trous."

        };

    }


    return {
        valid: true
    };

}


/* =========================================================
   27. OUVRIR UN MEMO
========================================================= */

function openMemo(item) {

    const content =
        item.content || {};


    const overlay =
        document.createElement("div");

    overlay.className =
        "content-modal";


    overlay.innerHTML = `

        <div class="content-modal-backdrop"
             onclick="this.parentElement.remove()">
        </div>

        <div class="content-modal-card">

            <div class="content-modal-header">

                <div>

                    <span class="eyebrow">
                        MÉMO
                    </span>

                    <h2>
                        ${escapeHtml(
                            item.title || "Mémo"
                        )}
                    </h2>

                </div>

                <button
                    class="secondary"
                    onclick="
                        this.closest(
                            '.content-modal'
                        ).remove()
                    "
                >
                    Fermer
                </button>

            </div>


            <div class="memo-content">

                ${
                    content.html
                        ? sanitizeMemoHtml(
                            content.html
                        )
                        : "<p>Aucun texte.</p>"
                }


                ${
                    content.imageUrl
                        ? `
                            <div class="memo-media">
                                <img
                                    src="${escapeAttribute(
                                        content.imageUrl
                                    )}"
                                    alt=""
                                    loading="lazy"
                                >
                            </div>
                        `
                        : ""
                }


                ${
                    content.audioUrl
                        ? `
                            <div class="memo-media">

                                <audio
                                    controls
                                    preload="metadata"
                                    src="${escapeAttribute(
                                        content.audioUrl
                                    )}"
                                >
                                </audio>

                            </div>
                        `
                        : ""
                }


                ${
                    content.youtubeUrl
                        ? renderYoutube(
                            content.youtubeUrl
                        )
                        : ""
                }

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );

}


/* =========================================================
   28. OUVRIR EXERCICE
========================================================= */

function openExercise(item) {

    const content =
        item.content || {};


    const overlay =
        document.createElement("div");

    overlay.className =
        "content-modal";


    overlay.innerHTML = `

        <div class="content-modal-backdrop"
             onclick="this.parentElement.remove()">
        </div>

        <div class="content-modal-card exercise-viewer">

            <div class="content-modal-header">

                <div>

                    <span class="eyebrow">
                        EXERCICE
                    </span>

                    <h2>
                        ${escapeHtml(
                            item.title || "Exercice"
                        )}
                    </h2>

                </div>

                <button
                    class="secondary"
                    onclick="
                        this.closest(
                            '.content-modal'
                        ).remove()
                    "
                >
                    Fermer
                </button>

            </div>


            <div class="exercise-question">

                <h3>
                    ${escapeHtml(
                        content.question || ""
                    )}
                </h3>

            </div>


            <div id="exerciseAnswerArea">

                ${renderExerciseAnswer(
                    content
                )}

            </div>


            <button
                id="checkExerciseButton"
                onclick="
                    checkExerciseAnswer(
                        this
                    )
                "
            >
                Vérifier ma réponse
            </button>


            <div
                id="exerciseResult"
                class="exercise-result"
            ></div>


            ${
                content.explanation
                    ? `
                        <div
                            id="exerciseExplanation"
                            class="correction-box hidden"
                        >

                            <h4>
                                Correction
                            </h4>

                            <p>
                                ${escapeHtml(
                                    content.explanation
                                )}
                            </p>

                        </div>
                    `
                    : ""
            }

        </div>

    `;


    overlay.dataset.exercise =
        JSON.stringify({
            itemId: item.id,
            content
        });


    document.body.appendChild(
        overlay
    );

}


/* =========================================================
   29. AFFICHAGE REPONSE EXERCICE
========================================================= */

function renderExerciseAnswer(
    content
) {

    const type =
        content.exerciseType;


    if (type === "short_answer") {

        return `

            <input
                id="exerciseUserAnswer"
                type="text"
                placeholder="Ta réponse..."
                autocomplete="off"
            >

        `;

    }


    if (
        type === "qcm" ||
        type === "multiple_answer"
    ) {

        const inputType =
            type === "multiple_answer"
                ? "checkbox"
                : "radio";


        return `

            <div class="exercise-choices">

                ${
                    (content.choices || [])
                        .map(
                            (choice, index) => `

                                <label
                                    class="exercise-choice"
                                >

                                    <input
                                        type="${inputType}"
                                        name="userExerciseChoice"
                                        value="${index}"
                                    >

                                    <span>
                                        ${escapeHtml(
                                            choice.text
                                        )}
                                    </span>

                                </label>

                            `
                        )
                        .join("")
                }

            </div>

        `;

    }


    if (type === "true_false") {

        return `

            <div class="exercise-choices">

                <label
                    class="exercise-choice"
                >

                    <input
                        type="radio"
                        name="trueFalseAnswer"
                        value="true"
                    >

                    <span>Vrai</span>

                </label>


                <label
                    class="exercise-choice"
                >

                    <input
                        type="radio"
                        name="trueFalseAnswer"
                        value="false"
                    >

                    <span>Faux</span>

                </label>

            </div>

        `;

    }


    if (type === "fill_blank") {

        return `

            <div class="fill-blank-question">

                <p>
                    ${escapeHtml(
                        content.fillBlankText
                    ).replace(
                        /\{\{(.*?)\}\}/g,
                        `<input
                            class="blank-answer"
                            type="text"
                            placeholder="réponse"
                            data-answer="$1"
                        >`
                    )}
                </p>

            </div>

        `;

    }


    return "";

}


/* =========================================================
   30. CORRIGER EXERCICE
========================================================= */

function checkExerciseAnswer(
    button
) {

    const modal =
        button.closest(
            ".content-modal"
        );

    if (!modal) return;


    const data =
        JSON.parse(
            modal.dataset.exercise
        );


    const content =
        data.content;


    let correct = false;


    /* -------------------------
       REPONSE PRECISE
    ------------------------- */

    if (
        content.exerciseType ===
        "short_answer"
    ) {

        const input =
            modal.querySelector(
                "#exerciseUserAnswer"
            );


        let userAnswer =
            input?.value.trim() || "";


        let expected =
            String(
                content.answer || ""
            ).trim();


        if (!content.caseSensitive) {

            userAnswer =
                userAnswer.toLowerCase();

            expected =
                expected.toLowerCase();

        }


        correct =
            userAnswer === expected;

    }


    /* -------------------------
       QCM
    ------------------------- */

    if (
        content.exerciseType ===
        "qcm"
    ) {

        const selected =
            modal.querySelector(
                'input[name="userExerciseChoice"]:checked'
            );


        if (selected) {

            const index =
                Number(
                    selected.value
                );

            correct =
                content.choices?.[index]
                    ?.correct === true;

        }

    }


    /* -------------------------
       MULTIPLE
    ------------------------- */

    if (
        content.exerciseType ===
        "multiple_answer"
    ) {

        const selected =
            Array.from(
                modal.querySelectorAll(
                    'input[name="userExerciseChoice"]:checked'
                )
            )
            .map(
                input =>
                    Number(input.value)
            );


        const expected =
            (content.choices || [])
                .map(
                    (choice, index) =>
                        choice.correct
                            ? index
                            : null
                )
                .filter(
                    index =>
                        index !== null
                );


        correct =
            selected.length ===
                expected.length &&
            selected.every(
                value =>
                    expected.includes(value)
            );

    }


    /* -------------------------
       VRAI FAUX
    ------------------------- */

    if (
        content.exerciseType ===
        "true_false"
    ) {

        const selected =
            modal.querySelector(
                'input[name="trueFalseAnswer"]:checked'
            );


        if (selected) {

            correct =
                selected.value ===
                String(
                    content.trueFalseAnswer
                );

        }

    }


    /* -------------------------
       TEXTE A TROUS
    ------------------------- */

    if (
        content.exerciseType ===
        "fill_blank"
    ) {

        const fields =
            modal.querySelectorAll(
                ".blank-answer"
            );


        const answers =
            Array.from(fields)
                .map(
                    field =>
                        field.value
                            .trim()
                            .toLowerCase()
                );


        const expected =
            Array.from(fields)
                .map(
                    field =>
                        field.dataset.answer
                            .trim()
                            .toLowerCase()
                );


        correct =
            answers.length ===
                expected.length &&
            answers.every(
                (answer, index) =>
                    answer === expected[index]
            );

    }


    const result =
        modal.querySelector(
            "#exerciseResult"
        );


    if (result) {

        result.className =
            "exercise-result " +
            (
                correct
                    ? "correct"
                    : "incorrect"
            );


        result.innerHTML =
            correct
                ? "✓ Bonne réponse !"
                : "✕ Ce n'est pas la bonne réponse.";

    }


    const explanation =
        modal.querySelector(
            "#exerciseExplanation"
        );


    if (
        explanation &&
        content.explanation
    ) {

        explanation.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   31. UPLOAD MEDIA
========================================================= */

async function uploadMedia(
    file,
    folder
) {

    if (!file) return null;


    if (
        !file.type.startsWith("image/") &&
        !file.type.startsWith("audio/")
    ) {

        throw new Error(
            "Type de fichier non autorisé."
        );

    }


    const safeName =
        file.name
            .replace(
                /[^a-zA-Z0-9._-]/g,
                "-"
            );


    const path =
        `${folder}/${crypto.randomUUID()}-${safeName}`;


    const {
        error
    } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(
            path,
            file,
            {
                cacheControl: "3600",
                upsert: false
            }
        );


    if (error) throw error;


    const {
        data
    } =
        supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path);


    return data.publicUrl;

}


/* =========================================================
   32. YOUTUBE
========================================================= */

function renderYoutube(url) {

    const videoId =
        extractYoutubeId(
            url
        );


    if (!videoId) {

        return `

            <p class="field-help">
                Lien YouTube invalide.
            </p>

        `;

    }


    return `

        <div class="youtube-wrapper">

            <iframe
                src="https://www.youtube.com/embed/${escapeAttribute(
                    videoId
                )}"
                title="Vidéo YouTube"
                loading="lazy"
                allow="
                    accelerometer;
                    autoplay;
                    clipboard-write;
                    encrypted-media;
                    gyroscope;
                    picture-in-picture;
                    web-share
                "
                allowfullscreen
            ></iframe>

        </div>

    `;

}


function extractYoutubeId(url) {

    try {

        const parsed =
            new URL(url);


        if (
            parsed.hostname.includes(
                "youtu.be"
            )
        ) {

            return parsed.pathname
                .replace("/", "")
                .trim();

        }


        if (
            parsed.hostname.includes(
                "youtube.com"
            )
        ) {

            if (
                parsed.pathname ===
                "/watch"
            ) {

                return parsed.searchParams.get(
                    "v"
                );

            }


            if (
                parsed.pathname.startsWith(
                    "/embed/"
                )
            ) {

                return parsed.pathname
                    .split("/embed/")[1];

            }

        }

    } catch {

        return null;

    }


    return null;

}


/* =========================================================
   33. EDITEUR RICHE
========================================================= */

function formatMemo(command) {

    const editor =
        document.getElementById(
            "memoEditor"
        );

    if (!editor) return;

    editor.focus();

    document.execCommand(
        command,
        false,
        null
    );

}


function addMemoLink() {

    const url =
        prompt(
            "Adresse du lien :"
        );

    if (!url) return;


    const editor =
        document.getElementById(
            "memoEditor"
        );

    if (!editor) return;


    editor.focus();


    document.execCommand(
        "createLink",
        false,
        url
    );

}


/* =========================================================
   34. SUPPRESSION
========================================================= */

async function deleteItem(id) {

    const item =
        items.find(
            element => element.id === id
        );

    if (!item) return;


    const descendants =
        getDescendantIds(
            id
        );


    const count =
        descendants.length + 1;


    const confirmed =
        confirm(
            `Supprimer "${item.title}" ?\n\n` +
            (
                count > 1
                    ? `${count} éléments seront supprimés.`
                    : "Cette action est irréversible."
            )
        );


    if (!confirmed) return;


    try {

        const {
            error
        } = await supabaseClient
            .from(ITEMS_TABLE)
            .delete()
            .eq("id", id);


        if (error) throw error;


        items =
            items.filter(
                item =>
                    item.id !== id &&
                    !descendants.includes(
                        item.id
                    )
            );


        if (
            currentFolder === id ||
            descendants.includes(
                currentFolder
            )
        ) {

            currentFolder = null;

        }


        renderCurrentView();


        showMessage(
            "Contenu supprimé.",
            "success"
        );


    } catch (error) {

        console.error(error);

        showMessage(
            "Suppression impossible : " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   35. DESCENDANTS
========================================================= */

function getDescendantIds(
    parentId
) {

    const result = [];

    const children =
        items.filter(
            item =>
                item.parent_id === parentId
        );


    for (const child of children) {

        result.push(
            child.id
        );


        result.push(
            ...getDescendantIds(
                child.id
            )
        );

    }


    return result;

}


/* =========================================================
   36. COLOR
========================================================= */

function updateColor() {

    const color =
        getValue("itemColor") ||
        "#315bd6";


    const preview =
        document.getElementById(
            "colorPreview"
        );


    if (preview) {

        preview.style.background =
            color;

    }

}


/* =========================================================
   37. FERMER EDITEUR
========================================================= */

function closeEditor() {

    const editor =
        document.getElementById(
            "editor"
        );


    if (editor) {

        editor.classList.add(
            "hidden"
        );

    }


    editingId = null;

}


/* =========================================================
   38. NETTOYAGE
========================================================= */

function clearMemoFields() {

    setValue(
        "memoEditor",
        ""
    );


    const editor =
        document.getElementById(
            "memoEditor"
        );

    if (editor) {

        editor.innerHTML = "";

    }


    setValue(
        "itemImageUrl",
        ""
    );

    setValue(
        "itemAudioUrl",
        ""
    );

    setValue(
        "itemYoutubeUrl",
        ""
    );


    const image =
        document.getElementById(
            "itemImageFile"
        );

    if (image) {

        image.value = "";

    }


    const audio =
        document.getElementById(
            "itemAudioFile"
        );

    if (audio) {

        audio.value = "";

    }

}


function clearExerciseFields() {

    setValue(
        "question",
        ""
    );

    setValue(
        "answer",
        ""
    );

    setValue(
        "caseSensitive",
        false
    );

    setValue(
        "trueFalseAnswer",
        "true"
    );

    setValue(
        "fillBlankText",
        ""
    );

    setValue(
        "exerciseExplanation",
        ""
    );


    const choices =
        document.getElementById(
            "choicesContainer"
        );

    if (choices) {

        choices.innerHTML = "";

    }

}


/* =========================================================
   39. VERIFICATION ADMIN
========================================================= */

async function isCurrentUserAdmin() {

    if (!currentSession?.user) {

        return false;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from(ADMIN_TABLE)
        .select("id")
        .eq(
            "user_id",
            currentSession.user.id
        )
        .maybeSingle();


    if (error) {

        console.error(error);

        return false;

    }


    return !!data;

}


/* =========================================================
   40. ADMIN UI
========================================================= */

function showAdmin() {

    const adminButton =
        document.getElementById(
            "adminButton"
        );


    if (adminButton) {

        adminButton.innerHTML = `

            <button
                class="nav-button"
                onclick="showAdminPage()"
            >
                Administration
            </button>

        `;

    }

}


function hideAdmin() {

    const adminButton =
        document.getElementById(
            "adminButton"
        );


    if (adminButton) {

        adminButton.innerHTML = "";

    }


    const admin =
        document.getElementById(
            "admin"
        );


    if (admin) {

        admin.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   41. POSITION
========================================================= */

function getNextPosition(
    parentId
) {

    const children =
        items.filter(
            item =>
                normalizeParentId(
                    item.parent_id
                ) === normalizeParentId(
                    parentId
                )
        );


    if (!children.length) {

        return 0;

    }


    return Math.max(
        ...children.map(
            item =>
                Number(
                    item.position || 0
                )
        )
    ) + 1;

}


/* =========================================================
   42. IMPORT
========================================================= */

function exportData() {

    const data = {

        version: 1,

        exportedAt:
            new Date().toISOString(),

        items

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],
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


    link.href = url;

    link.download =
        `sauvegarde-${formatDateForFile(
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

}


/* =========================================================
   43. IMPORT
========================================================= */

async function importData(event) {

    const file =
        event.target.files?.[0];


    if (!file) return;


    try {

        const text =
            await file.text();


        const parsed =
            JSON.parse(text);


        const imported =
            Array.isArray(
                parsed
            )
                ? parsed
                : parsed.items;


        if (
            !Array.isArray(
                imported
            )
        ) {

            throw new Error(
                "Fichier JSON invalide."
            );

        }


        const isAdmin =
            await isCurrentUserAdmin();


        if (!isAdmin) {

            throw new Error(
                "Accès administrateur requis."
            );

        }


        const cleaned =
            imported
                .map(
                    item => ({
                        title:
                            item.title ||
                            "Sans titre",

                        type:
                            item.type ||
                            "memo",

                        parent_id:
                            item.parent_id ||
                            null,

                        color:
                            item.color ||
                            "#315bd6",

                        content:
                            item.content ||
                            {},

                        position:
                            Number(
                                item.position ||
                                0
                            )

                    })
                );


        const {
            error
        } = await supabaseClient
            .from(ITEMS_TABLE)
            .insert(
                cleaned
            );


        if (error) throw error;


        await loadItems();


        showMessage(
            `${cleaned.length} éléments importés.`,
            "success"
        );


    } catch (error) {

        console.error(error);

        showMessage(
            "Import impossible : " +
            error.message,
            "error"
        );

    }


    event.target.value = "";

}


/* =========================================================
   44. RACCOURCIS
========================================================= */

function setupKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                (event.ctrlKey ||
                    event.metaKey) &&
                event.key === "s"
            ) {

                const editor =
                    document.getElementById(
                        "editor"
                    );


                if (
                    editor &&
                    !editor.classList.contains(
                        "hidden"
                    )
                ) {

                    event.preventDefault();

                    saveItem();

                }

            }


            if (
                event.key === "Escape"
            ) {

                const modals =
                    document.querySelectorAll(
                        ".content-modal"
                    );


                modals.forEach(
                    modal =>
                        modal.remove()
                );

            }

        }
    );

}


/* =========================================================
   45. EDITOR
========================================================= */

function setupEditor() {

    updateColor();

    changeType();

    changeExerciseType();

}


/* =========================================================
   46. OUTILS
========================================================= */

function getValue(id) {

    const element =
        document.getElementById(id);

    return element?.value ?? "";

}


function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (!element) return;


    if (
        element.type === "checkbox"
    ) {

        element.checked =
            Boolean(value);

    } else {

        element.value =
            value ?? "";

    }

}


function getChecked(id) {

    return Boolean(
        document.getElementById(id)
            ?.checked
    );

}


function normalizeParentId(
    value
) {

    return value || null;

}


/* =========================================================
   47. HTML SECURITY
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHtml(
        value
    );

}


function escapeJs(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "\\",
            "\\\\"
        )
        .replaceAll(
            "'",
            "\\'"
        )
        .replaceAll(
            "\n",
            "\\n"
        )
        .replaceAll(
            "\r",
            "\\r"
        );

}


/* =========================================================
   48. NETTOYAGE MEMO
========================================================= */

function sanitizeMemoHtml(
    html
) {

    const template =
        document.createElement(
            "template"
        );


    template.innerHTML =
        html || "";


    const forbidden =
        template.content.querySelectorAll(
            "script,style,iframe,object,embed,form"
        );


    forbidden.forEach(
        element =>
            element.remove()
    );


    template.content
        .querySelectorAll("*")
        .forEach(element => {

            Array.from(
                element.attributes
            )
            .forEach(attribute => {

                if (
                    attribute.name
                        .toLowerCase()
                        .startsWith("on")
                ) {

                    element.removeAttribute(
                        attribute.name
                    );

                }

            });

        });


    return template.innerHTML;

}


/* =========================================================
   49. COULEUR TRANSPARENTE
========================================================= */

function hexToRgba(
    hex,
    alpha
) {

    const clean =
        String(hex)
            .replace(
                "#",
                ""
            );


    if (
        clean.length !== 6
    ) {

        return `rgba(49,91,214,${alpha})`;

    }


    const r =
        parseInt(
            clean.substring(0, 2),
            16
        );


    const g =
        parseInt(
            clean.substring(2, 4),
            16
        );


    const b =
        parseInt(
            clean.substring(4, 6),
            16
        );


    return `rgba(${r},${g},${b},${alpha})`;

}


/* =========================================================
   50. MESSAGES
========================================================= */

function setLoginMessage(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "loginMessage"
        );


    if (!element) return;


    element.textContent =
        message;


    element.className =
        `login-message ${type}`;

}


function showMessage(
    message,
    type = "info"
) {

    let container =
        document.getElementById(
            "toastContainer"
        );


    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.id =
            "toastContainer";

        container.style.position =
            "fixed";

        container.style.right =
            "20px";

        container.style.bottom =
            "20px";

        container.style.zIndex =
            "99999";

        container.style.display =
            "flex";

        container.style.flexDirection =
            "column";

        container.style.gap =
            "10px";

        document.body.appendChild(
            container
        );

    }


    const toast =
        document.createElement(
            "div"
        );


    toast.textContent =
        message;


    toast.style.padding =
        "13px 17px";

    toast.style.borderRadius =
        "12px";

    toast.style.background =
        type === "error"
            ? "#fff0f2"
            : type === "success"
                ? "#edf9f4"
                : "#f0f4ff";

    toast.style.color =
        type === "error"
            ? "#b62f42"
            : type === "success"
                ? "#16734d"
                : "#315bd6";

    toast.style.border =
        "1px solid rgba(0,0,0,.06)";

    toast.style.boxShadow =
        "0 12px 35px rgba(25,35,60,.12)";

    toast.style.fontWeight =
        "600";


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateY(8px)";

            toast.style.transition =
                "180ms ease";


            setTimeout(
                () =>
                    toast.remove(),
                200
            );

        },
        3000
    );

}


function showExplorerError(
    message
) {

    [
        "homeExplorer",
        "learnExplorer",
        "adminExplorer"
    ]
    .forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {

            element.innerHTML = `

                <div class="notice">

                    Impossible de charger
                    les ressources.

                    <br><br>

                    <small>
                        ${escapeHtml(
                            message || ""
                        )}
                    </small>

                </div>

            `;

        }

    });

}


/* =========================================================
   51. ERREURS AUTH
========================================================= */

function translateAuthError(
    error
) {

    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    if (
        message.includes(
            "invalid login credentials"
        )
    ) {

        return "Adresse e-mail ou mot de passe incorrect.";

    }


    if (
        message.includes(
            "email not confirmed"
        )
    ) {

        return "Cette adresse e-mail n'est pas encore confirmée.";

    }


    if (
        message.includes(
            "too many requests"
        )
    ) {

        return "Trop de tentatives. Réessaie plus tard.";

    }


    return (
        error?.message ||
        "Connexion impossible."
    );

}


/* =========================================================
   52. DATE FICHIER
========================================================= */

function formatDateForFile(
    date
) {

    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    const hours =
        String(
            date.getHours()
        ).padStart(
            2,
            "0"
        );


    const minutes =
        String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}-${hours}-${minutes}`;

}


/* =========================================================
   FIN APP.JS
========================================================= */
