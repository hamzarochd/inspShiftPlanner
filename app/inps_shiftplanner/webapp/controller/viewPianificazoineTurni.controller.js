sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.viewPianificazoineTurni", {
        onInit() {
            // Carichiamo dati da un file JSON
            const oModel = new JSONModel();
            oModel.loadData("model/mockdata.json").then(() => {
                // Una volta caricati i dati, aggiorniamo il modello
                oModel.refresh();
            });
            
            // Lo settiamo come modello della view
            this.getView().setModel(oModel, "mockdata");

            const oKpiModel = new sap.ui.model.json.JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                coverageMsg: "Caricamento dati...",
                todayCount: 0,
                consecutiveCount: 0,
                ///showConsecutiveHighlight: false,
                /////showUnderstaffingHighlight: false
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

    // Creiamo il modello JSON
    // var oModel = new sap.ui.model.json.JSONModel(oData);
    
    // Assegniamo il modello alla vista con un nome (opzionale ma consigliato)
    this.getView().setModel(oModel, "ruoliModel");
        }
    });
});