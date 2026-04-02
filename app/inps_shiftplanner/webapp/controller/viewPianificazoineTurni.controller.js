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

            const oModel = this.getOwnerComponent().getModel();              
            const oListBinding = oModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments"  ///// segue la struttura della tabella staffs
            });

            
            oListBinding.requestContexts(0, Infinity).then(function (aContexts) {

                console.log("Contesti ricevuti:", aContexts.length);
                const aStaffData = aContexts.map(oCtx => oCtx.getObject());
                console.log("Staff data:", JSON.stringify(aStaffData));

                const now = new Date();
                const oData = {

                    startDate: UI5Date.getInstance(now.getFullYear(), now.getMonth(), 1),
                    
                    dipendenti: aStaffData.map(function (oStaff) {
                        return {///// sistemare i dati da stampare...
                            name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                            role: oStaff.Role || "",
                            icon: oStaff.icon || "",
                            highlight: false,
                            //// appuntamenti.:::
                            shifts: (oStaff.Appointments || []).map(function (oAppt) {
                                return {
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


                const oViewModel = new JSONModel(oData);
                this.getView().setModel(oViewModel);

                ////// i valori di KPI vanno calcolati dopo che il modello è pronto
                this.countConsecutive(false);
                this.updateUnderstaffing();
                this.countNonroposoSettimanale(false);
                
            }.bind(this))
            .catch(function(oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });



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



            var setRuoli = {
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

            // -------------------------------------------------------
            // Creiamo un modello JSON separato per ruoli e reparti,
            // usando l'oggetto oData definito sopra.
            // NOTA: oModel è già usato per mockdata, quindi ne creiamo uno nuovo.
            var oRuoliModel = new JSONModel(setRuoli);

            // Assegniamo il modello ruoli/reparti alla vista
            this.getView().setModel(oRuoliModel, "ruoliModel");
            // -------------------------------------------------------
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

        //////// per mancanza personale, deve controllare tutti i giorni per vedere se ci sono abbasanta personale.
        onPressMancanzaPersonale: function(){
            //////const sHeader = oEvent.getSource().getHeader();
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

            /*const oStartDate = oCalendar?.getStartDate() || new Date();
            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();*/

            const {iYear,iMonth,iDaysInMonth} = this.GGMMAA();

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
                const threshold = isWeekend ? 3 : 5; //////// per test: min 2 per il weekend, min 3 durante i giorni lavorativi.
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
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const limitDays = 3;
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();
            

            /// tot count
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
                                    if (iConsecutiveCounter === limitDays + 1) {
                                        for (let back = 0; back < limitDays; back++) {
                                            const oBackDate = new Date(iYear, iMonth, d - (limitDays - back));
                                            oRow.addSpecialDate(new sap.ui.unified.DateTypeRange({
                                                startDate: oBackDate,
                                                type: "NonWorking" 
                                            }));
                                        }
                                    }


                                    oRow.addSpecialDate(new sap.ui.unified.DateTypeRange({
                                        startDate: new Date(oCurrentDate),
                                        type: "NonWorking" 
                                    }));
                                }
                            }
                        }
                
                //!!!!!! per evidenziare la persona
                person.highlight = bShouldHighlight && bPersonViolates;

                if (bPersonViolates) iTotalViolatingPeople++;
            });

            

            oModel.refresh(true);
            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
        },


/////////////// minimo una casella di riposo per ogni settimana!!!! 
//////---> verrà fuori il numero di personale che non soddisfa la condizone.

////// va nell  kpi/personaleSenzaMinimoRiposoCount ---> per default 0;

        onPressMancazaRiposso: function() {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;

            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);

            const TotPersonale = this.countNonroposoSettimanale(bNewActive);

            if (TotPersonale > 0) {
                MessageToast.show("Attenzione: " + TotPersonale + " staffs senza riposo settimanale.");
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
                        if (shift.type === "RIPOSO" && shift.startDate) { ///// emergenza --> per test
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
