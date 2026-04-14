sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/date/UI5Date",
    "inpsshiftplanner/model/formatter"
], function (Controller, History, JSONModel, UI5Date, formatter) {
    "use strict";

    // Stessa logica di viewPianificazoineTurni: legge i componenti ISO direttamente
    // evitando la conversione UTC→locale di new Date() che sposta i turni di un giorno
    function toUI5Date(sISO) {
        if (!sISO) return null;
        const m = sISO.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!m) return null;
        return UI5Date.getInstance(
            parseInt(m[1]),
            parseInt(m[2]) - 1,
            parseInt(m[3]),
            parseInt(m[4]),
            parseInt(m[5])
        );
    }

    return Controller.extend("inpsshiftplanner.controller.turnoPersonale", {

        formatType: function (sType) {
            if (!sType) return "Type09";
            switch (sType) {
                case "Mattina":      return "Type06";
                case "Pomeriggio":   return "Type05";
                case "Notte":        return "Type01";
                default:             return "Type09";
            }
        },

        onInit: function () {
            var sIdUtente = "f61c6a39-4ef8-498b-8445-909e4571ff13";
            var oView = this.getView();

            // Modello locale per gli appointment con date già convertite
            var oApptModel = new JSONModel({ items: [] });
            oView.setModel(oApptModel, "appointments");

            // bindElement per i dati anagrafici del dipendente (Name, Surname, Role...)
            oView.bindElement({
                path: "odata>/staffs(" + sIdUtente + ")",
                parameters: { "$expand": "Appointments" },
                events: {
                    dataRequested: function () { oView.setBusy(true); },
                    dataReceived: function () { oView.setBusy(false); }
                }
            });

            // Fetch separato degli appointment con conversione date timezone-safe
            fetch("/odata/V4/catalog/appointments?$filter=ID_Utente eq '" + sIdUtente + "'")
                .then(function (oRes) {
                    if (!oRes.ok) throw new Error("Fetch fallito: " + oRes.status);
                    return oRes.json();
                })
                .then(function (oData) {
                    var aItems = (oData.value || []).map(function (oAppt) {
                        return {
                            id: oAppt.ID,
                            title: oAppt.title || "",
                            notes: oAppt.notes || "",
                            shiftIcon: oAppt.shiftIcon || "",
                            type: oAppt.type || "",
                            color: oAppt.color || "",
                            startDate: toUI5Date(oAppt.startDate),
                            endDate: toUI5Date(oAppt.endDate)
                        };
                    });
                    oApptModel.setProperty("/items", aItems);
                })
                .catch(function (oErr) {
                    console.error("Errore caricamento appointment:", oErr.message);
                });
        },

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
