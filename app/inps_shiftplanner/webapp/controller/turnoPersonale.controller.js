sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "inpsshiftplanner/model/formatter"
], function (Controller, History,formatter) {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.turnoPersonale", {

        // FORMATTER: Traduce il testo del DB (Mattina, ecc.) in colori SAPUI5
        formatType: function (sType) {
            if (!sType) return "Type09";
            switch (sType) {
                case "Mattina":
                    return "Type06"; // Verde
                case "Pomeriggio":
                    return "Type05"; // Giallo/Arancio
                case "Notte":
                    return "Type01"; // Blu/Rosso
                default:
                    return "Type09"; // Grigio
            }
        },

        onInit: function () {
            // 1. ID univoco di Marco Bianchi
            var sIdUtente = "f61c6a39-4ef8-498b-8445-909e4571ff13"; 

            // 2. Otteniamo la vista
            var oView = this.getView();

            // 3. Eseguiamo il binding dell'elemento con espansione degli appuntamenti
            oView.bindElement({
                path: "odata>/staffs(" + sIdUtente + ")",
                parameters: {
                    "$expand": "Appointments"
                },
                events: {
                    dataRequested: function () {
                        oView.setBusy(true);
                    },
                    dataReceived: function (oEvent) {
                        oView.setBusy(false);
                        console.log("Dati di Marco caricati con successo");
                    }
                }
            });
        },

        /**
         * Funzione per tornare alla schermata precedente
         */
        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        }
    });
});