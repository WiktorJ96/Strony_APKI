var storagePrefix = 'suple_';

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
    var eventArray = events.map(function (event) {
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
    var savedEvents = localStorage.getItem(storagePrefix + 'calendarEvents');
    if (savedEvents) {
        var eventArray = JSON.parse(savedEvents);
        eventArray.forEach(function (eventData) {
            calendar.addEvent(eventData);
        });
    }
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

                function exportEvents(events) {
                    let csvContent = "data:text/csv;charset=utf-8,";
                    csvContent += "Tytuł,Data rozpoczęcia,Data zakończenia,Cały dzień\n";

                    events.forEach(function (event) {
                        let row = [
                            event.title,
                            event.start.toISOString(),
                            event.end ? event.end.toISOString() : '',
                            event.allDay
                        ].join(",");
                        csvContent += row + "\n";
                    });

                    var encodedUri = encodeURI(csvContent);
                    var link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", storagePrefix + "suplementacja.csv");
                    document.body.appendChild(link);
                    link.click();
                }

                function importEvents(calendar) {
                    var file = document.getElementById('importFile').files[0];
                    if (file) {
                        var reader = new FileReader();
                        reader.onload = function (e) {
                            var contents = e.target.result;
                            var lines = contents.split("\n");
                            lines.shift(); // Usuń nagłówek

                            lines.forEach(function (line) {
                                if (line.trim() !== '') {
                                    var parts = line.split(',');
                                    calendar.addEvent({
                                        title: parts[0],
                                        start: new Date(parts[1]),
                                        end: parts[2] ? new Date(parts[2]) : null,
                                        allDay: parts[3] === 'true'
                                    });
                                }
                            });

                            calendar.render();
                            updateEventsList();
                            saveEvents(calendar.getEvents());
                        };
                        reader.readAsText(file);
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
};

request.onupgradeneeded = (event) => {
  db = event.target.result;
  const objectStore = db.createObjectStore("orders", { keyPath: "id" });
};

function saveOrder(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["orders"], "readwrite");
    const objectStore = transaction.objectStore("orders");
    const request = objectStore.put({ id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold });
    request.onerror = (event) => {
      reject("Błąd zapisu: " + event.target.error);
    };
    request.onsuccess = (event) => {
      resolve("Zapisano pomyślnie");
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
  let infoElement = $(`button[data-id="${id}"]`).siblings('.order-info');
  if (infoElement.length === 0) {
    infoElement = $('<span class="order-info"></span>').insertAfter(`button[data-id="${id}"]`);
  }
  const daysSupply = Math.floor(quantity / dailyDosage);
  const nextOrderDate = new Date(orderDate);
  nextOrderDate.setDate(nextOrderDate.getDate() + daysSupply - reorderThreshold);
  const today = new Date();
  const daysLeft = Math.ceil((nextOrderDate - today) / (1000 * 60 * 60 * 24));

  infoElement.text(`Zamówiono: ${quantity} szt. ${new Date(orderDate).toLocaleDateString()} | Następne: ${nextOrderDate.toLocaleDateString()} | Pozostało: ${daysLeft} dni`);
}

function loadAllSupplements() {
  const transaction = db.transaction(["orders"], "readonly");
  const objectStore = transaction.objectStore("orders");
  const request = objectStore.openCursor();

  request.onsuccess = (event) => {
    const cursor = event.target.result;
    if (cursor) {
      updateSupplementInfo(
        cursor.value.id,
        cursor.value.supplementName, 
        cursor.value.quantity, 
        cursor.value.orderDate, 
        cursor.value.dailyDosage, 
        cursor.value.reorderThreshold
      );
      cursor.continue();
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

$(document).ready(function() {
  $('.edit-btn').on('click', function() {
    var id = $(this).data('id');
    var supplementName = $(this).data('supplement');
    $('#supplementName').val(supplementName);
    $('#editModalLabel').text('Edytuj zamówienie: ' + supplementName);
    
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

  $('#saveChanges').on('click', function() {
    var id = $('.edit-btn.active').data('id');
    var supplementName = $('#supplementName').val();
    var quantity = $('#quantity').val();
    var orderDate = $('#orderDate').val();
    var dailyDosage = $('#dailyDosage').val();
    var reorderThreshold = $('#reorderThreshold').val();
    
    saveOrder(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold).then(() => {
      console.log('Zapisano:', id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold);
      updateSupplementInfo(id, supplementName, quantity, orderDate, dailyDosage, reorderThreshold);
      $('#editModal').modal('hide');
    }).catch(error => {
      console.error("Błąd podczas zapisywania:", error);
      alert("Wystąpił błąd podczas zapisywania danych. Spróbuj ponownie.");
    });
  });
});