document.addEventListener('DOMContentLoaded', function () {
    var calendarEl = document.getElementById('calendar');
    var eventsListEl = document.getElementById('events-list');
    var saveButton = document.getElementById('saveButton');
    var exportButton = document.getElementById('exportButton');
    var importFile = document.getElementById('importFile');
    var importButton = document.getElementById('importButton');

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

    var calendar = new FullCalendar.Calendar(calendarEl, {
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
            var activity = prompt('Wprowadź czynność:');
            if (activity) {
                var event = {
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
            var tooltip = new bootstrap.Tooltip(info.el, {
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
    loadEvents(calendar).then(() => {
        updateEventsList();
    }).catch(error => {
        console.error("Błąd ładowania wydarzeń:", error);
    });

    saveButton.addEventListener('click', function () {
        saveEvents(calendar.getEvents()).then(() => {
            alert('Wydarzenia zostały zapisane.');
        }).catch(error => {
            console.error("Błąd zapisu wydarzeń:", error);
            alert('Wystąpił błąd podczas zapisu wydarzeń.');
        });
    });

    exportButton.addEventListener('click', function () {
        exportEvents(calendar.getEvents());
    });

    importButton.addEventListener('click', function () {
        importEvents(calendar);
    });

    let db;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            let request = indexedDB.open("CalendarDB", 1);
            
            request.onerror = function(event) {
                reject("Błąd otwarcia bazy danych");
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                resolve(db);
            };

            request.onupgradeneeded = function(event) {
                let db = event.target.result;
                db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
            };
        });
    }

    function saveEvents(events) {
        return openDatabase().then(db => {
            return new Promise((resolve, reject) => {
                let transaction = db.transaction(["events"], "readwrite");
                let store = transaction.objectStore("events");

                // Usuń wszystkie istniejące wydarzenia
                store.clear();

                // Dodaj nowe wydarzenia
                events.forEach(event => {
                    store.add({
                        title: event.title,
                        start: event.start ? event.start.toISOString() : null,
                        end: event.end ? event.end.toISOString() : null,
                        allDay: event.allDay
                    });
                });

                transaction.oncomplete = function() {
                    resolve();
                };

                transaction.onerror = function(event) {
                    reject("Błąd zapisu wydarzeń");
                };
            });
        });
    }

    function loadEvents(calendar) {
        return openDatabase().then(db => {
            return new Promise((resolve, reject) => {
                let transaction = db.transaction(["events"], "readonly");
                let store = transaction.objectStore("events");
                let request = store.getAll();

                request.onsuccess = function(event) {
                    let events = event.target.result;
                    events.forEach(eventData => {
                        calendar.addEvent({
                            title: eventData.title,
                            start: new Date(eventData.start),
                            end: eventData.end ? new Date(eventData.end) : null,
                            allDay: eventData.allDay
                        });
                    });
                    resolve();
                };

                request.onerror = function(event) {
                    reject("Błąd odczytu wydarzeń");
                };
            });
        });
    }

    function updateEventsList() {
        if (eventsListEl) {
            var events = calendar.getEvents();
            var html = '<h3>Lista wydarzeń:</h3><ul>';
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

    function debugEvents(events) {
    console.log("Wszystkie wydarzenia:");
    events.forEach((event, index) => {
        console.log(`Wydarzenie ${index + 1}:`, {
            title: event.title,
            start: event.start ? event.start.toISOString() : null,
            end: event.end ? event.end.toISOString() : null,
            allDay: event.allDay
        });
    });
}

    function debugCSVContent(csvContent) {
    const lines = csvContent.split('\n');
    console.log("Zawartość CSV:");
    lines.forEach((line, index) => {
        if (line.trim() !== '') {
            console.log(`Wiersz ${index + 1}:`, line);
        }
    });
}

    function exportEvents(events) {
    debugEvents(events);  // Pozostawiam tę linię, zakładając, że funkcja debugEvents jest zdefiniowana gdzie indziej

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tytuł,Data rozpoczęcia,Data zakończenia,Cały dzień\n";

    let exportedCount = 0;
    let skippedCount = 0;

    events.forEach(function (event, index) {
        try {
            let row = [
                event.title || 'Brak tytułu',
                event.start ? event.start.toISOString() : '',
                event.end ? event.end.toISOString() : '',
                event.allDay
            ].map(e => {
                // Escape special characters and wrap in quotes
                return `"${(e + '').replace(/"/g, '""')}"`;
            }).join(",");
            
            csvContent += row + "\n";
            exportedCount++;
        } catch (error) {
            console.error(`Błąd podczas eksportowania wydarzenia ${index + 1}:`, error);
            skippedCount++;
        }
    });

    if (exportedCount > 0) {
        try {
            var encodedUri = encodeURI(csvContent);
            var link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `rutyna_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert(`Eksport zakończony.\nWyeksportowano: ${exportedCount} wydarzeń.\nPominięto: ${skippedCount} wydarzeń.`);
        } catch (error) {
            console.error('Błąd podczas tworzenia pliku do pobrania:', error);
            alert('Wystąpił błąd podczas tworzenia pliku do pobrania.');
        }
    } else {
        alert('Brak wydarzeń do wyeksportowania.');
    }
}

    function importEvents(calendar) {
    var file = document.getElementById('importFile').files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var contents = e.target.result;
                var lines = contents.split("\n");
                lines.shift(); // Usuń nagłówek

                calendar.removeAllEvents(); // Usuń wszystkie istniejące wydarzenia

                var successfulImports = 0;
                var failedImports = 0;

                lines.forEach(function (line, index) {
                    if (line.trim() !== '') {
                        var parts = line.split(',').map(part => part.replace(/^"(.*)"$/, '$1').trim());
                        if (parts.length >= 4) {
                            try {
                                var event = {
                                    title: parts[0],
                                    start: parts[1] ? new Date(parts[1]) : null,
                                    end: parts[2] ? new Date(parts[2]) : null,
                                    allDay: parts[3].toLowerCase() === 'true'
                                };

                                if (event.start && !isNaN(event.start.getTime())) {
                                    calendar.addEvent(event);
                                    successfulImports++;
                                } else {
                                    console.warn(`Nieprawidłowa data rozpoczęcia w linii ${index + 2}`);
                                    failedImports++;
                                }
                            } catch (error) {
                                console.error(`Błąd podczas importowania wydarzenia z linii ${index + 2}:`, error);
                                failedImports++;
                            }
                        } else {
                            console.warn(`Nieprawidłowa liczba pól w linii ${index + 2}`);
                            failedImports++;
                        }
                    }
                });

                calendar.render();
                updateEventsList();
                saveEvents(calendar.getEvents()).then(() => {
                    alert(`Import zakończony.\nPomyślnie zaimportowano: ${successfulImports} wydarzeń.\nNie udało się zaimportować: ${failedImports} wydarzeń.`);
                }).catch(error => {
                    console.error("Błąd zapisu wydarzeń:", error);
                    alert('Wystąpił błąd podczas zapisu zaimportowanych wydarzeń.');
                });
            } catch (error) {
                console.error('Błąd podczas importowania:', error);
                alert('Wystąpił błąd podczas importowania. Sprawdź format pliku.');
            }
        };
        reader.onerror = function (error) {
            console.error('Błąd odczytu pliku:', error);
            alert('Wystąpił błąd podczas odczytu pliku.');
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        alert('Proszę wybrać plik do importu.');
    }
}
    
});