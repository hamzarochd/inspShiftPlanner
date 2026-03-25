sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.viewPianificazoineTurni", {
        onInit() {

            const oKpiModel = new JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                coverageMsg: "Caricamento dati...",
                todayCount: 0,
                consecutiveCount: 0,
                ///showConsecutiveHighlight: false,
                /////showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");

        }
    });
});