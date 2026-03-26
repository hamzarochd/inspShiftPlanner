sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.turnoPersonale", {

        onInit: function () {
            console.log("Controller turnoPersonale caricato");
        },

        onPress: function () {
            MessageToast.show("Bottone cliccato 👍");
        }

    });
});