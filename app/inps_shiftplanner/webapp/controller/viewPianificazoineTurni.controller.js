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
            // Carica i dati da mockdata.json, converte le date e setta il modello default.
            // Il modello va settato senza nome (default) perché i binding relativi
            // nelle aggregazioni annidate (appointments) lo ereditino correttamente.
            const oModel = new JSONModel();
            oModel.loadData("model/mockdata.json").then(() => {
                const oData = oModel.getData();

                // Converte le stringhe ISO in UI5Date usando i componenti locali
                // per evitare problemi di timezone (es. data spostata di un giorno)
                function toUI5Date(sISO) {
                    const d = new Date(sISO);
                    return UI5Date.getInstance(
                        d.getFullYear(), d.getMonth(), d.getDate(),
                        d.getHours(), d.getMinutes()
                    );
                }

                oData.startDate = toUI5Date(oData.startDate);
                oData.dipendenti.forEach(function(oMembro) {
                    oMembro.shifts.forEach(function(oTurno) {
                        oTurno.startDate = toUI5Date(oTurno.startDate);
                        oTurno.endDate   = toUI5Date(oTurno.endDate);
                    });
                });

                oModel.setData(oData);
                this.getView().setModel(oModel);

                // updateUnderstaffing va chiamato dopo che il modello è pronto
                this.updateUnderstaffing();
            });

            const oKpiModel = new sap.ui.model.json.JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                //coverageMsg: "Caricamento dati...",
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
            // -------------------------------------------------------
        },


        //////// per mancanza personale, deve controllare tutti i giorni per vedere se ci sono abbasanta personale. 
        onPressMancanzaPersonale: function(oEvent){
            //////const sHeader = oEvent.getSource().getHeader();
            const oKpiModel = this.getView().getModel("kpi");
            ///const oModel = this.getView().getModel("mockdata");
            
            const bActive = oKpiModel?.getProperty("/showUnderstaffingHighlight") || false;
            oKpiModel?.setProperty("/showUnderstaffingHighlight", !bActive);
            oModel?.refresh(true);

            ///// prendere il calendario.

            const calendar = this.byId("planningCalendar")

            if (!bActive){
                this.updateUnderstaffing(true); 
            } else {
                calendar?.removeAllSpecialDates();
                MessageToast.show("Evidenziazione rimossa");
                }
            },


//// definisco una funzione che recupera l'anno, il mese ed quanti giorni in quel mese:::.

        GGMMAA: function(){
            const oCalendar = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();

            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            return {iYear,iMonth,iDaysInMonth};
        },

        /////// funzione da chiamare all'interno di kpiCountDay-


        updateUnderstaffing: function(bUpdateCalendar) { //// true oppure false
            const oModel = this.getView().getModel(); // modello default (no nome)
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const aStaff = oModel?.getProperty("/dipendenti") || [];

            /*const oStartDate = oCalendar?.getStartDate() || new Date();
            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();*/

            const {iYear,iMonth,iDaysInMonth} = this.GGMMAA();

            const staffCountByDate = {};
            aStaff.forEach(person => {
                person.shifts?.forEach(appointment => {
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
                const threshold = isWeekend ? 2 : 1; //////// min 2 per il weekend, min 1 durante i giorni lavorativi.
                const count = staffCountByDate[oDate.toDateString()] || 0;

                if (count < threshold) {
                    iCriticalDays++;
                    if (bUpdateCalendar) { ///// perché adesso il showUnderstaffingHighlight risulta true.
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

        ////////// per tile Rischio salute:::
        /////// non più di 6 giorni consecutivi.

        onPressRischioSalute: function(oEvent){
            // recuperiamo il modello:::
            const oModel = this.getView().getModel(); 
            const oKpiModel = this.getView().getModel("kpi");

            ////////
            const bActive = oKpiModel?.getProperty("/showConsecutiveHighlight") || false;
            oKpiModel?.setProperty("/showConsecutiveHighlight", !bActive);
            oModel?.refresh(true);


            ///// segue la logica simile.:::
            if (!bActive){
                this.countConsecutive(true);
            } else {
                MessageToast.show('Rischio salute rimossa')
            }

        },

        ////// da chiamare al interno di onPressRischioSalute --> per contare i giorni consicutivi 

        countConsecutive: function(){
            const oModel = this.getView().getModel(); 
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            if(!oCalendar){
                return;
            }

            const limitDat = 6; //// massimo 6 giorni consecutivi.

            const {iYear,iMonth,iDaysInMonth} = this.GGMMAA();
             
            let consecutCount = 0; //// per default

            ////// array degli staff
            const aStaff = oModel.getProperty("/Staff") || [];


            aStaff.forEach(staff => {
                let singleConsCount = 0;

                const personalShifts = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.shiftCode && shift.shiftCode !== "OFF") {
                            const sDate = new Date(shift.start).toDateString();
                            personalShifts[sDate] = true;
                        }
                    });
                }

                for (let d = 1; d <= iDaysInMonth; d++) {
                    const tempDate = new Date(iYear, iMonth, d).toDateString();

                    if (personalShifts[tempDate]) {

                        singleConsCount++;
                    } else {
                        singleConsCount = 0;
                    }


                    if (singleConsCount > limitDat) {
                        consecutCount++;
                    }
                }
            });
            

            oKpiModel.setProperty("/consecutiveCount", consecutCount);
            oKpiModel.setProperty("/consecutiveStatus", consecutCount > 0 ? "Warning" : "Success");
            oKpiModel.setProperty("/consecutiveMsg", consecutCount > 0 ? consecutCount + " Turni a Rischio" : "Riposo Garantito");

        },


/////// 



    });
});