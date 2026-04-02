sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageToast",
    "sap/ui/unified/DateTypeRange",
], (Controller, JSONModel, UI5Date, MessageToast, DateTypeRange) => {
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

            // ============================================================
            // [MOCKDATA] - Caricamento dati da file locale
            // Quando passi al DB: commenta questo blocco e decommenta il blocco [DB]
            // ============================================================
            /*
            const oModel = new JSONModel();
            oModel.loadData("model/mockdata.json").then(() => {
                const oData = oModel.getData();

                oData.startDate = toUI5Date(oData.startDate);
                oData.dipendenti.forEach((oMembro) => {
                    oMembro.shifts.forEach((oTurno) => {
                        oTurno.startDate = toUI5Date(oTurno.startDate);
                        oTurno.endDate   = toUI5Date(oTurno.endDate);
                    });
                });

                oModel.setData(oData);
                this.getView().setModel(oModel);

                this.updateUnderstaffing();
                this.countConsecutive(false);
                this.countNonroposoSettimanale(false);
            });
            */
            // ============================================================
            // [/MOCKDATA]
            // ============================================================

            // ============================================================
            // [DB] - Caricamento dati da OData backend
            // Quando torni a mockdata:
            //   1. Commenta questo blocco
            //   2. Decommenta il blocco [MOCKDATA] sopra
            // ============================================================
            fetch("/odata/V4/catalog/staffs?$expand=Appointments")
                .then(res => res.json())
                .then(function(oResponse) {
                    const aStaffs = oResponse.value || [];

                    const now = new Date();
                    const oData = {
                        startDate: UI5Date.getInstance(now.getFullYear(), now.getMonth(), 1),
                        dipendenti: aStaffs.map(function(oStaff) {
                            return {
                                name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                                role: oStaff.Role || "",
                                icon: oStaff.icon || "",
                                highlight: false,
                                shifts: (oStaff.Appointments || []).map(function(oAppt) {
                                    return {
                                        id:        oAppt.ID,
                                        startDate: toUI5Date(oAppt.startDate),
                                        endDate:   toUI5Date(oAppt.endDate),
                                        title:     oAppt.title || "",
                                        type:      oAppt.type  || "",
                                        shiftIcon: oAppt.shiftIcon || "",
                                        color:     oAppt.color || ""
                                    };
                                })
                            };
                        })
                    };

                    const oModel = new JSONModel(oData);
                    this.getView().setModel(oModel);

                    this.updateUnderstaffing();
                    this.countConsecutive(false);
                    this.countNonroposoSettimanale(false);
                }.bind(this))
                .catch(function(oErr) {
                    MessageToast.show("Errore caricamento dati: " + oErr.message);
                });
            // ============================================================
            // [/DB]
            // ============================================================


            const oKpiModel = new JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                todayCount: 0,
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");


            var oRuoliData = {
                "RuoliCollezione": [
                    { "key": "COORD", "text": "Coordinatore infermieristico" },
                    { "key": "INF",   "text": "Infermiere" },
                    { "key": "INF_TI","text": "Infermiere Terapia Intensiva" },
                    { "key": "OSS",   "text": "Operatore Socio Sanitario (OSS)" },
                    { "key": "AUS",   "text": "Ausiliario/Barelliere" },
                    { "key": "MED",   "text": "Medico" },
                    { "key": "CHIR",  "text": "Chirurgo" },
                    { "key": "ANES",  "text": "Anestesista" },
                    { "key": "SPEC",  "text": "Specializzando" },
                    { "key": "STRUM", "text": "Strumentista" },
                    { "key": "TEC",   "text": "Tecnico sanitario" },
                    { "key": "FISI",  "text": "Fisioterapista" },
                    { "key": "LOGO",  "text": "Logopedista" },
                    { "key": "SUP",   "text": "Supporto esterno" }
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
                ]
            };

            var oRuoliModel = new JSONModel(oRuoliData);
            this.getView().setModel(oRuoliModel, "ruoliModel");
        },


        // Recupera anno, mese e numero di giorni del mese visualizzato nel calendario
        GGMMAA: function() {
            const oCalendar = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();

            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            return { iYear, iMonth, iDaysInMonth };
        },


        // ----------------------------------------------------------------
        // FilterBar handlers
        // ----------------------------------------------------------------

        onSearch: function(oEvent) {
            // TODO: implementare filtro per ruolo/reparto sul PlanningCalendar
        },

        onResetFilters: function(oEvent) {
            this.byId("roleFilterCombo")?.setSelectedKey("");
            this.byId("repartoFilterCombo")?.setSelectedKey("");
        },


        switchAppointments: function(appointemnt1, appointment2) {
            // to do
        },

        overrideAppointments: function(appointemnt1, appointment2) {
            // to do
        },

        handleAppointmentDrop: function(oEvent) {
            const oAppointment  = oEvent.getParameter("appointment");
            const oNewStartDate = oEvent.getParameter("startDate");
            const oNewEndDate   = oEvent.getParameter("endDate");
            const oNewRow       = oEvent.getParameter("calendarRow");

            const sRowPath = oNewRow.getBindingContext().getPath();

            const aShifts = this.getView().getModel().getProperty(sRowPath + "/shifts");

            const sAppPath = oAppointment.getBindingContext().getPath();

            const aOtherShifts = aShifts.filter((oShift, iIndex) => {
                const sCurrentPath = sRowPath + "/shifts/" + iIndex;
                return sCurrentPath !== sAppPath;
            });

            const bOverlap = aOtherShifts.some((oShift) => {
                const oShiftStart = new Date(oShift.startDate);
                const oShiftEnd   = new Date(oShift.endDate);
                return (oNewStartDate < oShiftEnd) && (oNewEndDate > oShiftStart);
            });

            if (bOverlap) {
                MessageToast.show("Spostamento non consentito: si sovrappone ad un altro turno.");
                oEvent.preventDefault();
                return;
            }

            const oModel = this.getView().getModel();
            oModel.setProperty(sAppPath + "/startDate", oNewStartDate);
            oModel.setProperty(sAppPath + "/endDate", oNewEndDate);
            oModel.refresh(true);
        },

        // ----------------------------------------------------------------
        // KPI 1 - Mancanza personale
        // ----------------------------------------------------------------

        onPressMancanzaPersonale: function(oEvent) {
            const oKpiModel = this.getView().getModel("kpi");
            const oModel = this.getView().getModel();

            const bActive = oKpiModel?.getProperty("/showUnderstaffingHighlight") || false;
            oKpiModel?.setProperty("/showUnderstaffingHighlight", !bActive);
            oModel?.refresh(true);

            const calendar = this.byId("planningCalendar");

            if (!bActive) {
                this.updateUnderstaffing(true);
            } else {
                calendar?.removeAllSpecialDates();
                MessageToast.show("Evidenziazione rimossa");
            }
        },

        updateUnderstaffing: function(bUpdateCalendar) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const aStaff = oModel?.getProperty("/dipendenti") || [];
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            // ============================================================
            // [MOCKDATA] shift.type viene da mockdata.json (es. "RIPOSO")
            // [DB]       adatta il valore stringa al campo corrispondente nel tuo backend
            // ============================================================
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
                const oDate = new Date(iYear, iMonth, d);
                const isWeekend = (oDate.getDay() === 0 || oDate.getDay() === 6);
                const threshold = isWeekend ? 2 : 1;
                const count = staffCountByDate[oDate.toDateString()] || 0;

                if (count < threshold) {
                    iCriticalDays++;
                    if (bUpdateCalendar) {
                        oCalendar?.addSpecialDate(new DateTypeRange({
                            startDate: oDate
                        }));
                    }
                }
            }

            oKpiModel?.setProperty("/understaffedDays", iCriticalDays);
            oKpiModel?.setProperty("/criticalStatus", iCriticalDays > 0 ? "Critical" : "Success");

            if (bUpdateCalendar && iCriticalDays > 0) {
                MessageToast.show("Trovati " + iCriticalDays + " giorni sottorganico");
            }
        },


        // ----------------------------------------------------------------
        // KPI 2 - Rischio salute (giorni consecutivi)
        // ----------------------------------------------------------------

        onPressRischioSalute: function(oEvent) {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;

            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);
            this.countConsecutive(bNewActive);

            if (bNewActive) {
                MessageToast.show("Evidenziazione rischio salute attiva");
            } else {
                MessageToast.show("Evidenziazione rimossa");
            }
        },

        countConsecutive: function(bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const limitDays = 3;
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotalViolatingPeople = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];
            const aRows = oCalendar ? oCalendar.getRows() : [];

            aStaff.forEach((person, index) => {
                let iConsecutiveCounter = 0;
                let bPersonViolates = false;
                const oRow = aRows[index];

                if (oRow) oRow.destroySpecialDates();

                // ============================================================
                // [MOCKDATA] shift.type e shift.startDate vengono da mockdata.json
                // [DB]       adatta i nomi dei campi al tuo schema OData
                // ============================================================
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
                    const tempDate = oCurrentDate.toDateString();

                    if (personalShifts[tempDate]) {
                        iConsecutiveCounter++;
                    } else {
                        iConsecutiveCounter = 0;
                    }

                    if (iConsecutiveCounter > limitDays) {
                        bPersonViolates = true;

                        if (bShouldHighlight && oRow) {
                            oRow.addSpecialDate(new DateTypeRange({
                                startDate: new Date(oCurrentDate),
                                type: "Type01"
                            }));
                        }
                    }
                }

                person.highlight = bShouldHighlight && bPersonViolates;

                if (bPersonViolates) iTotalViolatingPeople++;
            });

            oModel.refresh(true);
            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
        },


        // ----------------------------------------------------------------
        // KPI 3 - Mancanza riposo settimanale
        // ----------------------------------------------------------------

        onPressMancazaRiposso: function(oEvent) {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;

            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);

            const TotPersonale = this.countNonroposoSettimanale(bNewActive);

            if (TotPersonale > 0) {
                MessageToast.show("Attenzione: " + TotPersonale + " dipendenti senza riposo settimanale.");
            } else {
                MessageToast.show("Tutto in regola: ogni dipendente ha almeno un riposo a settimana.");
            }
        },

        countNonroposoSettimanale: function(bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotViolazioni = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let bMancaRiposo = false;

                // ============================================================
                // [MOCKDATA] controlla shift.type === "RIPOSO" (valore in mockdata.json)
                // [DB]       sostituisci "RIPOSO" con il valore corrispondente nel tuo backend
                // ============================================================
                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type === "RIPOSO" && shift.startDate) {
                            restDays[new Date(shift.startDate).toDateString()] = true;
                        }
                    });
                }

                // Trova il primo lunedì del mese per iniziare il conteggio settimane
                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    let oTempDate = new Date(iYear, iMonth, iStartDay);
                    if (oTempDate.getDay() === 1) break;
                    iStartDay++;
                }

                // Ciclo per ogni settimana intera del mese
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposatoInSettimana = false;

                    for (let d = 0; d < 7; d++) {
                        let currentCheckDate = new Date(iYear, iMonth, weekStart + d);
                        if (restDays[currentCheckDate.toDateString()]) {
                            bHaRiposatoInSettimana = true;
                            break;
                        }
                    }

                    if (!bHaRiposatoInSettimana) {
                        bMancaRiposo = true;
                        break;
                    }
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
