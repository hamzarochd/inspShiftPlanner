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
            // ---- MOCKDATA DA FILE (commentato temporaneamente per debug) ----
            // const oModel = new JSONModel();
            // oModel.loadData("model/mockdata.json").then(() => {
            //     const oMockData = oModel.getData();
            //     oMockData.startDate = UI5Date.getInstance(oMockData.startDate);
            //     oMockData.dipendenti.forEach(function(oMembro) {
            //         oMembro.shifts.forEach(function(oTurno) {
            //             oTurno.startDate = UI5Date.getInstance(oTurno.startDate);
            //             oTurno.endDate   = UI5Date.getInstance(oTurno.endDate);
            //         });
            //     });
            //     oModel.setData(oMockData);
            //     this.getView().setModel(oModel, "mockdata");
            // });
            // ---- FINE MOCKDATA DA FILE ----

            // Dati inline generati direttamente (come il sample ufficiale SAP)
            // setData + setModel sincroni: la view trova il modello già pronto
            const oModel = new JSONModel();
            oModel.setData({
                startDate: UI5Date.getInstance(2026, 2, 1),
                dipendenti: [
                    {
                        name: "Marco Rossi",
                        role: "Infermiere",
                        icon: "sap-icon://employee",
                        shifts: [
                            {
                                startDate: UI5Date.getInstance(2026, 2, 3, 0, 0),
                                endDate:   UI5Date.getInstance(2026, 2, 3, 23, 59),
                                title: "Turno mattina",
                                text: "Reparto cardiologia",
                                type: "Type02",
                                shiftIcon: "sap-icon://stethoscope"
                            },
                            {
                                startDate: UI5Date.getInstance(2026, 2, 5, 0, 0),
                                endDate:   UI5Date.getInstance(2026, 2, 5, 23, 59),
                                title: "Turno pomeriggio",
                                text: "Pronto soccorso",
                                type: "Type07",
                                shiftIcon: "sap-icon://activity-2"
                            }
                        ]
                    },
                    {
                        name: "Laura Bianchi",
                        role: "Coordinatore",
                        icon: "sap-icon://manager",
                        shifts: [
                            {
                                startDate: UI5Date.getInstance(2026, 2, 3, 0, 0),
                                endDate:   UI5Date.getInstance(2026, 2, 3, 23, 59),
                                title: "Coordinamento reparto",
                                text: "Pianificazione turni settimanali",
                                type: "Type01",
                                shiftIcon: "sap-icon://action-settings"
                            }
                        ]
                    }
                ]
            });
            // Modello default (senza nome) come nel sample SAP — necessario perché
            // i binding relativi nelle aggregazioni annidate ereditino il modello correttamente
            this.getView().setModel(oModel);

            const oKpiModel = new sap.ui.model.json.JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                coverageMsg: "Caricamento dati...",
                todayCount: 0,
                consecutiveCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");

            var oData = {
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
                "Reparti": [
                    { "key": "PS", "text": "Pronto Soccorso" },
                    { "key": "TI", "text": "Terapia Intensiva" },
                    { "key": "MED", "text": "Medicina Generale" },
                    { "key": "CHIR", "text": "Chirurgia" },
                    { "key": "SO", "text": "Sala Operatoria" },
                    { "key": "RAD", "text": "Radiologia" },
                    { "key": "LAB", "text": "Laboratorio Analisi" },
                    { "key": "RIAB", "text": "Riabilitazione" },
                    { "key": "AMB", "text": "Ambulatorio" },
                    { "key": "DIR", "text": "Direzione Sanitaria" },
                    { "key": "CARD", "text": "Cardiologia" },
                    { "key": "ORT", "text": "Ortopedia" },
                    { "key": "PED", "text": "Pediatria" },
                    { "key": "GINE", "text": "Ginecologia" },
                    { "key": "NEURO", "text": "Neurologia" },
                    { "key": "ONCO", "text": "Oncologia" },
                    { "key": "URO", "text": "Urologia" },
                    { "key": "PSI", "text": "Psichiatria" },
                    { "key": "DERM", "text": "Dermatologia" }
                ]
            };

            // -------------------------------------------------------
            // Creiamo un modello JSON separato per ruoli e reparti,
            // usando l'oggetto oData definito sopra.
            // NOTA: oModel è già usato per mockdata, quindi ne creiamo uno nuovo.
            var oRuoliModel = new JSONModel(oData);

            // Assegniamo il modello ruoli/reparti alla vista
            this.getView().setModel(oRuoliModel, "ruoliModel");

            this.updateUnderstaffing();
            // -------------------------------------------------------
        },


        //////// per mancanza personale, deve controllare tutti i giorni per vedere se ci sono abbasanta personale. 
        kpiCountDay: function(oEvent){
            //////const sHeader = oEvent.getSource().getHeader();
            const oKpiModel = this.getView().getModel("kpi");
            ///const oModel = this.getView().getModel("mockdata");
            
            const bActive = oKpiModel?.getProperty("/showUnderstaffingHighlight") || false;
            oKpiModel?.setProperty("/showUnderstaffingHighlight", !bActive);

            ///// prendere il calendario.

            const calendar = this.byId("planningCalendar")

            if (!bActive){
                this.updateUnderstaffing(true); 
            } else {
                calendar?.removeAllSpecialDates();
                sap.m.MessageToast.show("Evidenziazione rimossa");
                }
            },

        /////// funzione da chiamare all'interno di kpiCountDay-

        updateUnderstaffing: function(bUpdateCalendar) { //// true oppure false
            const oModel = this.getView().getModel("mockdata");
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");
            
            const aStaff = oModel?.getProperty("/Staff") || [];
            ///console.log(aStaff);


            const oStartDate = oCalendar?.getStartDate() || new Date();
            const iYear = oStartDate.getFullYear(), iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            const staffCountByDate = {};
            aStaff.forEach(person => {
                person.appointments?.forEach(appointment => {
                    if (appointment.type && appointment.type !== "OFF") {
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
                const threshold = isWeekend ? 2 : 3;
                const count = staffCountByDate[oDate.toDateString()] || 0;

                if (count < threshold) {
                    iCriticalDays++;
                    if (bUpdateCalendar) {
                        oCalendar?.addSpecialDate(new sap.ui.unified.DateTypeRange({
                            startDate: oDate
                        }));
                    }
                }
            }

            oKpiModel?.setProperty("/understaffedDays", iCriticalDays);
            oKpiModel?.setProperty("/criticalStatus", iCriticalDays > 0 ? "Critical" : "Success");
            
            if (bUpdateCalendar && iCriticalDays > 0) {
                sap.m.MessageToast.show("Trovati " + iCriticalDays + " giorni sottorganico");
            }
        }

        

    });
});