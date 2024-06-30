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
                    localStorage.setItem('calendarEvents', JSON.stringify(eventArray));
                }

                function loadEvents(calendar) {
                    var savedEvents = localStorage.getItem('calendarEvents');
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
                    link.setAttribute("download", "rutyna.csv");
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