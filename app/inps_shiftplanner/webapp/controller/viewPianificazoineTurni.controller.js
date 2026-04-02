sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/unified/DateTypeRange",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, JSONModel, MessageToast, DateTypeRange, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.viewPianificazoineTurni", {
        
        onInit() {
            const oModel = this.getOwnerComponent().getModel();
            const oListBinding = oModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments,MemberOf"  ///// segue la struttura della tabella staffs
            });

            oListBinding.requestContexts().then(function (aContexts) {
                const aStaffData = aContexts.map(oCtx => oCtx.getObject());
                const now = new Date();
                
                const oData = {
                    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
                    staffs: aStaffData.map(function (oStaff) {
                        return {
                            name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                            role: oStaff.Role || "",
                            // Aggiungiamo i campi per i filtri (mappali con i nomi corretti del tuo DB)
                            department: oStaff.Department || "", 
                            repartoKey: oStaff.RepartoKey || "",
                            icon: oStaff.icon || "",
                            highlight: false,
                            teamName: oStaff.MemberOf ? oStaff.MemberOf.Name : "no team",
                            teamID: oStaff.MemberOf ? oStaff.MemberOf.ID : null,

                            //// appuntamenti.:::
                            shifts: (oStaff.Appointments || []).map(function (oAppt) {
                                return {
                                    startDate: new Date(oAppt.startDate),
                                    endDate: new Date(oAppt.endDate),
                                    title: oAppt.title || "",
                                    type: oAppt.type || "",
                                    shiftIcon: oAppt.shiftIcon || "",
                                    color: oAppt.color || ""
                                };
                            })
                        };
                    })
                };

                const oViewModel = new JSONModel(oData);
                this.getView().setModel(oViewModel);

                // Calcolo KPI iniziali
                this.countConsecutive(false);
                this.updateUnderstaffing();
                this.countNonroposoSettimanale(false);

            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });

            // Modello KPI
            const oKpiModel = new JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");

            // Modello Dipartimenti e Ruoli
            var setRuoli = {
                "RuoliCollezione": [
                    { "key": "COORD", "text": "Coordinatore infermieristico" },
                    { "key": "INF", "text": "Infermiere" },
                    { "key": "INF_TI", "text": "Infermiere Terapia Intensiva" },
                    { "key": "OSS", "text": "Operatore Socio Sanitario (OSS)" },
                    { "key": "AUS", "text": "Ausiliario/Barelliere" },
                    { "key": "MED", "text": "Medico" },
                    { "key": "CHIR", "text": "Chirurgo" },
                    { "key": "ANES", "text": "Anestesista" },
                    { "key": "SPEC", "text": "Specializzando" },
                    { "key": "STRUM", "text": "Strumentista" },
                    { "key": "TEC", "text": "Tecnico sanitario" },
                    { "key": "FISI", "text": "Fisioterapista" },
                    { "key": "LOGO", "text": "Logopedista" },
                    { "key": "SUP", "text": "Supporto esterno" }
                ],
                "Dipartimenti": [
                    {
                        "Dipartimento": "Emergenza-Urgenza e Area Critica",
                        "reparti": [
                            { "key": "PS", "text": "Pronto Soccorso e OBI" },
                            { "key": "TI", "text": "Terapia Intensiva e Rianimazione" },
                            { "key": "118", "text": "Centrale Operativa 118" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Chirurgia",
                        "reparti": [
                            { "key": "CHIR", "text": "Chirurgia Generale" },
                            { "key": "SO", "text": "Blocco Operatorio" },
                            { "key": "URO", "text": "Urologia" },
                            { "key": "ORT", "text": "Ortopedia e Traumatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Medicina Specialistica",
                        "reparti": [
                            { "key": "MED", "text": "Medicina Interna" },
                            { "key": "CARD", "text": "Cardiologia e UTIC" },
                            { "key": "NEURO", "text": "Neurologia" },
                            { "key": "ONCO", "text": "Oncologia Medica" },
                            { "key": "DERM", "text": "Dermatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento Materno-Infantile",
                        "reparti": [
                            { "key": "PED", "text": "Pediatria e Neonatologia" },
                            { "key": "GINE", "text": "Ostetricia e Ginecologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Servizi Diagnostici e Riabilitazione",
                        "reparti": [
                            { "key": "RAD", "text": "Radiologia e Imaging" },
                            { "key": "LAB", "text": "Laboratorio Analisi" },
                            { "key": "RIAB", "text": "Medicina Riabilitativa" },
                            { "key": "AMB", "text": "Poliambulatorio" }
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
        },
        //Funzione per cercare
        onSearch: function () {
            const RuoloChiave = this.byId("roleFilterCombo").getSelectedKey();
            const GruppoChiave = this.byId("groupFilterCombo").getSelectedKey();
            const RepartoChiave = this.byId("repartoFilterCombo").getSelectedKey();

            const oCalendar = this.byId("planningCalendar");
            const oBinding = oCalendar.getBinding("rows");
            const aFiltri = [];

            if (RuoloChiave) {
                aFiltri.push(new Filter("role", FilterOperator.EQ, RuoloChiave));
            }
            if (GruppoChiave) {
                aFiltri.push(new Filter("department", FilterOperator.EQ, GruppoChiave));
            }
            if (RepartoChiave) {
                aFiltri.push(new Filter("repartoKey", FilterOperator.EQ, RepartoChiave));
            }

            if (oBinding) {
                oBinding.filter(aFiltri);
                MessageToast.show("Risultati aggiornati");
            }
        },
        //filtro reset
        onResetFilters: function () {
            this.byId("roleFilterCombo").setSelectedKey("");
            this.byId("groupFilterCombo").setSelectedKey("");
            this.byId("repartoFilterCombo").setSelectedKey("");

            const oBinding = this.byId("planningCalendar").getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
            MessageToast.show("Filtri resettati");
        },

        GGMMAA: function () {
            const oCalendar = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();
            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();
            return { iYear, iMonth, iDaysInMonth };
        },

        updateUnderstaffing: function (bUpdateCalendar) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");
            const aStaff = oModel?.getProperty("/staffs") || [];
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
                const oDate = new Date(iYear, iMonth, d);
                const isWeekend = (oDate.getDay() === 0 || oDate.getDay() === 6);
                const threshold = isWeekend ? 3 : 5;
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
        },

        onPressMancanzaPersonale: function () {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive = oKpiModel.getProperty("/showUnderstaffingHighlight");
            oKpiModel.setProperty("/showUnderstaffingHighlight", !bActive);

            const calendar = this.byId("planningCalendar");
            if (!bActive) {
                this.updateUnderstaffing(true);
            } else {
                calendar?.removeAllSpecialDates();
                MessageToast.show("Evidenziazione rimossa");
            }
        },

        onPressRischioSalute: function () {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive = !oKpiModel.getProperty("/showConsecutiveHighlight");
            oKpiModel.setProperty("/showConsecutiveHighlight", bActive);
            this.countConsecutive(bActive);
            MessageToast.show(bActive ? 'Rischio salute attivo' : 'Evidenziazione rimossa');
        },

        countConsecutive: function (bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");
            const limitDays = 3;
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotalViolatingPeople = 0;
            const aStaff = oModel.getProperty("/staffs") || [];
            const aRows = oCalendar ? oCalendar.getRows() : [];

            aStaff.forEach((person, index) => {
                let iConsecutiveCounter = 0;
                let bPersonViolates = false;
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
        },

        onPressMancazaRiposso: function () {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive = !oKpiModel.getProperty("/showConsecutiveHighlight");
            oKpiModel.setProperty("/showConsecutiveHighlight", bActive);
            const count = this.countNonroposoSettimanale(bActive);
            MessageToast.show(count > 0 ? "Staff senza riposo: " + count : "Tutto in regola");
        },

        countNonroposoSettimanale: function (bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();
            let iTotViolazioni = 0;
            const aStaff = oModel.getProperty("/staffs") || [];

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
                    if (new Date(iYear, iMonth, iStartDay).getDay() === 1) break;
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