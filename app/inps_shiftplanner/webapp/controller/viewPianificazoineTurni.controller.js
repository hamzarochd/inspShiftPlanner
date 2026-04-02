sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageToast",
    "sap/ui/unified/DateTypeRange",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, JSONModel, UI5Date, MessageToast, DateTypeRange, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.viewPianificazoineTurni", {

        onInit() {

            // Converte stringhe ISO in UI5Date usando componenti locali
            // per evitare problemi di timezone (es. data spostata di un giorno)
            function toUI5Date(sISO) {
                const d = new Date(sISO);
                return UI5Date.getInstance(
                    d.getFullYear(), d.getMonth(), d.getDate(),
                    d.getHours(), d.getMinutes()
                );
            }

            // Setto subito il JSONModel vuoto sulla view — così il PlanningCalendar
            // si lega ad esso immediatamente e si aggiorna quando arrivano i dati
            const now = new Date();
            const oViewModel = new JSONModel({
                startDate: UI5Date.getInstance(now.getFullYear(), now.getMonth(), 1),
                dipendenti: []
            });
            this.getView().setModel(oViewModel);

            const oKpiModel = new JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
                todayCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");

            // Modello Dipartimenti e Ruoli
            var setRuoli = {
                "RuoliCollezione": [
                    { "key": "COORD",  "text": "Coordinatore infermieristico" },
                    { "key": "INF",    "text": "Infermiere" },
                    { "key": "INF_TI", "text": "Infermiere Terapia Intensiva" },
                    { "key": "OSS",    "text": "Operatore Socio Sanitario (OSS)" },
                    { "key": "AUS",    "text": "Ausiliario/Barelliere" },
                    { "key": "MED",    "text": "Medico" },
                    { "key": "CHIR",   "text": "Chirurgo" },
                    { "key": "ANES",   "text": "Anestesista" },
                    { "key": "SPEC",   "text": "Specializzando" },
                    { "key": "STRUM",  "text": "Strumentista" },
                    { "key": "TEC",    "text": "Tecnico sanitario" },
                    { "key": "FISI",   "text": "Fisioterapista" },
                    { "key": "LOGO",   "text": "Logopedista" },
                    { "key": "SUP",    "text": "Supporto esterno" }
                ],
                "Reparti": [
                    { "key": "PS",    "text": "Pronto Soccorso" },
                    { "key": "TI",    "text": "Terapia Intensiva" },
                    { "key": "MED",   "text": "Medicina Generale" },
                    { "key": "CHIR",  "text": "Chirurgia" },
                    { "key": "SO",    "text": "Sala Operatoria" },
                    { "key": "RAD",   "text": "Radiologia" },
                    { "key": "LAB",   "text": "Laboratorio Analisi" },
                    { "key": "RIAB",  "text": "Riabilitazione" },
                    { "key": "AMB",   "text": "Ambulatorio" },
                    { "key": "DIR",   "text": "Direzione Sanitaria" },
                    { "key": "CARD",  "text": "Cardiologia" },
                    { "key": "ORT",   "text": "Ortopedia" },
                    { "key": "PED",   "text": "Pediatria" },
                    { "key": "GINE",  "text": "Ginecologia" },
                    { "key": "NEURO", "text": "Neurologia" },
                    { "key": "ONCO",  "text": "Oncologia" },
                    { "key": "URO",   "text": "Urologia" },
                    { "key": "PSI",   "text": "Psichiatria" },
                    { "key": "DERM",  "text": "Dermatologia" }
                ],
                "Dipartimenti": [
                    {
                        "Dipartimento": "Emergenza-Urgenza e Area Critica",
                        "reparti": [
                            { "key": "PS",  "text": "Pronto Soccorso e OBI" },
                            { "key": "TI",  "text": "Terapia Intensiva e Rianimazione" },
                            { "key": "118", "text": "Centrale Operativa 118" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Chirurgia",
                        "reparti": [
                            { "key": "CHIR", "text": "Chirurgia Generale" },
                            { "key": "SO",   "text": "Blocco Operatorio" },
                            { "key": "URO",  "text": "Urologia" },
                            { "key": "ORT",  "text": "Ortopedia e Traumatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Medicina Specialistica",
                        "reparti": [
                            { "key": "MED",   "text": "Medicina Interna" },
                            { "key": "CARD",  "text": "Cardiologia e UTIC" },
                            { "key": "NEURO", "text": "Neurologia" },
                            { "key": "ONCO",  "text": "Oncologia Medica" },
                            { "key": "DERM",  "text": "Dermatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento Materno-Infantile",
                        "reparti": [
                            { "key": "PED",  "text": "Pediatria e Neonatologia" },
                            { "key": "GINE", "text": "Ostetricia e Ginecologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Servizi Diagnostici e Riabilitazione",
                        "reparti": [
                            { "key": "RAD",  "text": "Radiologia e Imaging" },
                            { "key": "LAB",  "text": "Laboratorio Analisi" },
                            { "key": "RIAB", "text": "Medicina Riabilitativa" },
                            { "key": "AMB",  "text": "Poliambulatorio" }
                        ]
                    },
                    {
                        "Dipartimento": "Salute Mentale e Direzione",
                        "reparti": [
                            { "key": "PSI", "text": "Psichiatria (SPDC)" },
                            { "key": "DIR", "text": "Direzione Sanitaria" }
                        ]
                    }
                ]
            };
            this.getView().setModel(new JSONModel(setRuoli), "ruoliModel");

            const oODataModel = this.getOwnerComponent().getModel("odata");
            const oListBinding = oODataModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments"
            });

            oListBinding.requestContexts(0, 9999).then(function(aContexts) {

                const aStaffData = aContexts.map(oCtx => oCtx.getObject());
                const nowInner = new Date();

                const aDipendenti = aStaffData.map(function(oStaff) {
                    return {
                        name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                        role: oStaff.Role || "",
                        department: oStaff.Department || "",
                        repartoKey: oStaff.RepartoKey || "",
                        icon: oStaff.icon || "",
                        highlight: false,
                        teamName: oStaff.MemberOf ? oStaff.MemberOf.Name : "no team",
                        teamID: oStaff.MemberOf ? oStaff.MemberOf.ID : null,
                        shifts: (oStaff.Appointments || []).map(function(oAppt) {
                            return {
                                id: oAppt.ID,
                                startDate: toUI5Date(oAppt.startDate),
                                endDate: toUI5Date(oAppt.endDate),
                                title: oAppt.title || "",
                                type: oAppt.type || "",
                                shiftIcon: oAppt.shiftIcon || "",
                                color: oAppt.color || ""
                            };
                        })
                    };
                });

                // Usa setData sull'istanza esistente — non creare un nuovo JSONModel
                // altrimenti il PlanningCalendar perde il binding
                oViewModel.setData({
                    startDate: UI5Date.getInstance(nowInner.getFullYear(), nowInner.getMonth(), 1),
                    dipendenti: aDipendenti
                });
                oViewModel.refresh(true);

                // Calcolo KPI iniziali
                this.countConsecutive(false);
                this.updateUnderstaffing();
                this.countNonroposoSettimanale(false);

            }.bind(this)).catch(function(oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });
        },

        // Drag & drop: sposta l'appointment e salva su DB via PATCH
        handleAppointmentDrop: function(oEvent) {
            const oAppointment  = oEvent.getParameter("appointment");
            const oStartDate    = oEvent.getParameter("startDate");
            const oEndDate      = oEvent.getParameter("endDate");
            const oCalendarRow  = oEvent.getParameter("calendarRow");

            const oModel        = this.getView().getModel();
            const aDipendenti   = oModel.getProperty("/dipendenti");

            // Trova la riga di destinazione (indice nel PlanningCalendar)
            const oCalendar     = this.byId("planningCalendar");
            const aRows         = oCalendar.getRows();
            const iTargetIndex  = aRows.indexOf(oCalendarRow);

            if (iTargetIndex === -1) return;

            const oTargetPerson = aDipendenti[iTargetIndex];
            const aTargetShifts = oTargetPerson.shifts;

            // Prende l'id dell'appointment dal binding context
            const oCtx      = oAppointment.getBindingContext();
            const sApptId   = oCtx.getProperty("id");

            // Calcola la durata originale e i nuovi estremi
            const oOldStart = oCtx.getProperty("startDate");
            const oOldEnd   = oCtx.getProperty("endDate");
            const iDuration = oOldEnd.getTime() - oOldStart.getTime();
            const oNewEnd   = new Date(oStartDate.getTime() + iDuration);

            // Controlla sovrapposizioni con gli altri turni della riga di destinazione
            const bOverlap = aTargetShifts.some(function(oShift) {
                if (oShift.id === sApptId) return false; // salta se stesso
                return oStartDate < oShift.endDate && oNewEnd > oShift.startDate;
            });

            if (bOverlap) {
                MessageToast.show("Sovrapposizione rilevata: turno non spostato");
                oModel.refresh(true);
                return;
            }

            // Aggiorna il modello locale
            const iShiftIndex = aTargetShifts.findIndex(oShift => oShift.id === sApptId);
            if (iShiftIndex !== -1) {
                oModel.setProperty(
                    "/dipendenti/" + iTargetIndex + "/shifts/" + iShiftIndex + "/startDate",
                    oStartDate
                );
                oModel.setProperty(
                    "/dipendenti/" + iTargetIndex + "/shifts/" + iShiftIndex + "/endDate",
                    oNewEnd
                );
            }

            // Salva su DB via PATCH
            if (sApptId) {
                fetch("/odata/V4/catalog/appointments(" + sApptId + ")", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        startDate: oStartDate.toISOString(),
                        endDate: new Date(oNewEnd).toISOString()
                    })
                }).then(function(oRes) {
                    if (!oRes.ok) throw new Error("PATCH fallito: " + oRes.status);
                    MessageToast.show("Turno aggiornato");
                }).catch(function(oErr) {
                    MessageToast.show("Errore salvataggio: " + oErr.message);
                });
            } else {
                MessageToast.show("Turno spostato (solo in locale)");
            }
        },

        onSearch: function() {
            const sRuoloChiave    = this.byId("roleFilterCombo").getSelectedKey();
            const sDipartimento   = this.byId("Dipartimenti").getSelectedKey();
            const sRepartoChiave  = this.byId("repartoFilterCombo").getSelectedKey();

            const oCalendar = this.byId("planningCalendar");
            const oBinding  = oCalendar.getBinding("rows");
            const aFiltri   = [];

            if (sRuoloChiave) {
                aFiltri.push(new Filter("role", FilterOperator.EQ, sRuoloChiave));
            }
            if (sDipartimento) {
                aFiltri.push(new Filter("department", FilterOperator.EQ, sDipartimento));
            }
            if (sRepartoChiave) {
                aFiltri.push(new Filter("repartoKey", FilterOperator.EQ, sRepartoChiave));
            }

            if (oBinding) {
                oBinding.filter(aFiltri);
                MessageToast.show("Risultati aggiornati");
            }
        },

        onResetFilters: function() {
            this.byId("roleFilterCombo").setSelectedKey("");
            this.byId("Dipartimenti").setSelectedKey("");
            this.byId("repartoFilterCombo").setSelectedKey("");

            const oBinding = this.byId("planningCalendar").getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
            MessageToast.show("Filtri resettati");
        },

        GGMMAA: function() {
            const oCalendar     = this.byId("planningCalendar");
            const oStartDate    = oCalendar?.getStartDate() || new Date();
            const iYear         = oStartDate.getFullYear();
            const iMonth        = oStartDate.getMonth();
            const iDaysInMonth  = new Date(iYear, iMonth + 1, 0).getDate();
            return { iYear, iMonth, iDaysInMonth };
        },

        updateUnderstaffing: function(bUpdateCalendar) {
            const oModel    = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");
            const aStaff    = oModel?.getProperty("/dipendenti") || [];
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            const staffCountByDate = {};
            aStaff.forEach(person => {
                person.shifts?.forEach(appointment => {
                    if (appointment.type && appointment.type !== "RIPOSO") {
                        const sDate = new Date(appointment.startDate).toDateString();
                        staffCountByDate[sDate] = (staffCountByDate[sDate] || 0) + 1;
                    }
                });
            });

            let iCriticalDays = 0;
            if (bUpdateCalendar) oCalendar?.removeAllSpecialDates();

            for (let d = 1; d <= iDaysInMonth; d++) {
                const oDate     = new Date(iYear, iMonth, d);
                const isWeekend = (oDate.getDay() === 0 || oDate.getDay() === 6);
                const threshold = isWeekend ? 3 : 5;
                const count     = staffCountByDate[oDate.toDateString()] || 0;

                if (count < threshold) {
                    iCriticalDays++;
                    if (bUpdateCalendar) {
                        oCalendar?.addSpecialDate(new DateTypeRange({ startDate: oDate }));
                    }
                }
            }

            oKpiModel?.setProperty("/understaffedDays", iCriticalDays);
            oKpiModel?.setProperty("/criticalStatus", iCriticalDays > 0 ? "Critical" : "Success");
        },

        onPressMancanzaPersonale: function() {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive   = oKpiModel.getProperty("/showUnderstaffingHighlight");
            oKpiModel.setProperty("/showUnderstaffingHighlight", !bActive);

            const oCalendar = this.byId("planningCalendar");
            if (!bActive) {
                this.updateUnderstaffing(true);
            } else {
                oCalendar?.removeAllSpecialDates();
                MessageToast.show("Evidenziazione rimossa");
            }
        },

        onPressRischioSalute: function() {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive   = !oKpiModel.getProperty("/showConsecutiveHighlight");
            oKpiModel.setProperty("/showConsecutiveHighlight", bActive);
            this.countConsecutive(bActive);
            MessageToast.show(bActive ? "Rischio salute attivo" : "Evidenziazione rimossa");
        },

        countConsecutive: function(bShouldHighlight) {
            const oModel    = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");
            const limitDays = 3;
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotalViolatingPeople = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];
            const aRows  = oCalendar ? oCalendar.getRows() : [];

            aStaff.forEach((person, index) => {
                let iConsecutiveCounter = 0;
                let bPersonViolates     = false;
                const oRow = aRows[index];

                if (oRow) oRow.destroySpecialDates();

                const personalShifts = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type && shift.type !== "RIPOSO") {
                            const sDate = new Date(shift.startDate).toDateString();
                            personalShifts[sDate] = true;
                        }
                    });
                }

                for (let d = 1; d <= iDaysInMonth; d++) {
                    const oCurrentDate = new Date(iYear, iMonth, d);
                    if (personalShifts[oCurrentDate.toDateString()]) {
                        iConsecutiveCounter++;
                    } else {
                        iConsecutiveCounter = 0;
                    }

                    if (iConsecutiveCounter > limitDays) {
                        bPersonViolates = true;
                        if (bShouldHighlight && oRow) {
                            oRow.addSpecialDate(new DateTypeRange({
                                startDate: new Date(oCurrentDate),
                                type: "NonWorking"
                            }));
                        }
                    }
                }

                person.highlight = bShouldHighlight && bPersonViolates;
                if (bPersonViolates) iTotalViolatingPeople++;
            });

            oModel.refresh(true);
            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
        },

        onPressMancazaRiposso: function() {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive   = !oKpiModel.getProperty("/showConsecutiveHighlight");
            oKpiModel.setProperty("/showConsecutiveHighlight", bActive);
            const count = this.countNonroposoSettimanale(bActive);
            MessageToast.show(count > 0 ? "Staff senza riposo: " + count : "Tutto in regola");
        },

        countNonroposoSettimanale: function(bShouldHighlight) {
            const oModel    = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotViolazioni = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let bMancaRiposo = false;
                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(s => {
                        if (s.type === "RIPOSO") restDays[new Date(s.startDate).toDateString()] = true;
                    });
                }

                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    let oTempDate = new Date(iYear, iMonth, iStartDay);
                    if (oTempDate.getDay() === 1) break;
                    iStartDay++;
                }

                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposato = false;
                    for (let d = 0; d < 7; d++) {
                        if (restDays[new Date(iYear, iMonth, weekStart + d).toDateString()]) {
                            bHaRiposato = true;
                            break;
                        }
                    }
                    if (!bHaRiposato) { bMancaRiposo = true; break; }
                }

                person.highlight = bShouldHighlight && bMancaRiposo;
                if (bMancaRiposo) iTotViolazioni++;
            });

            oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", iTotViolazioni);
            oModel.refresh(true);
            return iTotViolazioni;
        }
    });
});
