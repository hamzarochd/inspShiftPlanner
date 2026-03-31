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

            // Carica staffs con appointments espansi dall'OData backend
            fetch("/odata/v4/catalog/staffs?$expand=Appointments")
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

                    // KPI vanno calcolati dopo che il modello è pronto
                    this.countConsecutive(false);
                    this.updateUnderstaffing();
                    this.countNonroposoSettimanale(false);
                }.bind(this))
                .catch(function(oErr) {
                    sap.m.MessageToast.show("Errore caricamento dati: " + oErr.message);
                });



            const oKpiModel = new sap.ui.model.json.JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                //coverageMsg: "Caricamento dati...",
                todayCount: 0,
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false,
                ///warningIconSymbol: "\ue011"
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
            const oModel = this.getView().getModel("mockdata");
            
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


        onPressRischioSalute: function(oEvent) {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;
            
            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);


            this.countConsecutive(bNewActive);

            if (bNewActive) {
                sap.m.MessageToast.show('Evidenziazione rischio salute attiva');
            } else {
                sap.m.MessageToast.show('Evidenziazione rimossa');
            }
        },


        countConsecutive: function(bShouldHighlight) {

            ////// recuperare i modelli::::::
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


                if (oRow) {
                    oRow.destroySpecialDates();
                }

                const personalShifts = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type && shift.type !== "RIPOSO") {
                            const sDate = new Date(shift.startDate).toDateString();
                            personalShifts[sDate] = true;
                        }
                    });
                }


                ///// prendere tutti i giorni del mese
                for (let d = 1; d <= iDaysInMonth; d++) {
                    const oCurrentDate = new Date(iYear, iMonth, d);
                    const tempDate = oCurrentDate.toDateString();

                    //// se si (per almeno una volta)
                    if (personalShifts[tempDate]) {
                        iConsecutiveCounter++;
                    } else {
                        iConsecutiveCounter = 0; 
                    }

                    if (iConsecutiveCounter > limitDays) {
                        bPersonViolates = true;
                        

                        if (bShouldHighlight && oRow) {
                            oRow.addSpecialDate(new sap.ui.unified.DateTypeRange({
                                startDate: new Date(oCurrentDate),
                                type: "Type01"
                            }));
                        }
                    }
                }
                
                //!!!!!! per evidenziare la persona
                person.highlight = bShouldHighlight && bPersonViolates;

                if (bPersonViolates) {
                    iTotalViolatingPeople++;
                }
            });


            oModel.refresh(true);

            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
        },



/////////////// minimo una casella di riposo per ogni settimana!!!! 
//////---> verrà fuori il numero di personale che non soddisfa la condizone.

////// va nell  kpi/personaleSenzaMinimoRiposoCount ---> per default 0;

        onPressMancazaRiposso: function(oEvent) {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;
            
            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);
            
            const TotPersonale = this.countNonroposoSettimanale(bNewActive);

            
            //const sStatus = TotPersonale > 0 ? "Error" : "Success";
            //oKpiModel.setProperty("/restStatus", sStatus); 

            if (TotPersonale > 0) {
                MessageToast.show("Attenzione: " + TotPersonale + " dipendenti senza riposo settimanale.");
            } else {
                MessageToast.show("Tutto in regola: ogni dipendente ha almeno un riposo a settimana.");
            }
        },

       


        ////// la funzione da chiamare al interno di onPressMancanzaRiposo


        countNonroposoSettimanale: function(bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotViolazioni = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let bMancaRiposo = false;
                
                // Estrazione dei giorni di riposo
                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type === "EMERGENZA" && shift.startDate) { ///// emergenza --> per test
                            restDays[new Date(shift.startDate).toDateString()] = true;
                        }
                    });
                }

                // Trova il primo lunedì del mese per iniziare il conteggio delle settimane
                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    let oTempDate = new Date(iYear, iMonth, iStartDay);
                    if (oTempDate.getDay() === 1) break;
                    iStartDay++;
                }

                //////// Ciclo per ogni settimana intera del mese
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposatoInSettimana = false;

                    //////// Controlla i 7 giorni della settimana corrente
                    for (let d = 0; d < 7; d++) {
                        let currentCheckDate = new Date(iYear, iMonth, weekStart + d);
                        if (restDays[currentCheckDate.toDateString()]) {
                            bHaRiposatoInSettimana = true;
                            break; 
                        }
                    }

                    /////// persona no valida ---> almeno una settimana.
                    if (!bHaRiposatoInSettimana) {
                        bMancaRiposo = true;
                        break; 
                    }
                }

                //!!!!!!!Imposta highlight a true se richiesto e se c'è violazione
                person.highlight = bShouldHighlight && bMancaRiposo;

                if (bMancaRiposo) {
                    iTotViolazioni++;
                }
            });

            oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", iTotViolazioni);
            

            oModel.refresh(true);
            
            return iTotViolazioni;
        }


    });
});