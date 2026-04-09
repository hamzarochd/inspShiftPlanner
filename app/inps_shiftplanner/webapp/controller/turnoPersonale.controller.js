sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History"
], function (Controller, History) {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.turnoPersonale", {

        onInit: function () {
            // Binding per caricare Marco Bianchi
            var sIdUtente = "f61c6a39-4ef8-498b-8445-909e4571ff13"; 
            this.getView().bindElement({
                path: "/staffs(" + sIdUtente + ")",
                parameters: { expand: "Appointments" }
            });
        },

        // FUNZIONE PER TORNARE INDIETRO
        onNavBack: function () {
    this.getOwnerComponent().getRouter().navTo("RouteMain");
}
    }); 
}); 