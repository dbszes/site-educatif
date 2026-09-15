"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://eumfudusjqcjbsukxcyv.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_e9J4xKfdIbIM2STAI4lReQ_Ks-d8owd";

let supabaseClient = null;

function initSupabase() {
    try {
        if (
            window.supabase &&
            typeof window.supabase.createClient === "function"
        ) {
            supabaseClient =
                window.supabase.createClient(
                    SUPABASE_URL,
                    SUPABASE_KEY
                );

            return true;
        }

        console.error(
            "La bibliothèque Supabase n'est pas chargée."
        );

        return false;

    } catch (error) {

        console.error(
            "Impossible d'initialiser Supabase :",
            error
        );

        return false;
    }
}


/* =========================================================
   ADMINISTRATEUR
========================================================= */

const ADMIN_FIRST_NAME = "Ziyad";
const ADMIN_LAST_NAME = "Hamied";

const ADMIN_SESSION_KEY =
    "mini_ordinateur_admin";


/* =========================================================
   VARIABLES
========================================================= */

let items = [];

let currentFolder = null;

let isAdmin = false;


/* =========================================================
   DÉMARRAGE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        initSupabase();

        const savedAdmin =
            sessionStorage.getItem(
                ADMIN_SESSION_KEY
            );

        if (savedAdmin === "true") {
            isAdmin = true;
        }

        updateInterface();

        await loadItems();

        showHome();

        setupRealtime();
    }
);


/* =========================================================
   NAVIGATION
========================================================= */

function hideAllSections() {

    const sectionIds = [
        "home",
        "learn",
        "login",
        "admin"
    ];

    sectionIds.forEach(function (id) {

        const element =
            document.getElementById(id);

        if (element) {
            element.classList.add("hidden");
        }
    });
}


function showHome() {

    hideAllSections();

    const section =
        document.getElementById("home");

    if (section) {
        section.classList.remove("hidden");
    }

    setSiteTitle("Accueil");

    currentFolder = null;

    renderHome();
}


function showLearn() {

    hideAllSections();

    const section =
        document.getElementById("learn");

    if (section) {
        section.classList.remove("hidden");
    }

    setSiteTitle("Apprendre");

    currentFolder = null;

    renderLearn();
}


function showLogin() {

    hideAllSections();

    const section =
        document.getElementById("login");

    if (section) {
        section.classList.remove("hidden");
    }

    setSiteTitle("Se connecter");
}


function showAdmin() {

    if (!isAdmin) {
        showLogin();
        return;
    }

    hideAllSections();

    const section =
        document.getElementById("admin");

    if (section) {
        section.classList.remove("hidden");
    }

    setSiteTitle("Administration");

    currentFolder = null;

    closeEditor();

    renderAdmin();
}


function setSiteTitle(title) {

    const element =
        document.getElementById("siteTitle");

    if (element) {
        element.textContent = title;
    }
}


/* =========================================================
   INTERFACE ADMIN
========================================================= */

function updateInterface() {

    const adminButton =
        document.getElementById("adminButton");

    if (!adminButton) {
        return;
    }

    if (isAdmin) {

        adminButton.innerHTML = `
            <button
                class="nav-button"
                onclick="showAdmin()">
                Administration
            </button>
        `;

    } else {

        adminButton.innerHTML = "";
    }
}


/* =========================================================
   CONNEXION
========================================================= */

async function login() {

    const firstNameElement =
        document.getElementById("firstName");

    const lastNameElement =
        document.getElementById("lastName");

    const firstName =
        firstNameElement
            ? firstNameElement.value.trim()
            : "";

    const lastName =
        lastNameElement
            ? lastNameElement.value.trim()
            : "";

    if (!firstName || !lastName) {

        showLoginMessage(
            "Veuillez remplir les deux champs.",
            false
        );

        return;
    }

    const validFirstName =
        firstName.toLowerCase() ===
        ADMIN_FIRST_NAME.toLowerCase();

    const validLastName =
        lastName.toLowerCase() ===
        ADMIN_LAST_NAME.toLowerCase();

    if (!validFirstName || !validLastName) {

        showLoginMessage(
            "Prénom ou nom incorrect.",
            false
        );

        return;
    }

    isAdmin = true;

    sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        "true"
    );

    updateInterface();

    showLoginMessage(
        "Connexion réussie !",
        true
    );

    setTimeout(function () {
        showAdmin();
    }, 500);
}


function showLoginMessage(
    text,
    success
) {

    const message =
        document.getElementById(
            "loginMessage"
        );

    if (!message) {
        return;
    }

    message.textContent = text;

    message.classList.remove(
        "ok",
        "no"
    );

    message.classList.add(
        success ? "ok" : "no"
    );
}


/* =========================================================
   DÉCONNEXION
========================================================= */

function logout() {

    isAdmin = false;

    sessionStorage.removeItem(
        ADMIN_SESSION_KEY
    );

    closeEditor();

    updateInterface();

    showHome();
}


/* =========================================================
   CHARGEMENT DES DONNÉES
========================================================= */

async function loadItems() {

    const home =
        document.getElementById(
            "homeExplorer"
        );

    if (home) {

        home.innerHTML = `
            <div class="loading">
                Chargement...
            </div>
        `;
    }

    if (!supabaseClient) {

        if (home) {

            home.innerHTML = `
                <div class="notice">
                    Le service de données n'est pas disponible.
                    La navigation du site reste disponible.
                </div>
            `;
        }

        return;
    }

    try {

        const result =
            await supabaseClient
                .from("items")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (result.error) {
            throw result.error;
        }

        items = result.data || [];

        renderHome();
        renderLearn();

        if (isAdmin) {
            renderAdmin();
        }

    } catch (error) {

        console.error(
            "Erreur Supabase :",
            error
        );

        if (home) {

            home.innerHTML = `
                <div class="notice">
                    Impossible de charger les données.
                    Vérifie la connexion à Supabase.
                </div>
            `;
        }
    }
}


/* =========================================================
   ARBORESCENCE
========================================================= */

function getChildren(parentId) {

    return items.filter(
        function (item) {
            return item.parent_id === parentId;
        }
    );
}


function getItem(id) {

    return items.find(
        function (item) {
            return item.id === id;
        }
    );
}


function getPath(folderId) {

    const path = [];

    let current =
        getItem(folderId);

    while (current) {

        path.unshift(current);

        if (!current.parent_id) {
            break;
        }

        current =
            getItem(current.parent_id);
    }

    return path;
}


/* =========================================================
   ICÔNES
========================================================= */

function getIcon(type) {

    switch (type) {

        case "folder":
            return "📁";

        case "memo":
            return "📄";

        case "exercise":
            return "📝";

        default:
            return "📄";
    }
}


/* =========================================================
   ACCUEIL PUBLIC
========================================================= */

function renderHome() {

    const container =
        document.getElementById(
            "homeExplorer"
        );

    if (!container) {
        return;
    }

    if (currentFolder) {

        renderPublicFolder(
            container,
            currentFolder
        );

        return;
    }

    const roots =
        getChildren(null);

    if (roots.length === 0) {

        container.innerHTML = `
            <div class="notice">
                Aucun contenu pour le moment.
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="file-grid">
            ${roots
                .map(function (item) {
                    return publicFileHTML(item);
                })
                .join("")}
        </div>
    `;
}


function publicFileHTML(item) {

    return `
        <div
            class="file"
            style="border-top:5px solid ${escapeAttribute(
                item.color || "#315bd6"
            )}"
            onclick="openPublicItem('${escapeAttribute(
                item.id
            )}')"
        >

            <div class="icon">
                ${getIcon(item.type)}
            </div>

            <div class="file-title">
                ${escapeHTML(item.name)}
            </div>

        </div>
    `;
}


function openPublicItem(id) {

    const item =
        getItem(id);

    if (!item) {
        return;
    }

    if (item.type === "folder") {

        currentFolder = id;

        renderHome();

        return;
    }

    openPublicContent(item);
}


/* =========================================================
   DOSSIERS PUBLICS
========================================================= */

function renderPublicFolder(
    container,
    folderId
) {

    const folder =
        getItem(folderId);

    if (!folder) {

        currentFolder = null;

        renderHome();

        return;
    }

    const children =
        getChildren(folderId);

    const path =
        getPath(folderId);

    container.innerHTML = `

        <div class="breadcrumb">

            <button
                onclick="goHomeExplorer()">
                Accueil
            </button>

            ${path
                .map(function (folderItem) {

                    return `
                        <span>›</span>

                        <button
                            onclick="openPublicItem('${escapeAttribute(
                                folderItem.id
                            )}')">
                            ${escapeHTML(
                                folderItem.name
                            )}
                        </button>
                    `;
                })
                .join("")}

        </div>

        ${
            children.length === 0
                ? `
                    <div class="notice">
                        Ce dossier est vide.
                    </div>
                `
                : `
                    <div class="file-grid">
                        ${children
                            .map(function (item) {
                                return publicFileHTML(item);
                            })
                            .join("")}
                    </div>
                `
        }
    `;
}


function goHomeExplorer() {

    currentFolder = null;

    renderHome();
}


/* =========================================================
   AFFICHAGE DES MÉMOS / EXERCICES
========================================================= */

function openPublicContent(item) {

    const container =
        document.getElementById(
            "homeExplorer"
        );

    if (!container) {
        return;
    }

    const path =
        item.parent_id
            ? getPath(item.parent_id)
            : [];

    let html = `

        <div class="breadcrumb">

            <button
                onclick="goHomeExplorer()">
                Accueil
            </button>

            ${path
                .map(function (folder) {

                    return `
                        <span>›</span>

                        <button
                            onclick="openPublicItem('${escapeAttribute(
                                folder.id
                            )}')">
                            ${escapeHTML(
                                folder.name
                            )}
                        </button>
                    `;
                })
                .join("")}

            <span>›</span>

            <strong>
                ${escapeHTML(item.name)}
            </strong>

        </div>
    `;


    if (item.type === "memo") {

        html += `

            <article class="memo">

                <h2>
                    ${escapeHTML(item.name)}
                </h2>

                ${
                    item.text_content
                        ? `
                            <p>
                                ${escapeHTML(
                                    item.text_content
                                )}
                            </p>
                        `
                        : ""
                }

                ${
                    item.image_url
                        ? `
                            <img
                                src="${escapeAttribute(
                                    item.image_url
                                )}"
                                alt=""
                            >
                        `
                        : ""
                }

                ${
                    item.audio_url
                        ? `
                            <audio
                                controls
                                src="${escapeAttribute(
                                    item.audio_url
                                )}">
                            </audio>
                        `
                        : ""
                }

            </article>
        `;
    }


    if (item.type === "exercise") {

        html += `

            <div class="exercise">

                <h2>
                    ${escapeHTML(item.name)}
                </h2>

                <strong>
                    ${escapeHTML(
                        item.question || ""
                    )}
                </strong>

                <input
                    id="exerciseAnswer"
                    type="text"
                    placeholder="Ta réponse"
                >

                <button
                    onclick="checkExercise('${escapeAttribute(
                        item.id
                    )}')">
                    Vérifier
                </button>

                <div
                    id="exerciseResult"
                    class="result hidden">
                </div>

            </div>
        `;
    }

    container.innerHTML = html;
}


/* =========================================================
   EXERCICES
========================================================= */

function checkExercise(id) {

    const item =
        getItem(id);

    if (!item) {
        return;
    }

    const input =
        document.getElementById(
            "exerciseAnswer"
        );

    const result =
        document.getElementById(
            "exerciseResult"
        );

    if (!input || !result) {
        return;
    }

    const userAnswer =
        normalizeAnswer(
            input.value
        );

    const correctAnswer =
        normalizeAnswer(
            item.answer || ""
        );

    result.classList.remove(
        "hidden",
        "ok",
        "no"
    );

    if (
        userAnswer !== "" &&
        userAnswer === correctAnswer
    ) {

        result.classList.add("ok");

        result.textContent =
            "✅ Bonne réponse !";

    } else {

        result.classList.add("no");

        result.textContent =
            "❌ Ce n'est pas la bonne réponse.";
    }
}


function normalizeAnswer(value) {

    return String(value)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );
}


/* =========================================================
   APPRENDRE
========================================================= */

function renderLearn() {

    const container =
        document.getElementById(
            "learnExplorer"
        );

    if (!container) {
        return;
    }

    const roots =
        getChildren(null);

    if (roots.length === 0) {

        container.innerHTML = `
            <div class="notice">
                Aucun contenu disponible.
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="file-grid">

            ${roots
                .map(function (item) {
                    return publicFileHTML(item);
                })
                .join("")}

        </div>
    `;
}


/* =========================================================
   ADMINISTRATION
========================================================= */

function renderAdmin() {

    if (!isAdmin) {
        return;
    }

    const container =
        document.getElementById(
            "adminExplorer"
        );

    if (!container) {
        return;
    }

    const children =
        getChildren(currentFolder);

    const title =
        currentFolder
            ? getItem(currentFolder)?.name
            : "Accueil";

    const path =
        currentFolder
            ? getPath(currentFolder)
            : [];

    container.innerHTML = `

        <div class="breadcrumb">

            <button
                onclick="adminGoHome()">
                Accueil
            </button>

            ${path
                .map(function (folder) {

                    return `
                        <span>›</span>

                        <button
                            onclick="openAdminFolder('${escapeAttribute(
                                folder.id
                            )}')">
                            ${escapeHTML(
                                folder.name
                            )}
                        </button>
                    `;
                })
                .join("")}

        </div>

        <h2>
            ${escapeHTML(title)}
        </h2>

        ${
            children.length === 0
                ? `
                    <div class="notice">
                        Ce dossier est vide.
                    </div>
                `
                : children
                    .map(function (item) {
                        return adminItemHTML(item);
                    })
                    .join("")
        }
    `;
}


function adminItemHTML(item) {

    return `

        <div
            class="admin-item"
            style="--color:${escapeAttribute(
                item.color || "#315bd6"
            )}"
        >

            <b>
                ${getIcon(item.type)}
                ${escapeHTML(item.name)}
            </b>

            <small class="muted">

                ${
                    item.type === "folder"
                        ? "Dossier"
                        : item.type === "memo"
                            ? "Mémo"
                            : "Exercice"
                }

            </small>

            <div class="actions">

                ${
                    item.type === "folder"
                        ? `
                            <button
                                onclick="openAdminFolder('${escapeAttribute(
                                    item.id
                                )}')">
                                Ouvrir
                            </button>
                        `
                        : `
                            <button
                                onclick="previewItem('${escapeAttribute(
                                    item.id
                                )}')">
                                Voir
                            </button>
                        `
                }

                <button
                    class="secondary"
                    onclick="editItem('${escapeAttribute(
                        item.id
                    )}')">
                    Modifier
                </button>

                <button
                    class="danger"
                    onclick="deleteItem('${escapeAttribute(
                        item.id
                    )}')">
                    Supprimer
                </button>

            </div>

        </div>
    `;
}


/* =========================================================
   NAVIGATION ADMIN
========================================================= */

function adminGoHome() {

    currentFolder = null;

    closeEditor();

    renderAdmin();
}


function openAdminFolder(id) {

    if (!isAdmin) {
        return;
    }

    const item =
        getItem(id);

    if (
        !item ||
        item.type !== "folder"
    ) {
        return;
    }

    currentFolder = id;

    closeEditor();

    renderAdmin();
}


/* =========================================================
   NOUVEAU FICHIER
========================================================= */

function newItem(parentId = null) {

    if (!isAdmin) {

        showLogin();

        return;
    }

    currentFolder =
        parentId !== null
            ? parentId
            : currentFolder;

    clearEditor();

    const editParent =
        document.getElementById(
            "editParent"
        );

    if (editParent) {
        editParent.value =
            currentFolder || "";
    }

    const editorTitle =
        document.getElementById(
            "editorTitle"
        );

    if (editorTitle) {
        editorTitle.textContent =
            "Nouveau fichier";
    }

    const editor =
        document.getElementById(
            "editor"
        );

    if (editor) {

        editor.classList.remove(
            "hidden"
        );

        changeType();

        updateColor();

        editor.scrollIntoView({
            behavior: "smooth"
        });
    }
}


/* =========================================================
   MODIFICATION
========================================================= */

function editItem(id) {

    if (!isAdmin) {
        return;
    }

    const item =
        getItem(id);

    if (!item) {
        return;
    }

    setInputValue(
        "editId",
        item.id
    );

    setInputValue(
        "editParent",
        item.parent_id || ""
    );

    setInputValue(
        "itemName",
        item.name || ""
    );

    setInputValue(
        "itemType",
        item.type || "folder"
    );

    setInputValue(
        "itemColor",
        item.color || "#315bd6"
    );

    setInputValue(
        "itemText",
        item.text_content || ""
    );

    setInputValue(
        "itemImageUrl",
        item.image_url || ""
    );

    setInputValue(
        "itemAudioUrl",
        item.audio_url || ""
    );

    setInputValue(
        "question",
        item.question || ""
    );

    setInputValue(
        "answer",
        item.answer || ""
    );

    const editorTitle =
        document.getElementById(
            "editorTitle"
        );

    if (editorTitle) {
        editorTitle.textContent =
            "Modifier";
    }

    const editor =
        document.getElementById(
            "editor"
        );

    if (editor) {

        editor.classList.remove(
            "hidden"
        );

        changeType();

        updateColor();

        editor.scrollIntoView({
            behavior: "smooth"
        });
    }
}


function setInputValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value = value;
    }
}


/* =========================================================
   EDITEUR
========================================================= */

function clearEditor() {

    const fields = [
        "editId",
        "editParent",
        "itemName",
        "itemText",
        "itemImageUrl",
        "itemAudioUrl",
        "question",
        "answer"
    ];

    fields.forEach(function (id) {

        const element =
            document.getElementById(id);

        if (element) {
            element.value = "";
        }
    });

    const type =
        document.getElementById(
            "itemType"
        );

    if (type) {
        type.value = "folder";
    }

    const color =
        document.getElementById(
            "itemColor"
        );

    if (color) {
        color.value = "#315bd6";
    }

    const imageFile =
        document.getElementById(
            "itemImageFile"
        );

    if (imageFile) {
        imageFile.value = "";
    }

    const audioFile =
        document.getElementById(
            "itemAudioFile"
        );

    if (audioFile) {
        audioFile.value = "";
    }
}


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
}


function changeType() {

    const type =
        document.getElementById(
            "itemType"
        )?.value;

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
}


function updateColor() {

    const color =
        document.getElementById(
            "itemColor"
        )?.value ||
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
   ENREGISTRER
========================================================= */

async function saveItem() {

    if (!isAdmin) {

        showLogin();

        return;
    }

    if (!supabaseClient) {

        alert(
            "Supabase n'est pas disponible."
        );

        return;
    }

    const id =
        document
            .getElementById("editId")
            ?.value
            .trim();

    const parentId =
        document
            .getElementById("editParent")
            ?.value
            .trim() || null;

    const name =
        document
            .getElementById("itemName")
            ?.value
            .trim();

    const type =
        document
            .getElementById("itemType")
            ?.value;

    const color =
        document
            .getElementById("itemColor")
            ?.value ||
        "#315bd6";

    if (!name) {

        alert(
            "Veuillez donner un nom."
        );

        return;
    }

    if (
        ![
            "folder",
            "memo",
            "exercise"
        ].includes(type)
    ) {

        alert(
            "Type de fichier invalide."
        );

        return;
    }

    const data = {

        name: name,

        type: type,

        color: color,

        parent_id: parentId,

        text_content:
            type === "memo"
                ? getInputValue(
                    "itemText"
                ) || null
                : null,

        image_url:
            type === "memo"
                ? getInputValue(
                    "itemImageUrl"
                ) || null
                : null,

        audio_url:
            type === "memo"
                ? getInputValue(
                    "itemAudioUrl"
                ) || null
                : null,

        question:
            type === "exercise"
                ? getInputValue(
                    "question"
                ) || null
                : null,

        answer:
            type === "exercise"
                ? getInputValue(
                    "answer"
                ) || null
                : null
    };


    try {

        let result;

        if (id) {

            result =
                await supabaseClient
                    .from("items")
                    .update(data)
                    .eq("id", id)
                    .select()
                    .single();

        } else {

            result =
                await supabaseClient
                    .from("items")
                    .insert(data)
                    .select()
                    .single();
        }

        if (result.error) {
            throw result.error;
        }

        closeEditor();

        await loadItems();

        renderAdmin();

        alert(
            "Enregistré avec succès !"
        );

    } catch (error) {

        console.error(
            "Erreur enregistrement :",
            error
        );

        alert(
            "Impossible d'enregistrer.\n\n" +
            error.message
        );
    }
}


function getInputValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value
        : "";
}


/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteItem(id) {

    if (!isAdmin) {
        return;
    }

    if (!supabaseClient) {

        alert(
            "Supabase n'est pas disponible."
        );

        return;
    }

    const item =
        getItem(id);

    if (!item) {
        return;
    }

    const confirmation =
        confirm(
            `Supprimer "${item.name}" ?\n\n` +
            "Attention : si c'est un dossier, " +
            "son contenu sera également supprimé."
        );

    if (!confirmation) {
        return;
    }

    try {

        const result =
            await supabaseClient
                .from("items")
                .delete()
                .eq("id", id);

        if (result.error) {
            throw result.error;
        }

        if (currentFolder === id) {
            currentFolder = null;
        }

        await loadItems();

        renderAdmin();

    } catch (error) {

        console.error(
            "Erreur suppression :",
            error
        );

        alert(
            "Impossible de supprimer.\n\n" +
            error.message
        );
    }
}


/* =========================================================
   APERÇU ADMIN
========================================================= */

function previewItem(id) {

    const item =
        getItem(id);

    if (!item) {
        return;
    }

    currentFolder =
        item.parent_id || null;

    showHome();

    setTimeout(function () {

        openPublicContent(item);

    }, 50);
}


/* =========================================================
   REALTIME SUPABASE
========================================================= */

function setupRealtime() {

    if (!supabaseClient) {
        return;
    }

    try {

        supabaseClient
            .channel("items-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "items"
                },
                async function () {

                    await loadItems();
                }
            )
            .subscribe();

    } catch (error) {

        console.error(
            "Erreur Realtime :",
            error
        );
    }
}


/* =========================================================
   EXPORT JSON
========================================================= */

function exportData() {

    if (!isAdmin) {
        return;
    }

    const json =
        JSON.stringify(
            items,
            null,
            2
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
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "mini-ordinateur-educatif.json";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


/* =========================================================
   IMPORT JSON
========================================================= */

async function importData(event) {

    if (!isAdmin) {
        return;
    }

    if (!supabaseClient) {

        alert(
            "Supabase n'est pas disponible."
        );

        return;
    }

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    try {

        const text =
            await file.text();

        const imported =
            JSON.parse(text);

        if (!Array.isArray(imported)) {

            throw new Error(
                "Le fichier JSON est invalide."
            );
        }

        const confirmation =
            confirm(
                "Importer ce fichier ?\n\n" +
                "Les éléments seront ajoutés " +
                "à ceux déjà présents."
            );

        if (!confirmation) {
            return;
        }

        for (
            const item of imported
        ) {

            const data = {

                parent_id:
                    item.parent_id || null,

                name:
                    item.name || "Sans nom",

                type:
                    item.type || "folder",

                color:
                    item.color || "#315bd6",

                text_content:
                    item.text_content || null,

                image_url:
                    item.image_url || null,

                audio_url:
                    item.audio_url || null,

                question:
                    item.question || null,

                answer:
                    item.answer || null
            };

            const result =
                await supabaseClient
                    .from("items")
                    .insert(data);

            if (result.error) {

                console.error(
                    "Erreur import :",
                    result.error
                );
            }
        }

        await loadItems();

        renderAdmin();

        alert(
            "Import terminé."
        );

    } catch (error) {

        console.error(
            "Erreur import :",
            error
        );

        alert(
            "Impossible d'importer ce fichier."
        );

    } finally {

        event.target.value = "";
    }
}


/* =========================================================
   SÉCURITÉ AFFICHAGE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
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


function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   EXPOSER LES FONCTIONS AU HTML
========================================================= */

/*
   Les boutons de index.html utilisent onclick="..."
   On rend donc explicitement les fonctions accessibles
   depuis le HTML.
*/

window.showHome = showHome;
window.showLearn = showLearn;
window.showLogin = showLogin;
window.showAdmin = showAdmin;

window.login = login;
window.logout = logout;

window.newItem = newItem;
window.saveItem = saveItem;
window.closeEditor = closeEditor;
window.changeType = changeType;
window.updateColor = updateColor;

window.editItem = editItem;
window.deleteItem = deleteItem;
window.previewItem = previewItem;

window.openPublicItem = openPublicItem;
window.openAdminFolder = openAdminFolder;

window.goHomeExplorer = goHomeExplorer;
window.adminGoHome = adminGoHome;

window.checkExercise = checkExercise;

window.exportData = exportData;
window.importData = importData;
