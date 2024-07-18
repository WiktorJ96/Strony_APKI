let storagePrefix = 'suple_';

document.addEventListener('DOMContentLoaded', function () {
    let calendarEl = document.getElementById('calendar');
    let eventsListEl = document.getElementById('events-list');
    let saveButton = document.getElementById('saveButton');
    let exportButton = document.getElementById('exportButton');
    let importFile = document.getElementById('importFile');
    let importButton = document.getElementById('importButton');

    if (!calendarEl) console.error('Element #calendar not found');
    if (!eventsListEl) console.error('Element #events-list not found');
    if (!saveButton) console.error('Element #saveButton not found');
    if (!exportButton) console.error('Element #exportButton not found');
    if (!importFile) console.error('Element #importFile not found');
    if (!importButton) console.error('Element #importButton not found');

    if (!calendarEl || !eventsListEl || !saveButton || !exportButton || !importFile || !importButton) {
        console.error('Required elements not found in the DOM');
        return;
    }

    $('[data-toggle="tooltip"]').tooltip();

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
    loadEvents(calendar);
    updateEventsList();

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

    function saveEvents(events) {
        let eventArray = events.map(function (event) {
            return {
                title: event.title,
                start: event.start.toISOString(),
                end: event.end ? event.end.toISOString() : null,
                allDay: event.allDay
            };
        });
        localStorage.setItem(storagePrefix + 'calendarEvents', JSON.stringify(eventArray));
    }

    function loadEvents(calendar) {
        let savedEvents = localStorage.getItem(storagePrefix + 'calendarEvents');
        if (savedEvents) {
            let eventArray = JSON.parse(savedEvents);
            eventArray.forEach(function (eventData) {
                calendar.addEvent(eventData);
            });
        }
    }

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

    function exportEvents(events) {
    let exportData = events.map(event => ({
        title: event.title,
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : null,
        allDay: event.allDay
    }));

    let jsonContent = JSON.stringify(exportData, null, 2);
    let blob = new Blob([jsonContent], {type: 'application/json'});
    let url = URL.createObjectURL(blob);

    let link = document.createElement("a");
    link.href = url;
    link.download = `${storagePrefix}suplementacja_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

    function importEvents(calendar) {
    let file = document.getElementById('importFile').files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function (e) {
            try {
                let importedEvents = JSON.parse(e.target.result);
                
                importedEvents.forEach(function (eventData) {
                    calendar.addEvent({
                        title: eventData.title,
                        start: new Date(eventData.start),
                        end: eventData.end ? new Date(eventData.end) : null,
                        allDay: eventData.allDay
                    });
                });

                calendar.render();
                updateEventsList();
                saveEvents(calendar.getEvents());
                alert('Import zakończony pomyślnie.');
            } catch (error) {
                console.error('Błąd podczas importowania:', error);
                alert('Wystąpił błąd podczas importowania. Sprawdź format pliku JSON.');
            }
        };
        reader.readAsText(file);
    } else {
        alert('Proszę wybrać plik do importu.');
    }
}
});

let db;
const dbName = "SupplementsDB";

const request = indexedDB.open(dbName, 1);

request.onerror = (event) => {
    console.error("Błąd otwarcia bazy IndexedDB:", event.target.error);
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Baza danych otwarta pomyślnie");
    loadAllSupplements();
    startDailyUpdate(db);
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("orders", { keyPath: "id" });
};

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
                cursor.value.supplementName,
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

