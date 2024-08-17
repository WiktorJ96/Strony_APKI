let storagePrefix = 'suple_';
let db;
let dbReady = false;
const dbName = "SupplementsDB";
const dbVersion = 2; // Zwiększona wersja dla nowego object store

document.addEventListener('DOMContentLoaded', function () {
    let calendarEl = document.getElementById('calendar');
    let eventsListEl = document.getElementById('events-list');
    let saveButton = document.getElementById('saveButton');
    let exportButton = document.getElementById('exportButton');
    let importFile = document.getElementById('importFile');
    let importButton = document.getElementById('importButton');
    let addNoteButton = document.getElementById('addNote');
    let notesListEl = document.getElementById('notesList');

    if (!calendarEl) console.error('Element #calendar not found');
    if (!eventsListEl) console.error('Element #events-list not found');
    if (!saveButton) console.error('Element #saveButton not found');
    if (!exportButton) console.error('Element #exportButton not found');
    if (!importFile) console.error('Element #importFile not found');
    if (!importButton) console.error('Element #importButton not found');
    if (!addNoteButton) console.error('Element #addNote not found');
    if (!notesListEl) console.error('Element #notesList not found');

    if (!calendarEl || !eventsListEl || !saveButton || !exportButton || !importFile || !importButton) {
        console.error('Required elements not found in the DOM');
        return;
    }

    $('[data-toggle="tooltip"]').tooltip();

    // Inicjalizacja bazy danych
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = (event) => {
        console.error("Błąd otwarcia bazy IndexedDB:", event.target.error);
    };

    request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Baza danych otwarta pomyślnie");
    dbReady = true;
    loadAllSupplements();
    startDailyUpdate(db);
    initializeNotebook(); // Przeniesiemy to tutaj
};

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains("orders")) {
            db.createObjectStore("orders", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("notes")) {
            db.createObjectStore("notes", { keyPath: "id", autoIncrement: true });
        }
    };

    let calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        locale: 'pl',
        dayMaxEvents: 3,
        height: 'auto',
        aspectRatio: 1.35,
        expandRows: false,
        stickyHeaderDates: true,
        selectable: true,
        editable: true,
        eventClick: function (info) {
            if (confirm("Czy na pewno chcesz usunąć to wydarzenie?")) {
                if (info.event.extendedProps.tooltip) {
                    info.event.extendedProps.tooltip.dispose();
                }
                info.event.remove();
                saveEvents(calendar.getEvents());
                updateEventsList();
            }
        },
        select: function (info) {
            let activity = prompt('Wprowadź czynność:');
            if (activity) {
                let event = {
                    title: activity,
                    start: info.startStr,
                    end: info.endStr,
                    allDay: info.allDay
                };
                calendar.addEvent(event);
                saveEvents(calendar.getEvents());
                updateEventsList();
            }
        },
        eventDidMount: function (info) {
            let tooltip = new bootstrap.Tooltip(info.el, {
                title: info.event.title,
                placement: 'top',
                trigger: 'hover',
                container: 'body'
            });
            info.event.setExtendedProp('tooltip', tooltip);
        },
        eventAdd: function () {
            updateEventsList();
        },
        eventRemove: function () {
            updateEventsList();
        },
        eventChange: function () {
            updateEventsList();
            saveEvents(calendar.getEvents());
        }
    });

    calendar.render();
    if (typeof loadEvents === 'function') {
        loadEvents(calendar);
    }
    updateEventsList();

    function updateEventsList() {
    if (eventsListEl) {
        let events = calendar.getEvents();
        let html = '<h3>Lista wydarzeń:</h3><ul>';
        events.forEach(function (event) {
            html += '<li>' + event.title + ' - ' + formatDate(event.start) + '</li>';
        });
        html += '</ul>';
        eventsListEl.innerHTML = html;
    }
    }
    
    function formatDate(date) {
    return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

    saveButton.addEventListener('click', function () {
        saveEvents(calendar.getEvents());
        alert('Wydarzenia zostały zapisane.');
    });

    exportButton.addEventListener('click', function () {
        exportEvents(calendar.getEvents());
    });

    importButton.addEventListener('click', function () {
        importEvents(calendar);
    });

// Funkcje dla notatnika
function initializeNotebook() {
    const addNoteButton = document.getElementById("addNote");
    if (addNoteButton) {
        addNoteButton.removeEventListener('click', addNote);
        addNoteButton.addEventListener('click', addNote);
    }
    if (dbReady) {
        loadNotes();
    } else {
        console.log("Baza danych nie jest jeszcze gotowa. Oczekiwanie...");
        setTimeout(initializeNotebook, 100); // Spróbuj ponownie za 100ms
    }
}

function addNote() {
    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();
    const addNoteButton = document.getElementById("addNote");
    const mode = addNoteButton.getAttribute('data-mode');
    const editId = addNoteButton.getAttribute('data-edit-id');
    
    if (!title || !content) {
        alert("Proszę wypełnić tytuł i treść notatki.");
        return;
    }

    const transaction = db.transaction(["notes"], "readwrite");
    const objectStore = transaction.objectStore("notes");
    
    let request;
    if (mode === 'edit' && editId) {
        request = objectStore.put({ id: parseInt(editId), title: title, content: content });
    } else {
        request = objectStore.add({ title: title, content: content });
    }

    request.onerror = function(event) {
        console.error("Błąd podczas zapisywania notatki:", event.target.error);
    };

    request.onsuccess = function(event) {
        console.log("Notatka zapisana pomyślnie");
        document.getElementById("noteTitle").value = "";
        document.getElementById("noteContent").value = "";
        addNoteButton.textContent = "Dodaj notatkę";
        addNoteButton.removeAttribute('data-mode');
        addNoteButton.removeAttribute('data-edit-id');
        loadNotes();
    };
}

function loadNotes() {
    if (!dbReady) {
        console.log("Baza danych nie jest jeszcze gotowa. Ponowna próba za 100ms.");
        setTimeout(loadNotes, 100);
        return;
    }

    const notesList = document.getElementById("notesList");
    if (!notesList) {
        console.error("Element #notesList not found");
        return;
    }
    notesList.innerHTML = "";

    const transaction = db.transaction(["notes"], "readonly");
    const objectStore = transaction.objectStore("notes");
    
    objectStore.openCursor().onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const listItem = document.createElement("li");
            listItem.className = "list-group-item";
            listItem.innerHTML = `
                <h3 class="font-bold">${cursor.value.title}</h3>
                <p>${cursor.value.content}</p>
                <button class="btn btn-primary btn-sm mt-2 mr-2 edit-note" data-id="${cursor.value.id}">Edytuj</button>
                <button class="btn btn-danger btn-sm mt-2 delete-note" data-id="${cursor.value.id}">Usuń</button>
            `;
            notesList.appendChild(listItem);
            cursor.continue();
        }
    };
}

// Dodaj te funkcje do obsługi zdarzeń
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('edit-note')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        editNote(id);
    }
    if (e.target && e.target.classList.contains('delete-note')) {
        const id = parseInt(e.target.getAttribute('data-id'));
        deleteNote(id);
    }
});

function editNote(id) {
    const transaction = db.transaction(["notes"], "readonly");
    const objectStore = transaction.objectStore("notes");
    const request = objectStore.get(id);

    request.onerror = function(event) {
        console.error("Błąd podczas pobierania notatki:", event.target.error);
    };

    request.onsuccess = function(event) {
        const note = event.target.result;
        document.getElementById("noteTitle").value = note.title;
        document.getElementById("noteContent").value = note.content;
        
        const addNoteButton = document.getElementById("addNote");
        addNoteButton.textContent = "Zapisz zmiany";
        addNoteButton.setAttribute('data-mode', 'edit');
        addNoteButton.setAttribute('data-edit-id', id);
    };
}

function updateNote(id) {
    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();
    
    if (!title || !content) {
        alert("Proszę wypełnić tytuł i treść notatki.");
        return;
    }

    const transaction = db.transaction(["notes"], "readwrite");
    const objectStore = transaction.objectStore("notes");
    const request = objectStore.put({ id: id, title: title, content: content });

    request.onerror = function(event) {
        console.error("Błąd podczas aktualizacji notatki:", event.target.error);
    };

    request.onsuccess = function(event) {
        console.log("Notatka zaktualizowana pomyślnie");
        document.getElementById("noteTitle").value = "";
        document.getElementById("noteContent").value = "";
        
        const addNoteButton = document.getElementById("addNote");
        addNoteButton.textContent = "Dodaj notatkę";
        addNoteButton.onclick = addNote;
        
        loadNotes();
    };
}

function deleteNote(id) {
    if (confirm("Czy na pewno chcesz usunąć tę notatkę?")) {
        const transaction = db.transaction(["notes"], "readwrite");
        const objectStore = transaction.objectStore("notes");
        const request = objectStore.delete(id);

        request.onerror = function(event) {
            console.error("Błąd podczas usuwania notatki:", event.target.error);
        };

        request.onsuccess = function(event) {
            console.log("Notatka usunięta pomyślnie");
            loadNotes();
        };
    }
}

    // Obsługa przełączania zakładek
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        if (e.target.id === 'notatnik-tab') {
            initializeNotebook();
        }
    });

    initializeNotebook();
});

// Funkcje dla suplementów
function saveOrder(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold) {
    console.log("Próba zapisu:", id, supplementName);
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["orders"], "readwrite");
        const objectStore = transaction.objectStore("orders");
        const data = { id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold };
        const request = objectStore.put(data);
        request.onerror = (event) => {
            console.error("Błąd zapisu:", event.target.error);
            reject("Błąd zapisu: " + event.target.error);
        };
        request.onsuccess = (event) => {
            console.log("Zapisano pomyślnie:", id, supplementName);
            resolve(data);
        };
    });
}

function getOrder(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["orders"], "readonly");
        const objectStore = transaction.objectStore("orders");
        const request = objectStore.get(id);
        request.onerror = (event) => {
            reject("Błąd odczytu: " + event.target.error);
        };
        request.onsuccess = (event) => {
            resolve(request.result);
        };
    });
}

function updateSupplementInfo(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold) {
    let infoElement = $(`button[data-id="${id}"]`);

    if (infoElement.length === 0) {
        console.warn(`Element o id ${id} nie został znaleziony`);
        return;
    }

    // Usuń istniejące informacje
    infoElement.siblings('.order-info').remove();
    infoElement.tooltip('dispose');

    if (quantity && orderDate && dailyDosage) {
        const daysSupply = Math.floor(quantity / dailyDosage);
        const nextOrderDate = new Date(orderDate);
        nextOrderDate.setDate(nextOrderDate.getDate() + daysSupply - reorderThreshold);
        const today = new Date();
        const daysLeft = Math.ceil((nextOrderDate - today) / (1000 * 60 * 60 * 24));

        // Dodaj nowe informacje
        let infoSpan = $('<span class="order-info"></span>');
        infoSpan.append('<i class="bx bxs-calendar-check" style="color: green;"></i>');
        infoElement.after(infoSpan);

        // Dodaj tooltip z informacjami
        infoElement.attr('data-toggle', 'tooltip');
        infoElement.attr('data-placement', 'top');
        infoElement.attr('title', `Zamówiono: ${quantity} szt. ${new Date(orderDate).toLocaleDateString()} | Następne: ${nextOrderDate.toLocaleDateString()} | Pozostało: ${daysLeft} dni`);

        // Inicjalizuj tooltip
        infoElement.tooltip();
    }
}

function loadAllSupplements() {
    console.log("Ładowanie wszystkich suplementów");
    const transaction = db.transaction(["orders"], "readonly");
    const objectStore = transaction.objectStore("orders");
    const request = objectStore.openCursor();

    // Czyścimy istniejące informacje
    $('.order-info').remove();
    $('[data-toggle="tooltip"]').tooltip('dispose');

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            console.log("Znaleziono wpis:", cursor.value);
            updateSupplementInfo(
                cursor.value.id,
                cursor.value.supplementName, // Poprawione: usunięto dodatkowe "cursor.value."
                cursor.value.quantity,
                cursor.value.orderDate,
                cursor.value.dailyDosage,
                cursor.value.reorderThreshold
            );
            cursor.continue();
        } else {
            console.log("Zakończono ładowanie suplementów");
        }
    };
}

function updateOrderPredictions() {
    const quantity = parseInt($('#quantity').val()) || 0;
    const orderDate = new Date($('#orderDate').val());
    const dailyDosage = parseInt($('#dailyDosage').val()) || 1;
    const reorderThreshold = parseInt($('#reorderThreshold').val()) || 0;

    if (quantity && orderDate && dailyDosage) {
        const daysSupply = Math.floor(quantity / dailyDosage);
        const nextOrderDate = new Date(orderDate);
        nextOrderDate.setDate(nextOrderDate.getDate() + daysSupply - reorderThreshold);

        const today = new Date();
        const daysLeft = Math.ceil((nextOrderDate - today) / (1000 * 60 * 60 * 24));

        $('#nextOrderDate').text(nextOrderDate.toLocaleDateString());
        $('#daysLeft').text(daysLeft);
    } else {
        $('#nextOrderDate').text('Brak danych');
        $('#daysLeft').text('Brak danych');
    }
}

function updateDaysLeft(db) {
    const transaction = db.transaction(["orders"], "readonly");
    const objectStore = transaction.objectStore("orders");
    const request = objectStore.openCursor();

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const data = cursor.value;
            const today = new Date();
            const orderDate = new Date(data.orderDate);
            const daysSupply = Math.floor(data.quantity / data.dailyDosage);
            const nextOrderDate = new Date(orderDate);
            nextOrderDate.setDate(nextOrderDate.getDate() + daysSupply - data.reorderThreshold);
            const daysLeft = Math.ceil((nextOrderDate - today) / (1000 * 60 * 60 * 24));

            updateSupplementInfo(
                data.id,
                data.supplementName,
                data.quantity,
                data.orderDate,
                data.dailyDosage,
                data.reorderThreshold,
                daysLeft
            );

            cursor.continue();
        }
    };
}

function startDailyUpdate(db) {
    updateDaysLeft(db);
    // Aktualizuj codziennie o północy
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // następny dzień
        0, 0, 0 // o północy
    );
    const msToMidnight = night.getTime() - now.getTime();

    setTimeout(function () {
        updateDaysLeft(db);
        // Ustaw interwał na codzienne wywołanie
        setInterval(() => updateDaysLeft(db), 24 * 60 * 60 * 1000);
    }, msToMidnight);
}

function deleteOrder(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["orders"], "readwrite");
        const objectStore = transaction.objectStore("orders");
        const request = objectStore.delete(id);

        request.onerror = (event) => {
            console.error("Błąd usuwania:", event.target.error);
            reject("Błąd usuwania: " + event.target.error);
        };

        request.onsuccess = (event) => {
            console.log("Pomyślnie usunięto wpis o id:", id);
            resolve(id);
        };
    });
}

$(document).on('click', '.edit-btn', function() {
    let id = $(this).data('id');
    let supplementName = $(this).data('supplement');

    $('#supplementName').val(supplementName);
    $('#editModalLabel').text('Edytuj zamówienie: ' + supplementName);
    $('#editModal').data('currentId', id);

    getOrder(id).then(savedData => {
        if (savedData) {
            $('#quantity').val(savedData.quantity);
            $('#orderDate').val(savedData.orderDate);
            $('#dailyDosage').val(savedData.dailyDosage || 1);
            $('#reorderThreshold').val(savedData.reorderThreshold || 0);
            updateOrderPredictions();
        } else {
            $('#quantity').val('');
            $('#orderDate').val('');
            $('#dailyDosage').val('1');
            $('#reorderThreshold').val('0');
            $('#nextOrderDate').text('Brak danych');
            $('#daysLeft').text('Brak danych');
        }
        $('#editModal').modal('show');
    }).catch(error => {
        console.error("Błąd podczas wczytywania danych:", error);
        $('#editModal').modal('show');
    });
});

$('#quantity, #orderDate, #dailyDosage, #reorderThreshold').on('input', updateOrderPredictions);

$('#saveChanges').on('click', function () {
    let id = $('#editModal').data('currentId');
    console.log("ID przed zapisem:", id);
    let supplementName = $('#supplementName').val();
    let quantity = $('#quantity').val();
    let orderDate = $('#orderDate').val();
    let dailyDosage = $('#dailyDosage').val();
    let reorderThreshold = $('#reorderThreshold').val();

    saveOrder(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold).then((savedData) => {
        console.log('Zapisano:', savedData);
        updateSupplementInfo(
            savedData.id,
            savedData.supplementName,
            savedData.quantity,
            savedData.orderDate,
            savedData.dailyDosage,
            savedData.reorderThreshold
        );
        $('#editModal').modal('hide');
        loadAllSupplements();
    }).catch(error => {
        console.error("Błąd podczas zapisywania:", error);
        alert("Wystąpił błąd podczas zapisywania danych. Spróbuj ponownie.");
    });
});

$('#editModal').on('hidden.bs.modal', function () {
    loadAllSupplements();
});

$(document).on('click', '#deleteEntry', function() {
    let id = $('#editModal').data('currentId');
    console.log("Próba usunięcia wpisu o id:", id);

    deleteOrder(id).then((deletedId) => {
        console.log('Usunięto wpis o id:', deletedId);
        $(`button[data-id="${deletedId}"]`).siblings('.order-info').remove();
        $(`button[data-id="${deletedId}"]`).tooltip('dispose');
        $('#editModal').modal('hide');
        loadAllSupplements();
    }).catch(error => {
        console.error("Błąd podczas usuwania:", error);
        alert("Wystąpił błąd podczas usuwania danych. Spróbuj ponownie.");
    });
});