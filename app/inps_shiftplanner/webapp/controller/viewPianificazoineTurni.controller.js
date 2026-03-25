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
        }
    });
});