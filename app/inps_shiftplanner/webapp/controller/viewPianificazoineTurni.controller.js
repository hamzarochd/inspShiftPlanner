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
                this.countConsecutive();
                this.updateUnderstaffing();
                this.countMissingWeeklyRest();

            });

            const oKpiModel = new sap.ui.model.json.JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                //coverageMsg: "Caricamento dati...",
                todayCount: 0,
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
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
                    if (appointment.type && appointment.type !== "riposo") { 
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

        countConsecutive: function() {

            ///// recuperiamo i modelli::::
            const oModel = this.getView().getModel(); 
            const oKpiModel = this.getView().getModel("kpi");
            ///const oCalendar = this.byId("planningCalendar");

            ///if (!oCalendar) return;

            const limitDays = 3; 
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();
            
            ////total personale
            let iTotalViolatingPeople = 0; 

            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let iConsecutiveCounter = 0; 
                let bPersonViolates = false;

                const personalShifts = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        ////// consideriamo tutti gli eventi tranne i vuoti e i riposi
                        if (shift.type && shift.type !== "RIPOSO") {
                            const sDate = shift.startDate.toDateString();
                            personalShifts[sDate] = true;
                        }
                    });
                }

                //// prendiamo tutto il mesi --> tutti i giorni.
                for (let d = 1; d <= iDaysInMonth; d++) {
                    const tempDate = new Date(iYear, iMonth, d).toDateString();

                    if (personalShifts[tempDate]) {
                        iConsecutiveCounter++;
                    } else {
                        iConsecutiveCounter = 0; ////// ha trovaro un riposo/un giorno senza evento.
                    }

                    if (iConsecutiveCounter > limitDays) { //// se supera il limite per una volta ---> diventa true
                        bPersonViolates = true;
                        break;  ////// vogliamo sapere solo si/no di questa persona
                    }
                }
                
                //// se si (per almeno una volta)
                if (bPersonViolates) {
                    iTotalViolatingPeople++;  ////+1
                    ////console.log(`${person.name} superato i giorni limiti!!!!`);
                }
            });

            //////// update kpi
            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
            
        },


/////////////// minimo una casella di riposo per ogni settimana!!!! 
//////---> verrà fuori il numero di personale che non soddisfa la condizone.

////// va nell  kpi/personaleSenzaMinimoRiposoCount ---> per default 0;
/*
onPressMancazaRiposso: function(oEvent) {
    const oModel = this.getView().getModel(); 
    const oKpiModel = this.getView().getModel("kpi");
    const aStaff = oModel.getProperty("/dipendenti") || []; // 统一路径

    let iViolatingPeopleCount = 0; // 违规的人数
    const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

    aStaff.forEach(person => {
        let bHasRestThisWeek = false; 
        let bPersonIsViolating = false; // 员工违规标记

        // 提取该员工所有的 RIPOSO 日期
        const restDays = {};
        if (person.shifts) {
            person.shifts.forEach(shift => {
                if (shift.type === "RIPOSO" && shift.startDate) {
                    const sDate = shift.startDate.toDateString();
                    restDays[sDate] = true;
                }
            });
        }

        // 按日扫描，周结算
        for (let d = 1; d <= iDaysInMonth; d++) {
            const oDate = new Date(iYear, iMonth, d);
            const sDateStr = oDate.toDateString();

            if (restDays[sDateStr]) {
                bHasRestThisWeek = true;
            }

            // 结算点：周日 (0) 或 月末
            if (oDate.getDay() === 0 || d === iDaysInMonth) {
                if (!bHasRestThisWeek) {
                    bPersonIsViolating = true; // 这一周没休，整个人标记违规
                    // 已经确定违规了，可以直接跳出日期循环提高效率
                    break; 
                }
                bHasRestThisWeek = false; // 开启下一周检测
            }
        }

        // 如果该员工被标记为违规，总人数加 1
        if (bPersonIsViolating) {
            iViolatingPeopleCount++;
        }
    });

    // 更新模型中的人数属性
    oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", iViolatingPeopleCount);
    sap.m.MessageToast.show("Persone non a norma: " + iViolatingPeopleCount);
    console.log("每周一休违规总人数:", iViolatingPeopleCount);
},*/


        countMissingWeeklyRest: function() {

            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let TotPersonale = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let PersonaRiposato = false;
                
                /////// prendere i riposi al interno di unasettimana intera
                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type === "EMERGENZA" && shift.startDate) {
                            restDays[shift.startDate.toDateString()] = true;
                        }
                    });
                }

                /////// trova il primo lunedì ----> se il mese non inizia col lunedì --->per non creare pb
                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    let oTempDate = new Date(iYear, iMonth, iStartDay);
                    if (oTempDate.getDay() === 1) { // 1 --> lunedi
                        break;
                    }
                    iStartDay++;
                }

                ///////// un ciclo di 7 giorni!!!! 
                // iStartDay + 6 ---> domanica della settimana
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let SiRiposoWeek = false;

                    ////// controlliamo se ci sono giorni di riposo in questa settimana
                    for (let d = 0; d < 7; d++) {
                        let currentCheckDate = new Date(iYear, iMonth, weekStart + d);
                        if (restDays[currentCheckDate.toDateString()]) {
                            SiRiposoWeek = true;
                            break; 
                        }
                    }

                    ///// se true --> non riposo in una intera settimana
                    if (!SiRiposoWeek) {
                        PersonaRiposato = true;
                        break; ///// ci interessa si / no della persona --> una volta soddisfata --> usciamo dal ciclo
                    }
                }

                if (PersonaRiposato) {
                    TotPersonale++;
                }
            });


            oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", TotPersonale);
            //return TotPersonale;
        },


    });
});