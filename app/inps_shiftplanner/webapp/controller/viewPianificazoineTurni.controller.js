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

            const oODataModel = this.getOwnerComponent().getModel("odata");
            const oListBinding = oODataModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments,MemberOf"
            });

            oListBinding.requestContexts(0, 9999).then(function(aContexts) {
                const aStaffData = aContexts.map(oCtx => oCtx.getObject());

                const aDipendenti = aStaffData.map(function(oStaff) {
                    return {
                        name:       (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                        role:       oStaff.Role       || "",
                        department: oStaff.Department || "",
                        repartoKey: oStaff.RepartoKey || "",
                        icon:       oStaff.icon       || "",
                        highlight:  false,
                        teamName:   oStaff.MemberOf ? oStaff.MemberOf.Name : "no team",
                        teamID:     oStaff.MemberOf ? oStaff.MemberOf.ID   : null,
                        shifts: (oStaff.Appointments || []).map(function(oAppt) {
                            return {
                                id:        oAppt.ID,
                                startDate: toUI5Date(oAppt.startDate),
                                endDate:   toUI5Date(oAppt.endDate),
                                title:     oAppt.title    || "",
                                type:      oAppt.type     || "",
                                shiftIcon: oAppt.shiftIcon || "",
                                color:     oAppt.color    || ""
                            };
                        })
                    };
                });

                oViewModel.setData({
                    startDate:  UI5Date.getInstance(now.getFullYear(), now.getMonth(), 1),
                    dipendenti: aDipendenti
                });
                oViewModel.refresh(true);

                this.countConsecutive(false);
                this.updateUnderstaffing();
                this.countNonroposoSettimanale(false);

            }.bind(this))
            .catch(function(oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });


            // Modello KPI
            const oKpiModel = new JSONModel({
                understaffedDays:              0,
                criticalStatus:                "Neutral",
                todayCount:                    0,
                consecutiveCount:              0,
                personaleSenzaMinimoRiposoCount: 0,
                showConsecutiveHighlight:      false,
                showUnderstaffingHighlight:    false
            });
            this.getView().setModel(oKpiModel, "kpi");

            // Modello Ruoli e Dipartimenti
            const oRuoliData = {
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

            this.getView().setModel(new JSONModel(oRuoliData), "ruoliModel");
        },


        // ----------------------------------------------------------------
        // FilterBar handlers
        // ----------------------------------------------------------------

        onSearch: function() {
            const sRuoloKey   = this.byId("roleFilterCombo")?.getSelectedKey();
            const sRepartoKey = this.byId("repartoFilterCombo")?.getSelectedKey();

            const oCalendar = this.byId("planningCalendar");
            const oBinding  = oCalendar.getBinding("rows");
            const aFiltri   = [];

            if (sRuoloKey) {
                aFiltri.push(new Filter("role", FilterOperator.EQ, sRuoloKey));
            }
            if (sRepartoKey) {
                aFiltri.push(new Filter("repartoKey", FilterOperator.EQ, sRepartoKey));
            }

            if (oBinding) {
                oBinding.filter(aFiltri);
                MessageToast.show("Risultati aggiornati");
            }
        },

        onResetFilters: function() {
            this.byId("roleFilterCombo")?.setSelectedKey("");
            this.byId("repartoFilterCombo")?.setSelectedKey("");

            const oBinding = this.byId("planningCalendar").getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
            MessageToast.show("Filtri resettati");
        },


        // ----------------------------------------------------------------
        // Drag & Drop appointment
        // ----------------------------------------------------------------

        handleAppointmentDrop: function(oEvent) {
            const oAppointment  = oEvent.getParameter("appointment");
            const oNewStartDate = oEvent.getParameter("startDate");
            const oNewEndDate   = oEvent.getParameter("endDate");
            const oNewRow       = oEvent.getParameter("calendarRow");

            const oModel   = this.getView().getModel();
            const sRowPath = oNewRow.getBindingContext().getPath();
            const sAppPath = oAppointment.getBindingContext().getPath();
            const aShifts  = oModel.getProperty(sRowPath + "/shifts");

            // Escludo lo shift che sto spostando per non confrontarlo con se stesso
            const aOtherShifts = aShifts.filter((oShift, iIndex) => {
                const sCurrentPath = sRowPath + "/shifts/" + iIndex;
                return sCurrentPath !== sAppPath;
            });

            // Controllo sovrapposizione
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

            oModel.setProperty(sAppPath + "/startDate", oNewStartDate);
            oModel.setProperty(sAppPath + "/endDate", oNewEndDate);
            oModel.refresh(true);

            // Salva la modifica nel DB tramite PATCH
            const sAppId = oModel.getProperty(sAppPath + "/id");

            fetch("/odata/V4/catalog/appointments(" + sAppId + ")", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: oNewStartDate.toISOString(),
                    endDate:   oNewEndDate.toISOString()
                })
            })
            .then(res => {
                if (!res.ok) {
                    MessageToast.show("Errore salvataggio turno.");
                }
            })
            .catch(() => {
                MessageToast.show("Errore di rete durante il salvataggio.");
            });
        },


        // ----------------------------------------------------------------
        // Recupera anno, mese e numero di giorni del mese visualizzato nel calendario
        // ----------------------------------------------------------------

        GGMMAA: function() {
            const oCalendar  = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();

            const iYear       = oStartDate.getFullYear();
            const iMonth      = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            return { iYear, iMonth, iDaysInMonth };
        },


        // ----------------------------------------------------------------
        // KPI 1 - Mancanza personale
        // ----------------------------------------------------------------

        onPressMancanzaPersonale: function() {
            const oKpiModel = this.getView().getModel("kpi");
            const oModel    = this.getView().getModel();

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
            const oModel    = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const aStaff = oModel?.getProperty("/dipendenti") || [];
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
                const oDate    = new Date(iYear, iMonth, d);
                const isWeekend = (oDate.getDay() === 0 || oDate.getDay() === 6);
                const threshold = isWeekend ? 3 : 5;
                const count    = staffCountByDate[oDate.toDateString()] || 0;

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

        onPressRischioSalute: function() {
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
                            personalShifts[new Date(shift.startDate).toDateString()] = true;
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
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
        },


        // ----------------------------------------------------------------
        // KPI 3 - Mancanza riposo settimanale
        // ----------------------------------------------------------------

        onPressMancazaRiposso: function() {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;

            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);

            const iTotPersonale = this.countNonroposoSettimanale(bNewActive);

            if (iTotPersonale > 0) {
                MessageToast.show("Attenzione: " + iTotPersonale + " dipendenti senza riposo settimanale.");
            } else {
                MessageToast.show("Tutto in regola: ogni dipendente ha almeno un riposo a settimana.");
            }
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
                        if (s.type === "RIPOSO" && s.startDate) {
                            restDays[new Date(s.startDate).toDateString()] = true;
                        }
                    });
                }

                // Trova il primo lunedì del mese per iniziare il conteggio settimane
                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    if (new Date(iYear, iMonth, iStartDay).getDay() === 1) break;
                    iStartDay++;
                }

                // Ciclo per ogni settimana intera del mese
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposatoInSettimana = false;

                    for (let d = 0; d < 7; d++) {
                        const oCheckDate = new Date(iYear, iMonth, weekStart + d);
                        if (restDays[oCheckDate.toDateString()]) {
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
